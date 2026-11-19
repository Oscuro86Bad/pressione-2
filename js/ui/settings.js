/* ============================================================
   PRESSIONE 2.0 — impostazioni
   Profilo e target, account, backup, privacy e installazione.
   ============================================================ */
window.DP = window.DP || {};
DP.Views = DP.Views || {};

DP.Views.settings = (function () {
  const esc = DP.Fmt.escapeHtml;

  function intVal(v, fallback) {
    return DP.toInt(v, fallback);
  }

  function profileCard() {
    const p = DP.Store.profile();
    return '<section class="card settings-card" id="profile-card">' +
      '<div class="card-head"><div><h2>' + DP.UI.icon('user') + ' Profilo e target</h2>' +
        '<p>Il nome compare nel report; il target guida i colori e gli avvisi.</p></div></div>' +
      '<form id="profile-form" class="settings-form" novalidate>' +
        '<label class="field"><span>Nome o iniziali</span>' +
          '<input type="text" name="name" maxlength="60" autocomplete="name" value="' + esc(p.name) + '" placeholder="Es. Mario Rossi"></label>' +
        '<div class="two-cols">' +
          '<label class="field"><span>Target massima</span>' +
            '<div class="input-unit"><input type="number" name="targetSys" inputmode="numeric" min="80" max="250" value="' + p.target.sys + '"><span>mmHg</span></div></label>' +
          '<label class="field"><span>Target minima</span>' +
            '<div class="input-unit"><input type="number" name="targetDia" inputmode="numeric" min="40" max="150" value="' + p.target.dia + '"><span>mmHg</span></div></label>' +
        '</div>' +
        '<p class="small-note">Il valore predefinito 135/85 è quello consigliato per le misurazioni a casa. Segui sempre le indicazioni del tuo medico.</p>' +
        '<details class="advanced"' + (p.limits.sysLow !== DP.CONFIG.limits.sysLow ||
          p.limits.diaLow !== DP.CONFIG.limits.diaLow ||
          p.limits.pulseLow !== DP.CONFIG.limits.pulseLow ||
          p.limits.pulseHigh !== DP.CONFIG.limits.pulseHigh ? ' open' : '') + '>' +
          '<summary>Soglie di attenzione <span class="opt">(facoltative)</span></summary>' +
          '<p class="small-note">Servono solo a evidenziare valori bassi o pulsazioni fuori intervallo. Non sono una diagnosi.</p>' +
          '<div class="two-cols">' +
            '<label class="field"><span>Massima bassa</span><div class="input-unit"><input type="number" name="sysLow" min="40" max="200" value="' + p.limits.sysLow + '"><span>mmHg</span></div></label>' +
            '<label class="field"><span>Minima bassa</span><div class="input-unit"><input type="number" name="diaLow" min="20" max="150" value="' + p.limits.diaLow + '"><span>mmHg</span></div></label>' +
            '<label class="field"><span>Polso basso</span><div class="input-unit"><input type="number" name="pulseLow" min="20" max="150" value="' + p.limits.pulseLow + '"><span>bpm</span></div></label>' +
            '<label class="field"><span>Polso alto</span><div class="input-unit"><input type="number" name="pulseHigh" min="40" max="250" value="' + p.limits.pulseHigh + '"><span>bpm</span></div></label>' +
          '</div>' +
        '</details>' +
        '<p class="field-error" id="profile-error" hidden></p>' +
        '<div class="form-actions"><button type="submit" class="btn btn-primary">Salva profilo</button></div>' +
      '</form>' +
    '</section>';
  }

  function preferencesCard() {
    const s = DP.Store.settings();
    const options = DP.CONFIG.periods.filter(function (p) { return p.days >= 0; }).map(function (p) {
      return '<option value="' + p.days + '"' + (intVal(s.periodDays, 30) === p.days ? ' selected' : '') + '>' +
        esc(p.label) + '</option>';
    }).join('');
    return '<section class="card settings-card">' +
      '<div class="card-head"><div><h2>' + DP.UI.icon('settings') + ' Preferenze</h2>' +
        '<p>Piccole scelte per l’uso quotidiano.</p></div></div>' +
      '<label class="switch-row"><input type="checkbox" data-change-action="toggle-tips" ' + (s.showTips !== false ? 'checked' : '') + '>' +
        '<span><b>Mostra i consigli per misurare bene</b><small>Un promemoria nella pagina Oggi.</small></span></label>' +
      '<label class="field field-inline"><span>Periodo predefinito</span>' +
        '<select data-change-action="set-default-period">' + options + '</select></label>' +
      '<p class="small-note">Il periodo predefinito viene usato dal grafico della pagina Oggi e dal report.</p>' +
    '</section>';
  }

  function dataCard() {
    const state = DP.Store.get();
    const active = DP.Stats.active(state.readings).length;
    const pending = state.readings.filter(function (r) { return r.dirty; }).length;
    const lastSync = state.sync.lastSyncAt;
    return '<section class="card settings-card">' +
      '<div class="card-head"><div><h2>' + DP.UI.icon('download') + ' Dati e backup</h2>' +
        '<p>I dati sono tuoi: esportali quando vuoi, anche senza sincronizzazione.</p></div></div>' +
      '<div class="data-stats">' +
        '<div><b>' + active + '</b><span>' + DP.Fmt.plural(active, 'misurazione', 'misurazioni') + ' sul dispositivo</span></div>' +
        '<div><b>' + (pending || 0) + '</b><span>' + DP.Fmt.plural(pending, 'modifica da sincronizzare', 'modifiche da sincronizzare') + '</span></div>' +
        '<div><b>' + (lastSync ? esc(DP.Fmt.timeAgo(lastSync)) : 'mai') + '</b><span>ultimo sync</span></div>' +
      '</div>' +
      '<div class="btn-row btn-row-wrap">' +
        '<button type="button" class="btn btn-soft" data-action="export-json">' + DP.UI.icon('download') + ' Backup JSON</button>' +
        '<button type="button" class="btn btn-ghost" data-action="export-csv">' + DP.UI.icon('download') + ' Esporta CSV</button>' +
        '<button type="button" class="btn btn-ghost" data-action="import-backup">' + DP.UI.icon('upload') + ' Importa backup</button>' +
      '</div>' +
      '<p class="small-note">Puoi importare anche i backup della vecchia app Android <b>Pressione</b> (file JSON con le misurazioni). Le foto non sono mai incluse.</p>' +
      '<div class="danger-zone">' +
        '<div><b>Zona delicata</b><span>Le azioni qui sotto eliminano dati e non si possono annullare.</span></div>' +
        '<div class="btn-row btn-row-wrap">' +
          '<button type="button" class="btn btn-ghost btn-danger-ghost" data-action="clear-local">Cancella misurazioni locali</button>' +
          (DP.Cloud.configured()
            ? '<button type="button" class="btn btn-ghost btn-danger-ghost" data-action="clear-cloud">Elimina dati da GitHub</button>'
            : '') +
        '</div>' +
      '</div>' +
      '<div class="data-protect">' + DP.UI.icon('shield') +
        '<div><b>Proteggi i dati dalla pulizia automatica</b>' +
          '<span>Chiedi al browser di non eliminare i dati del diario quando libera spazio.</span></div>' +
        '<button type="button" class="btn btn-ghost btn-sm" data-action="persist-storage">Proteggi</button>' +
      '</div>' +
    '</section>';
  }

  function privacyCard() {
    return '<section class="card settings-card">' +
      '<div class="card-head"><div><h2>' + DP.UI.icon('lock') + ' Privacy e salute</h2>' +
        '<p>Trasparenza su dove finiscono i dati.</p></div></div>' +
      '<div class="privacy-list">' +
        '<div class="privacy-row">' + DP.UI.icon('camera') +
          '<div><b>Le foto restano sul dispositivo</b><span>La lettura del display avviene con OCR nel browser. Nessuna immagine viene salvata o caricata.</span></div></div>' +
        '<div class="privacy-row">' + DP.UI.icon('cloud') +
          '<div><b>Il cloud è facoltativo</b><span>Senza sincronizzazione i dati restano in questo browser. Con GitHub, il diario viene salvato in un repository privato e il token resta solo sul tuo dispositivo.</span></div></div>' +
        '<div class="privacy-row">' + DP.UI.icon('shield') +
          '<div><b>Non è un dispositivo medico</b><span>L’app non fa diagnosi e non sostituisce il medico. Non modificare la terapia in base ai valori letti.</span></div></div>' +
      '</div>' +
      '<p class="privacy-full">' + esc(DP.CONFIG.disclaimer) + '</p>' +
    '</section>';
  }

  function aboutCard() {
    const standalone = window.matchMedia && window.matchMedia('(display-mode: standalone)').matches;
    return '<section class="card settings-card">' +
      '<div class="card-head"><div><h2>' + DP.UI.icon('heart') + ' Informazioni</h2>' +
        '<p>Versione, installazione e link utili.</p></div></div>' +
      '<div class="about-actions">' +
        '<button type="button" class="btn btn-soft" data-action="install-app"' + (standalone ? ' disabled' : '') + '>' +
          DP.UI.icon('smartphone') + (standalone ? ' App installata' : ' Installa sul dispositivo') + '</button>' +
        '<a class="btn btn-ghost" href="' + esc(DP.CONFIG.repoUrl) + '" target="_blank" rel="noopener">' +
          DP.UI.icon('external') + ' Codice su GitHub</a>' +
        '<a class="btn btn-ghost" href="' + esc(DP.CONFIG.repoUrl) + '#-sincronizzazione-con-github-privato" target="_blank" rel="noopener">' +
          DP.UI.icon('info') + ' Guida sincronizzazione</a>' +
        '<a class="btn btn-ghost" href="test.html" target="_blank" rel="noopener">' + DP.UI.icon('check') + ' Test dell’app</a>' +
      '</div>' +
      '<div class="about-meta">' +
        '<span>Versione <b>' + esc(DP.VERSION) + '</b></span>' +
        '<span>Build <b>' + esc(DP.BUILD) + '</b></span>' +
        '<span>Dati locali: <b>' + (DP.Store.isStorageAvailable() ? 'attivi' : 'non disponibili') + '</b></span>' +
      '</div>' +
      '<p class="small-note">Pressione 2.0 è un progetto personale senza scopo di lucro. Non raccoglie statistiche d’uso e non mostra pubblicità.</p>' +
    '</section>';
  }

  function render() {
    return '<div class="page page-settings">' +
      '<div class="page-head">' +
        '<div><p class="eyebrow">Il tuo spazio</p><h1>Impostazioni</h1>' +
          '<p class="page-sub">Profilo, target, sincronizzazione e backup in un unico posto.</p></div>' +
      '</div>' +
      DP.AuthUI.syncBanner() +
      DP.UI.showStorageWarning() +
      profileCard() +
      DP.AuthUI.accountSection() +
      preferencesCard() +
      dataCard() +
      privacyCard() +
      aboutCard() +
      '<p class="page-disclaimer">' + DP.UI.icon('shield') + '<span>' + esc(DP.CONFIG.disclaimer) + '</span></p>' +
    '</div>';
  }

  function showError(msg) {
    const el = document.getElementById('profile-error');
    if (!el) return;
    el.textContent = msg || '';
    el.hidden = !msg;
  }

  function mount() {
    const form = document.getElementById('profile-form');
    if (!form) return;

    form.addEventListener('input', function () { showError(''); });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      const data = new FormData(form);
      const name = String(data.get('name') || '').trim();
      const targetSys = intVal(data.get('targetSys'), 0);
      const targetDia = intVal(data.get('targetDia'), 0);
      const limits = {
        sysLow: intVal(data.get('sysLow'), DP.CONFIG.limits.sysLow),
        diaLow: intVal(data.get('diaLow'), DP.CONFIG.limits.diaLow),
        pulseLow: intVal(data.get('pulseLow'), DP.CONFIG.limits.pulseLow),
        pulseHigh: intVal(data.get('pulseHigh'), DP.CONFIG.limits.pulseHigh)
      };

      if (!name) { showError('Scrivi un nome o le tue iniziali per intestare il report.'); return; }
      if (targetSys < 80 || targetSys > 250) { showError('La massima del target deve essere tra 80 e 250 mmHg.'); return; }
      if (targetDia < 40 || targetDia > 150) { showError('La minima del target deve essere tra 40 e 150 mmHg.'); return; }
      if (targetSys <= targetDia) { showError('La massima del target deve essere maggiore della minima.'); return; }
      if (limits.sysLow < 40 || limits.sysLow > 200) { showError('La soglia bassa della massima deve essere tra 40 e 200 mmHg.'); return; }
      if (limits.diaLow < 20 || limits.diaLow > 150) { showError('La soglia bassa della minima deve essere tra 20 e 150 mmHg.'); return; }
      if (limits.pulseLow < 20 || limits.pulseHigh > 250 || limits.pulseHigh <= limits.pulseLow) {
        showError('Controlla le soglie del polso: il valore alto deve superare quello basso.');
        return;
      }

      showError('');
      DP.Store.updateProfile({
        name: name,
        target: { sys: targetSys, dia: targetDia },
        limits: limits
      });
      DP.UI.toast('Profilo salvato.', 'ok');
      DP.App.afterDataChange();
    });
  }

  return { render: render, mount: mount };
})();
