/* ============================================================
   PRESSIONE 2.0 — sincronizzazione con un repository GitHub privato
   - Il diario viene salvato in un unico file JSON (default diario.json)
     dentro un repository privato dell'utente.
   - Il token GitHub è un token "fine-grained" limitato a quel repository,
     con permesso Contents: Read and write. Resta solo su questo dispositivo.
   - Le foto non vengono mai incluse: viaggiano solo i valori del diario.
   - Cache locale + merge per data di modifica: funziona anche offline e
     invia le modifiche appena torna la connessione.
   ============================================================ */
window.DP = window.DP || {};

DP.Cloud = (function () {
  const API = 'https://api.github.com';
  const G = DP.CONFIG.github;
  const STORE_KEY = DP.CONFIG.githubConfigKey;

  let config = null;
  let verified = null;
  let syncPromise = null;
  let syncAgain = false;
  const statusListeners = [];
  let status = {
    state: 'local',
    message: 'Solo su questo dispositivo',
    lastSyncAt: null,
    error: ''
  };

  // ---------- configurazione ----------
  function cleanText(value) {
    return String(value || '').trim();
  }

  function normalizeConfig(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const token = cleanText(raw.token);
    const owner = cleanText(raw.owner);
    const repo = cleanText(raw.repo).replace(/\.git$/i, '');
    if (!token || !owner || !repo) return null;
    return {
      token: token,
      owner: owner,
      repo: repo,
      branch: cleanText(raw.branch) || G.defaultBranch,
      path: cleanText(raw.path).replace(/^\/+/, '') || G.defaultPath
    };
  }

  function readConfig() {
    try {
      const raw = window.localStorage.getItem(STORE_KEY);
      if (!raw) return null;
      return normalizeConfig(JSON.parse(raw));
    } catch (e) {
      return null;
    }
  }

  function current() {
    if (!config) config = readConfig();
    return config;
  }

  function configured() {
    return !!current();
  }

  function getConfig() {
    const c = current();
    if (!c) return null;
    return {
      owner: c.owner,
      repo: c.repo,
      branch: c.branch,
      path: c.path,
      hasToken: !!c.token,
      login: verified ? verified.login : '',
      private: verified ? verified.private : null
    };
  }

  function validateConfig(c) {
    if (!/^[A-Za-z0-9_.-]+$/.test(c.owner)) {
      throw new Error('Il nome utente GitHub contiene caratteri non validi.');
    }
    if (!/^[A-Za-z0-9_.-]+$/.test(c.repo)) {
      throw new Error('Il nome del repository contiene caratteri non validi.');
    }
    if (!c.branch || /[\s~^:?*[\\]/.test(c.branch)) {
      throw new Error('Il nome del branch non è valido.');
    }
    if (!c.path || /(^|\/)\.\.(\/|$)/.test(c.path) || c.path.indexOf('\\') >= 0) {
      throw new Error('Il percorso del file non è valido.');
    }
    if (c.token.length < 20) {
      throw new Error('Il token GitHub non sembra valido.');
    }
  }

  function saveConfig(c) {
    try {
      window.localStorage.setItem(STORE_KEY, JSON.stringify(c));
    } catch (e) {
      throw new Error('Impossibile salvare il token su questo dispositivo: memoria piena o modalità privata.');
    }
    config = c;
    return c;
  }

  function setConfig(input) {
    const cur = current() || {};
    const c = normalizeConfig({
      token: cleanText(input && input.token) || cur.token,
      owner: cleanText(input && input.owner) || cur.owner,
      repo: cleanText(input && input.repo) || cur.repo,
      branch: cleanText(input && input.branch) || cur.branch || G.defaultBranch,
      path: cleanText(input && input.path) || cur.path || G.defaultPath
    });
    if (!c) throw new Error('Servono token, proprietario e nome del repository.');
    validateConfig(c);
    return saveConfig(c);
  }

  function clearConfig() {
    try { window.localStorage.removeItem(STORE_KEY); } catch (e) { /* ignore */ }
    config = null;
    verified = null;
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
    const c = current();
    return {
      state: status.state,
      message: status.message,
      lastSyncAt: status.lastSyncAt,
      error: status.error,
      email: verified ? verified.login : '',
      login: verified ? verified.login : '',
      repo: c ? c.owner + '/' + c.repo : '',
      configured: !!c
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

  // ---------- chiamate GitHub ----------
  function friendlyError(err) {
    const msg = String((err && err.message) || err || 'Errore sconosciuto');
    if (err && err.status === 401) {
      return 'Token GitHub non valido o scaduto. Creane uno nuovo e ricollega il diario.';
    }
    if (err && err.status === 403) {
      if (/rate limit/i.test(msg)) return 'GitHub ha temporaneamente bloccato le richieste. Riprova tra qualche minuto.';
      return 'GitHub ha negato l’accesso. Controlla che il token possa leggere e scrivere i Contents del repository.';
    }
    if (err && err.status === 404) {
      return 'Repository, branch o file non trovati. Controlla proprietario, nome e branch.';
    }
    if (err && (err.status === 409 || err.status === 422)) {
      return 'Il file è stato modificato altrove. Riprovo con i dati più recenti.';
    }
    if (/Failed to fetch|NetworkError|Load failed|ERR_NETWORK/i.test(msg)) {
      return 'Connessione assente o GitHub non raggiungibile.';
    }
    return msg;
  }

  async function request(c, path, options) {
    const opts = options || {};
    const headers = {
      'Accept': 'application/vnd.github+json',
      'Authorization': 'Bearer ' + c.token,
      'X-GitHub-Api-Version': '2022-11-28'
    };
    if (opts.body) headers['Content-Type'] = 'application/json';
    let res;
    try {
      res = await fetch(API + path, {
        method: opts.method || 'GET',
        headers: headers,
        body: opts.body ? JSON.stringify(opts.body) : undefined,
        cache: 'no-store'
      });
    } catch (e) {
      const err = new Error('Connessione assente o GitHub non raggiungibile.');
      err.network = true;
      throw err;
    }
    let data = null;
    const text = await res.text();
    if (text) {
      try { data = JSON.parse(text); } catch (e) { data = null; }
    }
    if (!res.ok) {
      const err = new Error((data && data.message) || ('GitHub: errore ' + res.status));
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  }

  async function detectLogin(c) {
    const user = await request(c, '/user');
    if (!user || !user.login) throw new Error('Non riesco a leggere il profilo GitHub del token.');
    return user.login;
  }

  async function verify(c) {
    const user = await request(c, '/user');
    const repo = await request(c, '/repos/' + encodeURIComponent(c.owner) + '/' + encodeURIComponent(c.repo));
    if (!repo.private) {
      throw new Error('Il repository ' + c.owner + '/' + c.repo + ' è pubblico. Rendilo privato: contiene dati di salute personali.');
    }
    if (repo.permissions && repo.permissions.push === false) {
      throw new Error('Il token non ha il permesso di scrittura sul repository.');
    }
    try {
      await request(c, '/repos/' + encodeURIComponent(c.owner) + '/' + encodeURIComponent(c.repo) +
        '/branches/' + encodeURIComponent(c.branch));
    } catch (e) {
      if (e.status === 404) {
        throw new Error('Il branch "' + c.branch + '" non esiste. Crea il repository con un file README e riprova.');
      }
      throw e;
    }
    return {
      login: user.login,
      private: true,
      defaultBranch: repo.default_branch || c.branch
    };
  }

  function encodePath(path) {
    return String(path || '').split('/').filter(Boolean).map(encodeURIComponent).join('/');
  }

  function contentsPath(c) {
    return '/repos/' + encodeURIComponent(c.owner) + '/' + encodeURIComponent(c.repo) +
      '/contents/' + encodePath(c.path);
  }

  function encodeBase64(text) {
    const bytes = new TextEncoder().encode(String(text));
    let binary = '';
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
    }
    return btoa(binary);
  }

  function decodeBase64(value) {
    const clean = String(value || '').replace(/\s+/g, '');
    const binary = atob(clean);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new TextDecoder('utf-8').decode(bytes);
  }

  async function readRemote(c) {
    try {
      const data = await request(c, contentsPath(c) + '?ref=' + encodeURIComponent(c.branch));
      if (Array.isArray(data)) {
        throw new Error('Il percorso indicato è una cartella, non un file.');
      }
      if (!data || !data.sha) throw new Error('Risposta GitHub non valida per il file del diario.');
      if (!data.content && data.size > 0) {
        throw new Error('Il file del diario è troppo grande per essere letto da GitHub.');
      }
      return { sha: data.sha, text: decodeBase64(data.content || '') };
    } catch (e) {
      if (e.status === 404) return null;
      throw e;
    }
  }

  async function writeRemote(c, payload, sha) {
    const text = JSON.stringify(payload);
    const bytes = new TextEncoder().encode(text);
    // GitHub Contents API ferma i file a 1 MB e il contenuto viaggia in base64:
    // teniamo un margine per non superare il limite.
    if (bytes.length > 700000) {
      throw new Error('Il diario è troppo grande per GitHub (oltre 700 KB). Esporta un backup e contatta l’assistenza.');
    }
    const body = {
      message: 'Pressione 2.0: aggiorna il diario (' + DP.Fmt.todayKey() + ')',
      content: encodeBase64(text),
      branch: c.branch
    };
    if (sha) body.sha = sha;
    const data = await request(c, contentsPath(c), { method: 'PUT', body: body });
    return data && data.content ? data.content.sha : null;
  }

  // ---------- dati ----------
  function nowIso() {
    return new Date().toISOString();
  }

  function dateMs(value) {
    const t = new Date(value).getTime();
    return Number.isFinite(t) ? t : 0;
  }

  function makePayload(state) {
    return {
      app: 'Pressione 2.0',
      kind: 'diary',
      version: 2,
      updatedAt: nowIso(),
      profile: {
        name: String(state.profile.name || '').slice(0, 60),
        target: { sys: state.profile.target.sys, dia: state.profile.target.dia },
        limits: state.profile.limits,
        updatedAt: state.profile.updatedAt || nowIso()
      },
      readings: state.readings.map(function (r) {
        return {
          id: r.id,
          at: r.at,
          sys: r.sys,
          dia: r.dia,
          pulse: r.pulse || 0,
          irregular: !!r.irregular,
          arm: r.arm || '',
          posture: r.posture || '',
          note: r.note || '',
          source: r.source || 'manual',
          createdAt: r.createdAt,
          updatedAt: r.updatedAt,
          deleted: !!r.deleted
        };
      })
    };
  }

  function parseRemote(text) {
    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      throw new Error('Il file del diario non è un JSON valido: non lo sovrascrivo.');
    }
    if (!data || data.app !== 'Pressione 2.0' || data.kind !== 'diary') {
      throw new Error('Il file non è un diario di Pressione 2.0: non lo sovrascrivo.');
    }
    const readings = (Array.isArray(data.readings) ? data.readings : [])
      .map(function (r) { return DP.Stats.normalizeReading(r); })
      .filter(Boolean);
    let profile = null;
    if (data.profile && typeof data.profile === 'object') {
      profile = {
        name: String(data.profile.name || '').slice(0, 60),
        target: DP.Stats.targetOf(data.profile.target),
        limits: DP.Stats.limitsOf(data.profile.limits),
        updatedAt: data.profile.updatedAt || data.updatedAt || nowIso()
      };
    }
    return { profile: profile, readings: readings };
  }

  function mergeStates(local, remote) {
    const remoteReadings = remote ? remote.readings : [];
    const remoteById = {};
    remoteReadings.forEach(function (r) { remoteById[r.id] = r; });
    const localById = {};
    local.readings.forEach(function (r) { localById[r.id] = r; });

    const ids = [];
    const seen = {};
    local.readings.forEach(function (r) {
      if (!seen[r.id]) { seen[r.id] = true; ids.push(r.id); }
    });
    remoteReadings.forEach(function (r) {
      if (!seen[r.id]) { seen[r.id] = true; ids.push(r.id); }
    });

    const merged = [];
    let localOnly = 0;

    ids.forEach(function (id) {
      const lr = localById[id];
      const rr = remoteById[id];
      if (lr && rr) {
        if (lr.dirty && dateMs(lr.updatedAt) >= dateMs(rr.updatedAt)) {
          merged.push(lr);
        } else {
          merged.push(Object.assign({}, rr, { dirty: false }));
        }
        return;
      }
      if (lr) {
        merged.push(Object.assign({}, lr, { dirty: true }));
        localOnly++;
        return;
      }
      if (rr) merged.push(Object.assign({}, rr, { dirty: false }));
    });

    let applyRemoteProfile = null;
    if (remote && remote.profile) {
      const lp = local.profile;
      const rp = remote.profile;
      const localWins = lp.dirty && dateMs(lp.updatedAt) > dateMs(rp.updatedAt);
      if (!localWins) applyRemoteProfile = rp;
    }

    return { readings: merged, applyRemoteProfile: applyRemoteProfile, localOnly: localOnly };
  }

  // ---------- flusso di sincronizzazione ----------
  async function doSync() {
    const c = current();
    if (!c) {
      setStatus('local', 'Solo su questo dispositivo');
      return { ok: false, reason: 'no-config' };
    }
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      setStatus('offline', 'Offline: i dati restano sul dispositivo');
      return { ok: false, reason: 'offline' };
    }

    try {
      if (!verified) {
        setStatus('connecting', 'Verifico GitHub…');
        verified = await verify(c);
      }
      setStatus('syncing', 'Sincronizzazione…');

      let lastError = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        const remoteFile = await readRemote(c);
        const remote = remoteFile ? parseRemote(remoteFile.text) : null;
        const local = DP.Store.get();
        const merge = mergeStates(local, remote);

        DP.Store.setReadings(merge.readings, 'sync-merge');
        if (merge.applyRemoteProfile) DP.Store.applySyncedProfile(merge.applyRemoteProfile);

        const state = DP.Store.get();
        const alreadyPushed = merge.localOnly;
        const profileDirty = !!state.profile.dirty;
        const readingsDirty = state.readings.some(function (r) { return r.dirty; });
        const shouldPush = !remoteFile || profileDirty || readingsDirty || alreadyPushed > 0;

        if (!shouldPush) {
          const at = nowIso();
          DP.Store.setSyncMeta({ accountId: 'github:' + c.owner + '/' + c.repo, lastSyncAt: at });
          setStatus('synced', 'Sincronizzato ' + DP.Fmt.timeAgo(at), { lastSyncAt: at });
          return {
            ok: true,
            pushed: 0,
            pulled: remote ? remote.readings.length : 0,
            total: state.readings.length
          };
        }

        const payload = makePayload(state);
        const pendingChanges = state.readings.filter(function (r) { return r.dirty; }).length;
        try {
          await writeRemote(c, payload, remoteFile ? remoteFile.sha : null);
        } catch (e) {
          lastError = e;
          if ((e.status === 409 || e.status === 422) && attempt < 2) {
            // Un altro dispositivo ha scritto nel frattempo: rileggo e rifaccio il merge.
            continue;
          }
          throw e;
        }

        const ids = state.readings.map(function (r) { return r.id; });
        DP.Store.markSynced(ids, true);
        const at = nowIso();
        DP.Store.setSyncMeta({ accountId: 'github:' + c.owner + '/' + c.repo, lastSyncAt: at });
        setStatus('synced', 'Sincronizzato ' + DP.Fmt.timeAgo(at), { lastSyncAt: at });
        return {
          ok: true,
          pushed: pendingChanges || (profileDirty ? 1 : 0),
          pulled: remote ? remote.readings.length : 0,
          total: state.readings.length
        };
      }
      throw lastError || new Error('Sincronizzazione non completata.');
    } catch (e) {
      const msg = friendlyError(e);
      setStatus('error', msg);
      return { ok: false, error: msg, reason: e && e.network ? 'offline' : 'error' };
    }
  }

  function sync() {
    if (syncPromise) {
      syncAgain = true;
      return syncPromise;
    }
    syncPromise = doSync().finally(function () {
      syncPromise = null;
      if (syncAgain) {
        syncAgain = false;
        setTimeout(function () {
          DP.Cloud.sync().catch(function () { /* ignore */ });
        }, 800);
      }
    });
    return syncPromise;
  }

  function scheduleSync(delay) {
    if (!configured()) return;
    if (DP.Store.settings().autoSync === false) return;
    setTimeout(function () {
      sync().catch(function () { /* ignore */ });
    }, Math.max(300, delay || 1200));
  }

  // ---------- avvio e connessione ----------
  function init() {
    config = readConfig();
    if (!config) {
      setStatus('local', 'Solo su questo dispositivo');
      return Promise.resolve(null);
    }
    const last = DP.Store.get().sync.lastSyncAt;
    setStatus('ready', 'GitHub pronto', { lastSyncAt: last || null });
    return Promise.resolve(config);
  }

  async function restoreSession() {
    const c = current();
    if (!c) {
      setStatus('local', 'Solo su questo dispositivo');
      return null;
    }
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      setStatus('offline', 'Offline: i dati restano sul dispositivo');
      return null;
    }
    try {
      setStatus('connecting', 'Verifico GitHub…');
      verified = await verify(c);
      setStatus('ready', 'Collegato come ' + verified.login);
      return verified;
    } catch (e) {
      setStatus('error', friendlyError(e));
      return null;
    }
  }

  async function connect(input) {
    const cur = current() || {};
    const token = cleanText(input && input.token) || cur.token;
    let owner = cleanText(input && input.owner) || cur.owner;
    const repo = cleanText(input && input.repo) || cur.repo || G.defaultRepo;
    const branch = cleanText(input && input.branch) || G.defaultBranch;
    const path = cleanText(input && input.path) || G.defaultPath;

    if (!token) return { ok: false, error: 'Incolla il token GitHub.' };
    const candidate = normalizeConfig({ token: token, owner: owner || 'pending', repo: repo, branch: branch, path: path });
    if (!candidate) return { ok: false, error: 'Controlla proprietario, repository e token.' };

    try {
      if (!owner) {
        owner = await detectLogin(candidate);
        candidate.owner = owner;
      }
      validateConfig(candidate);
      const info = await verify(candidate);
      saveConfig(candidate);
      verified = info;
      setStatus('ready', 'Collegato come ' + info.login);
      return { ok: true, login: info.login, owner: candidate.owner, repo: candidate.repo };
    } catch (e) {
      return { ok: false, error: friendlyError(e) };
    }
  }

  async function deleteCloudData() {
    const c = current();
    if (!c) return { ok: false, error: 'Sincronizzazione non configurata.' };
    try {
      const remoteFile = await readRemote(c);
      if (!remoteFile) return { ok: true };
      await request(c, contentsPath(c), {
        method: 'DELETE',
        body: {
          message: 'Pressione 2.0: elimina il diario dal repository',
          sha: remoteFile.sha,
          branch: c.branch
        }
      });
      DP.Store.setSyncMeta({ lastSyncAt: null });
      setStatus('ready', 'Diario rimosso da GitHub', { lastSyncAt: null });
      return { ok: true };
    } catch (e) {
      return { ok: false, error: friendlyError(e) };
    }
  }

  function signOut() {
    // Per GitHub "uscire" significa dimenticare il token su questo dispositivo.
    clearConfig();
    return Promise.resolve({ ok: true });
  }

  return {
    configured: configured,
    getConfig: getConfig,
    setConfig: setConfig,
    clearConfig: clearConfig,
    connect: connect,
    init: init,
    restoreSession: restoreSession,
    getStatus: getStatus,
    subscribe: subscribe,
    isSignedIn: configured,
    sync: sync,
    scheduleSync: scheduleSync,
    deleteCloudData: deleteCloudData,
    signOut: signOut
  };
})();
