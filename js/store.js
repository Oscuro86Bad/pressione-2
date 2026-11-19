/* ============================================================
   PRESSIONE 2.0 — archivio locale
   I dati vivono in localStorage; se c'è un account collegato
   vengono anche sincronizzati su Supabase (vedi cloud.js).
   ============================================================ */
window.DP = window.DP || {};

DP.Store = (function () {
  const listeners = [];
  let state = null;
  let memory = {};
  let storageAvailable = true;
  let lastSaveError = '';
  let loaded = false;

  function nowIso() {
    return new Date().toISOString();
  }

  function defaultState() {
    const now = nowIso();
    return {
      version: 2,
      onboarded: false,
      profile: {
        name: '',
        target: { sys: DP.CONFIG.target.sys, dia: DP.CONFIG.target.dia },
        limits: {
          sysLow: DP.CONFIG.limits.sysLow,
          diaLow: DP.CONFIG.limits.diaLow,
          pulseLow: DP.CONFIG.limits.pulseLow,
          pulseHigh: DP.CONFIG.limits.pulseHigh
        },
        createdAt: now,
        updatedAt: now,
        dirty: true
      },
      readings: [],
      sync: {
        accountId: null,
        lastSyncAt: null
      },
      settings: {
        autoSync: true,
        periodDays: 30,
        showTips: true
      }
    };
  }

  function storageGet(key) {
    try { return window.localStorage.getItem(key); }
    catch (e) { return memory[key] !== undefined ? memory[key] : null; }
  }

  function storageSet(key, value) {
    try {
      window.localStorage.setItem(key, value);
      return true;
    } catch (e) {
      memory[key] = value;
      storageAvailable = false;
      return false;
    }
  }

  function storageRemove(key) {
    try { window.localStorage.removeItem(key); }
    catch (e) { delete memory[key]; }
  }

  function testStorage() {
    try {
      const k = '__dp2_test__';
      window.localStorage.setItem(k, '1');
      window.localStorage.removeItem(k);
      return true;
    } catch (e) {
      return false;
    }
  }

  function dedupe(list) {
    const map = {};
    (list || []).forEach(function (r) {
      if (!r) return;
      const cur = map[r.id];
      if (!cur) { map[r.id] = r; return; }
      const curTime = new Date(cur.updatedAt).getTime() || 0;
      const newTime = new Date(r.updatedAt).getTime() || 0;
      if (newTime >= curTime) map[r.id] = r;
    });
    return DP.Stats.sortDesc(Object.keys(map).map(function (k) { return map[k]; }));
  }

  function sanitize(raw) {
    const out = defaultState();
    if (!DP.isObj(raw)) return out;

    out.version = 2;
    out.onboarded = !!raw.onboarded;

    const p = DP.isObj(raw.profile) ? raw.profile : {};
    out.profile.name = String(p.name || '').trim().slice(0, 60);
    if (out.profile.name) out.onboarded = true;

    const t = DP.isObj(p.target) ? p.target : {};
    const sysT = DP.toInt(t.sys, DP.CONFIG.target.sys);
    const diaT = DP.toInt(t.dia, DP.CONFIG.target.dia);
    if (sysT >= 80 && sysT <= 250 && diaT >= 40 && diaT <= 150 && sysT > diaT) {
      out.profile.target = { sys: sysT, dia: diaT };
    }

    const l = DP.isObj(p.limits) ? p.limits : {};
    out.profile.limits = {
      sysLow: DP.toInt(l.sysLow, DP.CONFIG.limits.sysLow),
      diaLow: DP.toInt(l.diaLow, DP.CONFIG.limits.diaLow),
      pulseLow: DP.toInt(l.pulseLow, DP.CONFIG.limits.pulseLow),
      pulseHigh: DP.toInt(l.pulseHigh, DP.CONFIG.limits.pulseHigh)
    };
    out.profile.createdAt = p.createdAt || out.profile.createdAt;
    out.profile.updatedAt = p.updatedAt || out.profile.updatedAt;
    out.profile.dirty = p.dirty !== false;

    const rawReadings = Array.isArray(raw.readings) ? raw.readings :
      (Array.isArray(raw.misurazioni) ? fromAndroid(raw.misurazioni) : []);
    out.readings = dedupe(rawReadings.map(function (r) {
      return DP.Stats.normalizeReading(r);
    }).filter(Boolean));

    if (DP.isObj(raw.sync)) {
      out.sync.accountId = raw.sync.accountId || null;
      out.sync.lastSyncAt = raw.sync.lastSyncAt || null;
    }
    if (DP.isObj(raw.settings)) {
      out.settings.autoSync = raw.settings.autoSync !== false;
      out.settings.periodDays = DP.toInt(raw.settings.periodDays, 30);
      out.settings.showTips = raw.settings.showTips !== false;
    }

    return out;
  }

  function fromAndroid(list) {
    return DP.Stats.fromAndroidBackup({ misurazioni: list }).readings;
  }

  function load() {
    storageAvailable = testStorage();
    const raw = storageGet(DP.CONFIG.storageKey);
    if (!raw) {
      state = defaultState();
      loaded = true;
      return state;
    }
    try {
      state = sanitize(JSON.parse(raw));
    } catch (e) {
      // Conserva una copia del dato illeggibile prima di ripartire.
      try { storageSet(DP.CONFIG.storageKey + '_corrupt_' + Date.now(), raw); } catch (err) { /* ignore */ }
      state = defaultState();
      lastSaveError = 'I dati salvati erano illeggibili: è stata creata una copia di sicurezza e il diario è ripartito vuoto.';
    }
    loaded = true;
    return state;
  }

  function pruneOldTombstones(list) {
    const cutoff = Date.now() - 365 * 86400000;
    return list.filter(function (r) {
      if (!r.deleted) return true;
      const t = new Date(r.updatedAt).getTime();
      return !t || t >= cutoff;
    });
  }

  function save() {
    if (!state) return false;
    let json;
    try { json = JSON.stringify(state); }
    catch (e) { lastSaveError = 'Impossibile preparare i dati per il salvataggio.'; return false; }

    if (!storageSet(DP.CONFIG.storageKey, json)) {
      // Prova a liberare spazio eliminando le vecchie cancellazioni.
      state.readings = pruneOldTombstones(state.readings);
      try {
        if (storageSet(DP.CONFIG.storageKey, JSON.stringify(state))) {
          lastSaveError = '';
          return true;
        }
      } catch (e) { /* ignore */ }
      lastSaveError = 'Memoria del dispositivo piena: esporta un backup e libera spazio.';
      return false;
    }
    lastSaveError = '';
    return true;
  }

  function notify(action) {
    listeners.forEach(function (fn) {
      try { fn(state, action); } catch (e) { console.error(e); }
    });
  }

  function commit(action) {
    save();
    notify(action);
  }

  function get() {
    if (!state) load();
    return state;
  }

  function init() {
    if (loaded) return state;
    return load();
  }

  function subscribe(fn) {
    if (typeof fn !== 'function') return function () {};
    listeners.push(fn);
    return function () {
      const i = listeners.indexOf(fn);
      if (i >= 0) listeners.splice(i, 1);
    };
  }

  function setOnboarded(name) {
    const s = get();
    const clean = String(name || '').trim().slice(0, 60);
    if (clean) s.profile.name = clean;
    s.onboarded = true;
    s.profile.updatedAt = nowIso();
    s.profile.dirty = true;
    commit('onboarding');
    return s;
  }

  function updateProfile(patch) {
    const s = get();
    const p = patch || {};
    if (p.name !== undefined) {
      s.profile.name = String(p.name || '').trim().slice(0, 60);
      if (s.profile.name) s.onboarded = true;
    }
    if (DP.isObj(p.target)) {
      const sys = DP.toInt(p.target.sys, s.profile.target.sys);
      const dia = DP.toInt(p.target.dia, s.profile.target.dia);
      if (sys >= 80 && sys <= 250 && dia >= 40 && dia <= 150 && sys > dia) {
        s.profile.target = { sys: sys, dia: dia };
      }
    }
    if (DP.isObj(p.limits)) {
      s.profile.limits = {
        sysLow: DP.toInt(p.limits.sysLow, s.profile.limits.sysLow),
        diaLow: DP.toInt(p.limits.diaLow, s.profile.limits.diaLow),
        pulseLow: DP.toInt(p.limits.pulseLow, s.profile.limits.pulseLow),
        pulseHigh: DP.toInt(p.limits.pulseHigh, s.profile.limits.pulseHigh)
      };
    }
    s.profile.updatedAt = nowIso();
    s.profile.dirty = true;
    commit('profile');
    return s;
  }

  function addReading(value) {
    const s = get();
    const now = nowIso();
    const reading = {
      id: DP.Fmt.uid(),
      at: value.at,
      sys: DP.toInt(value.sys, 0),
      dia: DP.toInt(value.dia, 0),
      pulse: DP.toInt(value.pulse, 0),
      irregular: !!value.irregular,
      arm: value.arm || '',
      posture: value.posture || '',
      note: String(value.note || '').slice(0, 2000),
      source: value.source === 'photo' ? 'photo' : 'manual',
      createdAt: now,
      updatedAt: now,
      deleted: false,
      dirty: true
    };
    s.readings.push(reading);
    s.readings = DP.Stats.sortDesc(s.readings);
    commit('reading-add');
    return reading;
  }

  function updateReading(id, value) {
    const s = get();
    const idx = s.readings.findIndex(function (r) { return r.id === id; });
    if (idx < 0) return null;
    const cur = s.readings[idx];
    const updated = Object.assign({}, cur, {
      at: value.at !== undefined ? value.at : cur.at,
      sys: value.sys !== undefined ? DP.toInt(value.sys, cur.sys) : cur.sys,
      dia: value.dia !== undefined ? DP.toInt(value.dia, cur.dia) : cur.dia,
      pulse: value.pulse !== undefined ? DP.toInt(value.pulse, 0) : cur.pulse,
      irregular: value.irregular !== undefined ? !!value.irregular : cur.irregular,
      arm: value.arm !== undefined ? value.arm : cur.arm,
      posture: value.posture !== undefined ? value.posture : cur.posture,
      note: value.note !== undefined ? String(value.note || '').slice(0, 2000) : cur.note,
      source: value.source !== undefined ? value.source : cur.source,
      updatedAt: nowIso(),
      dirty: true
    });
    s.readings[idx] = updated;
    s.readings = DP.Stats.sortDesc(s.readings);
    commit('reading-update');
    return updated;
  }

  function deleteReading(id) {
    const s = get();
    const idx = s.readings.findIndex(function (r) { return r.id === id; });
    if (idx < 0) return false;
    s.readings[idx] = Object.assign({}, s.readings[idx], {
      deleted: true,
      updatedAt: nowIso(),
      dirty: true
    });
    commit('reading-delete');
    return true;
  }

  function getReading(id) {
    return get().readings.find(function (r) { return r.id === id; }) || null;
  }

  function readings() {
    return DP.Stats.active(get().readings);
  }

  function allReadings() {
    return get().readings.slice();
  }

  function setReadings(list, action) {
    const s = get();
    s.readings = dedupe((list || []).map(function (r) {
      return DP.Stats.normalizeReading(r);
    }).filter(Boolean));
    commit(action || 'readings-replace');
    return s.readings;
  }

  function mergeReadings(incoming) {
    const s = get();
    s.readings = DP.Stats.mergeReadings(s.readings, incoming);
    commit('readings-merge');
    return s.readings;
  }

  function markSynced(ids, profileToo) {
    const s = get();
    const set = {};
    (ids || []).forEach(function (id) { set[id] = true; });
    s.readings.forEach(function (r) {
      if (set[r.id]) r.dirty = false;
    });
    if (profileToo) s.profile.dirty = false;
    save();
    notify('sync-mark');
  }

  function applySyncedProfile(profile) {
    if (!profile) return;
    const s = get();
    const p = profile;
    if (p.name !== undefined) {
      s.profile.name = String(p.name || '').trim().slice(0, 60);
      if (s.profile.name) s.onboarded = true;
    }
    if (DP.isObj(p.target)) {
      const sys = DP.toInt(p.target.sys, s.profile.target.sys);
      const dia = DP.toInt(p.target.dia, s.profile.target.dia);
      if (sys >= 80 && sys <= 250 && dia >= 40 && dia <= 150 && sys > dia) {
        s.profile.target = { sys: sys, dia: dia };
      }
    }
    if (DP.isObj(p.limits)) {
      s.profile.limits = {
        sysLow: DP.toInt(p.limits.sysLow, s.profile.limits.sysLow),
        diaLow: DP.toInt(p.limits.diaLow, s.profile.limits.diaLow),
        pulseLow: DP.toInt(p.limits.pulseLow, s.profile.limits.pulseLow),
        pulseHigh: DP.toInt(p.limits.pulseHigh, s.profile.limits.pulseHigh)
      };
    }
    s.profile.updatedAt = p.updatedAt || s.profile.updatedAt;
    s.profile.dirty = false;
    save();
    notify('sync-profile');
  }

  function setSyncMeta(meta) {
    const s = get();
    s.sync = Object.assign({}, s.sync, meta || {});
    save();
    notify('sync-meta');
  }

  function setSettings(patch) {
    const s = get();
    s.settings = Object.assign({}, s.settings, patch || {});
    save();
    notify('settings');
  }

  function clearAll(options) {
    const opts = options || {};
    const s = get();
    if (opts.keepProfile) {
      s.readings = [];
    } else {
      state = defaultState();
      state.settings = s.settings;
    }
    commit('clear');
  }

  function exportBackup() {
    const s = get();
    return {
      app: 'Pressione 2.0',
      version: 2,
      exportedAt: nowIso(),
      profile: {
        name: s.profile.name,
        target: DP.clone(s.profile.target),
        limits: DP.clone(s.profile.limits)
      },
      settings: DP.clone(s.settings),
      readings: DP.Stats.active(s.readings).map(function (r) {
        return {
          id: r.id,
          at: r.at,
          sys: r.sys,
          dia: r.dia,
          pulse: r.pulse,
          irregular: r.irregular,
          arm: r.arm,
          posture: r.posture,
          note: r.note,
          source: r.source,
          createdAt: r.createdAt,
          updatedAt: r.updatedAt
        };
      })
    };
  }

  function importBackup(input) {
    let data = input;
    if (typeof input === 'string') {
      try { data = JSON.parse(input); }
      catch (e) { return { ok: false, error: 'Il file non è un JSON valido.' }; }
    }
    if (!data) return { ok: false, error: 'Backup vuoto o non valido.' };

    const isAndroid = !!(data.misurazioni || data.measurements);
    const isOur = data.app === 'Pressione 2.0' || data.app === 'pressione-2.0';
    const isList = Array.isArray(data);
    if (!isAndroid && !isOur && !isList && !Array.isArray(data.readings)) {
      return { ok: false, error: 'Formato di backup non riconosciuto.' };
    }

    let incoming = [];
    let importedProfile = null;

    if (isAndroid) {
      const conv = DP.Stats.fromAndroidBackup(data);
      incoming = conv.readings;
      importedProfile = conv.profile;
    } else {
      incoming = (isList ? data : (data.readings || [])).map(function (r) {
        const normalized = DP.Stats.normalizeReading(r);
        if (!normalized) return null;
        const rawId = r && r.id !== undefined && r.id !== null ? String(r.id) : '';
        if (!DP.Fmt.isUuid(rawId)) {
          normalized.id = DP.Fmt.stableId('import|' + rawId + '|' + normalized.at + '|' +
            normalized.sys + '|' + normalized.dia + '|' + (normalized.pulse || '') + '|' +
            normalized.note);
        }
        return normalized;
      }).filter(Boolean);
      if (DP.isObj(data.profile)) {
        importedProfile = {
          name: data.profile.name || '',
          target: data.profile.target || null,
          limits: data.profile.limits || null
        };
      }
    }

    if (!incoming.length && !importedProfile) {
      return { ok: false, error: 'Il backup non contiene misurazioni valide.' };
    }

    // Segna come da sincronizzare: dopo il login finiranno nel cloud.
    incoming.forEach(function (r) {
      if (!DP.Fmt.isUuid(r.id)) r.id = DP.Fmt.uid();
      r.dirty = true;
    });
    const before = get().readings.length;
    const merged = DP.Stats.mergeReadings(get().readings, incoming);
    const s = get();
    s.readings = merged;
    let added = Math.max(0, merged.length - before);

    let profileApplied = false;
    if (importedProfile) {
      const p = s.profile;
      const targetIsDefault = p.target.sys === DP.CONFIG.target.sys && p.target.dia === DP.CONFIG.target.dia;
      const limitsAreDefault = p.limits.sysLow === DP.CONFIG.limits.sysLow &&
        p.limits.diaLow === DP.CONFIG.limits.diaLow &&
        p.limits.pulseLow === DP.CONFIG.limits.pulseLow &&
        p.limits.pulseHigh === DP.CONFIG.limits.pulseHigh;
      if (importedProfile.name && !p.name) { p.name = String(importedProfile.name).slice(0, 60); profileApplied = true; }
      if (importedProfile.target && targetIsDefault) {
        const sys = DP.toInt(importedProfile.target.sys, p.target.sys);
        const dia = DP.toInt(importedProfile.target.dia, p.target.dia);
        if (sys > dia && sys >= 80 && sys <= 250 && dia >= 40 && dia <= 150) p.target = { sys: sys, dia: dia };
        profileApplied = true;
      }
      if (importedProfile.limits && limitsAreDefault) {
        p.limits = {
          sysLow: DP.toInt(importedProfile.limits.sysLow, p.limits.sysLow),
          diaLow: DP.toInt(importedProfile.limits.diaLow, p.limits.diaLow),
          pulseLow: DP.toInt(importedProfile.limits.pulseLow, p.limits.pulseLow),
          pulseHigh: DP.toInt(importedProfile.limits.pulseHigh, p.limits.pulseHigh)
        };
        profileApplied = true;
      }
      if (profileApplied) {
        p.updatedAt = nowIso();
        p.dirty = true;
        s.onboarded = !!p.name || s.onboarded;
      }
    }

    commit('import');
    return {
      ok: true,
      added: added,
      total: incoming.length,
      profile: profileApplied,
      android: isAndroid,
      merged: merged.length
    };
  }

  function importFile(file) {
    return new Promise(function (resolve) {
      if (!file) { resolve({ ok: false, error: 'Nessun file selezionato.' }); return; }
      const reader = new FileReader();
      reader.onload = function () {
        resolve(importBackup(String(reader.result || '')));
      };
      reader.onerror = function () { resolve({ ok: false, error: 'Impossibile leggere il file.' }); };
      reader.readAsText(file);
    });
  }

  function saveError() {
    return lastSaveError;
  }

  function isStorageAvailable() {
    return storageAvailable;
  }

  function corruptKeyHint() {
    return DP.CONFIG.storageKey + '_corrupt_*';
  }

  // Avvio immediato
  init();

  return {
    init: init,
    get: get,
    profile: function () { return get().profile; },
    settings: function () { return get().settings; },
    readings: readings,
    allReadings: allReadings,
    getReading: getReading,
    subscribe: subscribe,
    setOnboarded: setOnboarded,
    updateProfile: updateProfile,
    addReading: addReading,
    updateReading: updateReading,
    deleteReading: deleteReading,
    setReadings: setReadings,
    mergeReadings: mergeReadings,
    markSynced: markSynced,
    applySyncedProfile: applySyncedProfile,
    setSyncMeta: setSyncMeta,
    setSettings: setSettings,
    clearAll: clearAll,
    exportBackup: exportBackup,
    importBackup: importBackup,
    importFile: importFile,
    save: save,
    saveError: saveError,
    isStorageAvailable: isStorageAvailable,
    corruptKeyHint: corruptKeyHint
  };
})();
