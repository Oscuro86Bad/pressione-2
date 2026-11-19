/* ============================================================
   PRESSIONE 2.0 — diario completo
   Filtri per periodo, categoria e testo; letture raggruppate
   per giorno e modificabili con un tocco.
   ============================================================ */
window.DP = window.DP || {};
DP.Views = DP.Views || {};

DP.Views.diary = (function () {
  const esc = DP.Fmt.escapeHtml;

  let query = '';
  let days = null;
  let catFilter = 'all';

  function currentDays() {
    if (days !== null) return days;
    const d = DP.toInt(DP.Store.settings().periodDays, 30);
    return d === -1 ? 0 : d;
  }

  function profile() {
    return DP.Store.profile();
  }

  function baseList() {
    const d = currentDays();
    return DP.Stats.filterPeriod(DP.Store.readings(), d === 0 ? { days: 0 } : { days: d });
  }

  function searchText(r) {
    const cat = DP.Stats.category(r, profile().target, profile().limits);
    const parts = [
      r.sys + '/' + r.dia,
      String(r.sys),
      String(r.dia),
      r.pulse ? String(r.pulse) : '',
      DP.Fmt.fmtDateShort(r.at),
      DP.Fmt.fmtTime(r.at),
      DP.Fmt.dateKey(r.at),
      DP.Fmt.dayLabel(DP.Fmt.dateKey(r.at)),
      cat.label,
      r.note || '',
      DP.Stats.armLabel(r.arm),
      DP.Stats.postureLabel(r.posture),
      r.irregular ? 'battito irregolare' : '',
      r.source === 'photo' ? 'foto' : ''
    ];
    return parts.join(' ').toLowerCase();
  }

  function filteredList() {
    let list = baseList();
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter(function (r) { return searchText(r).indexOf(q) >= 0; });
    }
    if (catFilter !== 'all') {
      const p = profile();
      list = list.filter(function (r) {
        return DP.Stats.category(r, p.target, p.limits).key === catFilter;
      });
    }
    return DP.Stats.sortDesc(list);
  }

  function summaryHtml(list) {
    const p = profile();
    const sum = DP.Stats.summarize(list, p.target, p.limits);
    if (!sum.count) {
      return '<div class="diary-summary-empty muted small">Nessuna misurazione con i filtri scelti.</div>';
    }
    return '<div class="diary-summary-grid">' +
      '<div class="summary-item"><span>Misurazioni</span><b>' + sum.count + '</b><small>in ' + sum.days + ' ' +
        DP.Fmt.plural(sum.days, 'giorno', 'giorni') + '</small></div>' +
      '<div class="summary-item"><span>Media</span><b>' + sum.avg.sys + '/' + sum.avg.dia + '</b><small>mmHg' +
        (sum.avg.pulse ? ' · ' + sum.avg.pulse + ' bpm' : '') + '</small></div>' +
      '<div class="summary-item"><span>Nel target</span><b>' + sum.percentNormal + '%</b><small>' +
        sum.above + ' sopra · ' + sum.low + ' sotto</small></div>' +
      '<div class="summary-item"><span>Intervallo</span><b>' + sum.min.sys + '/' + sum.min.dia + ' – ' +
        sum.max.sys + '/' + sum.max.dia + '</b><small>minima – massima</small></div>' +
    '</div>';
  }

  function flags(r) {
    const out = [];
    if (r.irregular) out.push(DP.UI.chip('Battito irregolare', 'warn'));
    if (r.source === 'photo') out.push(DP.UI.chip('Da foto', 'neutral'));
    if (r.arm) out.push(DP.UI.chip('Braccio ' + (r.arm === 'sx' ? 'sx' : 'dx'), 'neutral'));
    return out.join('');
  }

  function rowHtml(r) {
    const p = profile();
    const cat = DP.Stats.category(r, p.target, p.limits);
    return '<button type="button" class="reading-row" data-action="edit-reading" data-id="' + esc(r.id) + '" ' +
      'aria-label="Modifica la misurazione di ' + esc(DP.Fmt.fmtTime(r.at)) + '">' +
      '<span class="reading-time">' + esc(DP.Fmt.fmtTime(r.at)) + '</span>' +
      '<span class="reading-main">' + r.sys + '<i>/</i>' + r.dia + '<small>mmHg</small></span>' +
      '<span class="reading-pulse">' + (r.pulse > 0 ? DP.UI.icon('activity') + ' ' + r.pulse + ' <small>bpm</small>' : '<span class="muted">—</span>') + '</span>' +
      '<span class="reading-extra">' +
        (flags(r) ? '<span class="reading-flags">' + flags(r) + '</span>' : '') +
        (r.note ? '<span class="reading-note" title="' + esc(r.note) + '">' + esc(r.note) + '</span>' : '') +
      '</span>' +
      '<span class="reading-status">' + DP.UI.valueBadge(cat) + '</span>' +
      DP.UI.icon('chevron-right', 'row-chev') +
    '</button>';
  }

  function resultsHtml(list) {
    if (!DP.Store.readings().length) {
      return DP.UI.emptyState({
        icon: 'heart',
        title: 'Il diario è ancora vuoto',
        text: 'Aggiungi la prima misurazione: puoi leggere i valori dalla foto del display o inserirli a mano.',
        action: '<div class="empty-actions">' +
          '<button type="button" class="btn btn-primary" data-action="new-reading">' + DP.UI.icon('plus') + ' Nuova misurazione</button>' +
          '<button type="button" class="btn btn-soft" data-action="photo-reading">' + DP.UI.icon('camera') + ' Foto</button>' +
        '</div>'
      });
    }
    if (!list.length) {
      return DP.UI.emptyState({
        icon: 'search',
        title: 'Nessun risultato',
        text: 'Prova a cambiare periodo, categoria o testo della ricerca.',
        action: '<button type="button" class="btn btn-ghost" data-action="reset-diary-filters">Azzera i filtri</button>'
      });
    }

    const groups = DP.Stats.groupByDay(list);
    return groups.map(function (g) {
      const p = profile();
      const avgCat = DP.Stats.category({ sys: g.avg.sys, dia: g.avg.dia }, p.target, p.limits);
      return '<section class="day-group">' +
        '<div class="day-head">' +
          '<div class="day-title"><span class="day-dot"></span><h3>' + esc(g.label) + '</h3></div>' +
          '<div class="day-meta">' +
            '<span>' + g.count + ' ' + DP.Fmt.plural(g.count, 'misurazione', 'misurazioni') + '</span>' +
            '<span class="day-avg">media ' + g.avg.sys + '/' + g.avg.dia + ' ' + DP.UI.valueBadge(avgCat) + '</span>' +
          '</div>' +
        '</div>' +
        '<div class="day-rows">' + g.readings.map(rowHtml).join('') + '</div>' +
      '</section>';
    }).join('');
  }

  function paint() {
    const list = filteredList();
    const results = document.getElementById('diary-results');
    const summary = document.getElementById('diary-summary');
    if (results) results.innerHTML = resultsHtml(list);
    if (summary) summary.innerHTML = summaryHtml(list);
    const countEl = document.getElementById('diary-filter-count');
    if (countEl) countEl.textContent = list.length + ' ' + DP.Fmt.plural(list.length, 'risultato', 'risultati');
  }

  function render() {
    const all = DP.Store.readings();
    const d = currentDays();
    const options = [
      { v: 7, l: 'Ultimi 7 giorni' },
      { v: 14, l: 'Ultimi 14 giorni' },
      { v: 30, l: 'Ultimi 30 giorni' },
      { v: 90, l: 'Ultimi 3 mesi' },
      { v: 0, l: 'Tutte le misurazioni' }
    ].map(function (o) {
      return '<option value="' + o.v + '"' + (o.v === d ? ' selected' : '') + '>' + esc(o.l) + '</option>';
    }).join('');

    const cats = [
      { v: 'all', l: 'Tutte le categorie' },
      { v: 'normal', l: 'Nella norma' },
      { v: 'high', l: 'Sopra il target' },
      { v: 'critical', l: 'Molto alta' },
      { v: 'low', l: 'Sotto la soglia bassa' }
    ].map(function (o) {
      return '<option value="' + o.v + '"' + (o.v === catFilter ? ' selected' : '') + '>' + esc(o.l) + '</option>';
    }).join('');

    const list = filteredList();

    return '<div class="page page-diary">' +
      '<div class="page-head">' +
        '<div><p class="eyebrow">Il tuo storico</p><h1>Diario</h1>' +
          '<p class="page-sub">Tutte le misurazioni, raggruppate per giorno. Tocca una riga per correggerla.</p></div>' +
        '<div class="page-actions">' +
          '<button type="button" class="btn btn-ghost" data-action="export-csv">' + DP.UI.icon('download') + ' CSV</button>' +
          '<button type="button" class="btn btn-primary" data-action="new-reading">' + DP.UI.icon('plus') + ' Nuova</button>' +
        '</div>' +
      '</div>' +

      (all.length
        ? '<section class="card diary-filters">' +
            '<label class="search-field">' + DP.UI.icon('search') +
              '<input type="search" id="diary-search" placeholder="Cerca per valore, data o nota…" value="' + esc(query) + '" aria-label="Cerca nel diario">' +
            '</label>' +
            '<label class="field field-inline"><span>Periodo</span><select id="diary-period">' + options + '</select></label>' +
            '<label class="field field-inline"><span>Categoria</span><select id="diary-category">' + cats + '</select></label>' +
            '<span class="filter-count" id="diary-filter-count">' + list.length + ' ' + DP.Fmt.plural(list.length, 'risultato', 'risultati') + '</span>' +
          '</section>' +
          '<section class="card diary-summary" id="diary-summary">' + summaryHtml(list) + '</section>'
        : '') +

      '<div id="diary-results">' + resultsHtml(list) + '</div>' +

      (all.length
        ? '<div class="diary-footer-note">' + DP.UI.icon('lock') +
            '<span>Le misurazioni sono salvate su questo dispositivo' +
            (DP.Cloud.configured() && DP.Cloud.isSignedIn() ? ' e sincronizzate sul tuo account.' : '. Attiva la sincronizzazione per ritrovarle altrove.') +
            '</span></div>'
        : '') +
    '</div>';
  }

  function mount() {
    const search = document.getElementById('diary-search');
    const period = document.getElementById('diary-period');
    const category = document.getElementById('diary-category');

    if (search) {
      search.addEventListener('input', function () {
        query = search.value;
        paint();
      });
    }
    if (period) {
      period.addEventListener('change', function () {
        days = DP.toInt(period.value, 30);
        paint();
      });
    }
    if (category) {
      category.addEventListener('change', function () {
        catFilter = category.value;
        paint();
      });
    }
  }

  function reset() {
    query = '';
    catFilter = 'all';
    document.querySelectorAll('#diary-search').forEach(function (el) { el.value = ''; });
    document.querySelectorAll('#diary-category').forEach(function (el) { el.value = 'all'; });
    paint();
  }

  return { render: render, mount: mount, reset: reset };
})();
