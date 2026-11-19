/* ============================================================
   PRESSIONE 2.0 — lettura del display dalla foto (OCR)
   Tesseract.js in WebAssembly: la foto viene elaborata DENTRO il
   telefono/PC. Nessuna immagine viene caricata su un server.
   Il testo letto viene interpretato da ocr-parse.js; i valori
   restano modificabili e non vengono mai salvati da soli.
   ============================================================ */
window.DP = window.DP || {};

DP.OCR = (function () {
  const V = '7.0.0';
  const CDN = 'https://cdn.jsdelivr.net/npm';
  const LIB_URL = CDN + '/tesseract.js@' + V + '/dist/tesseract.min.js';
  const WORKER_PATH = CDN + '/tesseract.js@' + V + '/dist/worker.min.js';
  const CORE_PATH = CDN + '/tesseract.js-core@' + V;
  const LANG_PATH = CDN + '/@tesseract.js-data/ita@1.0.0/4.0.0';

  const MAX_SIDE = 2600;
  const MIN_SIDE = 1600;

  let libPromise = null;
  let workerPromise = null;
  let progressFn = null;
  let lastPct = 0;
  let currentPass = 0;

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
    if (status === 'recognizing text') {
      if (currentPass === 1) report('Leggo i numeri dal display…', 0.12 + p * 0.40);
      else report('Secondo tentativo, miglioro la lettura…', 0.58 + p * 0.34);
    } else if (/loading language traineddata/i.test(status)) {
      report('Scarico il dizionario italiano (solo la prima volta)…', 0.03 + p * 0.06);
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
        tessedit_pageseg_mode: '11', // testo sparso: display con etichette e numeri
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

  function drawScaled(source) {
    const w = source.naturalWidth || source.width;
    const h = source.naturalHeight || source.height;
    if (!w || !h) throw new Error('La foto non ha dimensioni valide.');

    const longSide = Math.max(w, h);
    let scale = 1;
    if (longSide > MAX_SIDE) scale = MAX_SIDE / longSide;
    else if (longSide < MIN_SIDE) scale = Math.min(3.2, MIN_SIDE / longSide);

    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(w * scale));
    c.height = Math.max(1, Math.round(h * scale));
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = true;
    g.imageSmoothingQuality = 'high';
    g.fillStyle = '#FFFFFF';
    g.fillRect(0, 0, c.width, c.height);
    g.drawImage(source, 0, 0, c.width, c.height);
    return c;
  }

  function enhance(canvas, mode) {
    const g = canvas.getContext('2d');
    let frame;
    try { frame = g.getImageData(0, 0, canvas.width, canvas.height); }
    catch (e) { return canvas; } // immagine protetta: si prova lo stesso
    const d = frame.data;
    const hist = new Uint32Array(256);
    let sum = 0;
    let centralSum = 0;
    let centralCount = 0;
    const w = canvas.width;
    const h = canvas.height;
    const cx0 = Math.floor(w * 0.15);
    const cx1 = Math.floor(w * 0.85);
    const cy0 = Math.floor(h * 0.15);
    const cy1 = Math.floor(h * 0.85);

    for (let i = 0, px = 0; i < d.length; i += 4, px++) {
      const l = (d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114) | 0;
      d[i] = d[i + 1] = d[i + 2] = l;
      hist[l]++;
      sum += l;
      const x = px % w;
      const y = (px / w) | 0;
      if (x >= cx0 && x <= cx1 && y >= cy0 && y <= cy1) {
        centralSum += l;
        centralCount++;
      }
    }

    const total = d.length / 4;
    const mean = total ? sum / total : 128;
    const centralMean = centralCount ? centralSum / centralCount : mean;
    const invert = centralMean < 110 || mean < 80;
    if (invert) {
      for (let i = 0; i < d.length; i += 4) {
        d[i] = 255 - d[i];
        d[i + 1] = 255 - d[i + 1];
        d[i + 2] = 255 - d[i + 2];
      }
      hist.fill(0);
      for (let i = 0; i < d.length; i += 4) hist[d[i]]++;
    }

    // Allungamento del contrasto (2% di taglio su entrambi i lati).
    const lowCut = total * 0.02;
    const highCut = total * 0.02;
    let acc = 0;
    let lo = 0;
    let hi = 255;
    for (let v = 0; v < 256; v++) { acc += hist[v]; if (acc >= lowCut) { lo = v; break; } }
    acc = 0;
    for (let v = 255; v >= 0; v--) { acc += hist[v]; if (acc >= highCut) { hi = v; break; } }

    if (hi - lo >= 30) {
      const k = 255 / (hi - lo);
      for (let i = 0; i < d.length; i += 4) {
        let v = (d[i] - lo) * k;
        v = v < 0 ? 0 : (v > 255 ? 255 : v);
        d[i] = d[i + 1] = d[i + 2] = v;
      }
    }

    // Secondo tentativo: binarizzazione di Otsu (utile per display
    // a sette segmenti o foto con riflessi).
    if (mode === 'binary') {
      const h2 = new Uint32Array(256);
      for (let i = 0; i < d.length; i += 4) h2[d[i]]++;
      let totalPx = total;
      let sumAll = 0;
      for (let v = 0; v < 256; v++) sumAll += v * h2[v];
      let sumB = 0;
      let wB = 0;
      let best = 0;
      let threshold = 127;
      for (let v = 0; v < 256; v++) {
        wB += h2[v];
        if (!wB) continue;
        const wF = totalPx - wB;
        if (!wF) break;
        sumB += v * h2[v];
        const mB = sumB / wB;
        const mF = (sumAll - sumB) / wF;
        const between = wB * wF * (mB - mF) * (mB - mF);
        if (between > best) { best = between; threshold = v; }
      }
      for (let i = 0; i < d.length; i += 4) {
        const v = d[i] >= threshold ? 255 : 0;
        d[i] = d[i + 1] = d[i + 2] = v;
      }
    }

    g.putImageData(frame, 0, 0);
    return canvas;
  }

  async function prepare(file, mode) {
    const img = await loadImage(file);
    const canvas = drawScaled(img);
    return enhance(canvas, mode || 'contrast');
  }

  // ---------- scelta del risultato migliore ----------
  function score(parsed) {
    if (!parsed) return -1;
    let s = 0;
    if (parsed.confidence === 'high') s += 6;
    else if (parsed.confidence === 'medium') s += 4;
    else if (parsed.confidence === 'low') s += 1;
    if (parsed.sys !== null) s += 2;
    if (parsed.dia !== null) s += 2;
    if (parsed.pulse !== null) s += 1;
    if (parsed.irregular) s += 0.5;
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

  // ---------- riconoscimento ----------
  async function recognize(file, onProgress) {
    if (!file) throw new Error('Nessuna foto selezionata.');
    progressFn = onProgress;
    lastPct = 0;
    currentPass = 1;
    report('Preparo la foto…', 0.02);

    try {
      const firstCanvas = await prepare(file, 'contrast');
      report('Preparo il lettore…', 0.07);
      const worker = await getWorker();

      report('Leggo i numeri dal display…', 0.12);
      const firstRaw = await worker.recognize(firstCanvas);
      const firstText = String((firstRaw && firstRaw.data && firstRaw.data.text) || '');
      const firstParsed = DP.OCRParser.parse(firstText);
      let best = { text: firstText, parsed: firstParsed, pass: 'contrast' };

      // Se la prima lettura non è convincente, prova la versione binarizzata.
      if (firstParsed.confidence !== 'high' && firstParsed.confidence !== 'medium') {
        currentPass = 2;
        report('Secondo tentativo, miglioro la lettura…', 0.58);
        try {
          await worker.setParameters({ tessedit_pageseg_mode: '6' });
          const secondCanvas = await prepare(file, 'binary');
          const secondRaw = await worker.recognize(secondCanvas);
          const secondText = String((secondRaw && secondRaw.data && secondRaw.data.text) || '');
          const secondParsed = DP.OCRParser.parse(secondText);
          best = better(best, { text: secondText, parsed: secondParsed, pass: 'binary' });
          await worker.setParameters({ tessedit_pageseg_mode: '11' });
        } catch (e) {
          // Il secondo tentativo è un bonus: se fallisce, resta il primo.
          try { await worker.setParameters({ tessedit_pageseg_mode: '11' }); } catch (e2) { /* ignore */ }
        }
      }

      report('Fatto!', 1);
      progressFn = null;
      return {
        text: best.text,
        parsed: best.parsed,
        pass: best.pass
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
