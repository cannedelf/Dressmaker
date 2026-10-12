// Run with: node --test
const test = require('node:test');
const assert = require('node:assert');
const D = require('../js/data.js');
const R = require('../js/roulette.js');
const P = require('../js/patterns.js');

function pool(friendships = {}, progress = {}) {
  return R.buildPatternPool(friendships, progress);
}

function ctx(overrides = {}) {
  return Object.assign({
    enabled: { colour: true, fabric: true, accessory: true, detail: true, pattern: true },
    colours: D.colours.map((c) => c.name),
    neutralsAllowed: true,
    patternPool: pool(),
    includeNone: false,
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

test('exact duplicate is redrawn even when only a couple of outcomes exist', () => {
  const only = pool({}, {}).map((p) => ((p.id === 'bodice:princess-bodice') ? p : Object.assign({}, p, { unlocked: false })));
  only.find((p) => p.id === 'bodice:princess-bodice').used = true;
  // Only two outcomes exist: Random -> Princess Bodice, or Choose Unused (falls back to the same Random).
  const c = ctx({ enabled: { pattern: true }, patternPool: only });
  const a = R.rollSlot(c, null).result;
  const b = R.rollSlot(c, a).result;
  assert.strictEqual(a.key, b.key);
  assert.strictEqual(b.duplicate, true, 'identical result must be flagged, not silently accepted');
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

test('empty pools give an explanation instead of a result', () => {
  const none = R.rollSlot(ctx({ enabled: {} }), null);
  assert.ok(none.error);
  assert.ok(!none.result);
  const noColours = R.rollSlot(ctx({ colours: [], enabled: { colour: true } }), null);
  assert.match(noColours.error, /no colours/i);
  const allLocked = Object.fromEntries(P.patterns.map((p) => [p.id, { unlockOverride: 'locked' }]));
  const noPatterns = R.rollSlot(ctx({ enabled: { pattern: true }, patternPool: pool({}, allLocked) }), null);
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
