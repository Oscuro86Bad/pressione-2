/* ============================================================
   PRESSIONE 2.0 — interpretazione del testo letto dalla foto
   Modulo puro (nessuna dipendenza): trasforma il testo OCR del
   display di un misuratore in massima, minima, pulsazioni e
   indicatore di battito irregolare.

   Il risultato NON viene mai salvato automaticamente: l'utente
   controlla e corregge i campi prima di salvare.
   ============================================================ */
window.DP = window.DP || {};

DP.OCRParser = (function () {
  // Errori tipici dell'OCR sui numeri (lettera -> cifra)
  const CONFUSABLE = {
    O: '0', Q: '0', D: '0',
    I: '1', L: '1', '|': '1', '!': '1',
    S: '5', B: '8', Z: '2'
  };

  const LABELS = [
    {
      kind: 'sys',
      words: ['SYS', 'SIS', 'SYST', 'SIST', 'SYSTOLIC', 'SISTOLIC', 'SISTOLICA',
        'SISTOLICO', 'MASSIMA', 'MASSIMO', 'MAX', 'HIGH', 'SVS', 'SY5', '5YS']
    },
    {
      kind: 'dia',
      words: ['DIA', 'DIAS', 'DIAST', 'DIASTOLIC', 'DIASTOLICA', 'DIASTOLICO',
        'MINIMA', 'MINIMO', 'MIN', 'LOW', 'D1A', 'DlA']
    },
    {
      kind: 'pul',
      words: ['PUL', 'PULS', 'PULSE', 'PULSES', 'PULSAZIONI', 'PULSAZIONE',
        'BPM', 'HR', 'FC', 'FREQ', 'FREQUENZA', 'BATTITI', 'BATTITO', 'PU1', 'PUI']
    }
  ];

  const WORD_TO_KIND = (function () {
    const map = {};
    LABELS.forEach(function (group) {
      group.words.forEach(function (w) { map[w] = group.kind; });
    });
    return map;
  })();

  const RANGES = {
    sys: [50, 300],
    dia: [25, 180],
    pul: [20, 240]
  };

  function inRange(value, kind) {
    const r = RANGES[kind];
    return value !== null && value !== undefined && value >= r[0] && value <= r[1];
  }

  // ---------- normalizzazione del testo ----------
  function clean(text) {
    let s = String(text || '').toUpperCase()
      .replace(/[ÀÁÂÃÄÅ]/g, 'A')
      .replace(/[ÈÉÊË]/g, 'E')
      .replace(/[ÌÍÎÏ]/g, 'I')
      .replace(/[ÒÓÔÖØ]/g, 'O')
      .replace(/[ÙÚÛÜ]/g, 'U')
      .replace(/[‐‑‒–—−]/g, '-')
      .replace(/\r/g, '');

    // Orari (08:30, 8.30) e date (18/11, 18-11-2026, 18.11.26):
    // vanno tolti prima di cercare i valori pressori.
    s = s.replace(/\b\d{1,2}\s*[:.]\s*\d{2}\b/g, ' ');
    s = s.replace(/\b(0?[1-9]|[12]\d|3[01])\s*[\/.\-]\s*(0?[1-9]|1[0-2])(?:\s*[\/.\-]\s*(?:\d{2}|\d{4}))?\b/g, ' ');
    s = s.replace(/\b(19|20)\d{2}\b/g, ' ');

    // L'OCR separa spesso etichette e numeri con righe vuote:
    // contano le righe di contenuto, non quelle vuote.
    s = s.replace(/\n[ \t]*\n+/g, '\n');

    return s;
  }

  function numericValue(raw) {
    const s = String(raw || '');
    if (!s) return null;
    if (/^\d+$/.test(s)) {
      if (s.length < 2 || s.length > 3) return null;
      const n = parseInt(s, 10);
      return Number.isFinite(n) ? n : null;
    }
    const hasDigit = /\d/.test(s);
    const confusableOnly = /^[OQDILSBZ|!]+$/.test(s);
    if (!hasDigit && !(confusableOnly && s.length >= 2 && s.length <= 3)) return null;
    if (!/^[0-9OQDILSBZ|!]+$/.test(s)) return null;
    let out = '';
    for (const ch of s) out += (CONFUSABLE[ch] || ch);
    if (!/^\d+$/.test(out) || out.length < 2 || out.length > 3) return null;
    const n = parseInt(out, 10);
    return Number.isFinite(n) ? n : null;
  }

  // ---------- tokenizzazione ----------
  function tokenize(text) {
    const tokens = [];
    const re = /[A-Z0-9]+/g;
    let m;
    let lastEnd = 0;
    let line = 0;

    while ((m = re.exec(text))) {
      const between = text.slice(lastEnd, m.index);
      line += (between.match(/\n/g) || []).length;
      tokens.push({
        raw: m[0],
        start: m.index,
        end: m.index + m[0].length,
        gap: between,
        line: line,
        index: tokens.length,
        value: numericValue(m[0])
      });
      lastEnd = m.index + m[0].length;
    }

    // Unisce le cifre separate dall'OCR: "1 2 0" -> "120".
    const out = [];
    for (let i = 0; i < tokens.length; i++) {
      const t = tokens[i];
      if (/^\d$/.test(t.raw)) {
        let raw = t.raw;
        let j = i;
        while (j + 1 < tokens.length &&
          /^\d$/.test(tokens[j + 1].raw) &&
          tokens[j + 1].line === t.line &&
          tokens[j + 1].start - tokens[j].end <= 4 &&
          raw.length < 3) {
          j++;
          raw += tokens[j].raw;
        }
        if (raw.length >= 2) {
          out.push({
            raw: raw,
            start: t.start,
            end: tokens[j].end,
            gap: t.gap,
            line: t.line,
            index: out.length,
            value: numericValue(raw)
          });
          i = j;
          continue;
        }
      }
      out.push({
        raw: t.raw,
        start: t.start,
        end: t.end,
        gap: t.gap,
        line: t.line,
        index: out.length,
        value: t.value
      });
    }
    return out;
  }

  function labelKind(token, tokens, i) {
    const raw = String(token.raw || '').toUpperCase();
    const kind = WORD_TO_KIND[raw] || null;
    if (!kind) return null;

    // "PULSE/MIN": MIN è l'unità (al minuto), non la minima.
    if ((raw === 'MIN' || raw === 'MAX') && i > 0) {
      const prevKind = WORD_TO_KIND[String(tokens[i - 1].raw || '').toUpperCase()];
      if (prevKind === 'pul' && /[\/\\]/.test(token.gap || '')) return null;
    }
    return kind;
  }

  // Cerca un numero vicino a un'etichetta. In avanti attraversa anche
  // etichette consecutive (display "SYS DIA PUL" sopra i tre numeri).
  function findNumber(tokens, fromIndex, direction, used) {
    const from = tokens[fromIndex];
    if (!from) return null;
    const max = direction > 0 ? 12 : 4;
    for (let step = 1; step <= max; step++) {
      const t = tokens[fromIndex + direction * step];
      if (!t) break;
      if (direction > 0 && t.line - from.line > 3) break;
      if (direction < 0 && t.line !== from.line) break;
      if (t.value !== null) {
        if (!used.has(t.index)) return t;
        continue;
      }
    }
    return null;
  }

  function findSlashPair(cleaned) {
    const re = /(\d{2,3})\s*[\/\\]\s*(\d{2,3})/g;
    let m;
    while ((m = re.exec(cleaned))) {
      let a = parseInt(m[1], 10);
      let b = parseInt(m[2], 10);
      if (a < b) { const t = a; a = b; b = t; }
      if (inRange(a, 'sys') && inRange(b, 'dia') && a - b >= 8) {
        return { sys: a, dia: b };
      }
    }
    return null;
  }

  function parse(input) {
    const rawText = Array.isArray(input) ? input.join('\n') : String(input || '');
    const irregular = /(\bIRREG|\bIHB\b|\bAFIB\b|\bA-FIB\b|\bARITM|\bFIBRILL)/.test(
      rawText.toUpperCase()
    );

    if (!rawText.trim()) {
      return emptyResult(rawText, irregular);
    }

    const cleaned = clean(rawText);
    const tokens = tokenize(cleaned);
    const values = { sys: null, dia: null, pul: null };
    const source = { sys: null, dia: null, pul: null };
    const used = new Set();

    // 1) Etichette esplicite (SYS, DIA, PULSE, MAX, MIN, ...)
    const labelTokens = [];
    tokens.forEach(function (t, i) {
      const kind = labelKind(t, tokens, i);
      if (kind) labelTokens.push({ token: t, kind: kind });
    });

    labelTokens.forEach(function (entry) {
      if (values[entry.kind] !== null) return;
      let num = findNumber(tokens, entry.token.index, 1, used);
      if (!num) num = findNumber(tokens, entry.token.index, -1, used);
      if (num && inRange(num.value, entry.kind)) {
        values[entry.kind] = num.value;
        source[entry.kind] = 'label';
        used.add(num.index);
      }
    });

    // 2) Formato "120/80"
    if (values.sys === null || values.dia === null) {
      const pair = findSlashPair(cleaned);
      if (pair) {
        if (values.sys === null) { values.sys = pair.sys; source.sys = 'slash'; }
        if (values.dia === null) { values.dia = pair.dia; source.dia = 'slash'; }
      }
    }

    // 3) Coppia plausibile nell'ordine di lettura (display senza etichette)
    if (values.sys === null || values.dia === null) {
      const candidates = tokens.filter(function (t) {
        return t.value !== null && !used.has(t.index);
      });
      const pairs = [];
      for (let i = 0; i < candidates.length; i++) {
        for (let j = i + 1; j < candidates.length && j <= i + 3; j++) {
          const a = candidates[i].value;
          const b = candidates[j].value;
          if (a <= b) continue;
          if (!inRange(a, 'sys') || !inRange(b, 'dia') || a - b < 8) continue;
          const score = i * 100 +
            Math.abs(a - 120) + Math.abs(b - 80) * 0.7 +
            (j > i + 1 ? 30 : 0) +
            (a < 85 ? 40 : 0) + (b < 40 ? 40 : 0);
          pairs.push({
            sys: a, dia: b, score: score,
            sysIndex: candidates[i].index, diaIndex: candidates[j].index
          });
        }
      }
      pairs.sort(function (x, y) { return x.score - y.score; });
      if (pairs.length) {
        const best = pairs[0];
        if (values.sys === null) { values.sys = best.sys; source.sys = 'sequence'; }
        if (values.dia === null) { values.dia = best.dia; source.dia = 'sequence'; }
        used.add(best.sysIndex);
        used.add(best.diaIndex);
      }
    }

    // 4) Pulsazioni residue
    if (values.pul === null) {
      const candidates = tokens.filter(function (t) {
        return t.value !== null && !used.has(t.index) &&
          inRange(t.value, 'pul') &&
          t.value !== values.sys && t.value !== values.dia;
      });
      let pick = null;
      const diaToken = tokens.find(function (t) {
        return t.value === values.dia && used.has(t.index);
      });
      if (diaToken) {
        pick = candidates.find(function (t) { return t.index > diaToken.index; }) || null;
      }
      if (!pick) {
        pick = candidates.find(function (t) { return t.value >= 35 && t.value <= 200; }) || null;
      }
      if (!pick) pick = candidates[0] || null;
      if (pick) {
        values.pul = pick.value;
        source.pul = 'sequence';
        used.add(pick.index);
      }
    }

    // 5) Correzione di eventuali scambi massima/minima
    if (values.sys !== null && values.dia !== null && values.sys < values.dia) {
      const t = values.sys;
      values.sys = values.dia;
      values.dia = t;
      const s = source.sys;
      source.sys = source.dia;
      source.dia = s;
    }

    // 6) Validazione finale
    if (!inRange(values.sys, 'sys')) { values.sys = null; source.sys = null; }
    if (!inRange(values.dia, 'dia')) { values.dia = null; source.dia = null; }
    if (values.sys !== null && values.dia !== null && values.sys <= values.dia) {
      values.dia = null;
      source.dia = null;
    }
    if (values.pul !== null &&
      (!inRange(values.pul, 'pul') || values.pul === values.sys || values.pul === values.dia)) {
      values.pul = null;
      source.pul = null;
    }

    let confidence = 'none';
    if (values.sys !== null && values.dia !== null) {
      confidence = (source.sys === 'label' && source.dia === 'label') ||
        (source.sys === 'slash' && source.dia === 'slash') ? 'high' : 'medium';
    } else if (values.sys !== null || values.dia !== null) {
      confidence = 'low';
    }

    return {
      sys: values.sys,
      dia: values.dia,
      pulse: values.pul,
      irregular: irregular,
      confidence: confidence,
      source: source,
      text: rawText,
      cleaned: cleaned,
      note: confidenceNote(confidence, values, source)
    };
  }

  function confidenceNote(confidence, values, source) {
    if (confidence === 'none') {
      return 'Non ho trovato una coppia massima/minima. Inserisci i valori a mano.';
    }
    if (confidence === 'low') {
      return 'Ho letto solo una parte dei valori: controlla e completa a mano.';
    }
    if (source.sys === 'sequence' || source.dia === 'sequence') {
      return 'Valori ricavati dal display: controlla sempre prima di salvare.';
    }
    return 'Valori letti dalle etichette del display: controlla sempre prima di salvare.';
  }

  function emptyResult(rawText, irregular) {
    return {
      sys: null, dia: null, pulse: null,
      irregular: !!irregular,
      confidence: 'none',
      source: { sys: null, dia: null, pul: null },
      text: rawText || '', cleaned: '',
      note: 'La foto non contiene testo leggibile. Riprova con più luce e il display vicino.'
    };
  }

  return {
    parse: parse,
    clean: clean,
    tokenize: tokenize,
    numericValue: numericValue,
    inRange: inRange
  };
})();
