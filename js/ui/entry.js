/* ============================================================
   PRESSIONE 2.0 — nuova misurazione / modifica
   Include la lettura dalla foto del misuratore (OCR).
   ============================================================ */
window.DP = window.DP || {};
DP.EntryUI = (function () {
  const esc = DP.Fmt.escapeHtml;

  function open(options) {
    const opts = options || {};
    const editing = !!opts.reading;
    const r = opts.reading || null;
    const state = {
      sys: r ? String(r.sys) : '',
      dia: r ? String(r.dia) : '',
      pulse: r && r.pulse ? String(r.pulse) : '',
      at: r ? r.at : DP.Fmt.nowLocal(),
      arm: r ? r.arm || '' : '',
      posture: r ? r.posture || '' : '',
      irregular: r ? !!r.irregular : false,
      note: r ? r.note || '' : '',
      source: r ? r.source || 'manual' : 'manual'
    };
    let dirty = false;
    let ocrBusy = false;
    let previewUrl = null;
    let closed = false;

    const modal = DP.UI.openModal({
      title: editing ? 'Modifica misurazione' : 'Nuova misurazione',
      subtitle: editing ? 'Correggi i valori o la data e salva.' : 'Inserisci a mano o leggi i valori dalla foto del display.',
      className: 'modal-entry',
      dismissible: false,
      body:
        '<form id="entry-form" novalidate>' +
          '<div class="entry-photo">' +
            '<div class="photo-actions">' +
              '<button type="button" class="btn btn-soft" data-photo="camera" autofocus>' + DP.UI.icon('camera') + ' Scatta foto</button>' +
              '<button type="button" class="btn btn-ghost" data-photo="gallery">' + DP.UI.icon('upload') + ' Galleria</button>' +
            '</div>' +
            '<input type="file" id="entry-camera" accept="image/*" capture="environment" hidden>' +
            '<input type="file" id="entry-gallery" accept="image/*" hidden>' +
            '<p class="photo-hint">' + DP.UI.icon('lock') +
              '<span>La foto viene letta sul dispositivo e <b>non viene salvata né inviata</b>. Controlla sempre i valori prima di salvare.</span></p>' +
            '<div id="ocr-panel" class="ocr-panel" hidden></div>' +
          '</div>' +

          '<div class="entry-values">' +
            '<label class="value-field">' +
              '<span>Massima</span>' +
              '<input type="text" inputmode="numeric" pattern="[0-9]*" maxlength="3" id="entry-sys" name="sys" value="' + esc(state.sys) + '" placeholder="120" aria-label="Pressione massima in mmHg">' +
              '<small>mmHg</small>' +
            '</label>' +
            '<span class="value-slash">/</span>' +
            '<label class="value-field">' +
              '<span>Minima</span>' +
              '<input type="text" inputmode="numeric" pattern="[0-9]*" maxlength="3" id="entry-dia" name="dia" value="' + esc(state.dia) + '" placeholder="80" aria-label="Pressione minima in mmHg">' +
              '<small>mmHg</small>' +
            '</label>' +
            '<label class="value-field value-pulse">' +
              '<span>Polso</span>' +
              '<input type="text" inputmode="numeric" pattern="[0-9]*" maxlength="3" id="entry-pulse" name="pulse" value="' + esc(state.pulse) + '" placeholder="72" aria-label="Pulsazioni in battiti al minuto">' +
              '<small>bpm</small>' +
            '</label>' +
          '</div>' +
          '<p class="field-error" id="err-sys" hidden></p>' +
          '<p class="field-error" id="err-dia" hidden></p>' +
          '<p class="field-error" id="err-pulse" hidden></p>' +

          '<div id="entry-preview" class="entry-preview" hidden></div>' +

          '<div class="entry-datetime">' +
            '<label class="field"><span>Data e ora</span>' +
              '<input type="datetime-local" id="entry-at" name="at" value="' + esc(state.at) + '" step="60">' +
            '</label>' +
            '<button type="button" class="btn btn-ghost btn-sm" data-entry-now>' + DP.UI.icon('clock') + ' Adesso</button>' +
          '</div>' +
          '<p class="field-error" id="err-at" hidden></p>' +

          '<details class="advanced entry-details"' + (state.arm || state.posture || state.irregular || state.note ? ' open' : '') + '>' +
            '<summary>Dettagli aggiuntivi <span class="opt">(facoltativi)</span></summary>' +
            '<div class="two-cols">' +
              '<label class="field"><span>Braccio</span><select id="entry-arm">' +
                '<option value=""' + (!state.arm ? ' selected' : '') + '>Non indicato</option>' +
                '<option value="sx"' + (state.arm === 'sx' ? ' selected' : '') + '>Sinistro</option>' +
                '<option value="dx"' + (state.arm === 'dx' ? ' selected' : '') + '>Destro</option>' +
              '</select></label>' +
              '<label class="field"><span>Posizione</span><select id="entry-posture">' +
                '<option value=""' + (!state.posture ? ' selected' : '') + '>Non indicata</option>' +
                '<option value="seduto"' + (state.posture === 'seduto' ? ' selected' : '') + '>Seduto</option>' +
                '<option value="sdraiato"' + (state.posture === 'sdraiato' ? ' selected' : '') + '>Sdraiato</option>' +
                '<option value="in piedi"' + (state.posture === 'in piedi' ? ' selected' : '') + '>In piedi</option>' +
              '</select></label>' +
            '</div>' +
            '<label class="check-row"><input type="checkbox" id="entry-irregular"' + (state.irregular ? ' checked' : '') + '>' +
              '<span>Il misuratore ha segnalato <b>battito irregolare</b></span></label>' +
            '<label class="field"><span>Note</span><textarea id="entry-note" rows="2" maxlength="2000" placeholder="Es. dopo i farmaci, stanchezza, visita…">' + esc(state.note) + '</textarea></label>' +
          '</details>' +

          '<div id="entry-form-error" class="form-error" hidden></div>' +
          (editing
            ? '<div class="entry-delete-row"><button type="button" class="btn btn-ghost btn-danger-ghost" data-entry-delete>' +
              DP.UI.icon('trash') + ' Elimina misurazione</button></div>'
            : '') +
        '</form>',
      footer:
        '<button type="button" class="btn btn-ghost" data-entry-cancel>Annulla</button>' +
        '<button type="submit" form="entry-form" class="btn btn-primary" id="entry-save">' +
          (editing ? 'Salva modifiche' : 'Salva misurazione') + '</button>',
      onMount: function (ctx) {
        const form = ctx.body.querySelector('#entry-form');
        const sysEl = ctx.body.querySelector('#entry-sys');
        const diaEl = ctx.body.querySelector('#entry-dia');
        const pulseEl = ctx.body.querySelector('#entry-pulse');
        const atEl = ctx.body.querySelector('#entry-at');
        const armEl = ctx.body.querySelector('#entry-arm');
        const postureEl = ctx.body.querySelector('#entry-posture');
        const irrEl = ctx.body.querySelector('#entry-irregular');
        const noteEl = ctx.body.querySelector('#entry-note');
        const previewEl = ctx.body.querySelector('#entry-preview');
        const ocrPanel = ctx.body.querySelector('#ocr-panel');
        const formError = ctx.body.querySelector('#entry-form-error');
        const saveBtn = ctx.foot.querySelector('#entry-save');

        function markDirty() { dirty = true; }

        function digits(el) {
          const cleaned = el.value.replace(/\D+/g, '').slice(0, 3);
          if (cleaned !== el.value) el.value = cleaned;
        }

        function readValues() {
          return {
            sys: sysEl.value,
            dia: diaEl.value,
            pulse: pulseEl.value,
            at: atEl.value,
            arm: armEl.value,
            posture: postureEl.value,
            irregular: irrEl.checked,
            note: noteEl.value,
            source: state.source
          };
        }

        function clearFieldErrors() {
          ['sys', 'dia', 'pulse', 'at'].forEach(function (k) {
            const el = ctx.body.querySelector('#err-' + k);
            if (el) { el.textContent = ''; el.hidden = true; }
            const input = k === 'at' ? atEl : (k === 'sys' ? sysEl : (k === 'dia' ? diaEl : pulseEl));
            if (input) input.classList.remove('invalid');
          });
          formError.hidden = true;
        }

        function showErrors(errors) {
          clearFieldErrors();
          let first = null;
          ['sys', 'dia', 'pulse', 'at'].forEach(function (k) {
            if (!errors[k]) return;
            const el = ctx.body.querySelector('#err-' + k);
            const input = k === 'at' ? atEl : (k === 'sys' ? sysEl : (k === 'dia' ? diaEl : pulseEl));
            if (el) { el.textContent = errors[k]; el.hidden = false; }
            if (input) {
              input.classList.add('invalid');
              if (!first) first = input;
            }
          });
          formError.textContent = Object.keys(errors).map(function (k) { return errors[k]; }).join(' ');
          formError.hidden = false;
          if (first) {
            try { first.focus({ preventScroll: false }); } catch (e) { first.focus(); }
          }
        }

        function updatePreview() {
          const sys = parseInt(sysEl.value, 10);
          const dia = parseInt(diaEl.value, 10);
          if (!Number.isFinite(sys) || !Number.isFinite(dia) || sys < 20 || dia < 10) {
            previewEl.hidden = true;
            previewEl.innerHTML = '';
            return;
          }
          if (sys <= dia) {
            previewEl.hidden = false;
            previewEl.innerHTML = '<span class="status status-high">La massima deve essere maggiore della minima</span>';
            return;
          }
          const profile = DP.Store.profile();
          const fake = { sys: sys, dia: dia, pulse: parseInt(pulseEl.value, 10) || 0, irregular: irrEl.checked };
          const cat = DP.Stats.category(fake, profile.target, profile.limits);
          const warns = DP.Stats.warnings(fake, profile.target, profile.limits);
          previewEl.hidden = false;
          previewEl.innerHTML =
            '<div class="preview-top">' +
              '<span class="preview-value">' + sys + '/' + dia + ' <small>mmHg</small></span>' +
              DP.UI.valueBadge(cat) +
            '</div>' +
            '<div class="preview-target">Target personale ' + profile.target.sys + '/' + profile.target.dia + ' mmHg</div>' +
            (warns.length ? '<div class="preview-warn">' + DP.UI.icon('alert') + '<span>' + esc(warns[0].text) + '</span></div>' : '');
        }

        // ---------- OCR ----------
        function setOcrPanel(html) {
          ocrPanel.hidden = false;
          ocrPanel.innerHTML = html;
        }

        function progress(label, pct) {
          const percent = Math.round(Math.max(0, Math.min(1, pct)) * 100);
          let bar = ocrPanel.querySelector('#ocr-bar');
          if (!bar) {
            setOcrPanel(
              '<div class="ocr-progress-head"><span id="ocr-label"></span><span id="ocr-pct"></span></div>' +
              '<div class="progress"><div class="progress-bar" id="ocr-bar"></div></div>' +
              '<p class="small-note" id="ocr-tip">Puoi intanto inserire i valori a mano.</p>'
            );
            bar = ocrPanel.querySelector('#ocr-bar');
          }
          const labelEl = ocrPanel.querySelector('#ocr-label');
          const pctEl = ocrPanel.querySelector('#ocr-pct');
          if (labelEl) labelEl.textContent = label || 'Leggo la foto…';
          if (pctEl) pctEl.textContent = percent + '%';
          if (bar) bar.style.width = percent + '%';
        }

        function showOcrError(message) {
          setOcrPanel(
            '<div class="ocr-error">' + DP.UI.icon('alert') + '<div><b>Non sono riuscito a leggere la foto</b>' +
              '<p>' + esc(message) + '</p>' +
              '<p class="small-note">Suggerimenti: avvicinati al display, evita riflessi, tieni il telefono parallelo e prova con più luce.</p>' +
              '<button type="button" class="btn btn-ghost btn-sm" data-photo-retry>Riprova con un’altra foto</button>' +
            '</div></div>'
          );
          ocrPanel.querySelector('[data-photo-retry]').addEventListener('click', function () {
            triggerCamera();
          });
        }

        function showOcrResult(result) {
          const p = result.parsed || {};
          const conf = p.confidence || 'none';
          const confLabel = conf === 'high' ? 'Lettura chiara' :
            conf === 'medium' ? 'Controlla i valori' :
            conf === 'low' ? 'Lettura parziale' : 'Nessun valore letto';
          const confTone = conf === 'high' ? 'ok' : conf === 'medium' ? 'warn' : 'error';

          let filled = false;
          if (p.sys !== null && p.sys !== undefined) { sysEl.value = String(p.sys); filled = true; }
          if (p.dia !== null && p.dia !== undefined) { diaEl.value = String(p.dia); filled = true; }
          if (p.pulse !== null && p.pulse !== undefined) { pulseEl.value = String(p.pulse); filled = true; }
          if (p.irregular) { irrEl.checked = true; filled = true; }
          if (filled) {
            state.source = 'photo';
            markDirty();
          }
          updatePreview();

          const summary = (p.sys || p.sys === 0 ? p.sys : '—') + ' / ' +
            (p.dia || p.dia === 0 ? p.dia : '—') +
            (p.pulse ? ' · ' + p.pulse + ' bpm' : '');
          const raw = String(result.text || '').trim();

          setOcrPanel(
            '<div class="ocr-result ocr-' + confTone + '">' +
              '<div class="ocr-result-head">' +
                '<span class="ocr-badge">' + (conf === 'high' ? DP.UI.icon('check') : DP.UI.icon('info')) + ' ' + esc(confLabel) + '</span>' +
                '<span class="ocr-values">' + esc(summary) + '</span>' +
              '</div>' +
              '<p>' + esc(p.note || '') + '</p>' +
              (raw
                ? '<details class="ocr-raw"><summary>Testo letto dalla foto</summary><pre>' + esc(raw) + '</pre></details>'
                : '') +
              '<div class="ocr-result-actions">' +
                '<button type="button" class="btn btn-ghost btn-sm" data-photo-retry>Usa un’altra foto</button>' +
                '<span class="small-note">Controlla e correggi i valori prima di salvare.</span>' +
              '</div>' +
            '</div>'
          );
          ocrPanel.querySelector('[data-photo-retry]').addEventListener('click', triggerCamera);

          if (conf === 'none' || p.sys === null || p.dia === null) {
            DP.UI.toast(p.note || 'Valori non letti: inseriscili a mano.', 'warn');
          }
        }

        async function handleFile(file) {
          if (!file) return;
          if (!/^image\//.test(file.type || '')) {
            DP.UI.toast('Seleziona una foto (JPG, PNG, HEIC…).', 'warn');
            return;
          }
          if (file.size > 30 * 1024 * 1024) {
            DP.UI.toast('La foto è molto grande: prova con una foto più leggera.', 'warn');
            return;
          }
          if (previewUrl) { URL.revokeObjectURL(previewUrl); previewUrl = null; }
          previewUrl = URL.createObjectURL(file);
          ocrBusy = true;
          const buttons = ctx.body.querySelectorAll('[data-photo]');
          buttons.forEach(function (b) { b.disabled = true; });
          setOcrPanel(
            '<div class="ocr-preview"><img alt="Anteprima della foto del misuratore" src="' + previewUrl + '"></div>' +
            '<div class="ocr-progress-head"><span id="ocr-label">Preparo la foto…</span><span id="ocr-pct">0%</span></div>' +
            '<div class="progress"><div class="progress-bar" id="ocr-bar" style="width:0%"></div></div>'
          );
          try {
            const result = await DP.OCR.recognize(file, progress);
            showOcrResult(result);
          } catch (e) {
            showOcrError(e.message || String(e));
          } finally {
            ocrBusy = false;
            buttons.forEach(function (b) { b.disabled = false; });
          }
        }

        function triggerCamera() {
          const input = ctx.body.querySelector('#entry-camera');
          if (input) input.click();
        }

        // ---------- eventi ----------
        [sysEl, diaEl, pulseEl].forEach(function (el) {
          el.addEventListener('input', function () {
            digits(el);
            markDirty();
            updatePreview();
            clearFieldErrors();
          });
          el.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') { e.preventDefault(); saveBtn.click(); }
          });
        });

        atEl.addEventListener('input', function () { markDirty(); });
        armEl.addEventListener('change', markDirty);
        postureEl.addEventListener('change', markDirty);
        irrEl.addEventListener('change', function () { markDirty(); updatePreview(); });
        noteEl.addEventListener('input', markDirty);

        ctx.body.querySelector('[data-entry-now]').addEventListener('click', function () {
          atEl.value = DP.Fmt.nowLocal();
          markDirty();
        });

        ctx.body.querySelectorAll('[data-photo]').forEach(function (btn) {
          btn.addEventListener('click', function () {
            if (ocrBusy) return;
            const which = btn.getAttribute('data-photo');
            const input = ctx.body.querySelector(which === 'camera' ? '#entry-camera' : '#entry-gallery');
            if (input) input.click();
          });
        });
        ctx.body.querySelector('#entry-camera').addEventListener('change', function (e) {
          const f = e.target.files && e.target.files[0];
          e.target.value = '';
          if (f) handleFile(f);
        });
        ctx.body.querySelector('#entry-gallery').addEventListener('change', function (e) {
          const f = e.target.files && e.target.files[0];
          e.target.value = '';
          if (f) handleFile(f);
        });

        ctx.foot.querySelector('[data-entry-cancel]').addEventListener('click', async function () {
          if (ocrBusy) {
            const stop = await DP.UI.confirm({
              title: 'Lettura in corso',
              message: 'La lettura della foto non è ancora finita. Vuoi annullare e chiudere?',
              confirmLabel: 'Chiudi',
              cancelLabel: 'Continua'
            });
            if (!stop) return;
          }
          if (dirty) {
            const discard = await DP.UI.confirm({
              title: 'Scartare la misurazione?',
              message: 'Le modifiche inserite non sono state salvate.',
              confirmLabel: 'Scarta',
              cancelLabel: 'Continua a compilare',
              danger: true
            });
            if (!discard) return;
          }
          close();
        });

        form.addEventListener('submit', async function (e) {
          e.preventDefault();
          if (ocrBusy) {
            DP.UI.toast('Attendi la fine della lettura della foto.', 'warn');
            return;
          }
          if (saveBtn.disabled) return;
          const values = readValues();
          const valid = DP.Stats.validateReading(values);
          if (!valid.ok) { showErrors(valid.errors); return; }
          clearFieldErrors();

          // Avviso duplicato (stessa data/ora), ma solo per una nuova misurazione.
          if (!editing) {
            const same = DP.Store.readings().find(function (x) { return x.at === valid.value.at; });
            if (same) {
              const cont = await DP.UI.confirm({
                title: 'Misurazione già presente',
                message: 'Esiste già una misurazione alle ' + DP.Fmt.fmtTime(valid.value.at) +
                  ' del ' + DP.Fmt.fmtDateShort(valid.value.at) + '. Vuoi salvarla comunque?',
                confirmLabel: 'Salva comunque',
                cancelLabel: 'Annulla'
              });
              if (!cont) return;
            }
          }

          saveBtn.disabled = true;
          saveBtn.textContent = 'Salvo…';
          let saved;
          if (editing) saved = DP.Store.updateReading(r.id, valid.value);
          else saved = DP.Store.addReading(valid.value);

          dirty = false;
          close();
          DP.UI.toast(editing ? 'Misurazione aggiornata.' : 'Misurazione salvata.', 'ok');
          DP.App.afterDataChange();

          const profile = DP.Store.profile();
          const cat = DP.Stats.category(saved, profile.target, profile.limits);
          if (cat.key === 'critical') {
            setTimeout(function () {
              DP.UI.openModal({
                title: 'Valori molto elevati',
                subtitle: 'Leggi con attenzione, non è una diagnosi.',
                body: '<div class="critical-box">' + DP.UI.icon('alert') +
                  '<p>' + esc(DP.CONFIG.emergency) + '</p></div>' +
                  '<p class="small-note">La misurazione è stata salvata. Se i valori restano così alti, contatta il medico.</p>',
                footer: '<button type="button" class="btn btn-primary" data-critical-ok>Ho capito</button>',
                onMount: function (c) {
                  c.foot.querySelector('[data-critical-ok]').addEventListener('click', function () { c.close(); });
                }
              });
            }, 350);
          }
        });

        const del = ctx.body.querySelector('[data-entry-delete]');
        if (del) {
          del.addEventListener('click', async function () {
            const yes = await DP.UI.confirm({
              title: 'Eliminare la misurazione?',
              message: 'La misurazione del ' + DP.Fmt.fmtDateShort(r.at) + ' alle ' + DP.Fmt.fmtTime(r.at) + ' verrà rimossa dal diario.',
              confirmLabel: 'Elimina',
              danger: true
            });
            if (!yes) return;
            DP.Store.deleteReading(r.id);
            dirty = false;
            close();
            DP.UI.toast('Misurazione eliminata.', 'ok');
            DP.App.afterDataChange();
          });
        }

        function close() {
          if (closed) return;
          closed = true;
          if (previewUrl) { URL.revokeObjectURL(previewUrl); previewUrl = null; }
          modal.close();
        }

        // Carica lo stato iniziale e l'anteprima.
        updatePreview();
        if (r && r.source === 'photo') {
          setOcrPanel('<p class="small-note">' + DP.UI.icon('camera') +
            ' Questa misurazione era stata letta da una foto. La foto non è stata salvata.</p>');
        }
        if (!editing && opts.start === 'photo') {
          setTimeout(function () {
            if (!closed) triggerCamera();
          }, 320);
        }
      }
    });

    return modal;
  }

  return { open: open };
})();
