/* ============================================================
   PRESSIONE 2.0 — pagina "Oggi"
   Ultima misurazione, riepilogo del periodo, grafico e consigli.
   ============================================================ */
window.DP = window.DP || {};
DP.Views = DP.Views || {};

DP.Views.dashboard = (function () {
  const esc = DP.Fmt.escapeHtml;

  function firstName(name) {
    const clean = String(name || '').trim();
    return clean ? clean.split(/\s+/)[0] : '';
  }

  function periodDays() {
    const s = DP.Store.settings();
    const d = DP.toInt(s.periodDays, 30);
    return d === 0 || d === -1 ? 30 : d;
  }

  function chartPeriod(days) {
    return { days: days };
  }

  function latestCard(latest, profile) {
    if (!latest) {
      return '<section class="card latest-card latest-empty">' +
        '<div class="latest-head"><span class="eyebrow">Il tuo diario</span>' +
          DP.UI.chip('Ancora vuoto', 'neutral') + '</div>' +
        '<div class="latest-empty-body">' +
          '<div class="latest-empty-icon">' + DP.UI.icon('heart') + '</div>' +
          '<div><h2>Iniziamo dalla prima misurazione</h2>' +
            '<p>Scatta una foto al display del misuratore oppure inserisci i valori a mano. In pochi secondi hai il primo dato del diario.</p></div>' +
        '</div>' +
        '<div class="latest-empty-actions">' +
          '<button type="button" class="btn btn-primary" data-action="new-reading">' + DP.UI.icon('plus') + ' Aggiungi misurazione</button>' +
          '<button type="button" class="btn btn-soft" data-action="photo-reading">' + DP.UI.icon('camera') + ' Foto del display</button>' +
        '</div>' +
      '</section>';
    }

    const cat = DP.Stats.category(latest, profile.target, profile.limits);
    const warns = DP.Stats.warnings(latest, profile.target, profile.limits);
    const trend = DP.Stats.trendWarnings(latest, DP.Store.allReadings());
    const allWarns = warns.concat(trend).slice(0, 2);
    const pulse = latest.pulse > 0
      ? '<div class="latest-pulse">' + DP.UI.icon('activity') + '<b>' + latest.pulse + '</b><span>bpm</span></div>'
      : '';

    return '<section class="card latest-card tone-' + cat.tone + '">' +
      '<div class="latest-head">' +
        '<div><span class="eyebrow">Ultima misurazione</span>' +
          '<p class="latest-when">' + DP.UI.icon('clock') + ' ' +
            esc(DP.Fmt.fmtDateLong(latest.at)) + ' · ' + esc(DP.Fmt.fmtTime(latest.at)) + '</p></div>' +
        DP.UI.valueBadge(cat) +
      '</div>' +
      '<div class="latest-main">' +
        '<div class="latest-value">' + latest.sys + '<span>/</span>' + latest.dia +
          '<small>mmHg</small></div>' +
        pulse +
      '</div>' +
      '<div class="latest-target">Target personale ' + profile.target.sys + '/' + profile.target.dia + ' mmHg</div>' +
      (allWarns.length
        ? '<div class="latest-warnings">' + allWarns.map(function (w) {
            return '<p class="mini-warn tone-' + (w.tone || 'high') + '">' + DP.UI.icon('alert') +
              '<span>' + esc(w.text) + '</span></p>';
          }).join('') + '</div>'
        : '<p class="latest-ok">' + DP.UI.icon('check') + ' Valore in linea con il tuo target personale.</p>') +
      '<div class="latest-actions">' +
        '<button type="button" class="btn btn-ghost btn-sm" data-action="edit-reading" data-id="' + esc(latest.id) + '">' +
          DP.UI.icon('edit') + ' Modifica</button>' +
        '<button type="button" class="btn btn-ghost btn-sm" data-action="new-reading">' + DP.UI.icon('plus') + ' Nuova</button>' +
      '</div>' +
    '</section>';
  }

  function kpiCards(sum, days) {
    if (!sum.count) {
      return '<div class="kpi-grid">' +
        DP.UI.statCard('Media', '—', 'nessun dato', '') +
        DP.UI.statCard('Nel target', '—', 'target ' + sum.target.sys + '/' + sum.target.dia, '') +
        DP.UI.statCard('Misurazioni', '0', 'ultimi ' + days + ' giorni', '') +
      '</div>';
    }
    const avgTone = sum.percentAbove > 50 ? 'high' : (sum.percentNormal >= 60 ? 'normal' : '');
    return '<div class="kpi-grid">' +
      DP.UI.statCard('Media ' + days + ' gg',
        '<b>' + sum.avg.sys + '</b><i>/</i><b>' + sum.avg.dia + '</b><small>mmHg</small>',
        sum.count + ' ' + DP.Fmt.plural(sum.count, 'misurazione', 'misurazioni') + (sum.avg.pulse ? ' · polso ' + sum.avg.pulse : ''),
        avgTone) +
      DP.UI.statCard('Nel target',
        '<b>' + sum.percentNormal + '</b><small>%</small>',
        sum.above + ' sopra · ' + sum.low + ' sotto',
        sum.percentNormal >= 60 ? 'normal' : (sum.percentAbove > sum.percentNormal ? 'high' : '')) +
      DP.UI.statCard('Misurazioni',
        '<b>' + sum.count + '</b>',
        'in ' + sum.days + ' ' + DP.Fmt.plural(sum.days, 'giorno', 'giorni'),
        '') +
    '</div>';
  }

  function chartCard(list, profile, days) {
    const options = [7, 14, 30, 90].map(function (d) {
      return '<button type="button" class="seg-btn' + (d === days ? ' active' : '') +
        '" data-dash-period="' + d + '">' + d + ' gg</button>';
    }).join('');
    return '<section class="card chart-card">' +
      '<div class="card-head">' +
        '<div><h2>' + DP.UI.icon('chart') + ' Andamento</h2>' +
          '<p>Massima e minima nel periodo scelto.</p></div>' +
        '<div class="segmented" role="group" aria-label="Periodo del grafico">' + options + '</div>' +
      '</div>' +
      '<div class="chart-wrap"><canvas id="dash-chart" aria-label="Grafico della pressione nel periodo" role="img"></canvas></div>' +
      '<div class="chart-legend">' +
        '<span class="legend-item"><i class="legend-dot sys"></i>Massima</span>' +
        '<span class="legend-item"><i class="legend-dot dia"></i>Minima</span>' +
        '<span class="legend-item"><i class="legend-band"></i>Intervallo target</span>' +
        '<span class="legend-note">' + (list.length ? list.length + ' ' + DP.Fmt.plural(list.length, 'misurazione', 'misurazioni') : 'Nessun dato nel periodo') + '</span>' +
      '</div>' +
    '</section>';
  }

  function recentCard(list) {
    const recent = list.slice(0, 5);
    if (!recent.length) {
      return '<section class="card recent-card">' +
        '<div class="card-head"><div><h2>' + DP.UI.icon('clock') + ' Ultime misurazioni</h2>' +
          '<p>Qui troverai gli ultimi valori registrati.</p></div></div>' +
        '<p class="muted small">Aggiungi la prima misurazione per iniziare.</p>' +
      '</section>';
    }
    const profile = DP.Store.profile();
    return '<section class="card recent-card">' +
      '<div class="card-head">' +
        '<div><h2>' + DP.UI.icon('clock') + ' Ultime misurazioni</h2>' +
          '<p>Le più recenti, in ordine di data.</p></div>' +
        '<a class="link-btn" href="#diario">Tutto il diario ' + DP.UI.icon('chevron-right') + '</a>' +
      '</div>' +
      '<div class="recent-list">' + recent.map(function (r) {
        const cat = DP.Stats.category(r, profile.target, profile.limits);
        return '<button type="button" class="recent-row" data-action="edit-reading" data-id="' + esc(r.id) + '">' +
          '<span class="recent-date"><b>' + esc(DP.Fmt.fmtTime(r.at)) + '</b><small>' + esc(DP.Fmt.fmtDateShort(r.at)) + '</small></span>' +
          '<span class="recent-value">' + r.sys + '<i>/</i>' + r.dia + '<small>mmHg</small></span>' +
          '<span class="recent-pulse">' + (r.pulse > 0 ? DP.UI.icon('activity') + ' ' + r.pulse : '<span class="muted">—</span>') + '</span>' +
          DP.UI.valueBadge(cat) +
          DP.UI.icon('chevron-right', 'row-chev') +
        '</button>';
      }).join('') + '</div>' +
    '</section>';
  }

  function morningEvening(sum) {
    if (!sum.count) return '';
    const rows = [];
    if (sum.morning.count) {
      rows.push('<div class="me-row"><span class="me-icon">' + DP.UI.icon('clock') + '</span>' +
        '<div><b>Mattina</b><small>' + sum.morning.count + ' ' + DP.Fmt.plural(sum.morning.count, 'misurazione', 'misurazioni') + '</small></div>' +
        '<span class="me-value">' + sum.morning.sys + '/' + sum.morning.dia + '</span></div>');
    }
    if (sum.evening.count) {
      rows.push('<div class="me-row"><span class="me-icon">' + DP.UI.icon('clock') + '</span>' +
        '<div><b>Sera</b><small>' + sum.evening.count + ' ' + DP.Fmt.plural(sum.evening.count, 'misurazione', 'misurazioni') + '</small></div>' +
        '<span class="me-value">' + sum.evening.sys + '/' + sum.evening.dia + '</span></div>');
    }
    if (!rows.length) {
      return '<div class="me-card"><h3>Mattina e sera</h3>' +
        '<p class="muted small">Registra qualche misurazione tra le 6 e le 12 e tra le 18 e le 24 per vedere le medie.</p></div>';
    }
    return '<div class="me-card"><h3>Mattina e sera</h3>' +
      '<p class="muted small">Medie delle misurazioni nel periodo.</p>' + rows.join('') + '</div>';
  }

  function render() {
    const state = DP.Store.get();
    const profile = state.profile;
    const all = DP.Store.readings();
    const days = periodDays();
    const list = DP.Stats.filterPeriod(all, chartPeriod(days));
    const sum = DP.Stats.summarize(list, profile.target, profile.limits);
    const latest = all.length ? DP.Stats.sortDesc(all)[0] : null;
    const hello = firstName(profile.name);
    const today = DP.Fmt.fmtDateLong(DP.Fmt.todayKey());
    const todayLabel = today ? today.charAt(0).toUpperCase() + today.slice(1) : '';

    return '<div class="page page-dashboard">' +
      '<section class="today-hero">' +
        '<div class="hero-copy">' +
          '<p class="eyebrow">' + esc(todayLabel) + '</p>' +
          '<h1>' + (hello ? 'Ciao, ' + esc(hello) + '.' : 'Il tuo diario.') + '</h1>' +
          '<p class="hero-lead">Misura con calma, registra il valore e porta al medico un quadro chiaro dell’andamento.</p>' +
        '</div>' +
        '<div class="hero-actions">' +
          '<button type="button" class="btn btn-primary btn-lg" data-action="new-reading">' +
            DP.UI.icon('plus') + ' Nuova misurazione</button>' +
          '<button type="button" class="btn btn-soft" data-action="photo-reading">' +
            DP.UI.icon('camera') + ' Foto del display</button>' +
        '</div>' +
      '</section>' +

      DP.AuthUI.syncBanner() +
      DP.UI.showStorageWarning() +

      '<div class="dash-top">' +
        latestCard(latest, profile) +
        '<div class="dash-side">' +
          kpiCards(sum, days) +
          morningEvening(sum) +
        '</div>' +
      '</div>' +

      chartCard(list, profile, days) +

      '<div class="dash-bottom">' +
        recentCard(all) +
        '<div class="dash-aside">' +
          (state.settings.showTips !== false ? DP.UI.tipsCard(false) : '') +
          '<section class="card report-cta">' +
            '<div class="report-cta-icon">' + DP.UI.icon('printer') + '</div>' +
            '<div><h3>Visita medica in arrivo?</h3>' +
              '<p>Prepara un report ordinato: medie, grafico e tutte le misurazioni in un’unica pagina.</p></div>' +
            '<a class="btn btn-soft btn-sm" href="#report">' + DP.UI.icon('chart') + ' Apri il report</a>' +
          '</section>' +
        '</div>' +
      '</div>' +

      '<p class="page-disclaimer">' + DP.UI.icon('shield') + '<span>' + esc(DP.CONFIG.disclaimer) + '</span></p>' +
    '</div>';
  }

  let resizeTimer = null;

  function drawChart() {
    const canvas = document.getElementById('dash-chart');
    if (!canvas) return;
    const profile = DP.Store.profile();
    const days = periodDays();
    const list = DP.Stats.filterPeriod(DP.Store.readings(), chartPeriod(days));
    DP.Chart.draw(canvas, list, {
      target: profile.target,
      limits: profile.limits,
      height: 260
    });
  }

  function mount() {
    const days = periodDays();
    document.querySelectorAll('[data-dash-period]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const d = DP.toInt(btn.getAttribute('data-dash-period'), 30);
        DP.Store.setSettings({ periodDays: d });
        DP.App.refresh();
      });
    });
    if (!document.querySelector('[data-dash-period="' + days + '"]')) {
      // Il periodo salvato non è tra i pulsanti rapidi: nessun problema,
      // il grafico usa comunque il valore richiesto.
    }
    requestAnimationFrame(drawChart);
  }

  function resize() {
    if (resizeTimer) clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      if (document.getElementById('dash-chart')) drawChart();
    }, 120);
  }

  return { render: render, mount: mount, resize: resize };
})();
