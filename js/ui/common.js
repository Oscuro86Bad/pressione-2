/* ============================================================
   PRESSIONE 2.0 — componenti comuni dell'interfaccia
   ============================================================ */
window.DP = window.DP || {};

DP.UI = (function () {
  const esc = DP.Fmt.escapeHtml;

  const ICONS = {
    heart: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1L12 21l7.7-7.6 1.1-1a5.5 5.5 0 0 0 0-7.8z"/>',
    gauge: '<path d="M4 18a8 8 0 1 1 16 0"/><path d="M12 14l4.2-4.2"/><path d="M7 18h10"/><circle cx="12" cy="14" r="1.4"/>',
    camera: '<path d="M4 7h3l2-2h6l2 2h3v12H4z"/><circle cx="12" cy="13" r="3.2"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18"/>',
    chart: '<path d="M4 19V5M4 19h16"/><path d="M7 15l4-4 3 3 5-6"/>',
    list: '<path d="M8 6h13M8 12h13M8 18h13"/><path d="M3 6h.01M3 12h.01M3 18h.01"/>',
    settings: '<path d="M4 6h16M4 12h16M4 18h16"/><circle cx="9" cy="6" r="2" fill="var(--surface)"/><circle cx="15" cy="12" r="2" fill="var(--surface)"/><circle cx="8" cy="18" r="2" fill="var(--surface)"/>',
    cloud: '<path d="M7 18a4 4 0 0 1 0-8 5.2 5.2 0 0 1 10-1.5A4.3 4.3 0 1 1 18 18z"/>',
    'cloud-off': '<path d="M3 3l18 18"/><path d="M7 18a4 4 0 0 1-.9-7.9A5.2 5.2 0 0 1 15 5.5M17 10a4.3 4.3 0 0 1 1 8.5H8"/>',
    check: '<path d="M20 6L9 17l-5-5"/>',
    alert: '<path d="M10.3 3.7L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.7a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
    trash: '<path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14M10 11v6M14 11v6"/>',
    edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5M12 15V3"/>',
    upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M17 8l-5-5-5 5M12 3v12"/>',
    printer: '<path d="M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 14h12v8H6z"/>',
    copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    lock: '<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
    x: '<path d="M18 6L6 18M6 6l12 12"/>',
    refresh: '<path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/>',
    'chevron-right': '<path d="M9 18l6-6-6-6"/>',
    'chevron-down': '<path d="M6 9l6 6 6-6"/>',
    'chevron-up': '<path d="M18 15l-6-6-6 6"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
    external: '<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><path d="M15 3h6v6M10 14L21 3"/>',
    shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/>',
    smartphone: '<rect x="6" y="2" width="12" height="20" rx="2"/><path d="M11 18h2"/>',
    pill: '<path d="M10.5 20.5l10-10a4.95 4.95 0 0 0-7-7l-10 10a4.95 4.95 0 0 0 7 7z"/><path d="M8.5 8.5l7 7"/>',
    home: '<path d="M3 11l9-8 9 8v10a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
    menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
    activity: '<path d="M3 12h4l3-8 4 16 3-8h4"/>'
  };

  function icon(name, cls) {
    const body = ICONS[name] || ICONS.info;
    return '<svg class="ic ' + (cls || '') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
      'stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      body + '</svg>';
  }

  function brandMark() {
    return '<span class="brand-mark" aria-hidden="true">' +
      '<svg viewBox="0 0 48 48" fill="none">' +
      '<path d="M24 42S6 30.5 6 18.2A9.8 9.8 0 0 1 24 12a9.8 9.8 0 0 1 18 6.2C42 30.5 24 42 24 42z" fill="currentColor"/>' +
      '<path d="M10 24h8.2l3-6.4 5.2 13 3-6.6H38" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>' +
      '</svg></span>';
  }

  function chip(text, tone, extra) {
    return '<span class="chip chip-' + (tone || 'neutral') + ' ' + (extra || '') + '">' +
      esc(text) + '</span>';
  }

  function valueBadge(cat) {
    return '<span class="status status-' + cat.tone + '">' + esc(cat.label) + '</span>';
  }

  function iconBtn(action, iconName, label, cls, attrs) {
    return '<button type="button" class="icon-btn ' + (cls || '') + '" data-action="' + action + '" ' +
      'aria-label="' + esc(label) + '" title="' + esc(label) + '" ' + (attrs || '') + '>' +
      icon(iconName) + '</button>';
  }

  // ---------- shell ----------
  function initShell() {
    const app = document.getElementById('app');
    if (!app) return;
    app.innerHTML =
      '<header class="topbar">' +
        '<button class="brand" type="button" data-route="oggi" aria-label="Vai alla pagina Oggi">' +
          brandMark() +
          '<span class="brand-text"><span class="brand-name">Pressione <b>2.0</b></span>' +
          '<span class="brand-sub">diario pressorio</span></span>' +
        '</button>' +
        '<div class="topbar-actions">' +
          '<button type="button" class="sync-chip" id="sync-chip" data-action="sync-now" title="Sincronizza">' +
            '<span class="sync-dot"></span><span id="sync-label">Solo locale</span>' +
          '</button>' +
          '<button type="button" class="avatar" id="avatar-btn" data-route="impostazioni" aria-label="Profilo e impostazioni">' +
            '<span id="avatar-initial">?</span>' +
          '</button>' +
        '</div>' +
      '</header>' +
      '<nav class="tabs" id="tabs" aria-label="Sezioni dell’app">' +
        '<button type="button" class="tab" data-route="oggi">' + icon('home') + '<span>Oggi</span></button>' +
        '<button type="button" class="tab" data-route="diario">' + icon('list') + '<span>Diario</span></button>' +
        '<button type="button" class="tab" data-route="report">' + icon('chart') + '<span>Report</span></button>' +
        '<button type="button" class="tab" data-route="impostazioni">' + icon('settings') + '<span>Impostazioni</span></button>' +
      '</nav>' +
      '<main id="view" class="view" tabindex="-1"></main>' +
      '<footer class="app-footer">' +
        '<span>Pressione 2.0 · I dati sono tuoi</span>' +
        '<span class="footer-sep">·</span>' +
        '<span>Non sostituisce il medico</span>' +
      '</footer>' +
      '<div id="offline-bar" class="offline-bar" hidden>' + icon('cloud-off') +
        '<span>Sei offline: i dati restano sul dispositivo e verranno sincronizzati appena torni online.</span>' +
      '</div>';

    updateHeader();
    updateOnline();
  }

  function updateHeader() {
    const state = DP.Store.get();
    const initialEl = document.getElementById('avatar-initial');
    if (initialEl) {
      const name = (state.profile.name || '').trim();
      initialEl.textContent = name ? name.charAt(0).toUpperCase() : '?';
    }
    const app = document.getElementById('app');
    if (app) app.classList.toggle('onboarding', !state.onboarded);
  }

  function setActiveRoute(route) {
    document.querySelectorAll('.tab').forEach(function (el) {
      el.classList.toggle('active', el.getAttribute('data-route') === route);
    });
  }

  function setSyncStatus(st) {
    const chipEl = document.getElementById('sync-chip');
    const label = document.getElementById('sync-label');
    if (!chipEl || !label) return;
    const s = st || DP.Cloud.getStatus();
    const map = {
      local: 'Solo locale',
      connecting: 'Connessione…',
      ready: 'Pronto',
      syncing: 'Sincronizzo…',
      synced: 'Sincronizzato',
      offline: 'Offline',
      error: 'Sync da controllare'
    };
    label.textContent = map[s.state] || 'Sync';
    chipEl.className = 'sync-chip sync-' + s.state;
    let title = s.message || '';
    if (s.lastSyncAt) title += ' · ultimo sync ' + DP.Fmt.timeAgo(s.lastSyncAt);
    if (s.email) title += ' · ' + s.email;
    chipEl.title = title || 'Sincronizzazione';
    chipEl.setAttribute('aria-label', 'Sincronizzazione: ' + (s.message || map[s.state] || ''));
  }

  function updateOnline() {
    const bar = document.getElementById('offline-bar');
    if (!bar) return;
    const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
    bar.hidden = !offline;
    document.body.classList.toggle('is-offline', offline);
  }

  // ---------- toast ----------
  function toast(message, type, duration) {
    const root = document.getElementById('toast-root');
    if (!root) return;
    while (root.children.length >= 3) root.removeChild(root.firstChild);
    const el = document.createElement('div');
    el.className = 'toast toast-' + (type || 'info');
    el.setAttribute('role', 'status');
    const iconName = type === 'ok' ? 'check' : type === 'error' ? 'alert' : type === 'warn' ? 'alert' : 'info';
    el.innerHTML = icon(iconName) + '<div>' + esc(message) + '</div>';
    root.appendChild(el);
    const ms = duration === 0 ? 0 : (duration || (type === 'error' ? 6000 : 3600));
    if (ms) {
      setTimeout(function () {
        el.classList.add('toast-out');
        setTimeout(function () { el.remove(); }, 260);
      }, ms);
    }
    return el;
  }

  // ---------- modali ----------
  const modalStack = [];

  function syncBodyLock() {
    document.documentElement.classList.toggle('modal-open', modalStack.length > 0);
  }

  function closeTopModal(result) {
    const top = modalStack[modalStack.length - 1];
    if (top) top.close(result);
  }

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && modalStack.length) {
      const top = modalStack[modalStack.length - 1];
      if (top.dismissible) {
        e.preventDefault();
        top.close();
      }
    }
  });

  function openModal(options) {
    const opts = options || {};
    const root = document.getElementById('modal-root');
    if (!root) return null;

    const overlay = document.createElement('div');
    overlay.className = 'overlay';
    const titleId = 'modal-title-' + Math.random().toString(36).slice(2, 8);
    overlay.innerHTML =
      '<div class="modal ' + (opts.className || '') + (opts.wide ? ' modal-wide' : '') + '" role="dialog" aria-modal="true" ' +
        'aria-labelledby="' + titleId + '">' +
        '<div class="modal-head">' +
          '<div><h2 id="' + titleId + '">' + esc(opts.title || '') + '</h2>' +
          (opts.subtitle ? '<p>' + esc(opts.subtitle) + '</p>' : '') + '</div>' +
          '<button type="button" class="icon-btn modal-x" aria-label="Chiudi">' + icon('x') + '</button>' +
        '</div>' +
        '<div class="modal-body"></div>' +
        (opts.footer ? '<div class="modal-foot"></div>' : '') +
      '</div>';

    const modal = overlay.querySelector('.modal');
    const body = overlay.querySelector('.modal-body');
    const foot = overlay.querySelector('.modal-foot');
    body.innerHTML = opts.body || '';
    if (foot) foot.innerHTML = opts.footer || '';

    const previousFocus = document.activeElement;
    let closed = false;

    function close(result) {
      if (closed) return;
      closed = true;
      const idx = modalStack.findIndex(function (m) { return m.overlay === overlay; });
      if (idx >= 0) modalStack.splice(idx, 1);
      overlay.classList.add('overlay-out');
      setTimeout(function () {
        overlay.remove();
        syncBodyLock();
      }, 180);
      if (previousFocus && previousFocus.focus) {
        setTimeout(function () { try { previousFocus.focus(); } catch (e) { /* ignore */ } }, 60);
      }
      if (typeof opts.onClose === 'function') opts.onClose(result);
    }

    const entry = {
      overlay: overlay,
      close: close,
      dismissible: opts.dismissible !== false
    };
    modalStack.push(entry);
    syncBodyLock();

    overlay.querySelector('.modal-x').addEventListener('click', function () { close(); });
    overlay.addEventListener('mousedown', function (e) {
      if (e.target === overlay && entry.dismissible) close();
    });

    root.appendChild(overlay);
    if (typeof opts.onMount === 'function') {
      try { opts.onMount({ overlay: overlay, modal: modal, body: body, foot: foot, close: close }); }
      catch (e) { console.error(e); }
    }

    setTimeout(function () {
      const focusable = overlay.querySelector('[autofocus], input:not([type="hidden"]), select, textarea, button.btn-primary');
      if (focusable) {
        try { focusable.focus({ preventScroll: true }); } catch (e2) { /* ignore */ }
        if (focusable.select && focusable.tagName === 'INPUT') {
          try { focusable.select(); } catch (e3) { /* ignore */ }
        }
      }
    }, 80);

    return { overlay: overlay, modal: modal, body: body, foot: foot, close: close };
  }

  function confirm(options) {
    const opts = options || {};
    return new Promise(function (resolve) {
      let done = false;
      const m = openModal({
        title: opts.title || 'Confermi?',
        subtitle: opts.subtitle || '',
        body: '<p class="confirm-text">' + esc(opts.message || '') + '</p>' +
          (opts.extraHtml || ''),
        footer:
          '<button type="button" class="btn btn-ghost" data-confirm="no">' + esc(opts.cancelLabel || 'Annulla') + '</button>' +
          '<button type="button" class="btn ' + (opts.danger ? 'btn-danger' : 'btn-primary') + '" data-confirm="yes">' +
          esc(opts.confirmLabel || 'Conferma') + '</button>',
        className: 'modal-confirm',
        dismissible: opts.dismissible !== false,
        onMount: function (ctx) {
          ctx.foot.querySelectorAll('[data-confirm]').forEach(function (btn) {
            btn.addEventListener('click', function () {
              done = true;
              const yes = btn.getAttribute('data-confirm') === 'yes';
              resolve(yes);
              ctx.close();
            });
          });
        },
        onClose: function () {
          if (!done) { done = true; resolve(false); }
        }
      });
      if (!m) { resolve(false); }
    });
  }

  // ---------- pezzi di interfaccia ----------
  function sectionTitle(title, sub) {
    return '<div class="section-title"><h2>' + esc(title) + '</h2>' +
      (sub ? '<p>' + esc(sub) + '</p>' : '') + '</div>';
  }

  function emptyState(opts) {
    const o = opts || {};
    return '<div class="empty-state">' +
      '<div class="empty-icon">' + icon(o.icon || 'activity') + '</div>' +
      '<h3>' + esc(o.title || 'Ancora nessun dato') + '</h3>' +
      '<p>' + esc(o.text || '') + '</p>' +
      (o.action || '') +
    '</div>';
  }

  function tipsCard(open) {
    return '<details class="card tips-card"' + (open ? ' open' : '') + '>' +
      '<summary>' + icon('info') + '<span>Come misurare bene</span>' + icon('chevron-down', 'summary-chev') + '</summary>' +
      '<ul>' + DP.CONFIG.tips.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul>' +
    '</details>';
  }

  function disclaimer() {
    return '<p class="disclaimer">' + icon('shield') + '<span>' + esc(DP.CONFIG.disclaimer) + '</span></p>';
  }

  function statCard(label, value, sub, tone) {
    return '<div class="stat-card ' + (tone ? 'stat-' + tone : '') + '">' +
      '<span class="stat-label">' + esc(label) + '</span>' +
      '<span class="stat-value">' + value + '</span>' +
      (sub ? '<span class="stat-sub">' + esc(sub) + '</span>' : '') +
    '</div>';
  }

  function showStorageWarning() {
    if (DP.Store.isStorageAvailable() && !DP.Store.saveError()) return '';
    const msg = DP.Store.saveError() || 'La memoria del browser non è disponibile: i dati potrebbero non essere salvati.';
    return '<div class="inline-warning">' + icon('alert') + '<span>' + esc(msg) + '</span></div>';
  }

  return {
    ICONS: ICONS,
    icon: icon,
    brandMark: brandMark,
    esc: esc,
    chip: chip,
    valueBadge: valueBadge,
    iconBtn: iconBtn,
    initShell: initShell,
    updateHeader: updateHeader,
    setActiveRoute: setActiveRoute,
    setSyncStatus: setSyncStatus,
    updateOnline: updateOnline,
    toast: toast,
    openModal: openModal,
    closeTopModal: closeTopModal,
    confirm: confirm,
    sectionTitle: sectionTitle,
    emptyState: emptyState,
    tipsCard: tipsCard,
    disclaimer: disclaimer,
    statCard: statCard,
    showStorageWarning: showStorageWarning
  };
})();
