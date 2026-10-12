// Pattern library, friendship unlocks and Pattern Piece rolls. Run with: node --test
const test = require('node:test');
const assert = require('node:assert');
const P = require('../js/patterns.js');
const R = require('../js/roulette.js');
const S = require('../js/state.js');

const RUNS = 1500;
const zero = S.defaultFriendships();
const byName = (part, name) => P.patterns.find((p) => p.part === part && p.name === name);
const unlockedNames = (friendships, progress = {}) =>
  new Set(R.buildPatternPool(friendships, progress).filter((p) => p.unlocked).map((p) => `${p.part}:${p.name}`));

function ctx(friendships = zero, progress = {}, extra = {}) {
  return Object.assign({
    enabled: { pattern: true },
    colours: [],
    neutralsAllowed: true,
    patternPool: R.buildPatternPool(friendships, progress),
    includeNone: false,
  }, extra);
}

function counts(friendships, progress) {
  const out = {};
  for (const p of R.buildPatternPool(friendships, progress)) {
    if (!p.none && p.unlocked) out[p.part] = (out[p.part] || 0) + 1;
  }
  return out;
}

test('library has 155 numbered patterns with unique, namespaced IDs', () => {
  const numbered = P.patterns.filter((p) => !p.none);
  assert.strictEqual(numbered.length, 155);
  const per = {};
  for (const p of numbered) per[p.part] = (per[p.part] || 0) + 1;
  assert.deepStrictEqual(per, { bodice: 59, skirt: 46, sleeve: 30, collar: 20 });
  const ids = P.patterns.map((p) => p.id);
  assert.strictEqual(new Set(ids).size, ids.length);
  for (const p of P.patterns) assert.ok(p.id.startsWith(`${p.part}:`), p.id);
});

test('1. fresh Run 2: 14 bodices, 10 skirts, 8 sleeves, 6 collars unlocked; all clients at 0', () => {
  const fresh = S.defaultState();
  assert.strictEqual(Object.keys(fresh.friendships).length, 10);
  assert.ok(Object.values(fresh.friendships).every((n) => n === 0));
  assert.deepStrictEqual(counts(fresh.friendships, fresh.patternProgress), { bodice: 14, skirt: 10, sleeve: 8, collar: 6 });
});

test('2 & 3. Edith 1 star unlocks Corset Bodice/Skirt and Slit Sleeve; Whirlpool Collar waits for star 3', () => {
  const at0 = unlockedNames(zero);
  const at1 = unlockedNames(Object.assign({}, zero, { Edith: 1 }));
  const added = [...at1].filter((x) => !at0.has(x)).sort();
  assert.deepStrictEqual(added, ['bodice:Corset Bodice', 'skirt:Corset Skirt', 'sleeve:Slit Sleeve']);
  assert.ok(!at1.has('collar:Whirlpool Collar'));
  const at3 = unlockedNames(Object.assign({}, zero, { Edith: 3 }));
  for (const n of ['collar:Whirlpool Collar', 'bodice:Corset Bodice', 'bodice:Gatsby Bodice', 'bodice:Queen Anne Bodice', 'skirt:Koi Skirt', 'sleeve:Tiered Sleeves']) {
    assert.ok(at3.has(n), n);
  }
  assert.ok(!at3.has('collar:Dagger Collar'));
});

test('4. Vivian 4 stars unlocks Gothic Collar and both star-4 sleeves', () => {
  const at3 = unlockedNames(Object.assign({}, zero, { Vivian: 3 }));
  const at4 = unlockedNames(Object.assign({}, zero, { Vivian: 4 }));
  const added = [...at4].filter((x) => !at3.has(x)).sort();
  assert.deepStrictEqual(added, ["collar:Gothic Collar", "sleeve:Angel's Trumpet Sleeve", 'sleeve:Arwen Sleeve']);
});

test('5. friendship never marks Used; Used never changes Unlocked', () => {
  const max = Object.fromEntries(P.CLIENTS.map((c) => [c, 5]));
  assert.ok(R.buildPatternPool(max, {}).every((p) => !p.used));
  const corset = byName('bodice', 'Corset Bodice');
  const locked = R.buildPatternPool(zero, { [corset.id]: { used: true } }).find((p) => p.id === corset.id);
  assert.strictEqual(locked.unlocked, false);
  assert.strictEqual(locked.used, true);
});

test('6. Random Bodice never picks a locked pattern and can pick a used one', () => {
  const allUsed = Object.fromEntries(P.patterns.map((p) => [p.id, { used: true }]));
  const c = ctx(zero, allUsed);
  const unlocked = new Set(c.patternPool.filter((p) => p.unlocked).map((p) => p.id));
  let random = 0;
  for (let i = 0; i < RUNS; i++) {
    const r = R.rollCategory('pattern', c);
    assert.strictEqual(r.mode, 'random'); // nothing unused, so Choose Unused falls back
    assert.ok(unlocked.has(r.choice), r.choice);
    if (r.part === 'bodice') random++;
  }
  assert.ok(random > 0);
});

test('7. Choose Unused presents eligible unused patterns and never picks one itself', () => {
  const pencil = byName('skirt', 'Pencil Skirt');
  const c = ctx(zero, { [pencil.id]: { used: true } });
  let seen = false;
  for (let i = 0; i < RUNS; i++) {
    const r = R.rollCategory('pattern', c);
    if (r.mode !== 'unused') continue;
    seen = true;
    assert.strictEqual(r.choice, null);
    assert.strictEqual(r.needsChoice, true);
  }
  assert.ok(seen);
  const options = R.unusedPatterns(c, 'skirt').map((p) => p.name);
  assert.strictEqual(options.length, 9);
  assert.ok(!options.includes('Pencil Skirt'));
  assert.ok(!options.includes('Corset Skirt')); // locked
});

