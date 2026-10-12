// Run with: node --test
const test = require('node:test');
const assert = require('node:assert');
const D = require('../js/data.js');
const R = require('../js/roulette.js');

function patterns({ unlocked = true, used = false } = {}) {
  const out = {};
  for (const p of D.patternPieces) {
    out[p.code] = [1, 2, 3].map((n) => ({ id: `${p.code}0${n}`, name: '', unlocked, used }));
  }
  return out;
}

function ctx(overrides = {}) {
  return Object.assign({
    enabled: { colour: true, fabric: true, accessory: true, detail: true, pattern: true },
    colours: D.colours.map((c) => c.name),
    neutralsAllowed: true,
    patterns: patterns(),
  }, overrides);
}

const RUNS = 2000;

test('Edith carrot: Colour disabled never produces a Colour result', () => {
  const c = ctx({ enabled: { colour: false, fabric: true, accessory: true, detail: true, pattern: true } });
  for (let i = 0; i < RUNS; i++) {
    const a = R.rollSlot(c, null).result;
    const b = R.rollSlot(c, a).result;
    assert.notStrictEqual(a.category, 'colour');
    assert.notStrictEqual(b.category, 'colour');
  }
});

test('same category twice is possible, but never the exact same challenge', () => {
  const c = ctx();
  let sameCategory = 0;
  for (let i = 0; i < RUNS; i++) {
    const a = R.rollSlot(c, null).result;
    const b = R.rollSlot(c, a).result;
    assert.notStrictEqual(a.key, b.key);
    if (a.category === b.category) sameCategory++;
  }
  assert.ok(sameCategory > 0, 'expected at least one double-category result');
});

test('exact duplicate is flagged when no distinct option exists', () => {
  const c = ctx({ enabled: { colour: false, fabric: false, accessory: false, detail: false, pattern: true },
    patterns: { BO: [{ id: 'BO01', unlocked: true, used: true }], CO: [], SL: [], SK: [] } });
  // Only two outcomes exist: random BO01, or choose-unused BO (none left).
  const a = R.rollSlot(c, null).result;
  const b = R.rollSlot(c, a).result;
  assert.notStrictEqual(a.key, b.key);
  const c2 = R.rollSlot(c, b).result;
  assert.notStrictEqual(c2.key, b.key);
});

test('accessories need at least three; line trims need three areas', () => {
  for (let i = 0; i < RUNS; i++) {
    const r = R.rollCategory('accessory', ctx());
    assert.match(r.result, /3/);
    if (r.subtype === 'Lace Trim' || r.subtype === 'Trim') assert.match(r.result, /3 distinct areas/);
    if (r.subtype === 'Bow') assert.strictEqual(r.result, 'At least 3 bows');
  }
});

test('Burlap never appears', () => {
  for (let i = 0; i < RUNS; i++) {
    const r = R.rollCategory('fabric', ctx());
    assert.doesNotMatch(JSON.stringify(r), /burlap/i);
  }
});

test('Random Pattern picks an exact unlocked ID; Choose Unused leaves it to the user', () => {
  const c = ctx();
  c.patterns.SK[0].unlocked = false;
  let sawRandom = false;
  let sawUnused = false;
  for (let i = 0; i < RUNS; i++) {
    const r = R.rollCategory('pattern', c);
    if (r.mode === 'random') {
      sawRandom = true;
      assert.notStrictEqual(r.choice, 'SK01');
      assert.ok(c.patterns[r.piece].some((p) => p.id === r.choice && p.unlocked));
    } else {
      sawUnused = true;
      assert.strictEqual(r.choice, null);
      assert.strictEqual(r.needsChoice, true);
    }
  }
  assert.ok(sawRandom && sawUnused);
});

test('Choose Unused excludes used and locked patterns, and offers conversion when none left', () => {
  const c = ctx();
  c.patterns.BO[0].used = true;
  c.patterns.BO[1].unlocked = false;
  assert.deepStrictEqual(R.unusedPatterns(c, 'BO').map((p) => p.id), ['BO03']);
  c.patterns.BO[2].used = true;
  assert.strictEqual(R.unusedPatterns(c, 'BO').length, 0);
  const converted = R.convertToRandom({ piece: 'BO' }, c);
  assert.strictEqual(converted.mode, 'random');
  assert.strictEqual(converted.choice, 'BO01');
});

test('empty pools give an explanation instead of a result', () => {
  const none = R.rollSlot(ctx({ enabled: {} }), null);
  assert.ok(none.error);
  assert.ok(!none.result);
  const noColours = R.rollSlot(ctx({ colours: [], enabled: { colour: true } }), null);
  assert.match(noColours.error, /no colours/i);
  const noPatterns = R.rollSlot(ctx({ enabled: { pattern: true }, patterns: patterns({ unlocked: false }) }), null);
  assert.match(noPatterns.error, /unlocked/i);
});

test('two-colour rules never repeat the same colour', () => {
  for (let i = 0; i < RUNS; i++) {
    const r = R.rollCategory('colour', ctx());
    const [, , c1, c2] = r.key.split('|');
    if (c2) assert.notStrictEqual(c1, c2);
  }
  const single = ctx({ colours: ['Orange'] });
  for (let i = 0; i < 200; i++) assert.ok(!R.rollCategory('colour', single).key.endsWith('|Orange|Orange'));
});

test('every result has the structured fields', () => {
  for (const cat of D.categories) {
    const r = R.rollCategory(cat.id, ctx());
    for (const f of ['category', 'subtype', 'result', 'constraints', 'timestamp', 'rerollReason']) {
      assert.ok(f in r, `${cat.id} missing ${f}`);
    }
  }
});

test('randInt is roughly uniform', () => {
  const counts = [0, 0, 0, 0, 0];
  for (let i = 0; i < 50000; i++) counts[R.randInt(5)]++;
  for (const n of counts) assert.ok(n > 9000 && n < 11000, `skewed: ${counts}`);
});
