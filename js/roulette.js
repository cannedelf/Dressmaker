/*
 * Fashion Roulette — rolling rules. No DOM code here, so it can be tested in Node.
 *
 * ctx = {
 *   enabled: { colour: true, ... },        // category toggles
 *   colours: ['Red', ...],                 // eligible colour names
 *   neutralsAllowed: true,
 *   patterns: { BO: [{ id, name, unlocked, used }], ... },
 * }
 */
(function (root) {
  const D = (typeof module !== 'undefined' && module.exports) ? require('./data.js') : root.FR_DATA;
  const cryptoApi = root.crypto || (typeof require !== 'undefined' ? require('crypto').webcrypto : null);

  const COMMISSION_FIRST = 'Commission restrictions override the roulette.';
  const MAX_REDRAWS = 200;

  // Unbiased integer in [0, n) using the browser crypto API (rejection sampling).
  function randInt(n) {
    if (!Number.isInteger(n) || n <= 0) throw new Error('Cannot pick from an empty pool.');
    const range = 0x100000000;
    const limit = range - (range % n);
    const buf = new Uint32Array(1);
    let x;
    do {
      cryptoApi.getRandomValues(buf);
      x = buf[0];
    } while (x >= limit);
    return x % n;
  }

  function pick(arr) {
    return arr[randInt(arr.length)];
  }

  function fill(template, c, c2) {
    return template.replace(/\{c\}/g, c).replace(/\{c2\}/g, c2 || '');
  }

  function catLabel(id) {
    return D.categories.find((c) => c.id === id).label;
  }

  function fabricPool() {
    return D.fabricTypes.filter((f) => f.toLowerCase() !== 'burlap');
  }

  function pieceLabel(code) {
    return D.patternPieces.find((p) => p.code === code).label;
  }

  function unlockedPatterns(ctx, code) {
    return ((ctx.patterns && ctx.patterns[code]) || []).filter((p) => p.unlocked);
  }

  function unusedPatterns(ctx, code) {
    return unlockedPatterns(ctx, code).filter((p) => !p.used);
  }

  function patternLabel(p) {
    return p.name ? `${p.id} (${p.name})` : p.id;
  }

  // Why a category can't be rolled right now, or null if it can.
  function categoryProblem(id, ctx) {
    if (!ctx.enabled[id]) return null; // disabled is not a problem, just excluded
    switch (id) {
      case 'colour':
        return ctx.colours.length ? null : 'Colour is on, but no colours are eligible. Tick at least one colour.';
      case 'fabric':
        return fabricPool().length ? null : 'No fabric types are available.';
      case 'accessory':
        return D.accessories.length ? null : 'No accessory types are available.';
      case 'detail':
        return D.details.length ? null : 'No trim / detail challenges are available.';
      case 'pattern':
        return D.patternPieces.some((p) => unlockedPatterns(ctx, p.code).length)
          ? null
          : 'Pattern Piece is on, but no patterns are marked unlocked. Unlock some in the Pattern catalogue.';
      default:
        return 'Unknown category.';
    }
  }

  function eligibleCategories(ctx) {
    const eligible = [];
    const problems = [];
    for (const c of D.categories) {
      if (!ctx.enabled[c.id]) continue;
      const problem = categoryProblem(c.id, ctx);
      if (problem) problems.push({ category: c.id, message: problem });
      else eligible.push(c.id);
    }
    return { eligible, problems };
  }

  function makeResult(category, fields) {
    return Object.assign({
      id: `${Date.now().toString(36)}-${randInt(1e9).toString(36)}`,
      category,
      categoryLabel: catLabel(category),
      timestamp: new Date().toISOString(),
      rerollReason: null,
      constraints: [COMMISSION_FIRST],
    }, fields);
  }

  const rollers = {
    colour(ctx) {
      const pool = ctx.colours;
      const uses = D.colourUses.filter((u) => !u.needsSecond || pool.length >= 2);
      const use = pick(uses);
      const c = pick(pool);
      const c2 = use.needsSecond ? pick(pool.filter((x) => x !== c)) : null;
      const neutrals = ctx.neutralsAllowed
        ? 'Neutrals (white, cream, black, brown, grey) may support — only if the commission and this rule allow.'
        : 'No supporting neutrals this session.';
      return makeResult('colour', {
        subtype: use.label,
        result: fill(use.text, c, c2),
        rule: fill(use.rule, c, c2),
        constraints: [COMMISSION_FIRST, neutrals],
        key: `colour|${use.id}|${c}|${c2 || ''}`,
      });
    },

    fabric() {
      if (randInt(2) === 0) {
        const f = pick(fabricPool());
        return makeResult('fabric', {
          subtype: 'Fabric type',
          result: `Use ${f}`,
          rule: `${f} must have a meaningful, visible presence on the dress.`,
          constraints: [COMMISSION_FIRST, 'Required fabric percentages from the commission still take priority.'],
          key: `fabric|type|${f}`,
        });
      }
      const p = pick(D.printChallenges);
      return makeResult('fabric', {
        subtype: 'Print challenge',
        result: p.name,
        rule: p.rule,
        constraints: [COMMISSION_FIRST, 'Required fabric percentages from the commission still take priority.'],
        key: `fabric|print|${p.name}`,
      });
    },

    accessory() {
      const a = pick(D.accessories);
      return makeResult('accessory', a.line
        ? {
          subtype: a.name,
          result: `${a.name} on at least 3 distinct areas`,
          rule: `Decorate at least three distinct areas with ${a.plural} (e.g. hem, neckline, cuffs).`,
          key: `accessory|${a.name}`,
        }
        : {
          subtype: a.name,
          result: `At least 3 ${a.plural}`,
          rule: `Use at least three individual ${a.plural}, arranged deliberately — a line, motif, fan, cascade or focal point — not just scattered.`,
          key: `accessory|${a.name}`,
        });
    },

    detail() {
      const d = pick(D.details);
      return makeResult('detail', {
        subtype: 'Composition',
        result: d.name,
        rule: d.rule,
        key: `detail|${d.name}`,
      });
    },

    pattern(ctx) {
      const pieces = D.patternPieces.filter((p) => unlockedPatterns(ctx, p.code).length);
      const piece = pick(pieces);
      const mode = randInt(2) === 0 ? 'random' : 'unused';
      if (mode === 'random') return randomPatternResult(ctx, piece.code);
      const unused = unusedPatterns(ctx, piece.code);
      return makeResult('pattern', {
        subtype: `${piece.label} · Choose Unused`,
        piece: piece.code,
        mode: 'unused',
        result: `${piece.label}: you choose any unlocked, never-used pattern`,
        rule: unused.length
          ? `Pick one of your ${unused.length} unused ${piece.label.toLowerCase()} patterns. You choose — it isn't random.`
          : `There are no unused ${piece.label.toLowerCase()} patterns left. You can convert this to a Random Pattern.`,
        needsChoice: unused.length > 0,
        needsConversion: unused.length === 0,
        choice: null,
        key: `pattern|${piece.code}|unused`,
      });
    },
  };

  function randomPatternResult(ctx, code) {
    const label = pieceLabel(code);
    const pool = unlockedPatterns(ctx, code);
    if (!pool.length) return null;
    const p = pick(pool);
    return makeResult('pattern', {
      subtype: `${label} · Random Pattern`,
      piece: code,
      mode: 'random',
      result: `${label}: ${patternLabel(p)}`,
      rule: `Use exactly ${p.id}. This is binding unless it's impossible or incompatible.`,
      choice: p.id,
      constraints: [COMMISSION_FIRST, 'Check compatibility with the other pieces yourself.'],
      key: `pattern|${code}|random|${p.id}`,
    });
  }

  // Turn a "Choose Unused" result with nothing left into a Random Pattern result.
  function convertToRandom(result, ctx) {
    const converted = randomPatternResult(ctx, result.piece);
    if (converted) converted.note = 'Converted from Choose Unused — no unused patterns were left.';
    return converted;
  }

  function rollCategory(id, ctx) {
    return rollers[id](ctx);
  }

  /*
   * Roll one main slot: category roll, then sub-rolls.
   * Same category as the other slot is fine; the exact same finished challenge
   * is redrawn automatically.
   * Returns { result, notes } or { error }.
   */
  function rollSlot(ctx, otherResult) {
    const { eligible, problems } = eligibleCategories(ctx);
    if (!eligible.length) {
      const why = problems.length
        ? problems.map((p) => p.message).join(' ')
        : 'All categories are switched off. Turn at least one on.';
      return { error: `Nothing can be rolled. ${why}` };
    }
    const notes = [];
    let redraws = 0;
    let result;
    do {
      const category = pick(eligible);
      result = rollCategory(category, ctx);
      if (!otherResult || result.key !== otherResult.key) break;
      redraws++;
    } while (redraws < MAX_REDRAWS);

    if (otherResult && result.key === otherResult.key) {
      result.duplicate = true;
      notes.push('This is the exact same challenge as the other slot and no distinct option could be found. Enable more categories or options.');
    } else if (redraws) {
      notes.push(`Auto-redrew ${redraws} exact duplicate${redraws > 1 ? 's' : ''} of the other slot.`);
    }
    if (problems.length) notes.push(...problems.map((p) => `Skipped: ${p.message}`));
    return { result, notes };
  }

  function rollConcept(pool) {
    const clean = pool.map((s) => s.trim()).filter(Boolean);
    if (!clean.length) return { error: 'The concept pool is empty. Add some concepts first.' };
    return { concept: pick(clean) };
  }

  const API = {
    randInt, pick, eligibleCategories, rollCategory, rollSlot, rollConcept,
    convertToRandom, unusedPatterns, unlockedPatterns, fabricPool, patternLabel, pieceLabel,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else root.FR = API;
})(typeof globalThis !== 'undefined' ? globalThis : this);
