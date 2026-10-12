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
      if (r.choice) {
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
        : 'Save this commission to your past commissions and start a new one?\n\n(Patterns are only marked used if you pressed "Mark pattern as used".)';
      if (!confirm(msg)) return;
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
    renderForm();
    renderToggles();
    renderSlots();
    renderSummary();
    renderLog();
    renderFriends();
    renderLibrary();
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
  bindFriends();
  bindLibrary();
  bindData();
  renderAll();
})();
