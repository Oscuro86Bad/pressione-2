/* ============================================================
   PRESSIONE 2.0 — sincronizzazione Supabase
   - Accesso con email + password
   - Dati protetti da Row Level Security (ogni account vede solo i suoi)
   - Cache locale + coda offline: le modifiche vengono inviate appena
     torna la connessione.
   - La chiave "anon" è pubblica per progetto: NON inserire mai la
     service_role key nel frontend.
   ============================================================ */
window.DP = window.DP || {};

DP.Cloud = (function () {
  const C = DP.CONFIG.supabase;
  const TABLE_SETTINGS = C.settingsTable;
  const TABLE_READINGS = C.readingsTable;

  let client = null;
  let libPromise = null;
  let initPromise = null;
  let config = null;
  let session = null;
  let user = null;
  let syncPromise = null;
  let syncAgain = false;
  let status = {
    state: 'local',
    message: 'Solo su questo dispositivo',
    lastSyncAt: null,
    error: ''
  };
  const statusListeners = [];
  const authListeners = [];

  // ---------- configurazione ----------
  function readConfig() {
    let local = null;
    try {
      const raw = window.localStorage.getItem(DP.CONFIG.cloudConfigKey);
      if (raw) local = JSON.parse(raw);
    } catch (e) { local = null; }

    const candidates = [local, window.DP_SUPABASE || null];
    for (let i = 0; i < candidates.length; i++) {
      const c = candidates[i];
      if (c && c.url && c.anonKey) {
        return {
          url: String(c.url).trim().replace(/\/+$/, ''),
          anonKey: String(c.anonKey).trim(),
          source: i === 0 ? 'local' : 'file'
        };
      }
    }
    return null;
  }

  function configured() {
    return !!readConfig();
  }

  function getConfig() {
    const c = config || readConfig();
    return c ? { url: c.url, anonKey: c.anonKey, source: c.source } : null;
  }

  function setConfig(url, anonKey) {
    const u = String(url || '').trim().replace(/\/+$/, '');
    const k = String(anonKey || '').trim();
    if (!/^https:\/\//i.test(u)) throw new Error('L’URL del progetto deve iniziare con https://');
    try { new URL(u); } catch (e) { throw new Error('L’URL del progetto non è valido.'); }
    if (k.length < 20) throw new Error('La chiave anon pubblica non sembra valida.');
    try {
      window.localStorage.setItem(DP.CONFIG.cloudConfigKey, JSON.stringify({ url: u, anonKey: k }));
    } catch (e) {
      throw new Error('Impossibile salvare la configurazione su questo dispositivo.');
    }
    config = { url: u, anonKey: k, source: 'local' };
    return true;
  }

  function clearConfig() {
    try { window.localStorage.removeItem(DP.CONFIG.cloudConfigKey); } catch (e) { /* ignore */ }
    config = null;
    client = null;
    initPromise = null;
    session = null;
    user = null;
    setStatus('local', 'Solo su questo dispositivo');
  }

  function setStatus(state, message, extra) {
    status = Object.assign({
      state: state,
      message: message,
      lastSyncAt: status.lastSyncAt,
      error: state === 'error' ? message : ''
    }, extra || {});
    statusListeners.forEach(function (fn) {
      try { fn(getStatus()); } catch (e) { console.error(e); }
    });
  }

  function getStatus() {
    return {
      state: status.state,
      message: status.message,
      lastSyncAt: status.lastSyncAt,
      error: status.error,
      email: user ? user.email : '',
      configured: configured()
    };
  }

  function subscribe(fn) {
    if (typeof fn !== 'function') return function () {};
    statusListeners.push(fn);
    return function () {
      const i = statusListeners.indexOf(fn);
      if (i >= 0) statusListeners.splice(i, 1);
    };
  }

  function onAuth(fn) {
    if (typeof fn !== 'function') return function () {};
    authListeners.push(fn);
    return function () {
      const i = authListeners.indexOf(fn);
      if (i >= 0) authListeners.splice(i, 1);
    };
  }

  function notifyAuth(event, s) {
    authListeners.forEach(function (fn) {
      try { fn(event, s); } catch (e) { console.error(e); }
    });
  }

  // ---------- caricamento libreria ----------
  function loadLib() {
    if (window.supabase && window.supabase.createClient) return Promise.resolve(window.supabase);
    if (libPromise) return libPromise;
    libPromise = new Promise(function (resolve, reject) {
      const s = document.createElement('script');
      s.src = C.libUrl;
      s.async = true;
      s.onload = function () {
        if (window.supabase && window.supabase.createClient) resolve(window.supabase);
        else {
          libPromise = null;
          reject(new Error('Libreria Supabase non disponibile.'));
        }
      };
      s.onerror = function () {
        libPromise = null;
        reject(new Error('La prima volta serve internet per caricare la sincronizzazione. Riprova quando sei online.'));
      };
      document.head.appendChild(s);
    });
    return libPromise;
  }

  function redirectUrl() {
    return window.location.origin + window.location.pathname;
  }

  function init() {
    if (initPromise) return initPromise;
    config = readConfig();
    if (!config) {
      setStatus('local', 'Solo su questo dispositivo');
      return Promise.resolve(null);
    }

    setStatus('connecting', 'Connessione…');
    initPromise = loadLib().then(function (lib) {
      client = lib.createClient(config.url, config.anonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          flowType: 'pkce'
        }
      });
      client.auth.onAuthStateChange(function (event, s) {
        // Supabase sconsiglia di attendere chiamate nel callback: usciamo subito.
        setTimeout(function () { handleAuthEvent(event, s); }, 0);
      });
      setStatus('ready', 'Pronto per la sincronizzazione');
      return client;
    }).catch(function (e) {
      initPromise = null;
      setStatus('error', 'Sincronizzazione non disponibile: ' + (e.message || e));
      throw e;
    });
    return initPromise;
  }

  function handleAuthEvent(event, s) {
    session = s || null;
    user = s && s.user ? s.user : null;

    if (event === 'PASSWORD_RECOVERY') {
      setStatus('ready', 'Imposta una nuova password');
      notifyAuth('recovery', session);
      return;
    }

    if (event === 'SIGNED_OUT') {
      setStatus('local', 'Non sincronizzato');
      notifyAuth('signed-out', null);
      return;
    }

    if (session && user) {
      setStatus('ready', 'Connesso come ' + (user.email || ''));
      notifyAuth(event, session);
      if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED') {
        setTimeout(function () {
          sync(DP.Store.get()).catch(function () { /* lo stato è già aggiornato */ });
        }, 150);
      }
    } else {
      notifyAuth(event, null);
      if (status.state !== 'error') setStatus('local', 'Accedi per sincronizzare');
    }
  }

  async function restoreSession() {
    try { await init(); } catch (e) { return null; }
    if (!client) return null;
    try {
      const res = await client.auth.getSession();
      if (res.error) {
        setStatus('error', friendlyAuthError(res.error));
        return null;
      }
      session = res.data ? res.data.session : null;
      user = session && session.user ? session.user : null;
      if (session) {
        setStatus('ready', 'Connesso come ' + (user.email || ''));
      } else {
        setStatus('local', 'Accedi per sincronizzare');
      }
      return session;
    } catch (e) {
      setStatus('error', 'Impossibile verificare la sessione: ' + (e.message || e));
      return null;
    }
  }

  // ---------- autenticazione ----------
  function friendlyAuthError(err) {
    const msg = String((err && err.message) || err || 'Errore sconosciuto');
    if (/Invalid login credentials/i.test(msg)) return 'Email o password non corretti.';
    if (/Email not confirmed/i.test(msg)) return 'Devi prima confermare l’email: apri il link che ti abbiamo inviato.';
    if (/User already registered/i.test(msg)) return 'Esiste già un account con questa email. Prova ad accedere.';
    if (/Password should be at least/i.test(msg)) return 'La password è troppo corta: usa almeno 8 caratteri.';
    if (/Unable to validate email/i.test(msg)) return 'L’indirizzo email non è valido.';
    if (/rate limit|too many/i.test(msg)) return 'Troppi tentativi: riprova tra qualche minuto.';
    if (/Signups not allowed/i.test(msg)) return 'Le registrazioni sono disabilitate nel progetto Supabase.';
    if (/Email logins are disabled/i.test(msg)) return 'L’accesso con email è disabilitato nel progetto Supabase.';
    if (/Failed to fetch|NetworkError|Load failed/i.test(msg)) return 'Connessione assente o Supabase non raggiungibile.';
    return msg;
  }

  async function signIn(email, password) {
    try { await init(); } catch (e) { return { ok: false, error: friendlyAuthError(e) }; }
    if (!client) return { ok: false, error: 'Sincronizzazione non configurata.' };
    try {
      const res = await client.auth.signInWithPassword({
        email: String(email || '').trim(),
        password: String(password || '')
      });
      if (res.error) return { ok: false, error: friendlyAuthError(res.error) };
      session = res.data.session;
      user = res.data.user;
      setStatus('ready', 'Connesso come ' + (user.email || ''));
      notifyAuth('signed-in', session);
      return { ok: true, session: session, user: user };
    } catch (e) {
      return { ok: false, error: friendlyAuthError(e) };
    }
  }

  async function signUp(email, password, name) {
    try { await init(); } catch (e) { return { ok: false, error: friendlyAuthError(e) }; }
    if (!client) return { ok: false, error: 'Sincronizzazione non configurata.' };
    try {
      const res = await client.auth.signUp({
        email: String(email || '').trim(),
        password: String(password || ''),
        options: {
          data: { name: String(name || '').trim().slice(0, 60) },
          emailRedirectTo: redirectUrl()
        }
      });
      if (res.error) return { ok: false, error: friendlyAuthError(res.error) };
      const sess = res.data ? res.data.session : null;
      if (sess) {
        session = sess;
        user = sess.user;
        setStatus('ready', 'Connesso come ' + (user.email || ''));
        notifyAuth('signed-in', sess);
      }
      return {
        ok: true,
        needsConfirm: !sess,
        session: sess,
        user: res.data ? res.data.user : null
      };
    } catch (e) {
      return { ok: false, error: friendlyAuthError(e) };
    }
  }

  async function signOut() {
    if (!client) return { ok: true };
    try {
      const res = await client.auth.signOut();
      session = null;
      user = null;
      setStatus('local', 'Non sincronizzato');
      notifyAuth('signed-out', null);
      return { ok: !res.error, error: res.error ? friendlyAuthError(res.error) : '' };
    } catch (e) {
      return { ok: false, error: friendlyAuthError(e) };
    }
  }

  async function resetPassword(email) {
    try { await init(); } catch (e) { return { ok: false, error: friendlyAuthError(e) }; }
    if (!client) return { ok: false, error: 'Sincronizzazione non configurata.' };
    try {
      const res = await client.auth.resetPasswordForEmail(String(email || '').trim(), {
        redirectTo: redirectUrl()
      });
      if (res.error) return { ok: false, error: friendlyAuthError(res.error) };
      return { ok: true };
    } catch (e) {
      return { ok: false, error: friendlyAuthError(e) };
    }
  }

  async function updatePassword(password) {
    if (!client) return { ok: false, error: 'Sincronizzazione non configurata.' };
    try {
      const res = await client.auth.updateUser({ password: String(password || '') });
      if (res.error) return { ok: false, error: friendlyAuthError(res.error) };
      return { ok: true };
    } catch (e) {
      return { ok: false, error: friendlyAuthError(e) };
    }
  }

  function currentSession() {
    return session;
  }

  function currentUser() {
    return user;
  }

  function isSignedIn() {
    return !!(client && session && user);
  }

  // ---------- sincronizzazione dati ----------
  function dateMs(value) {
    const t = new Date(value).getTime();
    return Number.isFinite(t) ? t : 0;
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function normalizeLimits(raw) {
    let l = raw;
    if (typeof l === 'string') {
      try { l = JSON.parse(l); } catch (e) { l = null; }
    }
    l = l && typeof l === 'object' ? l : {};
    return {
      sysLow: DP.toInt(l.sysLow, DP.CONFIG.limits.sysLow),
      diaLow: DP.toInt(l.diaLow, DP.CONFIG.limits.diaLow),
      pulseLow: DP.toInt(l.pulseLow, DP.CONFIG.limits.pulseLow),
      pulseHigh: DP.toInt(l.pulseHigh, DP.CONFIG.limits.pulseHigh)
    };
  }

  function normalizeServerProfile(row) {
    const target = DP.Stats.targetOf({
      sys: row.target_sys,
      dia: row.target_dia
    });
    return {
      name: String(row.name || '').slice(0, 60),
      target: target,
      limits: normalizeLimits(row.limits),
      updatedAt: row.updated_at || nowIso()
    };
  }

  function normalizeServerReading(row) {
    return DP.Stats.normalizeReading({
      id: row.id,
      at: row.local_at,
      sys: row.sys,
      dia: row.dia,
      pulse: row.pulse || 0,
      irregular: row.irregular,
      arm: row.arm,
      posture: row.posture,
      note: row.note,
      source: row.source,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      deleted: row.deleted,
      dirty: false
    });
  }

  function toServerReading(r, uid) {
    let at = r.at;
    let measured = new Date(at);
    if (isNaN(measured.getTime())) {
      measured = new Date();
      at = DP.Fmt.nowLocal(measured);
    }
    return {
      id: r.id,
      user_id: uid,
      local_at: at,
      measured_at: measured.toISOString(),
      tz_offset: measured.getTimezoneOffset(),
      sys: r.sys,
      dia: r.dia,
      pulse: r.pulse || null,
      irregular: !!r.irregular,
      arm: r.arm || null,
      posture: r.posture || null,
      note: r.note || '',
      source: r.source || 'manual',
      created_at: r.createdAt || nowIso(),
      updated_at: r.updatedAt || nowIso(),
      deleted: !!r.deleted
    };
  }

  function toServerProfile(profile, uid) {
    return {
      user_id: uid,
      name: String(profile.name || '').slice(0, 60),
      target_sys: profile.target.sys,
      target_dia: profile.target.dia,
      limits: profile.limits,
      updated_at: profile.updatedAt || nowIso()
    };
  }

  async function fetchAllReadings(uid) {
    const pageSize = 1000;
    let from = 0;
    const all = [];
    while (true) {
      const res = await client
        .from(TABLE_READINGS)
        .select('*')
        .eq('user_id', uid)
        .order('local_at', { ascending: false })
        .order('id', { ascending: true })
        .range(from, from + pageSize - 1);
      if (res.error) throw res.error;
      const rows = res.data || [];
      all.push.apply(all, rows);
      if (rows.length < pageSize) break;
      from += pageSize;
      if (from > 100000) break;
    }
    return all;
  }

  function friendlyDbError(err) {
    const msg = String((err && err.message) || err || 'Errore sconosciuto');
    if (/Could not find the table|relation .* does not exist|PGRST205/i.test(msg)) {
      return 'Tabelle non trovate. Esegui il file supabase/schema.sql nel progetto Supabase.';
    }
    if (/row-level security|new row violates|permission denied/i.test(msg)) {
      return 'Permessi del database non corretti. Controlla le policy RLS dello schema.';
    }
    if (/JWT|invalid.*token|not authenticated/i.test(msg)) {
      return 'Sessione scaduta: accedi di nuovo.';
    }
    if (/Failed to fetch|NetworkError|Load failed/i.test(msg)) {
      return 'Connessione assente o Supabase non raggiungibile.';
    }
    return msg;
  }

  function ensureUuidIds() {
    const state = DP.Store.get();
    let changed = false;
    state.readings.forEach(function (r) {
      if (!DP.Fmt.isUuid(r.id)) {
        r.id = DP.Fmt.uid();
        r.dirty = true;
        changed = true;
      }
    });
    if (changed) DP.Store.save();
  }

  async function doSync() {
    if (!client || !session || !user) {
      setStatus('local', 'Accedi per sincronizzare');
      return { ok: false, reason: 'no-auth' };
    }
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      setStatus('offline', 'Offline: i dati restano sul dispositivo');
      return { ok: false, reason: 'offline' };
    }

    const uid = user.id;
    setStatus('syncing', 'Sincronizzazione…');
    ensureUuidIds();

    try {
      // 1) Scarica impostazioni e tutte le misurazioni (paginazione).
      const settingsRes = await client.from(TABLE_SETTINGS).select('*').eq('user_id', uid).maybeSingle();
      if (settingsRes.error) throw settingsRes.error;
      const serverSettingsRow = settingsRes.data || null;
      const serverRows = await fetchAllReadings(uid);

      const local = DP.Store.get();
      const localReadings = local.readings.slice();
      const localById = {};
      localReadings.forEach(function (r) { localById[r.id] = r; });

      const accountChanged = local.sync.accountId && local.sync.accountId !== uid;
      if (local.sync.accountId !== uid) {
        // Primo collegamento (o account diverso): carica i dati locali nell'account.
        localReadings.forEach(function (r) {
          if (!r.deleted) r.dirty = true;
        });
      }

      // 2) Unisci: per ogni riga remota vince la più recente, salvo
      //    modifiche locali non ancora sincronizzate più recenti.
      const serverMap = {};
      const merged = [];
      serverRows.forEach(function (row) {
        const sr = normalizeServerReading(row);
        if (!sr) return;
        serverMap[sr.id] = sr;
        const lr = localById[sr.id];
        if (lr && lr.dirty && dateMs(lr.updatedAt) > dateMs(sr.updatedAt)) {
          merged.push(lr);
        } else {
          merged.push(sr);
        }
      });
      localReadings.forEach(function (lr) {
        if (!serverMap[lr.id]) {
          if (!lr.deleted) lr.dirty = true;
          merged.push(lr);
        }
      });

      // 3) Profilo: vince la versione più recente.
      let localProfile = local.profile;
      let profileNeedsPush = false;
      if (serverSettingsRow) {
        const sp = normalizeServerProfile(serverSettingsRow);
        const localWins = localProfile.dirty && dateMs(localProfile.updatedAt) > dateMs(sp.updatedAt);
        if (localWins) {
          profileNeedsPush = true;
        } else {
          DP.Store.applySyncedProfile({
            name: sp.name,
            target: sp.target,
            limits: sp.limits,
            updatedAt: sp.updatedAt
          });
        }
      } else {
        profileNeedsPush = true;
      }

      // 4) Applica i dati remoti alla cache locale.
      DP.Store.setReadings(merged, 'sync-merge');

      // 5) Carica le modifiche locali (profilo + misurazioni dirty).
      const stateAfter = DP.Store.get();
      if (profileNeedsPush || stateAfter.profile.dirty) {
        const res = await client.from(TABLE_SETTINGS).upsert(
          toServerProfile(stateAfter.profile, uid),
          { onConflict: 'user_id' }
        );
        if (res.error) throw res.error;
        DP.Store.markSynced([], true);
      }

      const dirty = stateAfter.readings.filter(function (r) { return r.dirty; });
      let pushed = 0;
      const pushedIds = [];
      for (let i = 0; i < dirty.length; i += 200) {
        const batch = dirty.slice(i, i + 200);
        const payload = batch.map(function (r) { return toServerReading(r, uid); });
        const res = await client.from(TABLE_READINGS).upsert(payload, { onConflict: 'id' });
        if (res.error) throw res.error;
        pushed += batch.length;
        batch.forEach(function (r) { pushedIds.push(r.id); });
      }
      if (pushedIds.length) DP.Store.markSynced(pushedIds, false);

      const at = nowIso();
      DP.Store.setSyncMeta({ accountId: uid, lastSyncAt: at });
      setStatus('synced', 'Sincronizzato ' + DP.Fmt.timeAgo(at), { lastSyncAt: at });

      return {
        ok: true,
        pushed: pushed,
        pulled: serverRows.length,
        total: stateAfter.readings.length,
        accountChanged: !!accountChanged
      };
    } catch (e) {
      const msg = friendlyDbError(e);
      setStatus('error', msg);
      return { ok: false, error: msg };
    }
  }

  function sync(state) {
    if (syncPromise) {
      syncAgain = true;
      return syncPromise;
    }
    syncPromise = doSync().finally(function () {
      syncPromise = null;
      if (syncAgain) {
        syncAgain = false;
        setTimeout(function () {
          DP.Cloud.sync(DP.Store.get()).catch(function () { /* ignore */ });
        }, 800);
      }
    });
    return syncPromise;
  }

  function scheduleSync(delay) {
    if (!isSignedIn()) return;
    setTimeout(function () {
      sync(DP.Store.get()).catch(function () { /* ignore */ });
    }, Math.max(300, delay || 1200));
  }

  async function deleteCloudData() {
    if (!client || !session || !user) return { ok: false, error: 'Non hai effettuato l’accesso.' };
    const uid = user.id;
    try {
      const r1 = await client.from(TABLE_READINGS).delete().eq('user_id', uid);
      if (r1.error) throw r1.error;
      const r2 = await client.from(TABLE_SETTINGS).delete().eq('user_id', uid);
      if (r2.error) throw r2.error;
      DP.Store.setSyncMeta({ lastSyncAt: null });
      return { ok: true };
    } catch (e) {
      return { ok: false, error: friendlyDbError(e) };
    }
  }

  return {
    configured: configured,
    getConfig: getConfig,
    setConfig: setConfig,
    clearConfig: clearConfig,
    init: init,
    restoreSession: restoreSession,
    getStatus: getStatus,
    subscribe: subscribe,
    onAuth: onAuth,
    signIn: signIn,
    signUp: signUp,
    signOut: signOut,
    resetPassword: resetPassword,
    updatePassword: updatePassword,
    currentSession: currentSession,
    currentUser: currentUser,
    isSignedIn: isSignedIn,
    sync: sync,
    scheduleSync: scheduleSync,
    deleteCloudData: deleteCloudData,
    friendlyAuthError: friendlyAuthError
  };
})();