test('8. no unused unlocked sleeves → Choose Unused visibly falls back to Random', () => {
  const sleevesUsed = Object.fromEntries(P.patterns.filter((p) => p.part === 'sleeve').map((p) => [p.id, { used: true }]));
  const c = ctx(zero, sleevesUsed);
  let fallbacks = 0;
  for (let i = 0; i < RUNS; i++) {
    const r = R.rollCategory('pattern', c);
    if (r.part !== 'sleeve') continue;
    assert.strictEqual(r.mode, 'random');
    if (r.note) {
      assert.match(r.note, /fell back to Random Pattern/);
      fallbacks++;
    }
  }
  assert.ok(fallbacks > 0);
});

test('9. No Sleeves / No Collar are separate and excluded from rolls unless opted in', () => {
  const none = P.patterns.filter((p) => p.none).map((p) => p.name).sort();
  assert.deepStrictEqual(none, ['No Collar', 'No Sleeves']);
  const c = ctx();
  for (let i = 0; i < RUNS; i++) {
    const r = R.rollCategory('pattern', c);
    assert.ok(!/^No (Sleeves|Collar)$/.test(r.choiceName || ''));
  }
  assert.ok(!R.unusedPatterns(c, 'sleeve').some((p) => p.none));
  const withNone = ctx(zero, {}, { includeNone: true });
  assert.ok(R.unusedPatterns(withNone, 'sleeve').some((p) => p.name === 'No Sleeves'));
});

test('10. overrides beat friendship and survive a save/load round trip', () => {
  const corset = byName('bodice', 'Corset Bodice');
  const princess = byName('bodice', 'Princess Bodice');
  const saved = S.defaultState();
  saved.patternProgress[corset.id] = { used: false, unlockOverride: 'unlocked', notes: 'got it early' };
  saved.patternProgress[princess.id] = { used: false, unlockOverride: 'locked', notes: '' };
  const loaded = S.normalise(JSON.parse(JSON.stringify(saved)));
  const pool = R.buildPatternPool(loaded.friendships, loaded.patternProgress);
  assert.strictEqual(pool.find((p) => p.id === corset.id).unlocked, true);
  assert.strictEqual(pool.find((p) => p.id === princess.id).unlocked, false);
  assert.strictEqual(loaded.patternProgress[corset.id].notes, 'got it early');
});

test('empty part is skipped visibly; never an invalid ID', () => {
  const collarsLocked = Object.fromEntries(P.patterns.filter((p) => p.part === 'collar').map((p) => [p.id, { unlockOverride: 'locked' }]));
  const c = ctx(zero, collarsLocked);
  for (let i = 0; i < 300; i++) {
    const r = R.rollCategory('pattern', c);
    assert.notStrictEqual(r.part, 'collar');
    assert.match(r.note || '', /Not rolled \(no unlocked patterns\): Collar/);
    if (r.choice) assert.ok(P.patterns.some((p) => p.id === r.choice));
  }
});

test('12. v1 save migrates without losing commissions, settings or history', () => {
  const v1 = {
    version: 1,
    commission: { customer: 'Edith', hasConcept: true, conceptName: 'Carrot' },
    enabled: { colour: false, fabric: true, accessory: true, detail: true, pattern: true },
    colours: { Red: false },
    neutralsAllowed: false,
    patterns: { BO: [{ id: 'BO03', name: '', unlocked: true, used: true }] },
    conceptPool: ['Food: Carrot'],
    slots: [
      { current: { category: 'pattern', categoryLabel: 'Pattern Piece', piece: 'BO', mode: 'random', choice: 'BO03', result: 'Bodice: BO03', key: 'x', constraints: [] }, locked: true, attempts: 2 },
      { current: null, locked: false, attempts: 0 },
    ],
    log: [{ action: 'Spin', result: 'Bodice: BO03' }],
    past: [{ commission: { customer: 'Adora' }, results: [null, null] }],
  };
  const s = S.normalise(JSON.parse(JSON.stringify(v1)));
  assert.strictEqual(s.version, S.SCHEMA_VERSION);
  assert.strictEqual(s.commission.customer, 'Edith');
  assert.strictEqual(s.commission.conceptName, 'Carrot');
  assert.strictEqual(s.enabled.colour, false);
  assert.strictEqual(s.colours.Red, false);
  assert.strictEqual(s.neutralsAllowed, false);
  assert.deepStrictEqual(s.conceptPool, ['Food: Carrot']);
  assert.strictEqual(s.past.length, 1);
  assert.strictEqual(s.log.length, 1);
  assert.strictEqual(s.slots[0].locked, true);
  assert.strictEqual(s.slots[0].current.result, 'Bodice: BO03');
  assert.strictEqual(s.slots[0].current.legacy, true);
  assert.deepStrictEqual(s.legacyPatterns, v1.patterns);
  assert.ok(!('patterns' in s));
  assert.ok(Object.values(s.friendships).every((n) => n === 0));
  // Re-normalising a v2 save keeps friendships and doesn't touch legacy data.
  s.friendships.Edith = 3;
  const again = S.normalise(JSON.parse(JSON.stringify(s)));
  assert.strictEqual(again.friendships.Edith, 3);
  assert.deepStrictEqual(again.legacyPatterns, v1.patterns);
});

test('friendship stars are clamped to 0..5', () => {
  const s = S.normalise({ friendships: { Rose: 9, Edith: -2, Alice: '3' } });
  assert.strictEqual(s.friendships.Rose, 5);
  assert.strictEqual(s.friendships.Edith, 0);
  assert.strictEqual(s.friendships.Alice, 3);
});
