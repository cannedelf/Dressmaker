// October 2026 concept pool update. Run with: node --test
const test = require('node:test');
const assert = require('node:assert');
const D = require('../js/data.js');
const R = require('../js/roulette.js');
const S = require('../js/state.js');

// The default pool as it was before this update (31 concepts).
const ORIGINAL_31 = [
  'Food: Strawberry', 'Food: Lemon tart', 'Food: Blueberry', 'Food: Macaron', 'Food: Honeycomb',
  'Animal: Bumblebee', 'Animal: Peacock', 'Animal: Fox', 'Animal: Jellyfish', 'Animal: Swan',
  'Botanical: Rose garden', 'Botanical: Wisteria', 'Botanical: Mushroom', 'Botanical: Sunflower', 'Botanical: Ivy',
  'Celestial: Starry night', 'Celestial: Sunrise', 'Celestial: Moon phases', 'Celestial: Comet',
  'Storybook: Fairy queen', 'Storybook: Little Red', 'Storybook: Mermaid', "Storybook: Witch's apprentice",
  'Object: Teacup', 'Object: Stained glass', 'Object: Music box', 'Object: Candle',
  'Place: Seaside', 'Place: Autumn forest', 'Place: Carnival', 'Place: Snowy village',
];
const NEW_14 = [
  'Food: Cake', 'Animal: Butterfly', 'Animal: Spider', 'Storybook: Harlequin', 'Storybook: Knight',
  'Object: Clockwork', 'Object: Playing cards', 'Place: Coral reef',
  'Holiday: Christmas', 'Holiday: Halloween', "Holiday: Valentine's Day", 'Holiday: Easter',
  'Artistic Style: Art Nouveau', 'Artistic Style: Art Deco',
];
const texts = (s) => s.conceptPool.map((c) => c.text);
const count = (s, t) => texts(s).filter((x) => x === t).length;

// An existing v3 save made before the update, with progress and a custom concept.
function oldSave() {
  const s = S.defaultState();
  s.version = 3;
  delete s.conceptUpdates;
  s.conceptPool = S.toConceptItems(ORIGINAL_31.concat(['Custom: Carrot']));
  const id = (t) => s.conceptPool.find((c) => c.text === t).id;
  s.usedConcepts = {
    [id('Object: Teacup')]: { usedAt: '2026-10-01T10:00:00Z', by: 'Rose' },
    [id('Object: Music box')]: { usedAt: '2026-10-02T10:00:00Z', by: 'Alice' },
    [id('Botanical: Sunflower')]: { usedAt: '2026-10-03T10:00:00Z', by: 'Priya' },
  };
  s.past = [{ commission: { customer: 'Alice', rolledConcept: 'Object: Music box' }, conceptMarkedUsed: id('Object: Music box'), results: [null, null] }];
  s.chapter = 2;
  s.friendships.Edith = 3;
  return JSON.parse(JSON.stringify(s));
}

test('1. a new user has exactly 44 unique default concepts', () => {
  const s = S.defaultState();
  assert.strictEqual(s.conceptPool.length, 44);
  assert.strictEqual(new Set(texts(s)).size, 44);
  assert.strictEqual(new Set(s.conceptPool.map((c) => c.id)).size, 44);
  assert.deepStrictEqual(texts(S.normalise(undefined)).sort(), texts(s).sort());
  for (const t of NEW_14) assert.strictEqual(count(s, t), 1, t);
  assert.ok(!texts(s).some((t) => /moth/i.test(t)));
  assert.ok(!texts(s).some((t) => /the starry night|the kiss/i.test(t)));
});

