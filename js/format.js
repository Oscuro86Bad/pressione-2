/* ============================================================
   PRESSIONE 2.0 — utilità di formattazione (date, testi, file)
   Tutte le date sono gestite come "ora locale" nel formato
   YYYY-MM-DDTHH:mm, così il diario non cambia ora se si viaggia.
   ============================================================ */
window.DP = window.DP || {};

DP.Fmt = (function () {
  const MONTHS = [
    'gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno',
    'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'
  ];
  const MONTHS_SHORT = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];
  const WEEKDAYS = ['domenica', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato'];

  function pad(n) {
    return String(Math.abs(Math.trunc(n))).padStart(2, '0');
  }

  function nowLocal(date) {
    const d = date || new Date();
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) +
      'T' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  }

  // Converte "YYYY-MM-DDTHH:mm" in Date locale (senza passare da UTC).
  function parseLocal(at) {
    if (!at) return null;
    const m = String(at).match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/);
    if (!m) return null;
    const d = new Date(
      Number(m[1]), Number(m[2]) - 1, Number(m[3]),
      m[4] ? Number(m[4]) : 0, m[5] ? Number(m[5]) : 0, 0, 0
    );
    return isNaN(d.getTime()) ? null : d;
  }

  function dateKey(value) {
    if (!value) return '';
    if (value instanceof Date) {
      return value.getFullYear() + '-' + pad(value.getMonth() + 1) + '-' + pad(value.getDate());
    }
    const s = String(value);
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
    const d = parseLocal(s);
    return d ? dateKey(d) : '';
  }

  function todayKey() {
    return dateKey(new Date());
  }

  function keyToDate(key) {
    const m = String(key || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return null;
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0, 0);
  }

  function addDaysKey(key, days) {
    const d = keyToDate(key);
    if (!d) return key;
    d.setDate(d.getDate() + days);
    return dateKey(d);
  }

  function daysBetweenKeys(a, b) {
    const da = keyToDate(a);
    const db = keyToDate(b);
    if (!da || !db) return 0;
    return Math.round((db.getTime() - da.getTime()) / 86400000);
  }

  function fmtTime(at) {
    const m = String(at || '').match(/T(\d{2}):(\d{2})/);
    return m ? m[1] + ':' + m[2] : '';
  }

  function fmtDateLong(at) {
    const d = parseLocal(at) || (at && keyToDate(at));
    if (!d) return '';
    return WEEKDAYS[d.getDay()] + ' ' + d.getDate() + ' ' + MONTHS[d.getMonth()] + ' ' + d.getFullYear();
  }

  function fmtDateMedium(at) {
    const d = parseLocal(at) || (at && keyToDate(at));
    if (!d) return '';
    return d.getDate() + ' ' + MONTHS_SHORT[d.getMonth()] + ' ' + d.getFullYear();
  }

  function fmtDateShort(at) {
    const d = parseLocal(at) || (at && keyToDate(at));
    if (!d) return '';
    return pad(d.getDate()) + '/' + pad(d.getMonth() + 1) + '/' + d.getFullYear();
  }

  function fmtWeekdayShort(at) {
    const d = parseLocal(at) || (at && keyToDate(at));
    if (!d) return '';
    const w = WEEKDAYS[d.getDay()];
    return w.charAt(0).toUpperCase() + w.slice(1, 3);
  }

  function fmtDateTime(at) {
    const d = parseLocal(at);
    if (!d) return '';
    return fmtDateMedium(at) + ', ' + fmtTime(at);
  }

  function dayLabel(key) {
    const today = todayKey();
    if (key === today) return 'Oggi';
    if (key === addDaysKey(today, -1)) return 'Ieri';
    if (key === addDaysKey(today, -2)) return 'L’altro ieri';
    const d = keyToDate(key);
    if (!d) return key;
    return WEEKDAYS[d.getDay()] + ' ' + d.getDate() + ' ' + MONTHS_SHORT[d.getMonth()] +
      (d.getFullYear() !== new Date().getFullYear() ? ' ' + d.getFullYear() : '');
  }

  function monthLabel(key) {
    const d = keyToDate(key);
    if (!d) return key;
    const s = MONTHS[d.getMonth()] + ' ' + d.getFullYear();
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  function hourOf(at) {
    const m = String(at || '').match(/T(\d{2}):/);
    return m ? Number(m[1]) : 0;
  }

  function escapeHtml(value) {
    return String(value === undefined || value === null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function round(n) {
    return Math.round(Number(n) || 0);
  }

  function round1(n) {
    return Math.round((Number(n) || 0) * 10) / 10;
  }

  function avg(values) {
    const nums = (values || []).map(Number).filter(function (n) { return Number.isFinite(n); });
    if (!nums.length) return 0;
    return nums.reduce(function (a, b) { return a + b; }, 0) / nums.length;
  }

  function percent(part, total) {
    if (!total) return 0;
    return Math.round((part / total) * 100);
  }

  function pad2(n) {
    return pad(n);
  }

  function csvCell(value) {
    const s = String(value === undefined || value === null ? '' : value);
    if (/[";\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
    return s;
  }

  function isUuid(value) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ''));
  }

  // ID deterministico (formato UUID v4) per importazioni senza id:
  // reimportare lo stesso backup non crea doppioni.
  function hash32(str, seed) {
    let h = (0x811c9dc5 ^ seed) >>> 0;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    h ^= h >>> 16;
    h = Math.imul(h, 0x85ebca6b) >>> 0;
    h ^= h >>> 13;
    h = Math.imul(h, 0xc2b2ae35) >>> 0;
    h ^= h >>> 16;
    return (h >>> 0).toString(16).padStart(8, '0');
  }

  function stableId(seed) {
    const s = String(seed || '');
    const hex = (hash32(s, 0x9e3779b9) + hash32(s, 0x85ebca6b) +
      hash32(s, 0xc2b2ae35) + hash32(s, 0x27d4eb2f)).split('');
    hex[12] = '4';
    hex[16] = (8 + (parseInt(hex[16], 16) & 3)).toString(16);
    const h = hex.join('');
    return h.slice(0, 8) + '-' + h.slice(8, 12) + '-' + h.slice(12, 16) + '-' +
      h.slice(16, 20) + '-' + h.slice(20, 32);
  }

  function uid() {
    try {
      if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    } catch (e) { /* fallback */ }
    // UUID v4 di riserva per gli identificativi delle misurazioni
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  function download(filename, content, mime) {
    const type = mime || 'text/plain;charset=utf-8';
    const blob = content instanceof Blob ? content : new Blob([content], { type: type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
  }

  function timeAgo(iso) {
    if (!iso) return 'mai';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return 'mai';
    const s = Math.max(0, Math.floor((Date.now() - d.getTime()) / 1000));
    if (s < 45) return 'adesso';
    if (s < 3600) return 'da ' + Math.floor(s / 60) + ' min';
    if (s < 86400) return 'da ' + Math.floor(s / 3600) + ' h';
    if (s < 604800) return 'da ' + Math.floor(s / 86400) + ' giorni';
    return fmtDateShort(d);
  }

  function clamp(n, min, max) {
    return Math.min(max, Math.max(min, n));
  }

  function plural(n, one, many) {
    return n === 1 ? one : many;
  }

  return {
    MONTHS: MONTHS,
    MONTHS_SHORT: MONTHS_SHORT,
    WEEKDAYS: WEEKDAYS,
    pad: pad,
    pad2: pad2,
    nowLocal: nowLocal,
    parseLocal: parseLocal,
    dateKey: dateKey,
    todayKey: todayKey,
    keyToDate: keyToDate,
    addDaysKey: addDaysKey,
    daysBetweenKeys: daysBetweenKeys,
    fmtTime: fmtTime,
    fmtDateLong: fmtDateLong,
    fmtDateMedium: fmtDateMedium,
    fmtDateShort: fmtDateShort,
    fmtWeekdayShort: fmtWeekdayShort,
    fmtDateTime: fmtDateTime,
    dayLabel: dayLabel,
    monthLabel: monthLabel,
    hourOf: hourOf,
    escapeHtml: escapeHtml,
    round: round,
    round1: round1,
    avg: avg,
    percent: percent,
    csvCell: csvCell,
    isUuid: isUuid,
    uid: uid,
    stableId: stableId,
    download: download,
    timeAgo: timeAgo,
    clamp: clamp,
    plural: plural
  };
})();
