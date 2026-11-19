/* ============================================================
   PRESSIONE 2.0 — calcoli, categorie, report e importazione
   Funzioni pure: nessun accesso al DOM o alla rete.
   ============================================================ */
window.DP = window.DP || {};

DP.Stats = (function () {
  const CATEGORIES = {
    critical: { key: 'critical', label: 'Molto alta', short: 'Molto alta', tone: 'critical' },
    high: { key: 'high', label: 'Sopra il target', short: 'Alta', tone: 'high' },
    low: { key: 'low', label: 'Sotto la soglia bassa', short: 'Bassa', tone: 'low' },
    normal: { key: 'normal', label: 'Nella norma', short: 'Normale', tone: 'normal' }
  };

  function targetOf(target) {
    const t = target || DP.CONFIG.target;
    return {
      sys: DP.toInt(t.sys, DP.CONFIG.target.sys),
      dia: DP.toInt(t.dia, DP.CONFIG.target.dia)
    };
  }

  function limitsOf(limits) {
    const l = limits || DP.CONFIG.limits;
    return {
      sysLow: DP.toInt(l.sysLow, DP.CONFIG.limits.sysLow),
      diaLow: DP.toInt(l.diaLow, DP.CONFIG.limits.diaLow),
      pulseLow: DP.toInt(l.pulseLow, DP.CONFIG.limits.pulseLow),
      pulseHigh: DP.toInt(l.pulseHigh, DP.CONFIG.limits.pulseHigh)
    };
  }

  function category(reading, target, limits) {
    const t = targetOf(target);
    const l = limitsOf(limits);
    const sys = DP.toInt(reading && reading.sys, 0);
    const dia = DP.toInt(reading && reading.dia, 0);
    if (sys >= 180 || dia >= 120) return CATEGORIES.critical;
    if (sys >= t.sys || dia >= t.dia) return CATEGORIES.high;
    if (sys < l.sysLow || dia < l.diaLow) return CATEGORIES.low;
    return CATEGORIES.normal;
  }

  function armLabel(arm) {
    if (arm === 'sx') return 'Sinistro';
    if (arm === 'dx') return 'Destro';
    return '';
  }

  function postureLabel(posture) {
    if (posture === 'seduto') return 'Seduto';
    if (posture === 'sdraiato') return 'Sdraiato';
    if (posture === 'in piedi') return 'In piedi';
    return '';
  }

  function warnings(reading, target, limits) {
    const t = targetOf(target);
    const l = limitsOf(limits);
    const out = [];
    const sys = DP.toInt(reading && reading.sys, 0);
    const dia = DP.toInt(reading && reading.dia, 0);
    const pulse = DP.toInt(reading && reading.pulse, 0);
    if (!sys || !dia) return out;

    if (sys >= 180 || dia >= 120) {
      out.push({ tone: 'critical', text: DP.CONFIG.emergency });
    } else if (sys >= t.sys || dia >= t.dia) {
      const parts = [];
      if (sys >= t.sys) parts.push('massima ' + sys + ' (target ' + t.sys + ')');
      if (dia >= t.dia) parts.push('minima ' + dia + ' (target ' + t.dia + ')');
      out.push({
        tone: 'high',
        text: 'Sopra il tuo target personale: ' + parts.join(' e ') + ' mmHg.'
      });
    } else if (sys < l.sysLow || dia < l.diaLow) {
      out.push({
        tone: 'low',
        text: 'Sotto la soglia bassa impostata (' + l.sysLow + '/' + l.diaLow + ' mmHg). Se ti senti stanco o gira la testa, parlane con il medico.'
      });
    }

    if (pulse > 0 && pulse >= l.pulseHigh) {
      out.push({ tone: 'pulse', text: 'Pulsazioni alte: ' + pulse + ' bpm (soglia ' + l.pulseHigh + ').' });
    } else if (pulse > 0 && pulse < l.pulseLow) {
      out.push({ tone: 'pulse', text: 'Pulsazioni basse: ' + pulse + ' bpm (soglia ' + l.pulseLow + ').' });
    }
    if (reading && reading.irregular) {
      out.push({
        tone: 'irregular',
        text: 'Il misuratore ha segnalato un battito irregolare. Se succede spesso, mostralo al medico.'
      });
    }
    return out;
  }

  function trendWarnings(latest, previous) {
    if (!latest || !previous || previous.length < 3) return [];
    const recent = previous
      .filter(function (r) {
        return !r.deleted && r.at < latest.at &&
          (DP.Fmt.parseLocal(latest.at).getTime() - DP.Fmt.parseLocal(r.at).getTime()) <= 7 * 86400000;
      })
      .slice(0, 5);
    if (recent.length < 3) return [];
    const out = [];
    const avgSys = DP.Fmt.round(DP.Fmt.avg(recent.map(function (r) { return r.sys; })));
    const avgDia = DP.Fmt.round(DP.Fmt.avg(recent.map(function (r) { return r.dia; })));
    if (Math.abs(latest.sys - avgSys) >= 15) {
      out.push({
        tone: 'trend',
        text: 'La massima (' + latest.sys + ') è cambiata di almeno 15 mmHg rispetto alla media recente (' + avgSys + ').'
      });
    }
    if (Math.abs(latest.dia - avgDia) >= 10) {
      out.push({
        tone: 'trend',
        text: 'La minima (' + latest.dia + ') è cambiata di almeno 10 mmHg rispetto alla media recente (' + avgDia + ').'
      });
    }
    return out;
  }

  function validateReading(input) {
    const errors = {};
    const warningsOut = [];
    const rawSys = input.sys;
    const rawDia = input.dia;
    const rawPulse = input.pulse;
    const sys = rawSys === '' || rawSys === null || rawSys === undefined ? null : DP.toInt(rawSys, null);
    const dia = rawDia === '' || rawDia === null || rawDia === undefined ? null : DP.toInt(rawDia, null);
    const pulse = rawPulse === '' || rawPulse === null || rawPulse === undefined ? null : DP.toInt(rawPulse, null);

    if (sys === null || !Number.isFinite(sys)) errors.sys = 'Inserisci la massima.';
    else if (sys < 40 || sys > 300) errors.sys = 'La massima deve essere tra 40 e 300 mmHg.';

    if (dia === null || !Number.isFinite(dia)) errors.dia = 'Inserisci la minima.';
    else if (dia < 20 || dia > 200) errors.dia = 'La minima deve essere tra 20 e 200 mmHg.';

    if (!errors.sys && !errors.dia && sys <= dia) {
      errors.dia = 'La massima deve essere maggiore della minima.';
    }

    if (pulse !== null && (!Number.isFinite(pulse) || pulse < 20 || pulse > 250)) {
      errors.pulse = 'Le pulsazioni devono essere tra 20 e 250 bpm.';
    }

    const at = input.at || DP.Fmt.nowLocal();
    if (!DP.Fmt.parseLocal(at)) errors.at = 'Data e ora non valide.';

    if (at && DP.Fmt.parseLocal(at) && DP.Fmt.parseLocal(at).getTime() > Date.now() + 10 * 60000) {
      warningsOut.push('La data e l’ora sono nel futuro: controlla di averle inserite bene.');
    }

    const note = String(input.note || '').trim();
    if (note.length > 2000) errors.note = 'La nota è troppo lunga (massimo 2000 caratteri).';

    if (sys !== null && dia !== null && sys - dia < 10 && sys > dia) {
      warningsOut.push('La differenza tra massima e minima è molto piccola: verifica i valori.');
    }

    const ok = Object.keys(errors).length === 0;
    return {
      ok: ok,
      errors: errors,
      warnings: warningsOut,
      value: ok ? {
        at: at,
        sys: sys,
        dia: dia,
        pulse: pulse || 0,
        irregular: !!input.irregular,
        arm: input.arm || '',
        posture: input.posture || '',
        note: note,
        source: input.source === 'photo' ? 'photo' : 'manual'
      } : null
    };
  }

  function normalizeReading(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const r = raw;
    let at = r.at || r.local_at || r.localAt || '';
    if (!at && (r.timestamp || r.measured_at)) {
      const d = new Date(r.timestamp || r.measured_at);
      if (!isNaN(d.getTime())) at = DP.Fmt.nowLocal(d);
    }
    if (!DP.Fmt.parseLocal(at)) at = DP.Fmt.nowLocal();

    const sys = DP.toInt(r.sys !== undefined ? r.sys : r.systolic, 0);
    const dia = DP.toInt(r.dia !== undefined ? r.dia : r.diastolic, 0);
    if (sys < 30 || sys > 320 || dia < 15 || dia > 220 || sys <= dia) return null;

    let pulse = DP.toInt(r.pulse !== undefined ? r.pulse : (r.pulsazioni !== undefined ? r.pulsazioni : 0), 0);
    if (pulse < 0 || pulse > 300) pulse = 0;
    if (pulse === sys || pulse === dia) pulse = 0;

    const created = r.createdAt || r.created_at || (r.timestamp ? new Date(r.timestamp).toISOString() : new Date().toISOString());
    const updated = r.updatedAt || r.updated_at || created;

    return {
      id: String(r.id || DP.Fmt.uid()),
      at: at,
      sys: sys,
      dia: dia,
      pulse: pulse,
      irregular: !!r.irregular,
      arm: r.arm === 'sx' || r.arm === 'dx' ? r.arm : '',
      posture: r.posture === 'seduto' || r.posture === 'sdraiato' || r.posture === 'in piedi' ? r.posture : '',
      note: String(r.note || '').slice(0, 2000),
      source: r.source === 'photo' ? 'photo' : (r.source === 'import' ? 'import' : 'manual'),
      createdAt: created,
      updatedAt: updated,
      deleted: !!r.deleted,
      dirty: r.dirty === true
    };
  }

  function active(readings) {
    return (readings || []).filter(function (r) {
      return r && !r.deleted && r.sys > 0 && r.dia > 0;
    });
  }

  function sortAsc(readings) {
    return readings.slice().sort(function (a, b) {
      const c = String(a.at).localeCompare(String(b.at));
      if (c !== 0) return c;
      return String(a.id).localeCompare(String(b.id));
    });
  }

  function sortDesc(readings) {
    return readings.slice().sort(function (a, b) {
      const c = String(b.at).localeCompare(String(a.at));
      if (c !== 0) return c;
      return String(b.id).localeCompare(String(a.id));
    });
  }

  function filterPeriod(readings, period) {
    const p = period || {};
    let from = p.from || '';
    let to = p.to || '';
    if (p.days > 0) {
      from = DP.Fmt.addDaysKey(DP.Fmt.todayKey(), -(p.days - 1));
      to = DP.Fmt.todayKey();
    }
    return active(readings).filter(function (r) {
      const key = DP.Fmt.dateKey(r.at);
      if (!key) return false;
      if (from && key < from) return false;
      if (to && key > to) return false;
      return true;
    });
  }

  function summarize(readings, target, limits) {
    const list = sortAsc(active(readings));
    const t = targetOf(target);
    const l = limitsOf(limits);
    const count = list.length;
    const pulseList = list.filter(function (r) { return r.pulse > 0; });
    const byDay = {};
    let high = 0;
    let critical = 0;
    let low = 0;
    let normal = 0;
    let irregular = 0;

    list.forEach(function (r) {
      const cat = category(r, t, l);
      if (cat.key === 'critical') critical++;
      else if (cat.key === 'high') high++;
      else if (cat.key === 'low') low++;
      else normal++;
      if (r.irregular) irregular++;
      const key = DP.Fmt.dateKey(r.at);
      if (!byDay[key]) byDay[key] = { key: key, readings: [], count: 0, sys: 0, dia: 0, pulse: 0, high: 0 };
      byDay[key].readings.push(r);
      byDay[key].count++;
      byDay[key].sys += r.sys;
      byDay[key].dia += r.dia;
      if (r.pulse > 0) byDay[key].pulse += r.pulse;
      if (cat.key === 'high' || cat.key === 'critical') byDay[key].high++;
    });

    const days = Object.keys(byDay).sort();
    const daily = days.map(function (key) {
      const d = byDay[key];
      return {
        key: key,
        count: d.count,
        sys: DP.Fmt.round(d.sys / d.count),
        dia: DP.Fmt.round(d.dia / d.count),
        pulse: d.count ? DP.Fmt.round(d.pulse / d.count) : 0,
        high: d.high
      };
    });

    const morning = list.filter(function (r) {
      const h = DP.Fmt.hourOf(r.at);
      return h >= 6 && h < 12;
    });
    const evening = list.filter(function (r) {
      const h = DP.Fmt.hourOf(r.at);
      return h >= 18 && h < 24;
    });

    const sysValues = list.map(function (r) { return r.sys; });
    const diaValues = list.map(function (r) { return r.dia; });
    const pulseValues = pulseList.map(function (r) { return r.pulse; });

    const avgSys = count ? DP.Fmt.round(DP.Fmt.avg(sysValues)) : 0;
    const avgDia = count ? DP.Fmt.round(DP.Fmt.avg(diaValues)) : 0;
    const avgPulse = pulseValues.length ? DP.Fmt.round(DP.Fmt.avg(pulseValues)) : 0;

    return {
      count: count,
      days: days.length,
      daily: daily,
      avg: { sys: avgSys, dia: avgDia, pulse: avgPulse },
      min: count ? {
        sys: Math.min.apply(null, sysValues),
        dia: Math.min.apply(null, diaValues)
      } : { sys: 0, dia: 0 },
      max: count ? {
        sys: Math.max.apply(null, sysValues),
        dia: Math.max.apply(null, diaValues)
      } : { sys: 0, dia: 0 },
      firstAt: count ? list[0].at : '',
      lastAt: count ? list[count - 1].at : '',
      high: high,
      critical: critical,
      low: low,
      normal: normal,
      above: high + critical,
      irregular: irregular,
      pulseCount: pulseValues.length,
      percentNormal: count ? DP.Fmt.percent(normal, count) : 0,
      percentAbove: count ? DP.Fmt.percent(high + critical, count) : 0,
      percentLow: count ? DP.Fmt.percent(low, count) : 0,
      morning: {
        count: morning.length,
        sys: morning.length ? DP.Fmt.round(DP.Fmt.avg(morning.map(function (r) { return r.sys; }))) : 0,
        dia: morning.length ? DP.Fmt.round(DP.Fmt.avg(morning.map(function (r) { return r.dia; }))) : 0,
        pulse: morning.filter(function (r) { return r.pulse > 0; }).length
          ? DP.Fmt.round(DP.Fmt.avg(morning.filter(function (r) { return r.pulse > 0; }).map(function (r) { return r.pulse; })))
          : 0
      },
      evening: {
        count: evening.length,
        sys: evening.length ? DP.Fmt.round(DP.Fmt.avg(evening.map(function (r) { return r.sys; }))) : 0,
        dia: evening.length ? DP.Fmt.round(DP.Fmt.avg(evening.map(function (r) { return r.dia; }))) : 0,
        pulse: evening.filter(function (r) { return r.pulse > 0; }).length
          ? DP.Fmt.round(DP.Fmt.avg(evening.filter(function (r) { return r.pulse > 0; }).map(function (r) { return r.pulse; })))
          : 0
      },
      target: t,
      limits: l
    };
  }

  function groupByDay(readings) {
    const list = sortDesc(active(readings));
    const map = {};
    list.forEach(function (r) {
      const key = DP.Fmt.dateKey(r.at);
      if (!map[key]) map[key] = [];
      map[key].push(r);
    });
    return Object.keys(map).sort().reverse().map(function (key) {
      const items = map[key].slice().sort(function (a, b) { return String(b.at).localeCompare(String(a.at)); });
      return {
        key: key,
        label: DP.Fmt.dayLabel(key),
        readings: items,
        count: items.length,
        avg: {
          sys: DP.Fmt.round(DP.Fmt.avg(items.map(function (r) { return r.sys; }))),
          dia: DP.Fmt.round(DP.Fmt.avg(items.map(function (r) { return r.dia; })))
        }
      };
    });
  }

  function periodLabel(period) {
    const p = period || {};
    if (p.days === -1) {
      if (p.from && p.to) return 'Dal ' + DP.Fmt.fmtDateMedium(p.from) + ' al ' + DP.Fmt.fmtDateMedium(p.to);
      if (p.from) return 'Dal ' + DP.Fmt.fmtDateMedium(p.from);
      if (p.to) return 'Fino al ' + DP.Fmt.fmtDateMedium(p.to);
      return 'Periodo personalizzato';
    }
    if (p.days === 0) return 'Tutte le misurazioni';
    if (p.days === 1) return 'Oggi';
    return 'Ultimi ' + p.days + ' giorni';
  }

  function reportModel(readings, options) {
    const opts = options || {};
    const filtered = filterPeriod(readings, opts.period);
    const summary = summarize(filtered, opts.target, opts.limits);
    return {
      name: String(opts.name || '').trim(),
      readings: sortAsc(filtered),
      summary: summary,
      target: targetOf(opts.target),
      limits: limitsOf(opts.limits),
      periodLabel: periodLabel(opts.period),
      generatedAt: new Date().toISOString(),
      methodNote: DP.CONFIG.methodNote,
      disclaimer: DP.CONFIG.disclaimer
    };
  }

  function csv(readings) {
    const list = sortAsc(active(readings));
    const lines = [];
    lines.push(['Data', 'Ora', 'Massima (mmHg)', 'Minima (mmHg)', 'Pulsazioni (bpm)',
      'Battito irregolare', 'Braccio', 'Posizione', 'Note'].map(DP.Fmt.csvCell).join(';'));
    list.forEach(function (r) {
      lines.push([
        DP.Fmt.fmtDateShort(r.at),
        DP.Fmt.fmtTime(r.at),
        r.sys,
        r.dia,
        r.pulse || '',
        r.irregular ? 'Sì' : 'No',
        armLabel(r.arm),
        postureLabel(r.posture),
        r.note || ''
      ].map(DP.Fmt.csvCell).join(';'));
    });
    return '\uFEFF' + lines.join('\r\n') + '\r\n';
  }

  function summaryText(model) {
    const s = model.summary;
    const lines = [];
    lines.push('Diario pressorio' + (model.name ? ' — ' + model.name : ''));
    lines.push('Periodo: ' + model.periodLabel);
    lines.push('Misurazioni: ' + s.count + (s.days ? ' in ' + s.days + ' giorni' : ''));
    if (s.count) {
      lines.push('Media: ' + s.avg.sys + '/' + s.avg.dia + ' mmHg' +
        (s.avg.pulse ? ' · ' + s.avg.pulse + ' bpm' : ''));
      lines.push('Minima/media/massima: ' + s.min.sys + '/' + s.min.dia + ' — ' +
        s.avg.sys + '/' + s.avg.dia + ' — ' + s.max.sys + '/' + s.max.dia + ' mmHg');
      lines.push('Nel target (' + model.target.sys + '/' + model.target.dia + '): ' +
        s.percentNormal + '% · sopra: ' + s.above + ' · sotto: ' + s.low);
      if (s.morning.count) {
        lines.push('Mattina: ' + s.morning.sys + '/' + s.morning.dia + ' mmHg (' + s.morning.count + ')');
      }
      if (s.evening.count) {
        lines.push('Sera: ' + s.evening.sys + '/' + s.evening.dia + ' mmHg (' + s.evening.count + ')');
      }
      if (s.irregular) lines.push('Battito irregolare segnalato: ' + s.irregular + ' volte');
    }
    lines.push('');
    lines.push(DP.CONFIG.methodNote);
    return lines.join('\n');
  }

  function mergeReadings(local, incoming) {
    const map = {};
    (local || []).forEach(function (r) {
      const n = normalizeReading(r);
      if (n) map[n.id] = n;
    });
    (incoming || []).forEach(function (raw) {
      const n = normalizeReading(raw);
      if (!n) return;
      const cur = map[n.id];
      if (!cur) { map[n.id] = n; return; }
      const curTime = new Date(cur.updatedAt).getTime() || 0;
      const newTime = new Date(n.updatedAt).getTime() || 0;
      if (newTime >= curTime) map[n.id] = n;
    });
    return sortDesc(Object.keys(map).map(function (k) { return map[k]; }));
  }

  function fromAndroidBackup(data) {
    const src = data || {};
    const list = Array.isArray(src) ? src : (src.misurazioni || src.measurements || []);
    const readings = (list || []).map(function (m) {
      const stamp = m.timestamp || m.measured_at || '';
      const rawId = m.id === undefined || m.id === null ? '' : String(m.id);
      const id = DP.Fmt.isUuid(rawId)
        ? rawId
        : DP.Fmt.stableId('android|' + rawId + '|' + stamp + '|' +
            (m.systolic !== undefined ? m.systolic : m.sys) + '|' +
            (m.diastolic !== undefined ? m.diastolic : m.dia) + '|' +
            (m.pulse || '') + '|' + (m.note || ''));
      return normalizeReading({
        id: id,
        timestamp: m.timestamp,
        sys: m.systolic !== undefined ? m.systolic : m.sys,
        dia: m.diastolic !== undefined ? m.diastolic : m.dia,
        pulse: m.pulse,
        irregular: m.irregular,
        note: m.note,
        source: 'import'
      });
    }).filter(Boolean);

    let profile = null;
    const s = src.impostazioni || src.settings || null;
    if (s && (s.sysHigh || s.diaHigh || s.sysLow || s.diaLow)) {
      profile = {
        target: {
          sys: DP.toInt(s.sysHigh, DP.CONFIG.target.sys),
          dia: DP.toInt(s.diaHigh, DP.CONFIG.target.dia)
        },
        limits: {
          sysLow: DP.toInt(s.sysLow, DP.CONFIG.limits.sysLow),
          diaLow: DP.toInt(s.diaLow, DP.CONFIG.limits.diaLow),
          pulseLow: DP.toInt(s.pulseLow, DP.CONFIG.limits.pulseLow),
          pulseHigh: DP.toInt(s.pulseHigh, DP.CONFIG.limits.pulseHigh)
        }
      };
    }
    return { readings: sortDesc(readings), profile: profile };
  }

  return {
    CATEGORIES: CATEGORIES,
    category: category,
    targetOf: targetOf,
    limitsOf: limitsOf,
    armLabel: armLabel,
    postureLabel: postureLabel,
    warnings: warnings,
    trendWarnings: trendWarnings,
    validateReading: validateReading,
    normalizeReading: normalizeReading,
    active: active,
    sortAsc: sortAsc,
    sortDesc: sortDesc,
    filterPeriod: filterPeriod,
    summarize: summarize,
    groupByDay: groupByDay,
    periodLabel: periodLabel,
    reportModel: reportModel,
    csv: csv,
    summaryText: summaryText,
    mergeReadings: mergeReadings,
    fromAndroidBackup: fromAndroidBackup
  };
})();
