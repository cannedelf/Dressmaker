// Colour pool: the 11 wiki fabric colour categories. Run with: node --test
const test = require('node:test');
const assert = require('node:assert');
const D = require('../js/data.js');
const R = require('../js/roulette.js');
const S = require('../js/state.js');

const OFFICIAL = ['Blue', 'Green', 'Pink', 'Purple', 'Red', 'Yellow', 'Orange', 'Black', 'White', 'Grey', 'Brown'];
const RUNS = 3000;

function ctx(colours) {
  return { enabled: { colour: true }, colours, neutralsAllowed: true, patternPool: [], includeNone: false };
}

// Every colour named in a result, read back from its duplicate-check key: colour|use|c1|c2
function coloursIn(r) {
  const [, , c1, c2] = r.key.split('|');
  return [c1, c2].filter(Boolean);
}

test('pool and settings use exactly the 11 wiki colours', () => {
  assert.deepStrictEqual(D.colours.map((c) => c.name).sort(), OFFICIAL.slice().sort());
  assert.deepStrictEqual(Object.keys(S.defaultState().colours).sort(), OFFICIAL.slice().sort());
  for (const gone of ['Teal', 'Gold', 'Cream', 'Mint', 'Lilac', 'Burgundy', 'Navy']) {
    assert.ok(!D.colours.some((c) => c.name === gone), gone);
  }
});

test('every colour challenge, including second colours, only uses the 11', () => {
  const seenUses = new Set();
  for (let i = 0; i < RUNS; i++) {
    const r = R.rollCategory('colour', ctx(OFFICIAL));
    seenUses.add(r.subtype);
    for (const c of coloursIn(r)) assert.ok(OFFICIAL.includes(c), c);
  }
  assert.strictEqual(seenUses.size, D.colourUses.length);
});

test('disabled colours never appear, including in secondary spins', () => {
  const enabled = ['Blue', 'Pink', 'Black'];
  for (let i = 0; i < RUNS; i++) {
    const r = R.rollCategory('colour', ctx(enabled));
    for (const c of coloursIn(r)) assert.ok(enabled.includes(c), `${c} is disabled`);
  }
});

test('two-colour challenges always pick two different colours', () => {
  for (let i = 0; i < RUNS; i++) {
    const r = R.rollCategory('colour', ctx(['Red', 'Green']));
    const cs = coloursIn(r);
    if (cs.length === 2) assert.notStrictEqual(cs[0], cs[1]);
  }
});

test('with one colour enabled, two-colour challenges are excluded', () => {
  for (let i = 0; i < RUNS; i++) {
    const r = R.rollCategory('colour', ctx(['Orange']));
    assert.ok(!['Two-colour challenge', 'Contrast challenge'].includes(r.subtype), r.subtype);
    assert.deepStrictEqual(coloursIn(r), ['Orange']);
  }
});

test('old saves drop retired colours but keep choices for the 11', () => {
  const s = S.normalise({ colours: { Teal: true, Cream: false, Red: false, Blue: true } });
  assert.deepStrictEqual(Object.keys(s.colours).sort(), OFFICIAL.slice().sort());
  assert.strictEqual(s.colours.Red, false);
  assert.strictEqual(s.colours.Blue, true);
  assert.strictEqual(s.colours.Green, true);
});
