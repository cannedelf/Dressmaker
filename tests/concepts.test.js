// Concept collection, no-repeat rolls and the v3 save migration. Run with: node --test
const test = require('node:test');
const assert = require('node:assert');
const D = require('../js/data.js');
const R = require('../js/roulette.js');
const S = require('../js/state.js');

const pool = () => S.toConceptItems(D.concepts);
const byText = (p, t) => p.find((c) => c.text === t);

test('default pool keeps the exact concept strings with unique stable IDs', () => {
  const p = pool();
  assert.deepStrictEqual(p.map((c) => c.text), D.concepts);
  assert.strictEqual(new Set(p.map((c) => c.id)).size, p.length);
  assert.deepStrictEqual(pool().map((c) => c.id), p.map((c) => c.id), 'IDs are the same every time');
});

test('used concepts are never rolled; the rest still can be', () => {
  const p = pool();
  const sunflower = byText(p, 'Botanical: Sunflower');
  const used = { [sunflower.id]: { usedAt: 'x' } };
  const seen = new Set();
  for (let i = 0; i < 5000; i++) {
    const { concept } = R.rollConcept(p, used);
    assert.notStrictEqual(concept.id, sunflower.id);
    seen.add(concept.id);
  }
  assert.strictEqual(seen.size, p.length - 1);
});

test('all used → clear message, no result, nothing reset', () => {
  const p = pool();
  const used = Object.fromEntries(p.map((c) => [c.id, { usedAt: 'x' }]));
  const out = R.rollConcept(p, used);
  assert.ok(!out.concept);
  assert.match(out.error, /All concepts have been used!/);
  assert.strictEqual(Object.keys(used).length, p.length);
});

test('commission concepts only match pool entries exactly', () => {
  const p = pool();
  assert.strictEqual(R.matchConcept(p, 'Sunflower').text, 'Botanical: Sunflower');
  assert.strictEqual(R.matchConcept(p, '  botanical:  sunflower ').text, 'Botanical: Sunflower');
  assert.strictEqual(R.matchConcept(p, 'Sun'), null);
  assert.strictEqual(R.matchConcept(p, 'Carrot'), null);
  assert.strictEqual(R.matchConcept(p, 'Sunflower dress'), null);
  assert.strictEqual(R.matchConcept(p, ''), null);
});

test('renaming keeps the ID (and so the Used status); other statuses survive edits', () => {
  const s = S.defaultState();
  const sun = byText(s.conceptPool, 'Botanical: Sunflower');
  const bee = byText(s.conceptPool, 'Animal: Bumblebee');
  s.usedConcepts[sun.id] = { usedAt: '2026-10-12', by: 'Edith' };
  s.usedConcepts[bee.id] = { usedAt: '2026-10-12', by: 'Adora' };
  sun.text = 'Botanical: Giant Sunflower';
  s.conceptPool = s.conceptPool.filter((c) => c.text !== 'Food: Lemon tart');
  const again = S.normalise(JSON.parse(JSON.stringify(s)));
  assert.strictEqual(byText(again.conceptPool, 'Botanical: Giant Sunflower').id, sun.id);
  assert.ok(again.usedConcepts[sun.id]);
  assert.ok(again.usedConcepts[bee.id]);
  assert.ok(!R.eligibleConcepts(again.conceptPool, again.usedConcepts).some((c) => c.id === sun.id));
});

test('v2 save migrates: strings backed up, nothing marked used, everything else kept', () => {
  const v2 = {
    version: 2,
    commission: { customer: 'Edith', hasConcept: false, rolledConcept: 'Animal: Fox' },
    conceptPool: ['Animal: Fox', 'Place: Seaside'],
    friendships: { Edith: 3 },
    patternProgress: { 'bodice:corset-bodice': { used: true, unlockOverride: 'auto', notes: '' } },
    past: [{ commission: { customer: 'Adora', rolledConcept: 'Place: Seaside' }, results: [null, null] }],
    log: [{ action: 'Concept', result: 'Animal: Fox' }],
  };
  const s = S.normalise(JSON.parse(JSON.stringify(v2)));
  assert.strictEqual(s.version, 3);
  assert.deepStrictEqual(s.conceptPoolBackup, v2.conceptPool);
  assert.deepStrictEqual(s.conceptPool.map((c) => c.text), v2.conceptPool);
  assert.deepStrictEqual(s.usedConcepts, {}, 'no bulk marking');
  assert.strictEqual(s.commission.rolledConceptId, byText(s.conceptPool, 'Animal: Fox').id);
  assert.strictEqual(s.friendships.Edith, 3);
  assert.strictEqual(s.patternProgress['bodice:corset-bodice'].used, true);
  assert.strictEqual(s.past[0].commission.rolledConcept, 'Place: Seaside');
  assert.strictEqual(s.chapter, 1);
  assert.strictEqual(s.practice, false);
  // Loading the migrated save again doesn't change IDs or overwrite the backup.
  const again = S.normalise(JSON.parse(JSON.stringify(s)));
  assert.deepStrictEqual(again.conceptPool, s.conceptPool);
  assert.deepStrictEqual(again.conceptPoolBackup, v2.conceptPool);
});

test('chapter and practice persist and are sanitised', () => {
  assert.strictEqual(S.normalise({ chapter: 4, practice: true }).chapter, 4);
  assert.strictEqual(S.normalise({ chapter: 4, practice: true }).practice, true);
  assert.strictEqual(S.normalise({ chapter: 0 }).chapter, 1);
  assert.strictEqual(S.normalise({ chapter: 'abc' }).chapter, 1);
});
