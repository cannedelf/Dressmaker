/* Fashion Roulette — UI. Rolling rules live in roulette.js. */
(function () {
  const D = window.FR_DATA;
  const R = window.FR;
  const STORAGE_KEY = 'crobat-sunshine-fashion-roulette-v1';
  const $ = (id) => document.getElementById(id);
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------- State ----------

  function defaultPatterns() {
    const out = {};
    for (const p of D.patternPieces) {
      out[p.code] = [];
      for (let i = 1; i <= D.patternsPerPiece; i++) {
        out[p.code].push({ id: `${p.code}${String(i).padStart(2, '0')}`, name: '', unlocked: true, used: false });
      }
    }
    return out;
  }

  function blankCommission() {
    return {
      customer: '', brief: '', requirements: '', forbidden: '', fabrics: '', budget: '',
      hasConcept: false, conceptName: '', rolledConcept: '', outcome: '', notes: '',
    };
  }

  function blankSlots() {
    return [{ current: null, locked: false, attempts: 0 }, { current: null, locked: false, attempts: 0 }];
  }

  function defaultState() {
    return {
      version: 1,
      commission: blankCommission(),
      enabled: Object.fromEntries(D.categories.map((c) => [c.id, true])),
      colours: Object.fromEntries(D.colours.map((c) => [c.name, true])),
      neutralsAllowed: true,
      patterns: defaultPatterns(),
      conceptPool: D.concepts.slice(),
      slots: blankSlots(),
      log: [],
      past: [],
    };
  }

  function normalise(raw) {
    const base = defaultState();
    const s = Object.assign(base, raw || {});
    s.commission = Object.assign(blankCommission(), s.commission);
    s.enabled = Object.assign(defaultState().enabled, s.enabled);
    s.colours = Object.assign(defaultState().colours, s.colours);
    s.patterns = Object.assign(defaultPatterns(), s.patterns);
    if (!Array.isArray(s.slots) || s.slots.length !== 2) s.slots = blankSlots();
    if (!Array.isArray(s.log)) s.log = [];
    if (!Array.isArray(s.past)) s.past = [];
    if (!Array.isArray(s.conceptPool)) s.conceptPool = D.concepts.slice();
    return s;
  }

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
      patterns: state.patterns,
    };
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
      const out = R.rollConcept(state.conceptPool);
      if (out.error) { $('concept-out').textContent = out.error; return; }
      state.commission.rolledConcept = out.concept;
      addLog({ action: 'Concept', result: out.concept });
      save(); renderConcept(); renderSummary(); renderLog();
    });
    $('btn-concept-clear').addEventListener('click', () => {
      state.commission.rolledConcept = '';
      save(); renderConcept(); renderSummary();
    });
    $('concept-pool').addEventListener('change', (e) => {
      state.conceptPool = e.target.value.split('\n').map((s) => s.trim()).filter(Boolean);
      save();
    });
  }

  function renderForm() {
    for (const [id, key] of Object.entries(fieldMap)) $(id).value = state.commission[key] || '';
    $('c-hasConcept').checked = !!state.commission.hasConcept;
    $('concept-pool').value = state.conceptPool.join('\n');
    renderConcept();
  }

  function renderConcept() {
    const has = state.commission.hasConcept;
    $('concept-given').hidden = !has;
    $('concept-roll').hidden = has;
    $('concept-out').textContent = state.commission.rolledConcept || '';
    $('btn-concept').textContent = state.commission.rolledConcept ? 'Roll again' : 'Roll a concept';
    $('btn-concept-clear').hidden = !state.commission.rolledConcept;
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
    if (r.category === 'pattern' && r.mode === 'unused') {
      if (r.choice) {
        const p = (state.patterns[r.piece] || []).find((x) => x.id === r.choice);
        extra = `<p class="chosen">✅ You chose: ${esc(p ? R.patternLabel(p) : r.choice)}</p>
          <button class="btn secondary small" data-act="choose" data-slot="${i}">Change choice</button>`;
      } else if (r.needsConversion || !R.unusedPatterns(ctx(), r.piece).length) {
        extra = `<p class="warn">No unused ${esc(R.pieceLabel(r.piece).toLowerCase())} patterns are left.</p>
          <button class="btn secondary small" data-act="convert" data-slot="${i}" ${slot.locked ? 'disabled' : ''}>Convert to Random Pattern</button>`;
      } else {
        extra = `<button class="btn secondary small" data-act="choose" data-slot="${i}">Choose pattern…</button>`;
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
        case 'convert': {
          const converted = R.convertToRandom(slot.current, ctx());
          if (!converted) { showNotice('No unlocked patterns exist for that piece either. Reroll this slot instead.'); return; }
          converted.rerollReason = 'Converted (no unused patterns)';
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
    $('dlg-pattern-title').textContent = `Choose an unused ${R.pieceLabel(r.piece).toLowerCase()} pattern`;
    $('choose-search').value = '';
    renderChooseList();
    $('dlg-pattern').showModal();
  }

  function renderChooseList() {
    const r = state.slots[chooseTarget].current;
    const q = $('choose-search').value.trim().toLowerCase();
    const list = R.unusedPatterns(ctx(), r.piece)
      .filter((p) => !q || p.id.toLowerCase().includes(q) || (p.name || '').toLowerCase().includes(q));
    $('choose-list').innerHTML = list.length
      ? list.map((p) => `<li><button class="btn" type="button" data-pid="${esc(p.id)}">${esc(R.patternLabel(p))}</button></li>`).join('')
      : '<li class="hint">No matching unused patterns.</li>';
  }

  function bindChoose() {
    $('choose-search').addEventListener('input', renderChooseList);
    $('choose-list').addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-pid]');
      if (!btn) return;
      const r = state.slots[chooseTarget].current;
      r.choice = btn.dataset.pid;
      addLog({ slot: chooseTarget + 1, action: 'Chose pattern', result: r.choice });
      save();
      $('dlg-pattern').close();
      renderSlots(); renderSummary(); renderLog();
    });
  }

  // ---------- Summary & log ----------

  function resultLine(r) {
    if (!r) return '(not rolled)';
    let line = `${r.categoryLabel} — ${r.result}`;
    if (r.category === 'pattern' && r.mode === 'unused') line += r.choice ? ` → ${r.choice}` : ' → (not chosen yet)';
    return `${line}\n   ${r.rule}`;
  }

  function summaryText() {
    const c = state.commission;
    const lines = ['🌞 Crobat & Sunshine — Fashion Roulette'];
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
      const pending = state.slots.some((s) => s.current && s.current.mode === 'unused' && !s.current.choice);
      const msg = pending
        ? 'One slot still needs a pattern chosen. Finish anyway?'
        : 'Save this commission to your past commissions and start a new one?';
      if (!confirm(msg)) return;
      // Mark patterns that ended up in the dress as used.
      for (const s of state.slots) {
        const r = s.current;
        if (r && r.category === 'pattern' && r.choice) {
          const p = (state.patterns[r.piece] || []).find((x) => x.id === r.choice);
          if (p) p.used = true;
        }
      }
      state.past.unshift({
        finishedAt: new Date().toISOString(),
        commission: state.commission,
        results: state.slots.map((s) => s.current),
        log: state.log,
        summary: summaryText(),
      });
      state.commission = blankCommission();
      state.slots = blankSlots();
      state.log = [];
      save();
      renderAll();
      showNotice('Saved! Ready for the next commission. 🌞');
      window.scrollTo({ top: 0, behavior: reducedMotion ? 'auto' : 'smooth' });
    });
  }

  function renderPast() {
    $('past').innerHTML = state.past.length
      ? state.past.map((p, n) => {
        const c = p.commission;
        const outcome = { success: '🎉 Succeeded', partial: 'Partly', fail: "Didn't work out" }[c.outcome] || 'No outcome recorded';
        return `<div class="past-item">
          <h3>${esc(c.customer || 'Unnamed commission')} <small class="meta">· ${new Date(p.finishedAt).toLocaleDateString()}</small></h3>
          ${p.results.map((r, i) => `<p>${i + 1}) ${r ? esc(`${r.categoryLabel} — ${r.result}${r.mode === 'unused' && r.choice ? ` → ${r.choice}` : ''}`) : '(not rolled)'}</p>`).join('')}
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

  // ---------- Pattern catalogue ----------

  function renderPatterns() {
    const q = $('pattern-search').value.trim().toLowerCase();
    $('pattern-tables').innerHTML = D.patternPieces.map((piece) => {
      const all = state.patterns[piece.code] || [];
      const rows = all.filter((p) => !q || p.id.toLowerCase().includes(q) || (p.name || '').toLowerCase().includes(q));
      const unlocked = all.filter((p) => p.unlocked).length;
      const unused = all.filter((p) => p.unlocked && !p.used).length;
      return `<h3>${esc(piece.label)} (${piece.code}) <small class="meta">· ${unlocked} unlocked, ${unused} unused</small></h3>
        <table class="ptable">
          <thead><tr><th>ID</th><th>Name / note</th><th class="c">Unlocked</th><th class="c">Used</th><th class="c"><span class="sr">Remove</span></th></tr></thead>
          <tbody>${rows.map((p) => `
            <tr>
              <td>${esc(p.id)}</td>
              <td><input type="text" aria-label="Name for ${esc(p.id)}" data-piece="${piece.code}" data-pid="${esc(p.id)}" data-field="name" value="${esc(p.name)}"></td>
              <td class="c"><input type="checkbox" aria-label="${esc(p.id)} unlocked" data-piece="${piece.code}" data-pid="${esc(p.id)}" data-field="unlocked" ${p.unlocked ? 'checked' : ''}></td>
              <td class="c"><input type="checkbox" aria-label="${esc(p.id)} used" data-piece="${piece.code}" data-pid="${esc(p.id)}" data-field="used" ${p.used ? 'checked' : ''}></td>
              <td class="c"><button class="btn link small" type="button" aria-label="Remove ${esc(p.id)}" data-remove="${esc(p.id)}" data-piece="${piece.code}">✕</button></td>
            </tr>`).join('') || '<tr><td colspan="5" class="hint">No patterns match.</td></tr>'}
          </tbody>
        </table>
        <form class="add-row" data-add="${piece.code}">
          <label>New ID <input type="text" name="id" placeholder="${piece.code}${String(all.length + 1).padStart(2, '0')}" autocomplete="off"></label>
          <label>Name <input type="text" name="name" placeholder="optional" autocomplete="off"></label>
          <button class="btn secondary small" type="submit">Add</button>
        </form>`;
    }).join('');
  }

  function bindPatterns() {
    $('pattern-search').addEventListener('input', renderPatterns);
    const box = $('pattern-tables');
    box.addEventListener('change', (e) => {
      const el = e.target;
      if (!el.dataset.field) return;
      const p = state.patterns[el.dataset.piece].find((x) => x.id === el.dataset.pid);
      if (!p) return;
      p[el.dataset.field] = el.type === 'checkbox' ? el.checked : el.value.trim();
      save();
      if (el.type === 'checkbox') { renderPatterns(); renderNoticeForPools(); renderSlots(); }
    });
    box.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-remove]');
      if (!btn || !confirm(`Remove ${btn.dataset.remove}?`)) return;
      const list = state.patterns[btn.dataset.piece];
      list.splice(list.findIndex((x) => x.id === btn.dataset.remove), 1);
      save(); renderPatterns(); renderNoticeForPools();
    });
    box.addEventListener('submit', (e) => {
      e.preventDefault();
      const form = e.target;
      const code = form.dataset.add;
      const list = state.patterns[code];
      const id = (form.elements.id.value.trim() || form.elements.id.placeholder).toUpperCase();
      if (list.some((x) => x.id === id)) { alert(`${id} already exists.`); return; }
      list.push({ id, name: form.elements.name.value.trim(), unlocked: true, used: false });
      save(); renderPatterns(); renderNoticeForPools();
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
    renderForm();
    renderToggles();
    renderSlots();
    renderSummary();
    renderLog();
    renderPatterns();
    renderPast();
    renderNoticeForPools();
  }

  $('btn-spin').addEventListener('click', spinBoth);
  bindForm();
  bindToggles();
  bindSlots();
  bindReroll();
  bindChoose();
  bindSummary();
  bindPast();
  bindPatterns();
  bindData();
  renderAll();
})();