test('2. existing users get the new defaults and keep custom concepts and progress', () => {
  const s = S.normalise(oldSave());
  for (const t of NEW_14) assert.strictEqual(count(s, t), 1, t);
  assert.strictEqual(count(s, 'Custom: Carrot'), 1);
  assert.strictEqual(s.conceptPool.length, 45); // 44 defaults + 1 custom
  const sun = s.conceptPool.find((c) => c.text === 'Botanical: Sunflower');
  assert.strictEqual(s.usedConcepts[sun.id].by, 'Priya');
  assert.strictEqual(s.past[0].commission.rolledConcept, 'Object: Music box');
  assert.strictEqual(s.chapter, 2);
  assert.strictEqual(s.friendships.Edith, 3);
  assert.deepStrictEqual(s.conceptUpdates, ['2026-10-concept-pool']);
});

test('3 & 4. Music box and Teacup are gone; Porcelain appears once and keeps Teacup\'s Used status', () => {
  for (const s of [S.defaultState(), S.normalise(oldSave())]) {
    assert.strictEqual(count(s, 'Object: Music box'), 0);
    assert.strictEqual(count(s, 'Object: Teacup'), 0);
    assert.strictEqual(count(s, 'Object: Porcelain'), 1);
  }
  const s = S.normalise(oldSave());
  const porcelain = s.conceptPool.find((c) => c.text === 'Object: Porcelain');
  assert.strictEqual(s.usedConcepts[porcelain.id].by, 'Rose');
  // The removed Music box keeps its historical record.
  assert.ok(Object.values(s.usedConcepts).some((u) => u.by === 'Alice'));
});

test('5. Mermaid appears once, for new and existing users', () => {
  assert.strictEqual(count(S.defaultState(), 'Storybook: Mermaid'), 1);
  assert.strictEqual(count(S.normalise(oldSave()), 'Storybook: Mermaid'), 1);
});

test('the update runs once: deleting a new concept afterwards sticks, and reloads change nothing', () => {
  const s = S.normalise(oldSave());
  s.conceptPool = s.conceptPool.filter((c) => c.text !== 'Holiday: Easter');
  const again = S.normalise(JSON.parse(JSON.stringify(s)));
  assert.strictEqual(count(again, 'Holiday: Easter'), 0);
  assert.deepStrictEqual(again.conceptPool, s.conceptPool);
  assert.deepStrictEqual(again.usedConcepts, s.usedConcepts);
});

test('a Teacup the player renamed themselves is left alone; Porcelain is still added', () => {
  const save = oldSave();
  save.conceptPool.find((c) => c.text === 'Object: Teacup').text = 'Object: Tea party';
  const s = S.normalise(save);
  assert.strictEqual(count(s, 'Object: Tea party'), 1);
  assert.strictEqual(count(s, 'Object: Porcelain'), 1);
});

test('old v2 saves (plain strings) also update, keeping their backup', () => {
  const s = S.normalise({ version: 2, conceptPool: ORIGINAL_31.slice() });
  assert.strictEqual(s.conceptPool.length, 44);
  assert.deepStrictEqual(s.conceptPoolBackup, ORIGINAL_31);
});

test('6 & 7. all four holidays and both artistic styles can roll, whatever the date', () => {
  const RealDate = Date;
  const wanted = NEW_14.filter((t) => /^(Holiday|Artistic Style):/.test(t));
  for (const iso of ['2026-01-15T12:00:00Z', '2026-07-04T12:00:00Z', '2026-12-25T12:00:00Z']) {
    global.Date = class extends RealDate { constructor(...a) { super(...(a.length ? a : [iso])); } static now() { return new RealDate(iso).getTime(); } };
    try {
      const pool = S.defaultState().conceptPool;
      const seen = new Set();
      for (let i = 0; i < 4000; i++) seen.add(R.rollConcept(pool, {}).concept.text);
      for (const t of wanted) assert.ok(seen.has(t), `${t} on ${iso}`);
    } finally {
      global.Date = RealDate;
    }
  }
});

test('10. completed concepts still never repeat after the update', () => {
  const s = S.normalise(oldSave());
  const used = new Set(Object.keys(s.usedConcepts));
  for (let i = 0; i < 3000; i++) assert.ok(!used.has(R.rollConcept(s.conceptPool, s.usedConcepts).concept.id));
});
