/* ============================================================
   PRESSIONE 2.0 — accesso, sincronizzazione, configurazione
   ============================================================ */
window.DP = window.DP || {};
DP.AuthUI = (function () {
  const esc = DP.Fmt.escapeHtml;

  function configLink() {
    return DP.CONFIG.repoUrl + '#-sincronizzazione-online-supabase';
  }

  // ---------- banner e sezione impostazioni ----------
  function syncBanner() {
    const st = DP.Cloud.getStatus();
    if (!DP.Cloud.configured()) {
      return '<div class="sync-banner sync-banner-muted">' +
        '<div class="sync-banner-icon">' + DP.UI.icon('cloud-off') + '</div>' +
        '<div class="sync-banner-text"><b>Diario solo su questo dispositivo</b>' +
        '<span>Attiva la sincronizzazione per ritrovare le misurazioni su telefono e computer.</span></div>' +
        '<button type="button" class="btn btn-ghost btn-sm" data-action="open-cloud-setup">Configura</button>' +
      '</div>';
    }
    if (!DP.Cloud.isSignedIn()) {
      return '<div class="sync-banner">' +
        '<div class="sync-banner-icon">' + DP.UI.icon('cloud') + '</div>' +
        '<div class="sync-banner-text"><b>Sincronizza su tutti i dispositivi</b>' +
        '<span>Accedi o crea un account: le misurazioni restano protette e solo tue.</span></div>' +
        '<button type="button" class="btn btn-primary btn-sm" data-action="open-auth">Accedi</button>' +
      '</div>';
    }
    if (st.state === 'error') {
      return '<div class="sync-banner sync-banner-error">' +
        '<div class="sync-banner-icon">' + DP.UI.icon('alert') + '</div>' +
        '<div class="sync-banner-text"><b>Sincronizzazione da controllare</b><span>' + esc(st.message) + '</span></div>' +
        '<button type="button" class="btn btn-ghost btn-sm" data-action="sync-now">Riprova</button>' +
      '</div>';
    }
    return '';
  }

  function accountSection() {
    const st = DP.Cloud.getStatus();
    const cfg = DP.Cloud.getConfig();
    const signed = DP.Cloud.isSignedIn();
    const auto = DP.Store.settings().autoSync !== false;

    let html = '<section class="card" id="account-card">' +
      '<div class="card-head"><div><h2>' + DP.UI.icon('cloud') + ' Sincronizzazione</h2>' +
      '<p>Supabase · dati protetti con Row Level Security</p></div>' +
      '<span class="sync-pill sync-pill-' + st.state + '">' + esc(syncLabel(st.state)) + '</span></div>';

    if (!DP.Cloud.configured()) {
      html += '<p class="muted">La sincronizzazione non è ancora configurata. L’app funziona comunque e salva i dati su questo dispositivo.</p>' +
        '<button type="button" class="btn btn-primary btn-block" data-action="open-cloud-setup">' +
        DP.UI.icon('cloud') + ' Attiva la sincronizzazione</button>' +
        '<p class="small-note">Serve un progetto Supabase gratuito e 5 minuti di configurazione. Guida passo passo nel README.</p>';
    } else if (signed) {
      html += '<div class="account-row">' +
        '<div class="account-avatar">' + esc((st.email || '?').charAt(0).toUpperCase()) + '</div>' +
        '<div><b>' + esc(st.email || 'Account collegato') + '</b>' +
        '<span>' + (st.lastSyncAt ? 'Ultimo sync ' + esc(DP.Fmt.timeAgo(st.lastSyncAt)) : 'In attesa del primo sync') + '</span></div>' +
      '</div>' +
      '<label class="switch-row"><input type="checkbox" id="auto-sync-toggle" data-change-action="toggle-auto-sync" ' + (auto ? 'checked' : '') + '>' +
        '<span><b>Sincronizzazione automatica</b><small>Invia le modifiche appena sei online.</small></span></label>' +
      '<div class="btn-row">' +
        '<button type="button" class="btn btn-primary" data-action="sync-now">' + DP.UI.icon('refresh') + ' Sincronizza ora</button>' +
        '<button type="button" class="btn btn-ghost" data-action="logout">Esci</button>' +
      '</div>' +
      '<p class="small-note">' + DP.UI.icon('lock') + ' Le misurazioni sono visibili solo al tuo account. Sul dispositivo resta una copia per l’uso offline.</p>';
    } else {
      html += '<p class="muted">Accedi per ritrovare le tue misurazioni su tutti i dispositivi. Senza account, il diario resta solo su questo browser.</p>' +
        '<div class="btn-row">' +
          '<button type="button" class="btn btn-primary" data-action="open-auth">' + DP.UI.icon('user') + ' Accedi</button>' +
          '<button type="button" class="btn btn-ghost" data-action="open-auth-signup">Crea account</button>' +
        '</div>';
    }

    if (cfg) {
      html += '<details class="advanced"><summary>Configurazione Supabase</summary>' +
        '<p class="small-note">Progetto: <code>' + esc(cfg.url) + '</code> ' +
        '<span class="tag">' + (cfg.source === 'file' ? 'dal file' : 'salvata sul dispositivo') + '</span></p>' +
        '<div class="btn-row">' +
          '<button type="button" class="btn btn-ghost btn-sm" data-action="open-cloud-setup">Modifica</button>' +
          '<button type="button" class="btn btn-ghost btn-sm btn-danger-ghost" data-action="remove-cloud-config">Rimuovi configurazione</button>' +
        '</div>' +
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

  // ---------- modale accesso ----------
  function open(mode) {
    if (!DP.Cloud.configured()) {
      openSetup();
      return;
    }
    let tab = mode === 'signup' ? 'signup' : 'login';
    let savedEmail = '';
    let savedPassword = '';

    const m = DP.UI.openModal({
      title: 'Sincronizza il diario',
      subtitle: 'Un solo account, tutti i tuoi dispositivi.',
      body: '<div id="auth-body"></div>',
      className: 'modal-auth',
      onMount: function (ctx) {
        renderAuth(ctx);
      }
    });
    if (!m) return;

    function renderAuth(ctx) {
      const isSignup = tab === 'signup';
      const profileName = DP.Store.profile().name || '';
      ctx.body.innerHTML =
        '<div class="auth-tabs" role="tablist">' +
          '<button type="button" class="auth-tab ' + (!isSignup ? 'active' : '') + '" data-auth-tab="login">Accedi</button>' +
          '<button type="button" class="auth-tab ' + (isSignup ? 'active' : '') + '" data-auth-tab="signup">Crea account</button>' +
        '</div>' +
        '<form id="auth-form" novalidate>' +
          (isSignup
            ? '<label class="field"><span>Nome</span><input type="text" name="name" maxlength="60" autocomplete="name" value="' + esc(profileName) + '" placeholder="Nome e cognome"></label>'
            : '') +
          '<label class="field"><span>Email</span><input type="email" name="email" autocomplete="email" inputmode="email" required placeholder="nome@esempio.it" value="' + esc(savedEmail) + '"></label>' +
          '<label class="field"><span>Password</span><div class="password-wrap">' +
            '<input type="password" name="password" autocomplete="' + (isSignup ? 'new-password' : 'current-password') + '" required placeholder="' + (isSignup ? 'Almeno 8 caratteri' : 'La tua password') + '">' +
            '<button type="button" class="reveal-btn" data-auth-reveal aria-label="Mostra password">' + DP.UI.icon('lock') + '</button>' +
          '</div></label>' +
          '<p class="field-error" id="auth-error" hidden></p>' +
          '<button type="submit" class="btn btn-primary btn-block btn-lg" id="auth-submit">' +
            (isSignup ? 'Crea il mio account' : 'Accedi') + '</button>' +
        '</form>' +
        '<div class="auth-links">' +
          (!isSignup ? '<button type="button" class="link-btn" data-auth-forgot>Password dimenticata?</button>' : '') +
          '<span class="auth-secure">' + DP.UI.icon('lock') + ' Connessione cifrata · dati solo tuoi</span>' +
        '</div>' +
        '<p class="auth-note">' + (isSignup
          ? 'Dopo la registrazione potrebbe servire confermare l’email. Apri il link sullo stesso dispositivo.'
          : 'Se non hai ancora un account, crealo dalla scheda «Crea account».') + '</p>';

      const form = ctx.body.querySelector('#auth-form');
      const errorEl = ctx.body.querySelector('#auth-error');
      const submit = ctx.body.querySelector('#auth-submit');

      ctx.body.querySelectorAll('[data-auth-tab]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          const email = form.querySelector('[name="email"]');
          const password = form.querySelector('[name="password"]');
          savedEmail = email ? email.value : '';
          savedPassword = password ? password.value : '';
          tab = btn.getAttribute('data-auth-tab');
          renderAuth(ctx);
        });
      });

      const reveal = ctx.body.querySelector('[data-auth-reveal]');
      if (reveal) {
        reveal.addEventListener('click', function () {
          const p = form.querySelector('[name="password"]');
          p.type = p.type === 'password' ? 'text' : 'password';
          reveal.classList.toggle('active', p.type === 'text');
        });
      }

      const forgot = ctx.body.querySelector('[data-auth-forgot]');
      if (forgot) {
        forgot.addEventListener('click', function () {
          const email = form.querySelector('[name="email"]').value;
          openReset(email);
        });
      }

      form.addEventListener('submit', async function (e) {
        e.preventDefault();
        const email = form.querySelector('[name="email"]').value.trim();
        const password = form.querySelector('[name="password"]').value;
        const name = form.querySelector('[name="name"]');
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          showError(errorEl, 'Scrivi un indirizzo email valido.');
          return;
        }
        if (password.length < 6) {
          showError(errorEl, 'La password deve avere almeno 6 caratteri (meglio 8 o più).');
          return;
        }
        showError(errorEl, '');
        submit.disabled = true;
        const original = submit.textContent;
        submit.textContent = isSignup ? 'Creo l’account…' : 'Accesso…';

        const res = isSignup
          ? await DP.Cloud.signUp(email, password, name ? name.value : '')
          : await DP.Cloud.signIn(email, password);

        submit.disabled = false;
        submit.textContent = original;

        if (!res.ok) {
          showError(errorEl, res.error || 'Non sono riuscito ad accedere.');
          return;
        }

        if (res.needsConfirm) {
          renderConfirm(ctx, email);
          return;
        }

        ctx.close();
        DP.UI.toast('Accesso effettuato. Sincronizzo i dati…', 'ok');
        DP.UI.updateHeader();
        DP.App.onCloudReady();
        DP.Cloud.sync(DP.Store.get()).then(function (r) {
          if (r && r.ok) DP.UI.toast('Diario sincronizzato.', 'ok');
        });
        DP.App.refresh();
      });
    }

    function renderConfirm(ctx, email) {
      ctx.body.innerHTML =
        '<div class="auth-confirm">' +
          '<div class="auth-confirm-icon">' + DP.UI.icon('check') + '</div>' +
          '<h3>Controlla la tua email</h3>' +
          '<p>Abbiamo inviato un link di conferma a <b>' + esc(email) + '</b>. Aprilo sullo stesso dispositivo, poi torna qui e accedi.</p>' +
          '<button type="button" class="btn btn-primary btn-block" data-confirm-login>Ho confermato, accedi</button>' +
          '<p class="small-note">Non trovi l’email? Controlla anche lo spam. La conferma email si può disattivare nelle impostazioni di Supabase.</p>' +
        '</div>';
      ctx.body.querySelector('[data-confirm-login]').addEventListener('click', function () {
        tab = 'login';
        renderAuth(ctx);
      });
    }
  }

  function showError(el, msg) {
    if (!el) return;
    el.textContent = msg || '';
    el.hidden = !msg;
  }

  function openReset(email) {
    const m = DP.UI.openModal({
      title: 'Recupera la password',
      subtitle: 'Ti inviamo un link per impostarne una nuova.',
      body:
        '<form id="reset-form" novalidate>' +
          '<label class="field"><span>Email</span><input type="email" name="email" autocomplete="email" required ' +
            'value="' + esc(email || '') + '" placeholder="nome@esempio.it" autofocus></label>' +
          '<p class="field-error" id="reset-error" hidden></p>' +
          '<button type="submit" class="btn btn-primary btn-block">Invia il link</button>' +
        '</form>' +
        '<p class="small-note">Apri il link sullo stesso dispositivo. Se non arriva, controlla lo spam.</p>',
      onMount: function (ctx) {
        const form = ctx.body.querySelector('#reset-form');
        const error = ctx.body.querySelector('#reset-error');
        form.addEventListener('submit', async function (e) {
          e.preventDefault();
          const mail = form.querySelector('[name="email"]').value.trim();
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) {
            showError(error, 'Scrivi un indirizzo email valido.');
            return;
          }
          const btn = form.querySelector('button[type="submit"]');
          btn.disabled = true;
          btn.textContent = 'Invio…';
          const res = await DP.Cloud.resetPassword(mail);
          btn.disabled = false;
          btn.textContent = 'Invia il link';
          if (!res.ok) { showError(error, res.error); return; }
          ctx.body.innerHTML = '<div class="auth-confirm"><div class="auth-confirm-icon">' + DP.UI.icon('check') + '</div>' +
            '<h3>Email inviata</h3><p>Se l’indirizzo è registrato, riceverai un link per impostare una nuova password.</p></div>';
        });
      }
    });
    return m;
  }

  function openRecovery() {
    const m = DP.UI.openModal({
      title: 'Nuova password',
      subtitle: 'Scegli una password lunga e difficile da indovinare.',
      body:
        '<form id="recovery-form" novalidate>' +
          '<label class="field"><span>Nuova password</span><input type="password" name="password" autocomplete="new-password" required minlength="8" autofocus></label>' +
          '<label class="field"><span>Ripeti la password</span><input type="password" name="confirm" autocomplete="new-password" required minlength="8"></label>' +
          '<p class="field-error" id="recovery-error" hidden></p>' +
          '<button type="submit" class="btn btn-primary btn-block">Salva la nuova password</button>' +
        '</form>',
      onMount: function (ctx) {
        const form = ctx.body.querySelector('#recovery-form');
        const error = ctx.body.querySelector('#recovery-error');
        form.addEventListener('submit', async function (e) {
          e.preventDefault();
          const p = form.querySelector('[name="password"]').value;
          const c = form.querySelector('[name="confirm"]').value;
          if (p.length < 8) { showError(error, 'Usa almeno 8 caratteri.'); return; }
          if (p !== c) { showError(error, 'Le due password non coincidono.'); return; }
          const btn = form.querySelector('button[type="submit"]');
          btn.disabled = true;
          btn.textContent = 'Salvo…';
          const res = await DP.Cloud.updatePassword(p);
          btn.disabled = false;
          btn.textContent = 'Salva la nuova password';
          if (!res.ok) { showError(error, res.error); return; }
          ctx.close();
          DP.UI.toast('Password aggiornata.', 'ok');
          DP.App.onCloudReady();
        });
      }
    });
    return m;
  }

  // ---------- configurazione Supabase ----------
  function openSetup() {
    const cfg = DP.Cloud.getConfig();
    const redirect = window.location.origin + window.location.pathname;
    const m = DP.UI.openModal({
      title: cfg ? 'Configurazione Supabase' : 'Attiva la sincronizzazione',
      subtitle: 'Cinque minuti, una volta sola. Poi funziona da solo.',
      wide: true,
      body:
        '<div class="setup-steps">' +
          '<div class="setup-step"><span class="step-num">1</span><div><b>Crea un progetto gratuito</b>' +
            '<p>Vai su <a href="https://supabase.com/dashboard" target="_blank" rel="noopener">supabase.com/dashboard</a> e crea un progetto (nome libero).</p></div></div>' +
          '<div class="setup-step"><span class="step-num">2</span><div><b>Prepara il database</b>' +
            '<p>Apri <b>SQL Editor</b>, incolla tutto il file <code>supabase/schema.sql</code> e premi <b>Run</b>.</p>' +
            '<button type="button" class="btn btn-ghost btn-sm" data-copy-schema>' + DP.UI.icon('copy') + ' Copia lo schema SQL</button></div></div>' +
          '<div class="setup-step"><span class="step-num">3</span><div><b>Abilita l’accesso email</b>' +
            '<p>In <b>Authentication → Providers</b> attiva <b>Email</b>. In <b>URL Configuration</b> imposta come Site URL:<br><code>' + esc(redirect) + '</code><br>e aggiungi la stessa URL tra i Redirect URLs.</p></div></div>' +
          '<div class="setup-step"><span class="step-num">4</span><div><b>Copia URL e chiave pubblica</b>' +
            '<p>In <b>Project Settings → API</b> copia <b>Project URL</b> e <b>anon public key</b>. Non usare mai la <code>service_role</code> key.</p></div></div>' +
          '<div class="setup-step"><span class="step-num">5</span><div><b>Incollale qui</b>' +
            '<p>La chiave anon è pubblica per progetto: i dati sono protetti dalle policy RLS.</p></div></div>' +
        '</div>' +
        '<form id="cloud-form" class="setup-form" novalidate>' +
          '<label class="field"><span>Project URL</span><input type="url" name="url" required placeholder="https://xxxxxxxx.supabase.co" value="' + esc(cfg ? cfg.url : '') + '"></label>' +
          '<label class="field"><span>Anon public key</span><div class="password-wrap">' +
            '<input type="password" name="key" required placeholder="eyJhbGciOi…" value="' + esc(cfg ? cfg.anonKey : '') + '">' +
            '<button type="button" class="reveal-btn" data-setup-reveal aria-label="Mostra chiave">' + DP.UI.icon('lock') + '</button>' +
          '</div></label>' +
          '<p class="field-error" id="cloud-error" hidden></p>' +
          '<div class="btn-row">' +
            '<button type="submit" class="btn btn-primary" id="cloud-save">Salva e connetti</button>' +
            (cfg ? '<button type="button" class="btn btn-ghost btn-danger-ghost" data-cloud-remove>Rimuovi</button>' : '') +
          '</div>' +
        '</form>' +
        '<p class="small-note">Guida completa: <a href="' + esc(configLink()) + '" target="_blank" rel="noopener">README del progetto</a>.</p>',
      onMount: function (ctx) {
        const form = ctx.body.querySelector('#cloud-form');
        const error = ctx.body.querySelector('#cloud-error');
        const reveal = ctx.body.querySelector('[data-setup-reveal]');
        if (reveal) {
          reveal.addEventListener('click', function () {
            const key = form.querySelector('[name="key"]');
            key.type = key.type === 'password' ? 'text' : 'password';
          });
        }
        const copyBtn = ctx.body.querySelector('[data-copy-schema]');
        if (copyBtn) {
          copyBtn.addEventListener('click', function () { copySchema(copyBtn); });
        }
        const remove = ctx.body.querySelector('[data-cloud-remove]');
        if (remove) {
          remove.addEventListener('click', async function () {
            const yes = await DP.UI.confirm({
              title: 'Rimuovere la configurazione?',
              message: 'La sincronizzazione verrà disattivata su questo dispositivo. I dati locali restano; quelli nel cloud non vengono cancellati.',
              confirmLabel: 'Rimuovi',
              danger: true
            });
            if (!yes) return;
            DP.Cloud.clearConfig();
            ctx.close();
            DP.UI.toast('Configurazione rimossa.', 'ok');
            setTimeout(function () { window.location.reload(); }, 500);
          });
        }
        form.addEventListener('submit', function (e) {
          e.preventDefault();
          const url = form.querySelector('[name="url"]').value.trim();
          const key = form.querySelector('[name="key"]').value.trim();
          try {
            DP.Cloud.setConfig(url, key);
          } catch (err) {
            showError(error, err.message || String(err));
            return;
          }
          ctx.close();
          DP.UI.toast('Configurazione salvata. Ricarico l’app…', 'ok');
          setTimeout(function () { window.location.reload(); }, 900);
        });
      }
    });
    return m;
  }

  async function copySchema(btn) {
    try {
      const res = await fetch('supabase/schema.sql', { cache: 'no-cache' });
      if (!res.ok) throw new Error('schema non raggiungibile');
      const text = await res.text();
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement('textarea');
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        ta.remove();
      }
      DP.UI.toast('Schema SQL copiato: incollalo nel SQL Editor di Supabase.', 'ok');
    } catch (e) {
      DP.UI.toast('Non riesco a copiare il file. Aprilo da GitHub: supabase/schema.sql', 'warn');
      window.open(DP.CONFIG.repoUrl + '/blob/main/supabase/schema.sql', '_blank', 'noopener');
    }
  }

  return {
    syncBanner: syncBanner,
    accountSection: accountSection,
    open: open,
    openSetup: openSetup,
    openRecovery: openRecovery,
    openReset: openReset,
    copySchema: copySchema,
    syncLabel: syncLabel
  };
})();
