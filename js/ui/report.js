/* ============================================================
   PRESSIONE 2.0 — report per il medico
   Riepilogo, grafico, tabella giornaliera e dettaglio.
   La stampa usa un documento separato (#print-doc) in A4.
   ============================================================ */
window.DP = window.DP || {};
DP.Views = DP.Views || {};

DP.Views.report = (function () {
  const esc = DP.Fmt.escapeHtml;

  let days = null;
  let customFrom = '';
  let customTo = '';

  function currentDays() {
    if (days !== null) return days;
    const d = DP.toInt(DP.Store.settings().periodDays, 30);
    return d === -1 ? 0 : d;
  }

  function customRange() {
    const all = DP.Stats.sortAsc(DP.Store.readings());
    const fallbackFrom = all.length ? DP.Fmt.dateKey(all[0].at) : DP.Fmt.addDaysKey(DP.Fmt.todayKey(), -30);
    return {
      from: customFrom || fallbackFrom,
      to: customTo || DP.Fmt.todayKey()
    };
  }

  function period() {
    const d = currentDays();
    if (d === -1) {
      const range = customRange();
      return { days: -1, from: range.from, to: range.to };
    }
    return { days: d };
  }

  function model() {
    const p = DP.Store.profile();
    return DP.Stats.reportModel(DP.Store.readings(), {
      period: period(),
      target: p.target,
      limits: p.limits,
      name: p.name
    });
  }

  function periodOptions() {
    const d = currentDays();
    const options = DP.CONFIG.periods.map(function (p) {
      return '<option value="' + p.days + '"' + (p.days === d ? ' selected' : '') + '>' + esc(p.label) + '</option>';
    }).join('');
    return options;
  }

  function statsGrid(m) {
    const s = m.summary;
    if (!s.count) return '';
    return '<div class="report-stats">' +
      '<div class="report-stat"><span>Misurazioni</span><b>' + s.count + '</b><small>' + s.days + ' ' +
        DP.Fmt.plural(s.days, 'giorno', 'giorni') + '</small></div>' +
      '<div class="report-stat"><span>Media</span><b>' + s.avg.sys + '/' + s.avg.dia + '</b><small>mmHg' +
        (s.avg.pulse ? ' · ' + s.avg.pulse + ' bpm' : '') + '</small></div>' +
      '<div class="report-stat"><span>Intervallo</span><b>' + s.min.sys + '/' + s.min.dia + ' – ' +
        s.max.sys + '/' + s.max.dia + '</b><small>minima – massima</small></div>' +
      '<div class="report-stat"><span>Nel target</span><b>' + s.percentNormal + '%</b><small>' +
        s.above + ' sopra · ' + s.low + ' sotto</small></div>' +
    '</div>' +
    '<div class="report-secondary">' +
      (s.morning.count
        ? '<span><b>Mattina</b> ' + s.morning.sys + '/' + s.morning.dia + ' <small>(' + s.morning.count + ')</small></span>'
        : '') +
      (s.evening.count
        ? '<span><b>Sera</b> ' + s.evening.sys + '/' + s.evening.dia + ' <small>(' + s.evening.count + ')</small></span>'
        : '') +
      (s.irregular ? '<span class="report-alert"><b>Battito irregolare</b> ' + s.irregular + ' ' +
        DP.Fmt.plural(s.irregular, 'volta', 'volte') + '</span>' : '') +
    '</div>';
  }

  function dailyTable(m) {
    if (!m.summary.daily.length) return '<p class="muted small">Nessun dato nel periodo.</p>';
    return '<div class="table-scroll"><table class="data-table">' +
      '<thead><tr><th>Giorno</th><th class="num">Mis.</th><th class="num">Media</th>' +
      '<th class="num">Polso</th><th class="num">Sopra target</th></tr></thead><tbody>' +
      m.summary.daily.map(function (d) {
        return '<tr>' +
          '<td><b>' + esc(DP.Fmt.fmtDateShort(d.key)) + '</b> <span class="muted">' + esc(DP.Fmt.fmtWeekdayShort(d.key)) + '</span></td>' +
          '<td class="num">' + d.count + '</td>' +
          '<td class="num"><b>' + d.sys + '/' + d.dia + '</b></td>' +
          '<td class="num">' + (d.pulse || '—') + '</td>' +
          '<td class="num">' + (d.high || '—') + '</td>' +
        '</tr>';
      }).join('') +
      '</tbody></table></div>';
  }

  function detailTable(m) {
    if (!m.readings.length) return '<p class="muted small">Nessuna misurazione nel periodo.</p>';
    const p = DP.Store.profile();
    return '<div class="table-scroll table-tall"><table class="data-table data-table-detail">' +
      '<thead><tr><th>Data</th><th>Ora</th><th class="num">Massima</th><th class="num">Minima</th>' +
      '<th class="num">Polso</th><th>Note e categoria</th></tr></thead><tbody>' +
      m.readings.map(function (r) {
        const cat = DP.Stats.category(r, p.target, p.limits);
        return '<tr>' +
          '<td>' + esc(DP.Fmt.fmtDateShort(r.at)) + '</td>' +
          '<td>' + esc(DP.Fmt.fmtTime(r.at)) + '</td>' +
          '<td class="num"><b>' + r.sys + '</b></td>' +
          '<td class="num"><b>' + r.dia + '</b></td>' +
          '<td class="num">' + (r.pulse || '—') + (r.irregular ? ' <span class="irregular-mark" title="Battito irregolare">!' : '') + '</td>' +
          '<td class="note-cell">' +
            (r.note ? esc(r.note) : '') +
            (r.arm || r.posture
              ? '<span class="cell-meta">' + esc([DP.Stats.armLabel(r.arm), DP.Stats.postureLabel(r.posture)].filter(Boolean).join(' · ')) + '</span>'
              : '') +
            '<span class="cell-cat status-' + cat.tone + '">' + esc(cat.short) + '</span>' +
          '</td>' +
        '</tr>';
      }).join('') +
      '</tbody></table></div>';
  }

  function emptyReport() {
    return '<section class="card report-empty">' +
      DP.UI.emptyState({
        icon: 'printer',
        title: 'Non ci sono ancora misurazioni',
        text: 'Registra almeno una misurazione per creare il report da mostrare al medico.',
        action: '<button type="button" class="btn btn-primary" data-action="new-reading">' +
          DP.UI.icon('plus') + ' Aggiungi misurazione</button>'
      }) +
    '</section>';
  }

  function render() {
    const m = model();
    const d = currentDays();
    const range = customRange();
    const has = m.summary.count > 0;

    return '<div class="page page-report">' +
      '<div class="page-head">' +
        '<div><p class="eyebrow">Per la visita</p><h1>Report</h1>' +
          '<p class="page-sub">Un riepilogo leggibile: medie, andamento e dettaglio di ogni misurazione.</p></div>' +
        '<div class="page-actions">' +
          '<button type="button" class="btn btn-ghost" data-action="copy-summary"' + (has ? '' : ' disabled') + '>' +
            DP.UI.icon('copy') + ' Copia riepilogo</button>' +
          '<button type="button" class="btn btn-primary" data-action="print-report"' + (has ? '' : ' disabled') + '>' +
            DP.UI.icon('printer') + ' Stampa / PDF</button>' +
        '</div>' +
      '</div>' +

      '<section class="card report-controls">' +
        '<label class="field field-inline"><span>Periodo</span><select id="report-period">' + periodOptions() + '</select></label>' +
        (d === -1
          ? '<label class="field field-inline"><span>Dal</span><input type="date" id="report-from" value="' + esc(range.from) + '"></label>' +
            '<label class="field field-inline"><span>Al</span><input type="date" id="report-to" value="' + esc(range.to) + '"></label>'
          : '<span class="report-period-label">' + DP.UI.icon('calendar') + ' ' + esc(m.periodLabel) + '</span>') +
        '<span class="filter-count">' + m.summary.count + ' ' +
          DP.Fmt.plural(m.summary.count, 'misurazione', 'misurazioni') + '</span>' +
      '</section>' +

      (!has ? emptyReport() :
        '<article class="card report-paper" id="report-paper">' +
          '<header class="report-head">' +
            '<div class="report-brand">' + DP.UI.brandMark() +
              '<div><span class="report-brand-name">Pressione <b>2.0</b></span>' +
              '<span class="report-brand-sub">Diario pressorio personale</span></div></div>' +
            '<div class="report-title"><h2>Report per il medico</h2>' +
              '<p>' + (m.name ? esc(m.name) + ' · ' : '') + esc(m.periodLabel) + '</p></div>' +
            '<div class="report-generated">Generato il<br><b>' + esc(DP.Fmt.fmtDateMedium(DP.Fmt.nowLocal())) + '</b><br>' +
              esc(DP.Fmt.fmtTime(DP.Fmt.nowLocal())) + '</div>' +
          '</header>' +

          '<div class="report-target">' +
            '<span class="target-pill">Target personale <b>' + m.target.sys + '/' + m.target.dia + '</b> mmHg</span>' +
            '<span class="target-pill ghost">Soglie basse ' + m.limits.sysLow + '/' + m.limits.diaLow + ' mmHg</span>' +
            (m.summary.firstAt ? '<span class="target-pill ghost">Dal ' + esc(DP.Fmt.fmtDateShort(m.summary.firstAt)) +
              ' al ' + esc(DP.Fmt.fmtDateShort(m.summary.lastAt)) + '</span>' : '') +
          '</div>' +

          statsGrid(m) +

          '<section class="report-section">' +
            '<h3>Andamento della pressione</h3>' +
            '<div class="report-chart"><canvas id="report-chart" role="img" aria-label="Grafico della pressione nel periodo"></canvas></div>' +
            '<div class="chart-legend report-legend">' +
              '<span class="legend-item"><i class="legend-dot sys"></i>Massima</span>' +
              '<span class="legend-item"><i class="legend-dot dia"></i>Minima</span>' +
              '<span class="legend-item"><i class="legend-band"></i>Intervallo target</span>' +
            '</div>' +
          '</section>' +

          '<section class="report-section">' +
            '<h3>Riepilogo giornaliero</h3>' + dailyTable(m) +
          '</section>' +

          '<section class="report-section">' +
            '<h3>Dettaglio delle misurazioni</h3>' + detailTable(m) +
          '</section>' +

          '<footer class="report-foot">' +
            '<p class="report-method">' + esc(m.methodNote) + '</p>' +
            '<p class="report-disclaimer">' + DP.UI.icon('shield') + '<span>' + esc(m.disclaimer) + '</span></p>' +
          '</footer>' +
        '</article>'
      ) +

      (has
        ? '<div class="report-actions-bottom">' +
            '<button type="button" class="btn btn-primary" data-action="print-report">' + DP.UI.icon('printer') + ' Stampa / salva PDF</button>' +
            '<button type="button" class="btn btn-ghost" data-action="export-csv">' + DP.UI.icon('download') + ' Scarica CSV</button>' +
            '<button type="button" class="btn btn-ghost" data-action="export-json">' + DP.UI.icon('download') + ' Backup JSON</button>' +
          '</div>' +
          '<p class="print-hint">' + DP.UI.icon('info') +
            '<span>Nella finestra di stampa scegli «Salva come PDF» per inviare il report al medico. Le note e i valori restano sul tuo dispositivo.</span></p>'
        : '') +
    '</div>';
  }

  let resizeTimer = null;

  function drawChart() {
    const canvas = document.getElementById('report-chart');
    if (!canvas) return;
    const m = model();
    const p = DP.Store.profile();
    DP.Chart.draw(canvas, m.readings, {
      target: p.target,
      limits: p.limits,
      height: 280
    });
  }

  function mount() {
    const periodEl = document.getElementById('report-period');
    const fromEl = document.getElementById('report-from');
    const toEl = document.getElementById('report-to');

    if (periodEl) {
      periodEl.addEventListener('change', function () {
        days = DP.toInt(periodEl.value, 30);
        if (days === -1) {
          const range = customRange();
          customFrom = range.from;
          customTo = range.to;
        }
        DP.App.refresh();
      });
    }
    if (fromEl) {
      fromEl.addEventListener('change', function () {
        customFrom = fromEl.value;
        DP.App.refresh();
      });
    }
    if (toEl) {
      toEl.addEventListener('change', function () {
        customTo = toEl.value;
        DP.App.refresh();
      });
    }
    requestAnimationFrame(drawChart);
  }

  function resize() {
    if (resizeTimer) clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      if (document.getElementById('report-chart')) drawChart();
    }, 120);
  }

  // ---------- stampa ----------
  function printRows(m) {
    const p = DP.Store.profile();
    return m.readings.map(function (r) {
      const cat = DP.Stats.category(r, p.target, p.limits);
      return '<tr>' +
        '<td>' + esc(DP.Fmt.fmtDateShort(r.at)) + '</td>' +
        '<td>' + esc(DP.Fmt.fmtTime(r.at)) + '</td>' +
        '<td class="num"><b>' + r.sys + '</b></td>' +
        '<td class="num"><b>' + r.dia + '</b></td>' +
        '<td class="num">' + (r.pulse || '—') + (r.irregular ? ' !' : '') + '</td>' +
        '<td class="num">' + esc(cat.short) + '</td>' +
        '<td class="print-note">' + (r.note ? esc(r.note) : '') +
          (r.arm || r.posture
            ? ' <span class="print-meta">(' + esc([DP.Stats.armLabel(r.arm), DP.Stats.postureLabel(r.posture)].filter(Boolean).join(', ')) + ')</span>'
            : '') +
        '</td>' +
      '</tr>';
    }).join('');
  }

  function printDocHtml(m) {
    const s = m.summary;
    return '<div class="print-page">' +
      '<header class="print-head">' +
        '<div class="print-head-left">' +
          '<div class="print-brand">Pressione 2.0 <span>· diario pressorio</span></div>' +
          '<h1>Report per il medico</h1>' +
          '<p class="print-patient">' + (m.name ? '<b>' + esc(m.name) + '</b> · ' : '') + esc(m.periodLabel) + '</p>' +
        '</div>' +
        '<div class="print-head-right">' +
          '<span>Generato il</span><b>' + esc(DP.Fmt.fmtDateMedium(DP.Fmt.nowLocal())) + '</b>' +
          '<span>' + esc(DP.Fmt.fmtTime(DP.Fmt.nowLocal())) + '</span>' +
        '</div>' +
      '</header>' +

      '<div class="print-target">Target personale <b>' + m.target.sys + '/' + m.target.dia + ' mmHg</b>' +
        ' · soglie basse ' + m.limits.sysLow + '/' + m.limits.diaLow + ' mmHg' +
        (s.firstAt ? ' · dal ' + esc(DP.Fmt.fmtDateShort(s.firstAt)) + ' al ' + esc(DP.Fmt.fmtDateShort(s.lastAt)) : '') +
      '</div>' +

      '<table class="print-summary-table"><tbody><tr>' +
        '<td><span>Misurazioni</span><b>' + s.count + '</b><small>' + s.days + ' ' + DP.Fmt.plural(s.days, 'giorno', 'giorni') + '</small></td>' +
        '<td><span>Media</span><b>' + s.avg.sys + '/' + s.avg.dia + '</b><small>mmHg' +
          (s.avg.pulse ? ' · ' + s.avg.pulse + ' bpm' : '') + '</small></td>' +
        '<td><span>Intervallo</span><b>' + s.min.sys + '/' + s.min.dia + ' – ' + s.max.sys + '/' + s.max.dia + '</b><small>minima – massima</small></td>' +
        '<td><span>Nel target</span><b>' + s.percentNormal + '%</b><small>' + s.above + ' sopra · ' + s.low + ' sotto</small></td>' +
      '</tr></tbody></table>' +

      '<p class="print-secondary">' +
        (s.morning.count ? 'Mattina <b>' + s.morning.sys + '/' + s.morning.dia + '</b> (' + s.morning.count + ') · ' : '') +
        (s.evening.count ? 'Sera <b>' + s.evening.sys + '/' + s.evening.dia + '</b> (' + s.evening.count + ') · ' : '') +
        'Sopra target <b>' + s.above + '</b> · Sotto soglia <b>' + s.low + '</b>' +
        (s.irregular ? ' · Battito irregolare <b>' + s.irregular + '</b>' : '') +
      '</p>' +

      '<h2>Andamento</h2>' +
      '<div class="print-chart-wrap"><canvas id="print-chart"></canvas></div>' +
      '<p class="print-chart-note">Linea rossa: pressione massima. Linea blu: pressione minima. Banda verde: intervallo del target personale.</p>' +

      '<h2>Riepilogo giornaliero</h2>' +
      '<table class="print-table"><thead><tr><th>Giorno</th><th class="num">Mis.</th>' +
        '<th class="num">Media</th><th class="num">Polso</th><th class="num">Sopra target</th></tr></thead><tbody>' +
        s.daily.map(function (d) {
          return '<tr><td>' + esc(DP.Fmt.fmtDateShort(d.key)) + ' ' + esc(DP.Fmt.fmtWeekdayShort(d.key)) + '</td>' +
            '<td class="num">' + d.count + '</td><td class="num"><b>' + d.sys + '/' + d.dia + '</b></td>' +
            '<td class="num">' + (d.pulse || '—') + '</td><td class="num">' + (d.high || '—') + '</td></tr>';
        }).join('') +
      '</tbody></table>' +

      '<h2 class="print-detail-title">Dettaglio delle misurazioni</h2>' +
      '<table class="print-table print-table-detail"><thead><tr><th>Data</th><th>Ora</th>' +
        '<th class="num">Massima</th><th class="num">Minima</th><th class="num">Polso</th>' +
        '<th>Categoria</th><th>Note</th></tr></thead><tbody>' + printRows(m) + '</tbody></table>' +

      '<footer class="print-foot">' +
        '<p>' + esc(m.methodNote) + '</p>' +
        '<p class="print-disclaimer">' + esc(m.disclaimer) + '</p>' +
      '</footer>' +
    '</div>';
  }

  function print() {
    const m = model();
    if (!m.readings.length) {
      DP.UI.toast('Non ci sono misurazioni da stampare nel periodo scelto.', 'warn');
      return;
    }
    const root = document.getElementById('print-doc');
    if (!root) {
      DP.UI.toast('Documento di stampa non disponibile.', 'error');
      return;
    }
    root.innerHTML = printDocHtml(m);

    const canvas = root.querySelector('#print-chart');
    const p = DP.Store.profile();
    if (canvas) {
      DP.Chart.draw(canvas, m.readings, {
        print: true,
        width: 1120,
        height: 360,
        target: p.target,
        limits: p.limits
      });
    }
    setTimeout(function () {
      try { window.print(); }
      catch (e) { DP.UI.toast('Il browser non ha aperto la stampa. Prova dal menu «Stampa».', 'warn'); }
    }, 90);
  }

  async function copySummary() {
    const m = model();
    if (!m.readings.length) {
      DP.UI.toast('Non ci sono misurazioni da copiare.', 'warn');
      return;
    }
    const text = DP.Stats.summaryText(m);
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        ta.remove();
      }
      DP.UI.toast('Riepilogo copiato negli appunti.', 'ok');
    } catch (e) {
      DP.UI.toast('Non riesco a copiare: seleziona il testo manualmente.', 'warn');
    }
  }

  return {
    render: render,
    mount: mount,
    resize: resize,
    print: print,
    copySummary: copySummary,
    currentModel: model
  };
})();
