/* ============================================================
   PRESSIONE 2.0 — grafico dell'andamento pressorio
   Canvas puro, nessuna libreria esterna.
   ============================================================ */
window.DP = window.DP || {};

DP.Chart = (function () {
  const COLORS = {
    sys: '#c8553d',
    dia: '#1d6fb8',
    band: 'rgba(44, 122, 91, 0.10)',
    bandLine: 'rgba(44, 122, 91, 0.35)',
    grid: 'rgba(18, 48, 47, 0.10)',
    text: '#5c7271',
    ink: '#12302f',
    bg: '#ffffff'
  };

  function draw(canvas, readings, options) {
    if (!canvas) return;
    const opts = options || {};
    const list = DP.Stats.sortAsc((readings || []).filter(function (r) {
      return r && !r.deleted && r.sys > 0 && r.dia > 0;
    }));

    let cssW;
    let cssH;
    let dpr = 1;

    if (opts.print) {
      cssW = opts.width || 1120;
      cssH = opts.height || 360;
      canvas.width = cssW;
      canvas.height = cssH;
      canvas.style.width = '100%';
      canvas.style.height = 'auto';
    } else {
      cssW = Math.max(280, Math.round(canvas.getBoundingClientRect().width || (canvas.parentElement && canvas.parentElement.clientWidth) || 600));
      cssH = Math.max(180, Math.round(opts.height || canvas.getBoundingClientRect().height || 260));
      dpr = Math.min(2.5, window.devicePixelRatio || 1);
      canvas.width = Math.round(cssW * dpr);
      canvas.height = Math.round(cssH * dpr);
      canvas.style.width = '100%';
      canvas.style.height = cssH + 'px';
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);

    if (opts.print) {
      ctx.fillStyle = COLORS.bg;
      ctx.fillRect(0, 0, cssW, cssH);
    }

    if (!list.length) {
      ctx.fillStyle = COLORS.text;
      ctx.font = '13px system-ui, -apple-system, "Segoe UI", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Nessuna misurazione nel periodo scelto', cssW / 2, cssH / 2);
      return;
    }

    const target = DP.Stats.targetOf(opts.target);
    const limits = DP.Stats.limitsOf(opts.limits);
    const pad = { left: 42, right: 16, top: 16, bottom: 30 };
    const plotW = Math.max(40, cssW - pad.left - pad.right);
    const plotH = Math.max(40, cssH - pad.top - pad.bottom);

    let minDia = Math.min.apply(null, list.map(function (r) { return r.dia; }));
    let maxSys = Math.max.apply(null, list.map(function (r) { return r.sys; }));
    let yMin = Math.max(0, Math.floor((Math.min(minDia, limits.diaLow, 60) - 10) / 20) * 20);
    let yMax = Math.ceil((Math.max(maxSys, target.sys, 140) + 10) / 20) * 20;
    if (yMax - yMin < 100) yMax = yMin + 100;

    const times = list.map(function (r) {
      const d = DP.Fmt.parseLocal(r.at);
      return d ? d.getTime() : 0;
    });
    let tMin = Math.min.apply(null, times);
    let tMax = Math.max.apply(null, times);
    if (tMin === tMax) {
      tMin -= 12 * 3600000;
      tMax += 12 * 3600000;
    }
    const tPad = (tMax - tMin) * 0.03;
    tMin -= tPad;
    tMax += tPad;

    function x(t) {
      return pad.left + ((t - tMin) / (tMax - tMin)) * plotW;
    }
    function y(v) {
      return pad.top + (1 - (v - yMin) / (yMax - yMin)) * plotH;
    }

    // Banda del target personale
    const bandTop = y(target.sys);
    const bandBottom = y(target.dia);
    if (bandBottom > bandTop) {
      ctx.fillStyle = COLORS.band;
      ctx.fillRect(pad.left, bandTop, plotW, bandBottom - bandTop);
      ctx.strokeStyle = COLORS.bandLine;
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(pad.left, bandTop);
      ctx.lineTo(pad.left + plotW, bandTop);
      ctx.moveTo(pad.left, bandBottom);
      ctx.lineTo(pad.left + plotW, bandBottom);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Griglia e asse Y
    const step = (yMax - yMin) > 160 ? 40 : 20;
    ctx.font = '11px system-ui, -apple-system, "Segoe UI", sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (let v = Math.ceil(yMin / step) * step; v <= yMax; v += step) {
      const yy = y(v);
      ctx.strokeStyle = COLORS.grid;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(pad.left, yy);
      ctx.lineTo(pad.left + plotW, yy);
      ctx.stroke();
      ctx.fillStyle = COLORS.text;
      ctx.fillText(String(v), pad.left - 8, yy);
    }

    // Etichette X
    const labels = Math.min(6, Math.max(2, Math.floor(plotW / 90)));
    const rangeMs = tMax - tMin;
    const showYear = rangeMs > 300 * 86400000;
    const showTime = rangeMs <= 3 * 86400000;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    for (let i = 0; i < labels; i++) {
      const t = tMin + (rangeMs * i) / (labels - 1);
      const d = new Date(t);
      const label = showTime
        ? DP.Fmt.pad(d.getDate()) + '/' + DP.Fmt.pad(d.getMonth() + 1) + ' ' +
          DP.Fmt.pad(d.getHours()) + ':' + DP.Fmt.pad(d.getMinutes())
        : DP.Fmt.pad(d.getDate()) + '/' + DP.Fmt.pad(d.getMonth() + 1) +
          (showYear ? '/' + String(d.getFullYear()).slice(2) : '');
      ctx.textAlign = i === 0 ? 'left' : (i === labels - 1 ? 'right' : 'center');
      const xx = i === 0 ? pad.left : (i === labels - 1 ? pad.left + plotW : x(t));
      ctx.strokeStyle = COLORS.grid;
      ctx.beginPath();
      ctx.moveTo(xx, pad.top);
      ctx.lineTo(xx, pad.top + plotH);
      ctx.stroke();
      ctx.fillStyle = COLORS.text;
      ctx.fillText(label, xx, pad.top + plotH + 8);
    }

    function drawSeries(key, color) {
      ctx.strokeStyle = color;
      ctx.lineWidth = opts.print ? 2.2 : 2;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.beginPath();
      list.forEach(function (r, i) {
        const xx = x(times[i]);
        const yy = y(r[key]);
        if (i === 0) ctx.moveTo(xx, yy);
        else ctx.lineTo(xx, yy);
      });
      ctx.stroke();

      const rPoint = list.length > 120 ? 1.6 : (list.length > 40 ? 2.4 : 3.6);
      list.forEach(function (r, i) {
        const xx = x(times[i]);
        const yy = y(r[key]);
        ctx.beginPath();
        ctx.fillStyle = '#ffffff';
        ctx.arc(xx, yy, rPoint + (opts.print ? 1 : 0.6), 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = color;
        ctx.lineWidth = opts.print ? 1.8 : 1.5;
        ctx.stroke();
      });
    }

    drawSeries('sys', COLORS.sys);
    drawSeries('dia', COLORS.dia);

    // Valore più recente, utile quando il grafico è piccolo
    if (list.length === 1) {
      const r = list[0];
      ctx.textAlign = 'left';
      ctx.textBaseline = 'bottom';
      ctx.font = 'bold 12px system-ui, -apple-system, "Segoe UI", sans-serif';
      ctx.fillStyle = COLORS.ink;
      const lx = Math.min(cssW - 70, x(times[0]) + 8);
      ctx.fillText(r.sys + '/' + r.dia, lx, y(r.sys) - 6);
    }
  }

  return { draw: draw, COLORS: COLORS };
})();
