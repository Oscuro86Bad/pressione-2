/* ============================================================
   PRESSIONE 2.0 — avvio, navigazione e azioni comuni
   ============================================================ */
window.DP = window.DP || {};

DP.App = (function () {
  const ROUTES = {
    oggi: { title: 'Oggi', view: 'dashboard' },
    diario: { title: 'Diario', view: 'diary' },
    report: { title: 'Report', view: 'report' },
    impostazioni: { title: 'Impostazioni', view: 'settings' }
  };

  let currentRoute = 'oggi';
  let lastRendered = null;
  let deferredPrompt = null;
  let refreshTimer = null;
  let resizeTimer = null;
  let booted = false;

  function viewEl() {
    return document.getElementById('view');
  }

  function routeFromHash() {
    const raw = String(window.location.hash || '').replace(/^#\/?/, '').split('?')[0].trim();
    return ROUTES[raw] ? raw : 'oggi';
  }

  function setTitle(label) {
    document.title = (label ? label + ' · ' : '') + DP.CONFIG.appName;
  }

  // ---------- rendering ----------
  function render(options) {
    if (!booted) return;
    const opts = options || {};
    if (refreshTimer) { clearTimeout(refreshTimer); refreshTimer = null; }

    const state = DP.Store.get();
    const view = viewEl();
    if (!view) return;

    DP.UI.updateHeader();
    DP.UI.updateOnline();

    if (!state.onboarded) {
      currentRoute = 'oggi';
      lastRendered = 'onboarding';
      DP.UI.setActiveRoute('');
      view.innerHTML = DP.Views.onboarding.render();
      DP.Views.onboarding.mount();
      setTitle('Benvenuto');
      window.scrollTo(0, 0);
      return;
    }

    let route = opts.route || routeFromHash();
    if (!ROUTES[route]) route = 'oggi';
    currentRoute = route;
    const module = DP.Views[ROUTES[route].view];
    if (!module) {
      view.innerHTML = '<div class="page"><div class="card">' +
        '<h2>Sezione non disponibile</h2><p>Ricarica l’app per risolvere il problema.</p></div></div>';
      return;
    }

    DP.UI.setActiveRoute(route);
    view.innerHTML = module.render();
    module.mount();

    const routeChanged = lastRendered !== null && lastRendered !== route;
    lastRendered = route;
    if (routeChanged || !opts.preserveScroll) {
      window.scrollTo(0, 0);
    }
    setTitle(ROUTES[route].title);
  }

  function refresh() {
    render({ preserveScroll: true });
  }

  function scheduleRefresh(delay) {
    if (refreshTimer) clearTimeout(refreshTimer);
    refreshTimer = setTimeout(function () {
      refreshTimer = null;
      refresh();
    }, Math.max(40, delay || 80));
  }

  function go(route) {
    const r = ROUTES[route] ? route : 'oggi';
    if (routeFromHash() === r) {
      render({ route: r, preserveScroll: false });
    } else {
      window.location.hash = r;
    }
  }

  // ---------- azioni ----------
  function exportJson() {
    const backup = DP.Store.exportBackup();
    const name = 'pressione-2.0-backup-' + DP.Fmt.todayKey() + '.json';
    DP.Fmt.download(name, JSON.stringify(backup, null, 2), 'application/json;charset=utf-8');
    DP.UI.toast('Backup JSON scaricato.', 'ok');
  }

  function exportCsv() {
    const list = DP.Store.readings();
    if (!list.length) {
      DP.UI.toast('Non ci sono misurazioni da esportare.', 'warn');
      return;
    }
    const name = 'pressione-2.0-misurazioni-' + DP.Fmt.todayKey() + '.csv';
    DP.Fmt.download(name, DP.Stats.csv(list), 'text/csv;charset=utf-8');
    DP.UI.toast('CSV scaricato.', 'ok');
  }

  async function syncNow() {
    if (!DP.Cloud.configured()) { DP.AuthUI.openSetup(); return; }
    if (!DP.Cloud.isSignedIn()) { DP.AuthUI.open(); return; }
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      DP.UI.toast('Sei offline: le modifiche restano sul dispositivo e partiranno al ritorno della connessione.', 'warn');
      return;
    }
    DP.UI.toast('Sincronizzazione in corso…', 'info', 2200);
    const res = await DP.Cloud.sync(DP.Store.get());
    if (res && res.ok) {
      DP.UI.toast('Sincronizzato. ' + res.pushed + ' inviate, ' + res.pulled + ' ricevute.', 'ok');
      refresh();
    } else if (res && res.error && res.reason !== 'offline' && res.reason !== 'no-auth') {
      DP.UI.toast(res.error, 'error');
    }
  }

  async function logout() {
    const yes = await DP.UI.confirm({
      title: 'Uscire dall’account?',
      message: 'Le misurazioni restano su questo dispositivo. Potrai rientrare quando vuoi: il diario locale non viene cancellato.',
      confirmLabel: 'Esci',
      cancelLabel: 'Annulla'
    });
    if (!yes) return;
    const res = await DP.Cloud.signOut();
    if (!res.ok) {
      DP.UI.toast(res.error || 'Non sono riuscito a uscire.', 'error');
      return;
    }
    DP.UI.toast('Sei uscito dall’account.', 'ok');
    DP.UI.updateHeader();
    refresh();
  }

  async function removeCloudConfig() {
    const yes = await DP.UI.confirm({
      title: 'Rimuovere la sincronizzazione?',
      message: 'Il collegamento a Supabase viene rimosso da questo dispositivo. Le misurazioni locali restano; quelle nel cloud non vengono cancellate.',
      confirmLabel: 'Rimuovi',
      danger: true
    });
    if (!yes) return;
    try { await DP.Cloud.signOut(); } catch (e) { /* ignore */ }
    DP.Cloud.clearConfig();
    DP.UI.toast('Configurazione rimossa. Ricarico l’app…', 'ok');
    setTimeout(function () { window.location.reload(); }, 700);
  }

  async function clearLocalReadings() {
    const active = DP.Store.readings();
    if (!active.length) {
      DP.UI.toast('Non ci sono misurazioni da cancellare.', 'warn');
      return;
    }
    const signed = DP.Cloud.isSignedIn();
    const yes = await DP.UI.confirm({
      title: 'Cancellare tutte le misurazioni?',
      message: 'Verranno eliminate ' + active.length + ' ' +
        DP.Fmt.plural(active.length, 'misurazione', 'misurazioni') + ' dal diario' +
        (signed ? ' e, al prossimo sync, anche dal tuo account Supabase' : ' su questo dispositivo') +
        '. Il profilo e il target restano. L’operazione non si può annullare: se vuoi conservare una copia, esporta prima il backup JSON.',
      confirmLabel: 'Cancella tutto',
      cancelLabel: 'Annulla',
      danger: true
    });
    if (!yes) return;

    // Cancellazione "morbida": crea le tombstone così la cancellazione
    // arriva anche al cloud e i dati non ricompaiono al prossimo sync.
    const now = new Date().toISOString();
    const tombstones = active.map(function (r) {
      return Object.assign({}, r, { deleted: true, updatedAt: now, dirty: true });
    });
    DP.Store.mergeReadings(tombstones);
    DP.UI.toast('Misurazioni cancellate.', 'ok');
    afterDataChange();
  }

  async function clearCloudData() {
    if (!DP.Cloud.isSignedIn()) { DP.AuthUI.open(); return; }
    const yes = await DP.UI.confirm({
      title: 'Eliminare i dati dal cloud?',
      message: 'Tutte le misurazioni e il profilo vengono eliminati dal tuo account Supabase e anche da questo dispositivo. Gli altri dispositivi collegati perderanno i dati al prossimo sync. L’operazione non si può annullare: esporta prima un backup se ti serve.',
      confirmLabel: 'Elimina dal cloud',
      cancelLabel: 'Annulla',
      danger: true
    });
    if (!yes) return;
    const res = await DP.Cloud.deleteCloudData();
    if (!res.ok) {
      DP.UI.toast(res.error || 'Non sono riuscito a cancellare i dati dal cloud.', 'error');
      return;
    }
    DP.Store.setReadings([], 'cloud-clear');
    DP.Store.setSyncMeta({ lastSyncAt: null });
    DP.UI.toast('Dati eliminati dal cloud e dal dispositivo.', 'ok');
    refresh();
  }

  function triggerImport() {
    const input = document.getElementById('import-input');
    if (!input) return;
    input.value = '';
    input.click();
  }

  async function handleImportFile(file) {
    if (!file) return;
    const res = await DP.Store.importFile(file);
    if (!res.ok) {
      DP.UI.toast(res.error || 'Importazione non riuscita.', 'error');
      return;
    }
    let msg = 'Importate ' + res.added + ' ' + DP.Fmt.plural(res.added, 'misurazione', 'misurazioni') + '.';
    if (res.total && res.added === 0) msg = 'Nessuna nuova misurazione: erano già tutte presenti.';
    if (res.profile) msg += ' Profilo aggiornato dal backup.';
    if (res.android) msg += ' Backup della vecchia app Android riconosciuto.';
    DP.UI.toast(msg, 'ok');
    afterDataChange();
  }

  async function persistStorage() {
    try {
      if (!navigator.storage || !navigator.storage.persist) {
        DP.UI.toast('Questo browser non permette di richiedere la protezione dei dati.', 'warn');
        return;
      }
      const already = navigator.storage.persisted ? await navigator.storage.persisted() : false;
      if (already) {
        DP.UI.toast('I dati del diario sono già protetti dalla pulizia automatica.', 'ok');
        return;
      }
      const granted = await navigator.storage.persist();
      DP.UI.toast(granted
        ? 'Protezione attivata: il browser non eliminerà i dati automaticamente.'
        : 'Il browser non ha concesso la protezione. Esporta un backup ogni tanto.', granted ? 'ok' : 'warn');
    } catch (e) {
      DP.UI.toast('Non sono riuscito a richiedere la protezione dei dati.', 'warn');
    }
  }

  async function installApp() {
    if (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) {
      DP.UI.toast('L’app è già installata.', 'ok');
      return;
    }
    if (deferredPrompt) {
      const prompt = deferredPrompt;
      deferredPrompt = null;
      try {
        prompt.prompt();
        const choice = await prompt.userChoice;
        if (choice && choice.outcome === 'accepted') {
          DP.UI.toast('Installazione avviata.', 'ok');
        } else {
          DP.UI.toast('Puoi installarla più tardi dal menu del browser.', 'info');
        }
      } catch (e) {
        DP.UI.toast('Installazione non disponibile: usa il menu del browser.', 'warn');
      }
      return;
    }
    DP.UI.openModal({
      title: 'Installa Pressione 2.0',
      subtitle: 'Un’icona sulla schermata home, come una vera app.',
      body:
        '<div class="install-steps">' +
          '<div class="install-step"><span class="step-num">1</span><div><b>Android · Chrome</b>' +
            '<p>Apri il menu ⋮ in alto a destra e scegli <b>Installa app</b> o <b>Aggiungi alla schermata Home</b>.</p></div></div>' +
          '<div class="install-step"><span class="step-num">2</span><div><b>iPhone · Safari</b>' +
            '<p>Tocca il pulsante <b>Condividi</b> (quadrato con freccia) e scegli <b>Aggiungi alla schermata Home</b>.</p></div></div>' +
          '<div class="install-step"><span class="step-num">3</span><div><b>Computer · Chrome o Edge</b>' +
            '<p>Clicca l’icona di installazione nella barra degli indirizzi, oppure menu → <b>Installa Pressione 2.0</b>.</p></div></div>' +
        '</div>' +
        '<p class="small-note">Se non vedi l’opzione, apri l’app da GitHub Pages (https) e ricarica la pagina una volta.</p>',
      footer: '<button type="button" class="btn btn-primary" data-install-ok>Ho capito</button>',
      onMount: function (ctx) {
        ctx.foot.querySelector('[data-install-ok]').addEventListener('click', function () { ctx.close(); });
      }
    });
  }

  async function checkUpdate() {
    if (!('serviceWorker' in navigator)) {
      DP.UI.toast('Questo browser non supporta l’aggiornamento automatico.', 'warn');
      return;
    }
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      if (!reg) {
        DP.UI.toast('App non ancora registrata per l’uso offline.', 'warn');
        return;
      }
      await reg.update();
      DP.UI.toast('Controllo completato. Se è disponibile una nuova versione, chiudi e riapri l’app.', 'ok');
    } catch (e) {
      DP.UI.toast('Non riesco a controllare gli aggiornamenti adesso.', 'warn');
    }
  }

  function handleAction(action, el) {
    switch (action) {
      case 'new-reading':
        DP.EntryUI.open();
        break;
      case 'photo-reading':
        DP.EntryUI.open({ start: 'photo' });
        break;
      case 'edit-reading': {
        const id = el.getAttribute('data-id');
        const reading = id ? DP.Store.getReading(id) : null;
        if (reading) DP.EntryUI.open({ reading: reading });
        else DP.UI.toast('Misurazione non trovata: aggiorna la pagina.', 'warn');
        break;
      }
      case 'sync-now':
        syncNow();
        break;
      case 'open-auth':
        DP.AuthUI.open();
        break;
      case 'open-auth-signup':
        DP.AuthUI.open('signup');
        break;
      case 'open-cloud-setup':
        DP.AuthUI.openSetup();
        break;
      case 'remove-cloud-config':
        removeCloudConfig();
        break;
      case 'logout':
        logout();
        break;
      case 'export-json':
        exportJson();
        break;
      case 'export-csv':
        exportCsv();
        break;
      case 'import-backup':
        triggerImport();
        break;
      case 'clear-local':
        clearLocalReadings();
        break;
      case 'clear-cloud':
        clearCloudData();
        break;
      case 'persist-storage':
        persistStorage();
        break;
      case 'install-app':
        installApp();
        break;
      case 'check-update':
        checkUpdate();
        break;
      case 'reset-diary-filters':
        DP.Views.diary.reset();
        break;
      case 'print-report':
        DP.Views.report.print();
        break;
      case 'copy-summary':
        DP.Views.report.copySummary();
        break;
      default:
        break;
    }
  }

  function handleChange(el) {
    const action = el.getAttribute('data-change-action');
    if (!action) return;
    if (action === 'toggle-auto-sync') {
      DP.Store.setSettings({ autoSync: !!el.checked });
      DP.UI.toast(el.checked ? 'Sincronizzazione automatica attiva.' : 'Sincronizzazione automatica disattivata.', 'ok');
      if (el.checked) DP.Cloud.scheduleSync(400);
      return;
    }
    if (action === 'toggle-tips') {
      DP.Store.setSettings({ showTips: !!el.checked });
      refresh();
      return;
    }
    if (action === 'set-default-period') {
      const d = DP.toInt(el.value, 30);
      DP.Store.setSettings({ periodDays: d });
      DP.UI.toast('Periodo predefinito aggiornato.', 'ok');
      refresh();
    }
  }

  // ---------- eventi ----------
  function bindEvents() {
    document.addEventListener('click', function (e) {
      const routeEl = e.target.closest && e.target.closest('[data-route]');
      if (routeEl) {
        e.preventDefault();
        go(routeEl.getAttribute('data-route'));
        return;
      }
      const actionEl = e.target.closest && e.target.closest('[data-action]');
      if (actionEl) {
        e.preventDefault();
        handleAction(actionEl.getAttribute('data-action'), actionEl);
      }
    });

    document.addEventListener('change', function (e) {
      const el = e.target.closest && e.target.closest('[data-change-action]');
      if (el) handleChange(el);
    });

    window.addEventListener('hashchange', function () {
      render({ preserveScroll: false });
    });

    window.addEventListener('online', function () {
      DP.UI.updateOnline();
      DP.UI.setSyncStatus();
      if (DP.Cloud.isSignedIn()) DP.Cloud.scheduleSync(600);
    });
    window.addEventListener('offline', function () {
      DP.UI.updateOnline();
    });

    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState !== 'visible') return;
      if (!DP.Cloud.isSignedIn()) return;
      const st = DP.Cloud.getStatus();
      const last = st.lastSyncAt ? new Date(st.lastSyncAt).getTime() : 0;
      if (!last || Date.now() - last > 5 * 60000) DP.Cloud.scheduleSync(500);
    });

    window.addEventListener('resize', function () {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () {
        const view = DP.Views[ROUTES[currentRoute] ? ROUTES[currentRoute].view : ''];
        if (view && typeof view.resize === 'function') view.resize();
      }, 160);
    });

    window.addEventListener('beforeinstallprompt', function (e) {
      e.preventDefault();
      deferredPrompt = e;
    });
    window.addEventListener('appinstalled', function () {
      deferredPrompt = null;
      DP.UI.toast('Pressione 2.0 installata sul dispositivo.', 'ok');
    });

    const importInput = document.getElementById('import-input');
    if (importInput) {
      importInput.addEventListener('change', function (e) {
        const file = e.target.files && e.target.files[0];
        e.target.value = '';
        if (file) handleImportFile(file);
      });
    }

    DP.Store.subscribe(function (state, action) {
      DP.UI.updateHeader();
      if (action === 'sync-merge' || action === 'sync-profile' || action === 'readings-merge' ||
          action === 'readings-replace' || action === 'cloud-clear' || action === 'import' ||
          action === 'reading-add' || action === 'reading-update' || action === 'reading-delete' ||
          action === 'profile' || action === 'clear') {
        scheduleRefresh(90);
      }
    });
  }

  // ---------- cloud ----------
  function initCloud() {
    if (!DP.Cloud.configured()) {
      DP.UI.setSyncStatus();
      return;
    }

    DP.Cloud.subscribe(function (status) {
      DP.UI.setSyncStatus(status);
      const pill = document.querySelector('.sync-pill');
      if (pill) {
        pill.className = 'sync-pill sync-pill-' + status.state;
        pill.textContent = DP.AuthUI.syncLabel(status.state);
      }
    });

    DP.Cloud.onAuth(function (event) {
      if (event === 'recovery') {
        DP.AuthUI.openRecovery();
        return;
      }
      if (event === 'signed-in' || event === 'signed-out') {
        DP.UI.updateHeader();
        if (currentRoute === 'impostazioni') refresh();
      }
    });

    DP.Cloud.init().catch(function () { /* stato già mostrato nell'interfaccia */ });
    DP.Cloud.restoreSession().then(function (session) {
      DP.UI.setSyncStatus();
      if (session) DP.Cloud.scheduleSync(600);
      if (currentRoute === 'impostazioni') refresh();
    }).catch(function () { /* offline o libreria non disponibile */ });
  }

  // ---------- service worker ----------
  function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    if (window.location.protocol === 'file:') return;
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then(function (reg) {
        if (reg.waiting) {
          DP.UI.toast('È pronta una nuova versione: chiudi e riapri l’app per aggiornarla.', 'info', 7000);
        }
      }).catch(function (e) {
        console.warn('Service worker non registrato:', e && e.message ? e.message : e);
      });
    });

    let hadController = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.addEventListener('controllerchange', function () {
      if (!hadController) { hadController = true; return; }
      DP.UI.toast('Nuova versione attiva: chiudi e riapri l’app se noti qualcosa di strano.', 'info', 7000);
    });
  }

  // ---------- avvio ----------
  function boot() {
    if (booted) return;
    booted = true;

    DP.UI.initShell();
    DP.UI.setSyncStatus();
    bindEvents();
    render();

    initCloud();
    registerServiceWorker();

    if (window.location.protocol === 'file:') {
      setTimeout(function () {
        DP.UI.toast('Stai aprendo l’app da un file locale: per sincronizzazione, OCR e installazione serve GitHub Pages o un server locale.', 'warn', 9000);
      }, 900);
    }

    window.addEventListener('unhandledrejection', function (e) {
      if (window.console && console.warn) console.warn('Operazione non completata:', e.reason);
    });
  }

  function afterDataChange() {
    scheduleRefresh(10);
    if (DP.Cloud.isSignedIn() && DP.Store.settings().autoSync !== false) {
      DP.Cloud.scheduleSync(700);
    }
  }

  function onCloudReady() {
    DP.UI.updateHeader();
    DP.UI.setSyncStatus();
    refresh();
  }

  const api = {
    go: go,
    render: render,
    refresh: refresh,
    afterDataChange: afterDataChange,
    onCloudReady: onCloudReady,
    current: function () { return currentRoute; },
    syncNow: syncNow,
    checkUpdate: checkUpdate,
    install: installApp
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  return api;
})();
