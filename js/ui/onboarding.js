/* ============================================================
   PRESSIONE 2.0 — prima apertura / benvenuto
   ============================================================ */
window.DP = window.DP || {};
DP.Views = DP.Views || {};

DP.Views.onboarding = (function () {
  const esc = DP.Fmt.escapeHtml;

  function render() {
    const configured = DP.Cloud.configured();
    const name = (DP.Store.profile().name || '');
    return '<div class="onboarding-wrap">' +
      '<section class="welcome-hero">' +
        '<div class="welcome-mark">' + DP.UI.brandMark() + '</div>' +
        '<p class="eyebrow">Il tuo diario pressorio</p>' +
        '<h1>Misura, fotografa,<br><span>porta il report al medico.</span></h1>' +
        '<p class="welcome-lead">Un diario semplice per la pressione arteriosa: leggila dalla foto del misuratore, ritrova lo storico e stampa un report chiaro per la visita.</p>' +
        '<div class="welcome-features">' +
          '<div class="welcome-feature">' + DP.UI.icon('camera') + '<div><b>Foto del display</b><span>Massima, minima e pulsazioni lette sul telefono.</span></div></div>' +
          '<div class="welcome-feature">' + DP.UI.icon('chart') + '<div><b>Andamento e report</b><span>Medie, grafici e PDF pronti per il medico.</span></div></div>' +
          '<div class="welcome-feature">' + DP.UI.icon('cloud') + '<div><b>Sincronizzato</b><span>Ritrova i dati su telefono e computer.</span></div></div>' +
        '</div>' +
      '</section>' +
      '<section class="card welcome-card">' +
        '<h2>Come ti chiami?</h2>' +
        '<p class="muted">Serve solo per intestare il report. Puoi cambiarlo quando vuoi.</p>' +
        '<form id="onboard-form" novalidate>' +
          '<label class="field">' +
            '<span>Nome</span>' +
            '<input type="text" id="onboard-name" name="name" maxlength="60" autocomplete="given-name" ' +
              'placeholder="Es. Mario Rossi" value="' + esc(name) + '" autofocus>' +
          '</label>' +
          '<p class="field-error" id="onboard-error" hidden></p>' +
          '<button type="submit" class="btn btn-primary btn-lg btn-block">Inizia</button>' +
        '</form>' +
        '<div class="welcome-secondary">' +
          (configured
            ? '<button type="button" class="link-btn" data-action="open-auth">Ho già un account · Accedi</button>'
            : '<button type="button" class="link-btn" data-action="open-cloud-setup">Attiva la sincronizzazione</button>') +
        '</div>' +
        '<p class="privacy-mini">' + DP.UI.icon('lock') +
          '<span>Le foto non vengono salvate né inviate: la lettura avviene sul tuo dispositivo. Con un account, le misurazioni sono protette e visibili solo a te.</span>' +
        '</p>' +
      '</section>' +
      '<p class="welcome-disclaimer">' + esc(DP.CONFIG.disclaimer) + '</p>' +
    '</div>';
  }

  function mount() {
    const form = document.getElementById('onboard-form');
    const input = document.getElementById('onboard-name');
    const error = document.getElementById('onboard-error');
    if (!form || !input) return;

    function showError(msg) {
      if (!error) return;
      error.textContent = msg;
      error.hidden = !msg;
      input.classList.toggle('invalid', !!msg);
      input.focus();
    }

    input.addEventListener('input', function () { showError(''); });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      const name = input.value.trim();
      if (!name) { showError('Scrivi il tuo nome (o le iniziali) per intestare il report.'); return; }
      DP.Store.setOnboarded(name);
      DP.UI.updateHeader();
      DP.UI.toast('Benvenuto nel tuo diario, ' + name.split(' ')[0] + '.', 'ok');
      DP.App.go('oggi');
      // Se la sincronizzazione è configurata ma non c'è un account, invita ad accedere.
      if (DP.Cloud.configured() && !DP.Cloud.isSignedIn()) {
        setTimeout(function () { DP.AuthUI.open(); }, 450);
      }
    });
  }

  return { render: render, mount: mount };
})();
