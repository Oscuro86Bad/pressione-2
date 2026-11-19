/* ============================================================
   PRESSIONE 2.0 — lettura del display dalla foto (OCR)
   Tesseract.js in WebAssembly: la foto viene elaborata DENTRO il
   telefono/PC. Nessuna immagine viene caricata su un server.
   Il testo letto viene interpretato da ocr-parse.js; i valori
   restano modificabili e non vengono mai salvati da soli.

   Strategia: più passaggi sulla stessa foto (etichette, soli numeri,
   ritaglio centrale) con immagini preparate in modo diverso. Vince
   la lettura più affidabile.
   ============================================================ */
window.DP = window.DP || {};

DP.OCR = (function () {
  const V = '7.0.0';
  const CDN = 'https://cdn.jsdelivr.net/npm';
  const LIB_URL = CDN + '/tesseract.js@' + V + '/dist/tesseract.min.js';
  const WORKER_PATH = CDN + '/tesseract.js@' + V + '/dist/worker.min.js';
  const CORE_PATH = CDN + '/tesseract.js-core@' + V;
  const LANG_PATH = CDN + '/@tesseract.js-data/ita@1.0.0/4.0.0';

  const MAX_SIDE = 2200;
  const MIN_SIDE = 1500;
  const PAD = 28;
  const DIGITS = '0123456789/';

  const PASSES = [
    { id: 'labels', psm: '11', whitelist: '', mode: 'contrast', crop: null, rotate: 0, label: 'Leggo le etichette del display…' },
    { id: 'digits', psm: '11', whitelist: DIGITS, mode: 'binary', crop: null, rotate: 0, label: 'Leggo i numeri del display…' },
    { id: 'digits-tilt-left', psm: '11', whitelist: DIGITS, mode: 'binary', crop: null, rotate: 10, label: 'Riprovo raddrizzando la foto…' },
    { id: 'digits-tilt-right', psm: '11', whitelist: DIGITS, mode: 'binary', crop: null, rotate: -10, label: 'Riprovo inclinando dall’altro lato…' },
    { id: 'labels-center', psm: '6', whitelist: '', mode: 'contrast', crop: 'center', rotate: 0, label: 'Riprovo sulla parte centrale…' },
    { id: 'digits-center', psm: '6', whitelist: DIGITS, mode: 'binary', crop: 'center', rotate: 0, label: 'Ultimo tentativo sui numeri…' }
  ];

  let libPromise = null;
  let workerPromise = null;
  let progressFn = null;
  let lastPct = 0;
  let currentPass = 1;
  let totalPasses = PASSES.length;

  function report(label, pct) {
    if (typeof progressFn !== 'function') return;
    lastPct = Math.max(lastPct, Math.min(1, Math.max(0, pct)));
    try { progressFn(label, lastPct); } catch (e) { /* ignore */ }
  }

  function loadLib() {
    if (window.Tesseract) return Promise.resolve(window.Tesseract);
    if (libPromise) return libPromise;
    libPromise = new Promise(function (resolve, reject) {
      const s = document.createElement('script');
      s.src = LIB_URL;
      s.async = true;
      s.onload = function () {
        if (window.Tesseract) resolve(window.Tesseract);
        else {
          libPromise = null;
          reject(new Error('Lettore di testo non disponibile.'));
        }
      };
      s.onerror = function () {
        libPromise = null;
        reject(new Error('La prima volta serve internet per scaricare il lettore di testo. Poi funziona anche offline.'));
      };
      document.head.appendChild(s);
    });
    return libPromise;
  }

  function logger(m) {
    const status = String((m && m.status) || '');
    const p = (m && typeof m.progress === 'number') ? m.progress : 0;
    const base = 0.10 + ((currentPass - 1) / totalPasses) * 0.86;
    const span = 0.86 / totalPasses;
    if (status === 'recognizing text') {
      report(PASSES[Math.min(currentPass - 1, PASSES.length - 1)].label, base + p * span);
    } else if (/loading language traineddata/i.test(status)) {
      report('Scarico il dizionario italiano (solo la prima volta)…', 0.03 + p * 0.05);
    } else if (/loading|initializ|core/i.test(status)) {
      report('Preparo il lettore…', 0.02 + p * 0.05);
    }
  }

  function getWorker() {
    if (workerPromise) return workerPromise;
    workerPromise = loadLib().then(function (T) {
      return T.createWorker('ita', 1, {
        workerPath: WORKER_PATH,
        corePath: CORE_PATH,
        langPath: LANG_PATH,
        cacheMethod: 'write',
        logger: logger
      });
    }).then(function (worker) {
      return worker.setParameters({
        tessedit_pageseg_mode: '11',
        preserve_interword_spaces: '1',
        user_defined_dpi: '300'
      }).then(function () { return worker; });
    }).catch(function (e) {
      workerPromise = null;
      throw e;
    });
    return workerPromise;
  }

  // ---------- preparazione immagine ----------
  function loadImage(file) {
    return new Promise(function (resolve, reject) {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = function () {
        URL.revokeObjectURL(url);
        resolve(img);
      };
      img.onerror = function () {
        URL.revokeObjectURL(url);
        reject(new Error('Non riesco ad aprire questa foto.'));
      };
      img.src = url;
    });
  }

  function cropRect(source, crop) {
    const sw = source.naturalWidth || source.width;
    const sh = source.naturalHeight || source.height;
    if (!crop) return { x: 0, y: 0, w: sw, h: sh };
    // Il display è quasi sempre al centro: ritaglio prudente, senza
    // tagliare le colonne laterali (massima, minima, polso).
    return {
      x: Math.round(sw * 0.03),
      y: Math.round(sh * 0.08),
      w: Math.round(sw * 0.94),
      h: Math.round(sh * 0.84)
    };
  }

  function drawScaled(source, crop) {
    const src = cropRect(source, crop);
    if (!src.w || !src.h) throw new Error('La foto non ha dimensioni valide.');

    const longSide = Math.max(src.w, src.h);
    let scale = 1;
    if (longSide > MAX_SIDE) scale = MAX_SIDE / longSide;
    else if (longSide < MIN_SIDE) scale = Math.min(4, MIN_SIDE / longSide);

    let w = Math.max(1, Math.round(src.w * scale));
    let h = Math.max(1, Math.round(src.h * scale));
    // Evita immagini enormi dopo l'ingrandimento di un ritaglio piccolo.
    const outLong = Math.max(w, h);
    if (outLong > MAX_SIDE) {
      const k = MAX_SIDE / outLong;
      w = Math.max(1, Math.round(w * k));
      h = Math.max(1, Math.round(h * k));
    }

    const c = document.createElement('canvas');
    c.width = w + PAD * 2;
    c.height = h + PAD * 2;
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = true;
    g.imageSmoothingQuality = 'high';
    g.fillStyle = '#FFFFFF';
    g.fillRect(0, 0, c.width, c.height);
    g.drawImage(source, src.x, src.y, src.w, src.h, PAD, PAD, w, h);
    return c;
  }

  function otsuThreshold(hist, total) {
    let sumAll = 0;
    for (let v = 0; v < 256; v++) sumAll += v * hist[v];
    let sumB = 0;
    let wB = 0;
    let best = 0;
    let threshold = 127;
    for (let v = 0; v < 256; v++) {
      wB += hist[v];
      if (!wB) continue;
      const wF = total - wB;
      if (!wF) break;
      sumB += v * hist[v];
      const mB = sumB / wB;
      const mF = (sumAll - sumB) / wF;
      const between = wB * wF * (mB - mF) * (mB - mF);
      if (between > best) { best = between; threshold = v; }
    }
    return threshold;
  }

  function rotateCanvas(canvas, angle) {
    const w = canvas.width;
    const h = canvas.height;
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = true;
    g.imageSmoothingQuality = 'high';
    g.fillStyle = '#FFFFFF';
    g.fillRect(0, 0, w, h);
    g.translate(w / 2, h / 2);
    g.rotate(-angle * Math.PI / 180);
    // Ingrandisce appena per non tagliare gli angoli.
    const zoom = 1 + Math.abs(Math.sin(angle * Math.PI / 180)) * 1.1;
    g.scale(zoom, zoom);
    g.drawImage(canvas, -w / 2, -h / 2);
    return c;
  }

  function enhance(canvas, mode) {
    const g = canvas.getContext('2d');
    let frame;
    try { frame = g.getImageData(0, 0, canvas.width, canvas.height); }
    catch (e) { return canvas; } // immagine protetta: si prova lo stesso
    const d = frame.data;
    const w = canvas.width;
    const h = canvas.height;
    const total = w * h;
    const gray = new Uint8ClampedArray(total);

    // Scala di grigi + istogramma.
    const hist = new Uint32Array(256);
    let sum = 0;
    let centralSum = 0;
    let centralCount = 0;
    const cx0 = Math.floor(w * 0.15);
    const cx1 = Math.floor(w * 0.85);
    const cy0 = Math.floor(h * 0.15);
    const cy1 = Math.floor(h * 0.85);

    for (let i = 0, px = 0; i < d.length; i += 4, px++) {
      const l = (d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114 + 0.5) | 0;
      gray[px] = l;
      hist[l]++;
      sum += l;
      const x = px % w;
      const y = (px / w) | 0;
      if (x >= cx0 && x <= cx1 && y >= cy0 && y <= cy1) {
        centralSum += l;
        centralCount++;
      }
    }

    const mean = total ? sum / total : 128;
    const centralMean = centralCount ? centralSum / centralCount : mean;

    // Display scuro con cifre chiare: invertiamo per avere testo scuro su fondo chiaro.
    if (centralMean < 105 || mean < 75) {
      hist.fill(0);
      for (let i = 0; i < total; i++) {
        const v = 255 - gray[i];
        gray[i] = v;
        hist[v]++;
      }
      sum = total * 255 - sum;
    }

    // Allungamento del contrasto (1% di taglio su entrambi i lati).
    const lowCut = Math.max(1, total * 0.01);
    const highCut = Math.max(1, total * 0.01);
    let acc = 0;
    let lo = 0;
    let hi = 255;
    for (let v = 0; v < 256; v++) { acc += hist[v]; if (acc >= lowCut) { lo = v; break; } }
    acc = 0;
    for (let v = 255; v >= 0; v--) { acc += hist[v]; if (acc >= highCut) { hi = v; break; } }
    if (hi - lo < 20) { lo = 0; hi = 255; }
    if (hi <= lo) { lo = 0; hi = 255; }
    const k = 255 / (hi - lo);
    for (let i = 0; i < total; i++) {
      let v = (gray[i] - lo) * k;
      gray[i] = v < 0 ? 0 : (v > 255 ? 255 : v);
    }

    // Nitidezza (unsharp mask leggera): aiuta molto sui display LCD.
    const sharp = new Uint8ClampedArray(total);
    for (let y = 0; y < h; y++) {
      const row = y * w;
      for (let x = 0; x < w; x++) {
        const i = row + x;
        const c = gray[i];
        const l = x > 0 ? gray[i - 1] : c;
        const r = x < w - 1 ? gray[i + 1] : c;
        const u = y > 0 ? gray[i - w] : c;
        const dn = y < h - 1 ? gray[i + w] : c;
        let v = c * 1.7 - (l + r + u + dn) * 0.175;
        sharp[i] = v < 0 ? 0 : (v > 255 ? 255 : v);
      }
    }

    if (mode === 'binary') {
      // Binarizzazione adattiva (Sauvola semplificata): gestisce ombre,
      // riflessi e foto scattate di lato molto meglio di una soglia unica.
      const iw = w + 1;
      const integral = new Float64Array(iw * (h + 1));
      const integralSq = new Float64Array(iw * (h + 1));
      for (let y = 1; y <= h; y++) {
        let rowSum = 0;
        let rowSq = 0;
        for (let x = 1; x <= w; x++) {
          const v = sharp[(y - 1) * w + (x - 1)];
          rowSum += v;
          rowSq += v * v;
          integral[y * iw + x] = integral[(y - 1) * iw + x] + rowSum;
          integralSq[y * iw + x] = integralSq[(y - 1) * iw + x] + rowSq;
        }
      }
      let win = Math.round(Math.min(w, h) / 10);
      if (win < 15) win = 15;
      if (win % 2 === 0) win++;
      const rad = (win - 1) >> 1;

      for (let y = 0; y < h; y++) {
        const y0 = Math.max(0, y - rad);
        const y1 = Math.min(h - 1, y + rad);
        for (let x = 0; x < w; x++) {
          const x0 = Math.max(0, x - rad);
          const x1 = Math.min(w - 1, x + rad);
          const area = (x1 - x0 + 1) * (y1 - y0 + 1);
          const sumI = integral[(y1 + 1) * iw + (x1 + 1)] - integral[y0 * iw + (x1 + 1)] -
            integral[(y1 + 1) * iw + x0] + integral[y0 * iw + x0];
          const sumSq = integralSq[(y1 + 1) * iw + (x1 + 1)] - integralSq[y0 * iw + (x1 + 1)] -
            integralSq[(y1 + 1) * iw + x0] + integralSq[y0 * iw + x0];
          const m = sumI / area;
          const variance = Math.max(0, sumSq / area - m * m);
          const std = Math.sqrt(variance);
          let t = m * (1 + 0.22 * (std / 128 - 1));
          if (!(t > 8 && t < 247)) t = otsuThreshold(hist, total);
          const idx = y * w + x;
          const v = sharp[idx] < t ? 0 : 255;
          sharp[idx] = v;
        }
      }
    }

    for (let i = 0, px = 0; i < d.length; i += 4, px++) {
      const v = sharp[px];
      d[i] = d[i + 1] = d[i + 2] = v;
      d[i + 3] = 255;
    }
    g.putImageData(frame, 0, 0);
    return canvas;
  }

  function prepare(image, pass) {
    let canvas = drawScaled(image, pass.crop);
    if (pass.rotate) {
      try { canvas = rotateCanvas(canvas, pass.rotate); } catch (e) { /* ignore */ }
    }
    return enhance(canvas, pass.mode);
  }

  // ---------- scelta del risultato migliore ----------
  function score(parsed) {
    if (!parsed) return -1;
    let s = 0;
    if (parsed.confidence === 'high') s += 8;
    else if (parsed.confidence === 'medium') s += 5;
    else if (parsed.confidence === 'low') s += 2;
    if (parsed.sys !== null) s += 2;
    if (parsed.dia !== null) s += 2;
    if (parsed.pulse !== null) s += 1.5;
    if (parsed.irregular) s += 0.5;
    if (parsed.source && parsed.source.sys === 'label') s += 1;
    if (parsed.source && parsed.source.dia === 'label') s += 1;
    return s;
  }

  function better(a, b) {
    if (!a) return b;
    if (!b) return a;
    const sa = score(a.parsed);
    const sb = score(b.parsed);
    if (sb > sa) return b;
    if (sa > sb) return a;
    return (b.text || '').length > (a.text || '').length ? b : a;
  }

  function hasThreeValues(parsed) {
    return !!parsed && parsed.sys !== null && parsed.dia !== null && parsed.pulse !== null;
  }

  // Se un passaggio legge bene la coppia ma non il polso (o viceversa),
  // completa i valori mancanti usando gli altri passaggi: per il polso
  // vince il valore letto più volte, così un numero isolato non basta.
  function mergeResults(best, results) {
    if (!best || !best.parsed) return best;
    const p = best.parsed;
    if (!p.source) p.source = {};

    if (p.sys === null || p.dia === null) {
      const withPair = results.filter(function (r) {
        const q = r.parsed;
        return q && q !== p && q.sys !== null && q.dia !== null &&
          q.sys > q.dia && q.sys - q.dia >= 10;
      }).sort(function (a, b) { return score(b.parsed) - score(a.parsed); })[0];
      if (withPair) {
        if (p.sys === null) p.sys = withPair.parsed.sys;
        if (p.dia === null) p.dia = withPair.parsed.dia;
      }
    }

    if (p.pulse === null) {
      const votes = {};
      results.forEach(function (r) {
        const q = r.parsed;
        if (!q || q.pulse === null) return;
        if (q.pulse < 30 || q.pulse > 220) return;
        if (q.pulse === p.sys || q.pulse === p.dia) return;
        votes[q.pulse] = (votes[q.pulse] || 0) + 1;
      });
      let chosen = null;
      let count = 0;
      Object.keys(votes).forEach(function (k) {
        if (votes[k] > count) { count = votes[k]; chosen = parseInt(k, 10); }
      });
      if (chosen !== null) {
        p.pulse = chosen;
        p.source.pul = 'merge';
      }
    }

    results.forEach(function (r) {
      if (r.parsed && r.parsed.irregular) p.irregular = true;
    });
    return best;
  }

  // ---------- riconoscimento ----------
  async function recognize(file, onProgress) {
    if (!file) throw new Error('Nessuna foto selezionata.');
    progressFn = onProgress;
    lastPct = 0;
    currentPass = 1;
    totalPasses = PASSES.length;
    report('Preparo la foto…', 0.02);

    try {
      const image = await loadImage(file);
      report('Preparo il lettore…', 0.07);
      const worker = await getWorker();

      let best = null;
      let usedPasses = 0;
      const results = [];

      for (let i = 0; i < PASSES.length; i++) {
        const pass = PASSES[i];
        currentPass = i + 1;
        report(pass.label, 0.10 + (i / totalPasses) * 0.86);

        await worker.setParameters({
          tessedit_pageseg_mode: pass.psm,
          tessedit_char_whitelist: pass.whitelist,
          preserve_interword_spaces: '1'
        });

        const canvas = prepare(image, pass);
        const raw = await worker.recognize(canvas);
        const text = String((raw && raw.data && raw.data.text) || '');
        const parsed = DP.OCRParser.parse(text);
        const result = { text: text, parsed: parsed, pass: pass.id };
        results.push(result);
        best = better(best, result);
        best = mergeResults(best, results);
        usedPasses++;

        // Con tre valori letti e buona confidenza non serve altro tempo.
        if (best.parsed && best.parsed.confidence === 'high' && hasThreeValues(best.parsed)) break;
        // Dopo i primi due tentativi, il ritaglio centrale serve solo se
        // la lettura è ancora incerta.
        if (i === 1 && best.parsed && best.parsed.confidence !== 'none' && hasThreeValues(best.parsed)) break;
        // Provate entrambe le inclinazioni: se i tre valori ci sono, fermati.
        if (i === 3 && best.parsed && hasThreeValues(best.parsed) && best.parsed.confidence !== 'none') break;
      }

      best = mergeResults(best, results);

      // Ripristina i parametri per la prossima foto.
      try {
        await worker.setParameters({
          tessedit_pageseg_mode: '11',
          tessedit_char_whitelist: '',
          preserve_interword_spaces: '1'
        });
      } catch (e) { /* ignore */ }

      report('Fatto!', 1);
      progressFn = null;
      return {
        text: best ? best.text : '',
        parsed: best ? best.parsed : DP.OCRParser.parse(''),
        pass: best ? best.pass : '',
        passes: usedPasses,
        details: results.map(function (r) {
          return {
            pass: r.pass,
            sys: r.parsed.sys, dia: r.parsed.dia, pulse: r.parsed.pulse,
            confidence: r.parsed.confidence, text: r.text
          };
        })
      };
    } catch (e) {
      progressFn = null;
      const msg = String((e && e.message) || e || '');
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        throw new Error('Per usare la foto la prima volta serve internet (per scaricare il lettore di testo). Poi funziona anche offline.');
      }
      throw new Error(msg || 'Non sono riuscito a leggere la foto.');
    }
  }

  function dispose() {
    const w = workerPromise;
    workerPromise = null;
    progressFn = null;
    if (w) w.then(function (worker) { try { worker.terminate(); } catch (e) { /* ignore */ } });
  }

  return {
    recognize: recognize,
    dispose: dispose
  };
})();
