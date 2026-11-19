/* ============================================================
   PRESSIONE 2.0 — sincronizzazione GitHub: banner e configurazione
   ============================================================ */
window.DP = window.DP || {};
DP.AuthUI = (function () {
  const esc = DP.Fmt.escapeHtml;

  function guideLink() {
    return DP.CONFIG.repoUrl + '#-sincronizzazione-con-github-privato';
  }

  // ---------- banner e sezione impostazioni ----------
  function syncBanner() {
    const st = DP.Cloud.getStatus();
    if (!DP.Cloud.configured()) {
      return '<div class="sync-banner sync-banner-muted">' +
        '<div class="sync-banner-icon">' + DP.UI.icon('cloud-off') + '</div>' +
        '<div class="sync-banner-text"><b>Diario solo su questo dispositivo</b>' +
        '<span>Collega un repository GitHub privato per ritrovare le misurazioni su telefono e computer.</span></div>' +
        '<button type="button" class="btn btn-ghost btn-sm" data-action="open-cloud-setup">Configura</button>' +
      '</div>';
    }
    if (st.state === 'error') {
      return '<div class="sync-banner sync-banner-error">' +
        '<div class="sync-banner-icon">' + DP.UI.icon('alert') + '</div>' +
        '<div class="sync-banner-text"><b>Sincronizzazione da controllare</b><span>' + esc(st.message) + '</span></div>' +
        '<button type="button" class="btn btn-ghost btn-sm" data-action="sync-now">Riprova</button>' +
      '</div>';
    }
    if (st.state === 'offline') {
      return '<div class="sync-banner sync-banner-muted">' +
        '<div class="sync-banner-icon">' + DP.UI.icon('cloud-off') + '</div>' +
        '<div class="sync-banner-text"><b>Sei offline</b>' +
        '<span>Le modifiche restano sul dispositivo e verranno inviate appena torni online.</span></div>' +
        '<button type="button" class="btn btn-ghost btn-sm" data-action="sync-now">Riprova</button>' +
      '</div>';
    }
    return '';
  }

  function accountSection() {
    const st = DP.Cloud.getStatus();
    const cfg = DP.Cloud.getConfig();
    const configured = DP.Cloud.configured();
    const auto = DP.Store.settings().autoSync !== false;

    let html = '<section class="card" id="account-card">' +
      '<div class="card-head"><div><h2>' + DP.UI.icon('cloud') + ' Sincronizzazione</h2>' +
      '<p>GitHub privato · il diario vive in un file JSON nel tuo repository</p></div>' +
      '<span class="sync-pill sync-pill-' + st.state + '">' + esc(syncLabel(st.state)) + '</span></div>';

    if (!configured) {
      html += '<p class="muted">La sincronizzazione non è ancora configurata. L’app funziona comunque e salva i dati su questo dispositivo.</p>' +
        '<button type="button" class="btn btn-primary btn-block" data-action="open-cloud-setup">' +
        DP.UI.icon('cloud') + ' Collega GitHub</button>' +
        '<p class="small-note">Ti servono un repository <b>privato</b> e un token GitHub limitato a quel repository. La procedura guidata è nella finestra successiva.</p>';
    } else {
      html += '<div class="account-row">' +
        '<div class="account-avatar">' + DP.UI.icon('github') + '</div>' +
        '<div><b>' + esc(cfg.owner + '/' + cfg.repo) + '</b>' +
        '<span>' + (st.lastSyncAt ? 'Ultimo sync ' + esc(DP.Fmt.timeAgo(st.lastSyncAt)) : 'In attesa del primo sync') +
        (st.login ? ' · ' + esc(st.login) : '') + '</span></div>' +
      '</div>' +
      '<label class="switch-row"><input type="checkbox" id="auto-sync-toggle" data-change-action="toggle-auto-sync" ' + (auto ? 'checked' : '') + '>' +
        '<span><b>Sincronizzazione automatica</b><small>Invia le modifiche appena sei online.</small></span></label>' +
      '<div class="btn-row btn-row-wrap">' +
        '<button type="button" class="btn btn-primary" data-action="sync-now">' + DP.UI.icon('refresh') + ' Sincronizza ora</button>' +
        '<button type="button" class="btn btn-ghost" data-action="open-cloud-setup">Modifica</button>' +
        '<button type="button" class="btn btn-ghost btn-danger-ghost" data-action="remove-cloud-config">Scollega</button>' +
      '</div>' +
      '<p class="small-note">' + DP.UI.icon('lock') + ' File <code>' + esc(cfg.branch + '/' + cfg.path) + '</code>. ' +
        'Il token resta solo su questo dispositivo e non viene mai pubblicato.</p>' +
      '<details class="advanced"><summary>Come è protetto</summary>' +
        '<p class="small-note">Il repository deve essere <b>privato</b>: l’app rifiuta di scrivere su repository pubblici. ' +
        'Usa un token <b>fine-grained</b> con accesso al solo repository del diario e permesso ' +
        '<b>Contents: Read and write</b>. Se revochi il token da GitHub, l’app smette subito di accedere ai dati.</p>' +
      '</details>';
    }

    html += '</section>';
    return html;
  }

  function syncLabel(state) {
    const map = {
      local: 'Solo locale',
      connecting: 'Connessione',
      ready: 'Pronto',
      syncing: 'Sincronizzo',
      synced: 'Sincronizzato',
      offline: 'Offline',
      error: 'Errore'
    };
    return map[state] || 'Sync';
  }

  // ---------- configurazione ----------
  function open() {
    return openSetup();
  }

  function openSetup() {
    const cfg = DP.Cloud.getConfig();
    const editing = !!cfg;
    const m = DP.UI.openModal({
      title: editing ? 'Sincronizzazione GitHub' : 'Collega il diario a GitHub',
      subtitle: 'Un repository privato, un file JSON, nessun altro servizio.',
      wide: true,
      body:
        '<div class="setup-steps">' +
          '<div class="setup-step"><span class="step-num">1</span><div><b>Crea un repository privato</b>' +
            '<p>Apri <a href="' + esc(DP.CONFIG.github.repoUrl) + '" target="_blank" rel="noopener">github.com/new</a>, ' +
            'chiamalo <code>' + esc(DP.CONFIG.github.defaultRepo) + '</code>, scegli <b>Private</b> e aggiungi un file <b>README</b>.</p></div></div>' +
          '<div class="setup-step"><span class="step-num">2</span><div><b>Crea un token limitato</b>' +
            '<p>Vai su <a href="' + esc(DP.CONFIG.github.tokenUrl) + '" target="_blank" rel="noopener">Personal access tokens → Fine-grained</a>. ' +
            'Scegli <b>Only select repositories</b> → il repository del diario, poi ' +
            '<b>Repository permissions → Contents: Read and write</b>. Non servono altri permessi.</p></div></div>' +
          '<div class="setup-step"><span class="step-num">3</span><div><b>Incolla qui i dati</b>' +
            '<p>Il proprietario può restare vuoto: lo ricavo dal token. Il file viene creato al primo sync.</p></div></div>' +
        '</div>' +
        '<form id="cloud-form" class="setup-form" novalidate>' +
          '<label class="field"><span>Token GitHub</span><div class="password-wrap">' +
            '<input type="password" name="token" autocomplete="off" spellcheck="false" ' +
              'placeholder="' + (cfg && cfg.hasToken ? 'Token già salvato · lascia vuoto per non cambiarlo' : 'github_pat_…') + '"' +
              (cfg && cfg.hasToken ? '' : ' required') + '>' +
            '<button type="button" class="reveal-btn" data-setup-reveal aria-label="Mostra token">' + DP.UI.icon('lock') + '</button>' +
          '</div></label>' +
          '<div class="two-cols">' +
            '<label class="field"><span>Proprietario</span><input type="text" name="owner" autocomplete="off" spellcheck="false" ' +
              'placeholder="Il tuo nome utente GitHub" value="' + esc(cfg ? cfg.owner : '') + '"></label>' +
            '<label class="field"><span>Repository</span><input type="text" name="repo" autocomplete="off" spellcheck="false" ' +
              'value="' + esc(cfg ? cfg.repo : DP.CONFIG.github.defaultRepo) + '"></label>' +
          '</div>' +
          '<div class="two-cols">' +
            '<label class="field"><span>Branch</span><input type="text" name="branch" autocomplete="off" spellcheck="false" ' +
              'value="' + esc(cfg ? cfg.branch : DP.CONFIG.github.defaultBranch) + '"></label>' +
            '<label class="field"><span>File del diario</span><input type="text" name="path" autocomplete="off" spellcheck="false" ' +
              'value="' + esc(cfg ? cfg.path : DP.CONFIG.github.defaultPath) + '"></label>' +
          '</div>' +
          '<p class="small-note">' + DP.UI.icon('shield') + ' Il repository deve essere privato. L’app rifiuta di salvare dati di salute in un repository pubblico. ' +
            'Il token è salvato solo in questo browser.</p>' +
          '<p class="field-error" id="cloud-error" hidden></p>' +
          '<div class="btn-row">' +
            '<button type="submit" class="btn btn-primary" id="cloud-save">' + (editing ? 'Salva e sincronizza' : 'Collega e sincronizza') + '</button>' +
            (editing ? '<button type="button" class="btn btn-ghost btn-danger-ghost" data-cloud-remove>Scollega</button>' : '') +
          '</div>' +
        '</form>' +
        '<p class="small-note">Guida completa: <a href="' + esc(guideLink()) + '" target="_blank" rel="noopener">README del progetto</a>.</p>',
      onMount: function (ctx) {
        const form = ctx.body.querySelector('#cloud-form');
        const error = ctx.body.querySelector('#cloud-error');
        const submit = ctx.body.querySelector('#cloud-save');
        const reveal = ctx.body.querySelector('[data-setup-reveal]');
        if (reveal) {
          reveal.addEventListener('click', function () {
            const input = form.querySelector('[name="token"]');
            input.type = input.type === 'password' ? 'text' : 'password';
            reveal.classList.toggle('active', input.type === 'text');
          });
        }
        const remove = ctx.body.querySelector('[data-cloud-remove]');
        if (remove) {
          remove.addEventListener('click', async function () {
            const yes = await DP.UI.confirm({
              title: 'Scollegare GitHub?',
              message: 'Il token viene dimenticato da questo dispositivo. I dati locali restano e il file nel repository non viene cancellato.',
              confirmLabel: 'Scollega',
              danger: true
            });
            if (!yes) return;
            DP.Cloud.clearConfig();
            ctx.close();
            DP.UI.toast('Sincronizzazione scollegata.', 'ok');
            DP.App.onCloudReady();
          });
        }
        form.addEventListener('submit', async function (e) {
          e.preventDefault();
          const data = new FormData(form);
          showError(error, '');
          submit.disabled = true;
          const original = submit.textContent;
          submit.textContent = 'Collego…';
          const res = await DP.Cloud.connect({
            token: String(data.get('token') || ''),
            owner: String(data.get('owner') || ''),
            repo: String(data.get('repo') || ''),
            branch: String(data.get('branch') || ''),
            path: String(data.get('path') || '')
          });
          submit.disabled = false;
          submit.textContent = original;
          if (!res.ok) {
            showError(error, res.error || 'Non sono riuscito a collegare GitHub.');
            return;
          }
          ctx.close();
          DP.UI.toast('GitHub collegato. Sincronizzo il diario…', 'ok');
          DP.App.onCloudReady();
          const sync = await DP.Cloud.sync();
          if (sync && sync.ok) {
            DP.UI.toast('Diario sincronizzato con GitHub.', 'ok');
            DP.App.refresh();
          } else if (sync && sync.error) {
            DP.UI.toast(sync.error, 'error');
          }
        });
      }
    });
    return m;
  }

  function showError(el, msg) {
    if (!el) return;
    el.textContent = msg || '';
    el.hidden = !msg;
  }

  return {
    syncBanner: syncBanner,
    accountSection: accountSection,
    open: open,
    openSetup: openSetup,
    syncLabel: syncLabel
  };
})();
