/* Fashion Roulette — UI. Rolling rules live in roulette.js. */
(function () {
  const D = window.FR_DATA;
  const R = window.FR;
  const P = window.FR_PATTERNS;
  const S = window.FR_STATE;
  const STORAGE_KEY = S.STORAGE_KEY;
  const $ = (id) => document.getElementById(id);
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------- State ----------

  const { blankCommission, blankSlots, defaultState, normalise } = S;

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return normalise(JSON.parse(raw));
    } catch (e) { /* storage unavailable or corrupt: start fresh */ }
    return defaultState();
  }

  let state = load();

  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) { /* ignore */ }
  }

  function ctx() {
    return {
      enabled: state.enabled,
      colours: D.colours.map((c) => c.name).filter((n) => state.colours[n]),
      neutralsAllowed: state.neutralsAllowed,
      patternPool: R.buildPatternPool(state.friendships, state.patternProgress),
      includeNone: state.includeNone,
    };
  }

  const NO_PROGRESS = { used: false, unlockOverride: 'auto', notes: '' };

  function progressOf(id) {
    return state.patternProgress[id] || NO_PROGRESS;
  }

  function setProgress(id, field, value) {
    state.patternProgress[id] = Object.assign({}, progressOf(id), { [field]: value });
  }

  const esc = (s) => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  function time(iso) {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  // ---------- Commission form ----------

  const fieldMap = {
    'c-customer': 'customer', 'c-brief': 'brief', 'c-requirements': 'requirements',
    'c-forbidden': 'forbidden', 'c-fabrics': 'fabrics', 'c-budget': 'budget',
    'c-conceptName': 'conceptName', 'c-outcome': 'outcome', 'c-notes': 'notes',
  };

  function bindForm() {
    for (const [id, key] of Object.entries(fieldMap)) {
      const el = $(id);
      el.addEventListener('input', () => { state.commission[key] = el.value; save(); renderSummary(); });
      el.addEventListener('change', () => { state.commission[key] = el.value; save(); renderSummary(); });
    }
    $('c-hasConcept').addEventListener('change', (e) => {
      state.commission.hasConcept = e.target.checked;
      save(); renderConcept(); renderSummary();
    });
    $('btn-concept').addEventListener('click', () => {
      if (!conceptRollAllowed()) return;
      const out = R.rollConcept(state.conceptPool, state.usedConcepts);
      if (out.error) { renderConcept(); return; }
      state.commission.rolledConcept = out.concept.text;
      state.commission.rolledConceptId = out.concept.id;
      state.commission.rolledInPractice = state.practice;
      addLog({ action: state.practice ? 'Concept (practice)' : 'Concept', result: out.concept.text });
      save(); renderConcept(); renderSummary(); renderLog();
    });
    $('btn-concept-clear').addEventListener('click', () => {
      state.commission.rolledConcept = '';
      state.commission.rolledConceptId = null;
      state.commission.rolledInPractice = false;
      save(); renderConcept(); renderSummary();
    });
  }

  // Random concepts unlock in Chapter 2; Practice mode can try them any time.
  function conceptRollAllowed() {
    return state.practice || state.chapter >= 2;
  }

  function renderForm() {
    for (const [id, key] of Object.entries(fieldMap)) $(id).value = state.commission[key] || '';
    $('c-hasConcept').checked = !!state.commission.hasConcept;
    renderConcept();
  }

  function renderConcept() {
    const has = state.commission.hasConcept;
    $('concept-given').hidden = !has;
    $('concept-roll').hidden = has;
    $('concept-out').textContent = state.commission.rolledConcept || '';
    $('btn-concept').textContent = state.commission.rolledConcept ? 'Roll again' : 'Roll a concept';
    $('btn-concept-clear').hidden = !state.commission.rolledConcept;
    const allowed = conceptRollAllowed();
    $('btn-concept').disabled = !allowed;
    $('concept-lock').hidden = allowed;
    const left = R.eligibleConcepts(state.conceptPool, state.usedConcepts).length;
    const total = state.conceptPool.length;
    $('concept-msg').textContent = !allowed ? ''
      : left ? `${left} of ${total} concepts available to roll.`
        : total ? 'All concepts have been used! Mark some as Available in the Concept collection to roll again.'
          : 'The concept pool is empty. Add some in the Concept collection.';
  }

  // ---------- Chapter & practice mode ----------

  function renderProgress() {
    $('chapter').value = state.chapter;
    $('chapter-down').disabled = state.chapter <= 1;
    $('practice').checked = state.practice;
    document.body.classList.toggle('is-practice', state.practice);
    $('practice-banner').hidden = !state.practice;
    $('btn-finish').textContent = state.practice ? 'Finish practice (nothing is saved)' : 'Finish & start a new commission';
  }

  function setChapter(n) {
    const v = Math.floor(Number(n));
    state.chapter = Number.isFinite(v) && v >= 1 ? v : 1;
    save(); renderProgress(); renderConcept();
  }

  function bindProgress() {
    $('chapter-down').addEventListener('click', () => setChapter(state.chapter - 1));
    $('chapter-up').addEventListener('click', () => setChapter(state.chapter + 1));
    $('chapter').addEventListener('change', (e) => setChapter(e.target.value));
    $('practice').addEventListener('change', (e) => {
      state.practice = e.target.checked;
      save(); renderProgress(); renderConcept(); renderSlots(); renderSummary();
    });
  }

  // ---------- Category & colour toggles ----------

  function renderToggles() {
    $('cat-toggles').innerHTML = D.categories.map((c) => `
      <label class="toggle">
        <input type="checkbox" data-cat="${c.id}" ${state.enabled[c.id] ? 'checked' : ''}>
        <span aria-hidden="true">${c.icon}</span> ${esc(c.label)}
      </label>`).join('');
    $('colour-toggles').innerHTML = D.colours.map((c) => `
      <label class="chip">
        <input type="checkbox" data-colour="${esc(c.name)}" ${state.colours[c.name] ? 'checked' : ''}>
        ${esc(c.name)}${c.neutral ? ' <small>(neutral)</small>' : ''}
      </label>`).join('');
    $('neutrals').checked = !!state.neutralsAllowed;
  }

  function bindToggles() {
    $('cat-toggles').addEventListener('change', (e) => {
      const id = e.target.dataset.cat;
      if (!id) return;
      state.enabled[id] = e.target.checked;
      save(); renderNoticeForPools();
    });
    $('colour-toggles').addEventListener('change', (e) => {
      const name = e.target.dataset.colour;
      if (!name) return;
      state.colours[name] = e.target.checked;
      save(); renderNoticeForPools();
    });
    $('neutrals').addEventListener('change', (e) => { state.neutralsAllowed = e.target.checked; save(); });
  }

  // Warn early about enabled categories that can't produce anything.
  function renderNoticeForPools() {
    const { eligible, problems } = R.eligibleCategories(ctx());
    if (!eligible.length) {
      showNotice(problems.length
        ? `Nothing can be rolled yet. ${problems.map((p) => p.message).join(' ')}`
        : 'All categories are switched off. Turn at least one on to spin.');
    } else if (problems.length) {
      showNotice(problems.map((p) => p.message).join(' '));
    } else {
      showNotice('');
    }
  }

  function showNotice(msg) {
    const el = $('notice');
    el.textContent = msg;
    el.hidden = !msg;
  }

  // ---------- Rolling ----------

  function addLog(entry) {
    state.log.push(Object.assign({ timestamp: new Date().toISOString() }, entry));
  }

  function rollInto(i, other, reason, note) {
    const out = R.rollSlot(ctx(), other);
    if (out.error) { showNotice(out.error); return false; }
    const res = out.result;
    res.rerollReason = reason || null;
    if (note) res.rerollNote = note;
    if (out.notes.length) res.notes = out.notes;
    const slot = state.slots[i];
    const previous = slot.current;
    slot.current = res;
    slot.attempts += 1;
    addLog({
      slot: i + 1,
      action: reason ? 'Reroll' : 'Spin',
      reason: reason || null,
      note: note || null,
      replaced: reason && previous ? previous.result : null,
      result: res.result,
      category: res.categoryLabel,
      notes: out.notes,
      outcome: res,
    });
    return true;
  }

  function spinBoth() {
    const free = [0, 1].filter((i) => !state.slots[i].locked);
    if (!free.length) {
      showNotice('Both slots are locked. Unlock one to spin it again.');
      return;
    }
    renderNoticeForPools();
    // Free slots are being replaced, so only compare against results that will stay.
    const fresh = new Set();
    for (const i of free) {
      const o = 1 - i;
      const other = (state.slots[o].locked || fresh.has(o)) ? state.slots[o].current : null;
      if (rollInto(i, other)) fresh.add(i);
    }
    save();
    renderSlots(free);
    renderSummary();
    renderLog();
  }

  function rerollSlot(i, reason, note) {
    const other = state.slots[1 - i].current;
    if (rollInto(i, other, reason, note)) {
      save();
      renderSlots([i]);
      renderSummary();
      renderLog();
    }
  }

  // ---------- Slots ----------

  function slotHtml(i) {
    const slot = state.slots[i];
    const r = slot.current;
    if (!r) {
      return `<p><strong>Slot ${i + 1}</strong><br>Press <em>Spin both</em> to roll a challenge.</p>`;
    }
    const cat = D.categories.find((c) => c.id === r.category);
    const warnings = [];
    if (r.duplicate) warnings.push('⚠️ Same exact challenge as the other slot — no distinct option was available.');
    if (r.note) warnings.push(r.note);
    (r.notes || []).forEach((n) => warnings.push(n));

    let extra = '';
    if (r.category === 'pattern' && r.legacy) {
      warnings.push('Rolled from the old placeholder catalogue. Reroll to use the wiki pattern library.');
    } else if (r.category === 'pattern') {
      const partName = R.partLabel(r.part).toLowerCase();
      if (r.mode === 'unused') {
        if (r.choice) {
          extra = `<p class="chosen">✅ You chose: ${esc(r.choiceName || r.choice)}</p>
            <button class="btn secondary small" data-act="choose" data-slot="${i}">Change choice</button>`;
        } else if (!R.unusedPatterns(ctx(), r.part).length) {
          extra = `<p class="warn">No unused ${esc(partName)} patterns are left.</p>
            <button class="btn secondary small" data-act="convert" data-slot="${i}" ${slot.locked ? 'disabled' : ''}>Switch to Random Pattern</button>`;
        } else {
          extra = `<button class="btn secondary small" data-act="choose" data-slot="${i}">Choose pattern…</button>`;
        }
      }
      if (r.choice && !state.practice) {
        const used = progressOf(r.choice).used;
        extra += `<button class="btn secondary small" data-act="used" data-slot="${i}" aria-pressed="${used}">
          ${used ? '✅ Marked as used' : 'Mark pattern as used'}</button>`;
      }
    }

    return `
      <div class="slot-head">
        <span class="slot-num">Slot ${i + 1}</span>
        <span class="badge"><span aria-hidden="true">${cat.icon}</span> ${esc(r.categoryLabel)}</span>
      </div>
      <p class="subtype">${esc(r.subtype)}</p>
      <p class="result">${esc(r.result)}</p>
      <p class="rule">${esc(r.rule)}</p>
      ${extra}
      <ul class="constraints">${r.constraints.map((c) => `<li>${esc(c)}</li>`).join('')}</ul>
      ${warnings.map((w) => `<p class="warn">${esc(w)}</p>`).join('')}
      <p class="attempts">Attempts this commission: ${slot.attempts}${r.rerollReason ? ` · last reroll: ${esc(r.rerollReason)}` : ''}</p>
      <div class="slot-actions">
        <button class="btn primary small" data-act="reroll" data-slot="${i}" ${slot.locked ? 'disabled' : ''}
          aria-label="Reroll slot ${i + 1}">Reroll this</button>
        <button class="btn secondary small" data-act="lock" data-slot="${i}" aria-pressed="${slot.locked}">
          ${slot.locked ? '🔒 Kept' : '🔓 Keep'}</button>
      </div>`;
  }

  function renderSlots(animate) {
    for (const i of [0, 1]) {
      const el = $(`slot-${i}`);
      const slot = state.slots[i];
      el.className = `slot${slot.current ? '' : ' empty'}${slot.locked ? ' locked' : ''}`;
      el.setAttribute('aria-label', `Slot ${i + 1}`);
      el.innerHTML = slotHtml(i);
      if (animate && animate.includes(i) && !reducedMotion) {
        el.classList.remove('rolling');
        void el.offsetWidth; // restart the animation
        el.classList.add('rolling');
      }
    }
    $('btn-spin').textContent = state.slots.some((s) => s.current) ? 'Spin both again' : 'Spin both';
  }

  function bindSlots() {
    document.querySelector('.slots').addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-act]');
      if (!btn) return;
      const i = Number(btn.dataset.slot);
      const slot = state.slots[i];
      switch (btn.dataset.act) {
        case 'reroll': openReroll(i); break;
        case 'lock':
          slot.locked = !slot.locked;
          save(); renderSlots();
          break;
        case 'choose': openChoose(i); break;
        case 'used': {
          const id = slot.current.choice;
          setProgress(id, 'used', !progressOf(id).used);
          save(); renderSlots(); renderLibrary();
          break;
        }
        case 'convert': {
          const converted = R.convertToRandom(slot.current, ctx());
          if (!converted) { showNotice('No unlocked patterns exist for that piece either. Reroll this slot instead.'); return; }
          converted.rerollReason = 'Switched to Random (no unused patterns)';
          slot.current = converted;
          addLog({ slot: i + 1, action: 'Convert', reason: 'No unused patterns left', result: converted.result, outcome: converted });
          save(); renderSlots([i]); renderSummary(); renderLog();
          break;
        }
      }
    });
  }

  // ---------- Reroll dialog ----------

  let rerollTarget = null;

  function openReroll(i) {
    rerollTarget = i;
    $('reroll-slot-num').textContent = String(i + 1);
    $('reroll-reasons').innerHTML = D.rerollReasons.map((r) => `
      <label><input type="radio" name="reason" value="${esc(r)}"> ${esc(r)}</label>`).join('');
    $('reroll-note').value = '';
    $('reroll-error').textContent = '';
    $('dlg-reroll').showModal();
  }

  function bindReroll() {
    $('form-reroll').addEventListener('submit', (e) => {
      if (e.submitter && e.submitter.value === 'cancel') return;
      const chosen = document.querySelector('#reroll-reasons input:checked');
      const note = $('reroll-note').value.trim();
      if (!chosen) {
        e.preventDefault();
        $('reroll-error').textContent = 'Pick a reason for the reroll.';
        return;
      }
      if (chosen.value === 'Other (note)' && !note) {
        e.preventDefault();
        $('reroll-error').textContent = 'Add a short note explaining why.';
        return;
      }
      rerollSlot(rerollTarget, chosen.value, note);
    });
  }

  // ---------- Choose-unused dialog ----------

  let chooseTarget = null;

  function openChoose(i) {
    chooseTarget = i;
    const r = state.slots[i].current;
    $('dlg-pattern-title').textContent = `Choose an unused ${R.partLabel(r.part).toLowerCase()} pattern`;
    $('choose-search').value = '';
    renderChooseList();
    $('dlg-pattern').showModal();
  }

  function renderChooseList() {
    const r = state.slots[chooseTarget].current;
    const q = $('choose-search').value.trim().toLowerCase();
    const list = R.unusedPatterns(ctx(), r.part).filter((p) => !q || p.name.toLowerCase().includes(q));
    $('choose-list').innerHTML = list.length
      ? list.map((p) => `<li><button class="btn" type="button" data-pid="${esc(p.id)}">${esc(p.name)}</button></li>`).join('')
      : '<li class="hint">No matching unused patterns.</li>';
  }

  function bindChoose() {
    $('choose-search').addEventListener('input', renderChooseList);
    $('choose-list').addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-pid]');
      if (!btn) return;
      const r = state.slots[chooseTarget].current;
      r.choice = btn.dataset.pid;
      r.choiceName = btn.textContent;
      addLog({ slot: chooseTarget + 1, action: 'Chose pattern', result: r.choiceName });
      save();
      $('dlg-pattern').close();
      renderSlots(); renderSummary(); renderLog();
    });
  }

  // ---------- Summary & log ----------

  function resultLine(r) {
    if (!r) return '(not rolled)';
    let line = `${r.categoryLabel} — ${r.result}`;
    if (r.category === 'pattern' && r.mode === 'unused') line += r.choice ? ` → ${r.choiceName || r.choice}` : ' → (not chosen yet)';
    return `${line}\n   ${r.rule}`;
  }

  function summaryText() {
    const c = state.commission;
    const lines = ['🌞 Crobat & Sunshine — Fashion Roulette'];
    if (state.practice) lines.push('🧪 PRACTICE — not part of the real playthrough');
    if (c.customer) lines.push(`Customer: ${c.customer}`);
    if (c.brief) lines.push(`Brief: ${c.brief}`);
    if (c.requirements) lines.push(`Requirements: ${c.requirements}`);
    if (c.forbidden) lines.push(`Forbidden colours: ${c.forbidden}`);
    if (c.fabrics) lines.push(`Fabrics: ${c.fabrics}`);
    if (c.budget) lines.push(`Budget: ${c.budget}`);
    const concept = c.hasConcept ? (c.conceptName ? `${c.conceptName} (from commission)` : '(from commission)') : (c.rolledConcept ? `${c.rolledConcept} (rolled)` : 'none');
    lines.push(`Concept: ${concept}`);
    const off = D.categories.filter((x) => !state.enabled[x.id]).map((x) => x.label);
    if (off.length) lines.push(`Disabled categories: ${off.join(', ')}`);
    lines.push('');
    lines.push(`1) ${resultLine(state.slots[0].current)}`);
    lines.push(`2) ${resultLine(state.slots[1].current)}`);
    const rerolls = state.log.filter((l) => l.action === 'Reroll').length;
    lines.push('', `Rerolls: ${rerolls}`);
    if (c.outcome) lines.push(`Outcome: ${{ success: 'Succeeded', partial: 'Partly', fail: "Didn't work out" }[c.outcome]}`);
    if (c.notes) lines.push(`Notes: ${c.notes}`);
    return lines.join('\n');
  }

  function renderSummary() {
    $('summary').value = summaryText();
  }

  function renderLog() {
    const items = state.log.slice().reverse();
    $('log').innerHTML = items.length
      ? items.map((l) => {
        const who = l.slot ? `Slot ${l.slot} · ` : '';
        const reason = l.reason ? ` <span class="reason">(${esc(l.reason)}${l.note ? `: ${esc(l.note)}` : ''})</span>` : '';
        const replaced = l.replaced ? ` <span class="meta">replaced “${esc(l.replaced)}”</span>` : '';
        const notes = (l.notes || []).length ? ` <span class="meta">— ${esc(l.notes.join(' '))}</span>` : '';
        return `<li><span class="meta">${time(l.timestamp)}</span> ${who}<strong>${esc(l.action)}</strong>: ${esc(l.result)}${reason}${replaced}${notes}</li>`;
      }).join('')
      : '<li class="hint">Nothing rolled yet.</li>';
  }

  function bindSummary() {
    $('btn-copy').addEventListener('click', async () => {
      const text = summaryText();
      try {
        await navigator.clipboard.writeText(text);
        $('copy-status').textContent = 'Copied!';
      } catch (e) {
        $('summary').select();
        $('copy-status').textContent = 'Selected — press Ctrl/Cmd+C to copy.';
      }
      setTimeout(() => { $('copy-status').textContent = ''; }, 3000);
    });

    $('btn-finish').addEventListener('click', () => {
      if (state.practice) {
        if (!confirm('Clear this practice commission?\n\nNothing is saved to your past commissions and no concepts or patterns are marked as used.\n\nTo keep it as a real commission instead, press Cancel, switch off Practice mode, then Finish.')) return;
        resetCommission();
        showNotice('Practice cleared. 🧪');
        return;
      }
      const pending = state.slots.some((s) => s.current && s.current.mode === 'unused' && !s.current.choice);
      const msg = pending
        ? 'One slot still needs a pattern chosen. Finish anyway?'
        : 'Save this commission to your past commissions and start a new one?\n\n(Patterns are only marked used if you pressed "Mark pattern as used".)';
      if (!confirm(msg)) return;
      const markedConcept = markFinishedConcept(state.commission);
      state.past.unshift({
        finishedAt: new Date().toISOString(),
        commission: state.commission,
        results: state.slots.map((s) => s.current),
        log: state.log,
        summary: summaryText(),
        conceptMarkedUsed: markedConcept,
      });
      resetCommission();
      showNotice(markedConcept
        ? `Saved! “${conceptText(markedConcept)}” is now marked as used. Ready for the next commission. 🌞`
        : 'Saved! Ready for the next commission. 🌞');
      window.scrollTo({ top: 0, behavior: reducedMotion ? 'auto' : 'smooth' });
    });
  }

  function resetCommission() {
    state.commission = blankCommission();
    state.slots = blankSlots();
    state.log = [];
    save();
    renderAll();
  }

  function conceptText(id) {
    const c = state.conceptPool.find((x) => x.id === id);
    return c ? c.text : id;
  }

  /*
   * A finished real commission uses up its concept:
   * - a rolled concept is marked used (after a confirm if it was rolled in Practice mode);
   * - a commission-supplied concept is only marked if it exactly matches a pool entry and you agree.
   * Returns the concept ID that was marked, or null.
   */
  function markFinishedConcept(c) {
    let id = null;
    if (c.hasConcept) {
      const match = R.matchConcept(state.conceptPool, c.conceptName);
      if (match && !state.usedConcepts[match.id]
        && confirm(`This commission's concept “${c.conceptName}” matches “${match.text}” in your Concept collection.\n\nMark it as used so it won't be rolled again?`)) {
        id = match.id;
      }
    } else if (c.rolledConcept) {
      const entry = state.conceptPool.find((x) => x.id === c.rolledConceptId)
        || state.conceptPool.find((x) => x.text === c.rolledConcept);
      if (entry && !state.usedConcepts[entry.id]
        && (!c.rolledInPractice || confirm(`“${entry.text}” was rolled in Practice mode.\n\nCount it as used in your real playthrough?`))) {
        id = entry.id;
      }
    }
    if (id) state.usedConcepts[id] = { usedAt: new Date().toISOString(), by: c.customer || '' };
    return id;
  }

  // ---------- Concept collection ----------

  let conceptUndo = null;

  function conceptGroup(text) {
    const i = text.indexOf(':');
    return i > 0 ? text.slice(0, i).trim() : 'Other';
  }

  function renderConcepts() {
    const q = $('cc-search').value.trim().toLowerCase();
    const filter = $('cc-filter').value;
    const used = state.usedConcepts;
    const total = state.conceptPool.length;
    const nUsed = state.conceptPool.filter((c) => used[c.id]).length;
    $('cc-counts').textContent = `${total - nUsed} available · ${nUsed} used · ${total} total`;

    const rows = state.conceptPool.filter((c) => {
      if (q && !c.text.toLowerCase().includes(q)) return false;
      if (filter === 'available') return !used[c.id];
      if (filter === 'used') return !!used[c.id];
      return true;
    });
    const groups = new Map();
    for (const c of rows) {
      const g = conceptGroup(c.text);
      if (!groups.has(g)) groups.set(g, []);
      groups.get(g).push(c);
    }
    $('cc-list').innerHTML = groups.size ? [...groups].map(([g, list]) => `
      <h3>${esc(g)}</h3>
      <ul class="cc-group">${list.map((c) => {
        const u = used[c.id];
        const when = u && u.usedAt && !Number.isNaN(Date.parse(u.usedAt)) ? new Date(u.usedAt).toLocaleDateString() : '';
        return `<li class="cc-row${u ? ' is-used' : ''}">
          <input type="text" value="${esc(c.text)}" data-cid="${esc(c.id)}" aria-label="Concept name" autocomplete="off">
          <span class="status ${u ? 'off' : 'on'}">${u ? `Used${u.by ? ` · ${esc(u.by)}` : ''}${when ? ` · ${esc(when)}` : ''}` : 'Available'}</span>
          <button class="btn secondary small" type="button" data-toggle="${esc(c.id)}">${u ? 'Mark available' : 'Mark used'}</button>
          <button class="btn link small" type="button" data-remove="${esc(c.id)}" aria-label="Remove ${esc(c.text)}">✕</button>
        </li>`;
      }).join('')}</ul>`).join('') : '<p class="hint">No concepts match.</p>';
  }

  function renderUndo(msg) {
    $('cc-undo').innerHTML = msg
      ? `${esc(msg)} <button class="btn link small" type="button" id="cc-undo-btn">Undo</button>`
      : '';
  }

  function bindConcepts() {
    $('cc-search').addEventListener('input', renderConcepts);
    $('cc-filter').addEventListener('change', renderConcepts);
    $('cc-undo').addEventListener('click', (e) => {
      if (e.target.id !== 'cc-undo-btn' || !conceptUndo) return;
      if (conceptUndo.prev) state.usedConcepts[conceptUndo.id] = conceptUndo.prev;
      else delete state.usedConcepts[conceptUndo.id];
      conceptUndo = null;
      renderUndo('');
      save(); renderConcepts(); renderConcept();
    });
    $('cc-list').addEventListener('click', (e) => {
      const toggle = e.target.closest('button[data-toggle]');
      if (toggle) {
        const id = toggle.dataset.toggle;
        const prev = state.usedConcepts[id] || null;
        if (prev) delete state.usedConcepts[id];
        else state.usedConcepts[id] = { usedAt: new Date().toISOString(), by: '' };
        conceptUndo = { id, prev };
        renderUndo(`“${conceptText(id)}” marked ${prev ? 'available' : 'used'}.`);
        save(); renderConcepts(); renderConcept();
        return;
      }
      const remove = e.target.closest('button[data-remove]');
      if (remove && confirm(`Remove “${conceptText(remove.dataset.remove)}” from the pool?\n\nPast commissions keep their concept.`)) {
        state.conceptPool = state.conceptPool.filter((c) => c.id !== remove.dataset.remove);
        save(); renderConcepts(); renderConcept();
      }
    });
    // Renaming keeps the concept's ID, so its Used status stays with it.
    $('cc-list').addEventListener('change', (e) => {
      const el = e.target;
      if (!el.dataset.cid) return;
      const c = state.conceptPool.find((x) => x.id === el.dataset.cid);
      const text = el.value.trim();
      if (!c) return;
      if (!text) { el.value = c.text; return; }
      c.text = text;
      save(); renderConcepts();
    });
    $('cc-add').addEventListener('submit', (e) => {
      e.preventDefault();
      const input = e.target.elements.text;
      const text = input.value.trim();
      if (!text) return;
      const taken = new Set(state.conceptPool.map((c) => c.id).concat(Object.keys(state.usedConcepts)));
      state.conceptPool.push({ id: S.newConceptId(text, taken), text });
      input.value = '';
      save(); renderConcepts(); renderConcept();
    });
  }

  function renderPast() {
    $('past').innerHTML = state.past.length
      ? state.past.map((p, n) => {
        const c = p.commission;
        const outcome = { success: '🎉 Succeeded', partial: 'Partly', fail: "Didn't work out" }[c.outcome] || 'No outcome recorded';
        return `<div class="past-item">
          <h3>${esc(c.customer || 'Unnamed commission')} <small class="meta">· ${new Date(p.finishedAt).toLocaleDateString()}</small></h3>
          ${p.results.map((r, i) => `<p>${i + 1}) ${r ? esc(`${r.categoryLabel} — ${r.result}${r.mode === 'unused' && r.choice ? ` → ${r.choiceName || r.choice}` : ''}`) : '(not rolled)'}</p>`).join('')}
          <p class="meta">${esc(outcome)}${c.notes ? ` · ${esc(c.notes)}` : ''}</p>
          <button class="btn link small" type="button" data-del="${n}">Delete</button>
        </div>`;
      }).join('')
      : '<p class="hint">Finished commissions will appear here.</p>';
  }

  function bindPast() {
    $('past').addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-del]');
      if (!btn || !confirm('Delete this past commission?')) return;
      state.past.splice(Number(btn.dataset.del), 1);
      save(); renderPast();
    });
  }

  // ---------- Friendship stars ----------

  function unlockedIds() {
    return new Set(R.buildPatternPool(state.friendships, state.patternProgress).filter((p) => p.unlocked).map((p) => p.id));
  }

  function starText(n) {
    return '★'.repeat(n) + '☆'.repeat(P.MAX_STARS - n);
  }

  function renderFriends() {
    const unlocked = unlockedIds();
    $('friend-list').innerHTML = P.CLIENTS.map((client) => {
      const stars = state.friendships[client] || 0;
      const theirs = P.patterns.filter((p) => p.unlock.kind === 'friendship' && p.unlock.client === client);
      const have = theirs.filter((p) => unlocked.has(p.id)).length;
      const next = theirs.filter((p) => p.unlock.stars > stars).map((p) => p.unlock.stars);
      const nextStar = next.length ? Math.min(...next) : null;
      const nextCount = theirs.filter((p) => p.unlock.stars === nextStar).length;
      const nextText = nextStar
        ? `Next: ★${nextStar} unlocks ${nextCount} pattern${nextCount > 1 ? 's' : ''}`
        : 'All their patterns unlocked';
      return `<div class="friend">
        <span class="fname">${esc(client)}</span>
        <span class="stepper">
          <button class="btn secondary small" type="button" data-client="${esc(client)}" data-step="-1"
            aria-label="Fewer stars for ${esc(client)}" ${stars <= 0 ? 'disabled' : ''}>−</button>
          <input type="number" inputmode="numeric" min="0" max="${P.MAX_STARS}" value="${stars}"
            data-client="${esc(client)}" aria-label="${esc(client)} friendship stars">
          <button class="btn secondary small" type="button" data-client="${esc(client)}" data-step="1"
            aria-label="More stars for ${esc(client)}" ${stars >= P.MAX_STARS ? 'disabled' : ''}>+</button>
        </span>
        <span class="stars" aria-hidden="true">${starText(stars)}</span>
        <span class="meta">${have}/${theirs.length} patterns · ${esc(nextText)}</span>
      </div>`;
    }).join('');
  }

  function setStars(client, value) {
    const before = unlockedIds();
    const old = state.friendships[client] || 0;
    state.friendships[client] = S.clampStars(value);
    const fresh = P.patterns.filter((p) => !before.has(p.id) && unlockedIds().has(p.id));
    $('friend-news').textContent = state.friendships[client] > old && fresh.length
      ? `New for ${client} ★${state.friendships[client]}: ${fresh.map((p) => p.name).join(', ')}`
      : '';
    save();
    renderFriends(); renderLibrary(); renderSlots(); renderNoticeForPools();
  }

  function bindFriends() {
    $('friend-list').addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-step]');
      if (!btn) return;
      const client = btn.dataset.client;
      setStars(client, (state.friendships[client] || 0) + Number(btn.dataset.step));
      const again = document.querySelector(`#friend-list button[data-client="${client}"][data-step="${btn.dataset.step}"]`);
      if (again && !again.disabled) again.focus();
    });
    $('friend-list').addEventListener('change', (e) => {
      if (e.target.matches('input[data-client]')) setStars(e.target.dataset.client, e.target.value);
    });
  }

  // ---------- Pattern library ----------

  let libTab = 'bodice';

  function unlockText(p) {
    if (p.none) return 'Picker choice from the start · not a numbered pattern';
    return p.unlock.kind === 'start' ? 'Starting pattern' : `${p.unlock.client} · ★${p.unlock.stars}`;
  }

  function renderLibrary() {
    $('lib-tabs').innerHTML = P.PARTS.map((part) => `
      <button type="button" role="tab" id="tab-${part.part}" data-tab="${part.part}"
        aria-selected="${part.part === libTab}" aria-controls="lib-list" tabindex="${part.part === libTab ? 0 : -1}">${esc(part.plural)}</button>`).join('');
    $('include-none').checked = !!state.includeNone;

    const unlocked = unlockedIds();
    const q = $('lib-search').value.trim().toLowerCase();
    const filter = $('lib-filter').value;
    const inPart = P.patterns.filter((p) => p.part === libTab);
    // Picker choices first, then the wiki's order.
    const ordered = inPart.filter((p) => p.none).concat(inPart.filter((p) => !p.none));
    const rows = ordered.filter((p) => {
      const isUnlocked = unlocked.has(p.id);
      const used = progressOf(p.id).used;
      if (q && !p.name.toLowerCase().includes(q) && !unlockText(p).toLowerCase().includes(q)) return false;
      if (filter === 'unlocked') return isUnlocked;
      if (filter === 'locked') return !isUnlocked;
      if (filter === 'unused') return !used;
      if (filter === 'ready') return isUnlocked && !used;
      return true;
    });

    const numbered = inPart.filter((p) => !p.none);
    const nUnlocked = numbered.filter((p) => unlocked.has(p.id)).length;
    const nReady = numbered.filter((p) => unlocked.has(p.id) && !progressOf(p.id).used).length;
    const label = P.PARTS.find((x) => x.part === libTab).plural;
    $('lib-counts').textContent = `${label}: ${nUnlocked} of ${numbered.length} unlocked · ${nReady} unlocked & unused`;

    $('lib-list').setAttribute('aria-labelledby', `tab-${libTab}`);
    $('lib-list').innerHTML = rows.length ? rows.map((p) => {
      const prog = progressOf(p.id);
      const isUnlocked = unlocked.has(p.id);
      const overridden = prog.unlockOverride !== 'auto';
      return `<li class="lib-row${isUnlocked ? '' : ' is-locked'}${p.none ? ' is-none' : ''}">
        <div class="lib-main">
          <strong>${esc(p.name)}</strong>
          <span class="meta">${esc(unlockText(p))}</span>
        </div>
        <span class="status ${isUnlocked ? 'on' : 'off'}">${isUnlocked ? '🔓 Unlocked' : '🔒 Locked'}${overridden ? ' <em>(override)</em>' : ''}</span>
        <label class="lib-used"><input type="checkbox" data-id="${esc(p.id)}" data-field="used" ${prog.used ? 'checked' : ''}> Used</label>
        <details class="lib-more"${overridden || prog.notes ? ' open' : ''}>
          <summary>Override / notes${prog.notes ? ' ✎' : ''}</summary>
          <label class="lib-ovr">Unlock
            <select data-id="${esc(p.id)}" data-field="unlockOverride" aria-label="Unlock override for ${esc(p.name)}">
              <option value="auto" ${prog.unlockOverride === 'auto' ? 'selected' : ''}>Auto (from friendship)</option>
              <option value="unlocked" ${prog.unlockOverride === 'unlocked' ? 'selected' : ''}>Force unlocked</option>
              <option value="locked" ${prog.unlockOverride === 'locked' ? 'selected' : ''}>Force locked</option>
            </select>
          </label>
          <input class="lib-notes" type="text" data-id="${esc(p.id)}" data-field="notes" value="${esc(prog.notes)}"
            placeholder="Notes" aria-label="Notes for ${esc(p.name)}" autocomplete="off">
        </details>
      </li>`;
    }).join('') : '<li class="hint">No patterns match.</li>';
  }

  function bindLibrary() {
    $('lib-search').addEventListener('input', renderLibrary);
    $('lib-filter').addEventListener('change', renderLibrary);
    $('include-none').addEventListener('change', (e) => {
      state.includeNone = e.target.checked;
      save();
    });
    const tabs = $('lib-tabs');
    tabs.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-tab]');
      if (!btn) return;
      libTab = btn.dataset.tab;
      renderLibrary();
      $(`tab-${libTab}`).focus();
    });
    tabs.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      const order = P.PARTS.map((p) => p.part);
      const n = order.indexOf(libTab) + (e.key === 'ArrowRight' ? 1 : -1);
      libTab = order[(n + order.length) % order.length];
      renderLibrary();
      $(`tab-${libTab}`).focus();
    });
    $('lib-list').addEventListener('change', (e) => {
      const el = e.target;
      const id = el.dataset.id;
      if (!id) return;
      if (el.dataset.field === 'notes') {
        setProgress(id, 'notes', el.value.trim());
        save();
        return;
      }
      setProgress(id, el.dataset.field, el.type === 'checkbox' ? el.checked : el.value);
      save();
      renderLibrary(); renderFriends(); renderSlots(); renderNoticeForPools();
    });
  }

  // ---------- Export / import / reset ----------

  function bindData() {
    $('btn-export').addEventListener('click', () => {
      const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `fashion-roulette-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    });
    $('file-import').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const data = JSON.parse(await file.text());
        if (!confirm('Replace everything here with the imported data?')) return;
        state = normalise(data);
        save(); renderAll();
        showNotice('Imported! 🌞');
      } catch (err) {
        alert('That file could not be read as Fashion Roulette data.');
      } finally {
        e.target.value = '';
      }
    });
    $('btn-reset').addEventListener('click', () => {
      if (!confirm('Reset everything — commission, patterns, history and settings? This cannot be undone.')) return;
      state = defaultState();
      save(); renderAll();
    });
  }

  // ---------- Boot ----------

  function renderAll() {
    renderProgress();
    renderForm();
    renderToggles();
    renderSlots();
    renderSummary();
    renderLog();
    renderFriends();
    renderLibrary();
    renderConcepts();
    renderPast();
    renderNoticeForPools();
  }

  $('btn-spin').addEventListener('click', spinBoth);
  bindProgress();
  bindForm();
  bindToggles();
  bindSlots();
  bindReroll();
  bindChoose();
  bindSummary();
  bindPast();
  bindFriends();
  bindLibrary();
  bindConcepts();
  bindData();
  renderAll();
})();
