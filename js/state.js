/*
 * Fashion Roulette — saved state shape and migrations. No DOM code, so it can be tested in Node.
 *
 * Schema history:
 *   1 — first prototype; home-made pattern catalogue in `patterns` (BO01, SK01, …).
 *   2 — wiki pattern library: `friendships`, `patternProgress`, `includeNone`.
 *       The v1 catalogue is kept untouched in `legacyPatterns` (not mapped, since
 *       its IDs don't follow the wiki's order).
 */
(function (root) {
  const isNode = typeof module !== 'undefined' && module.exports;
  const D = isNode ? require('./data.js') : root.FR_DATA;
  const P = isNode ? require('./patterns.js') : root.FR_PATTERNS;

  const STORAGE_KEY = 'crobat-sunshine-fashion-roulette-v1';
  const SCHEMA_VERSION = 2;
  const OVERRIDES = ['auto', 'unlocked', 'locked'];

  function blankCommission() {
    return {
      customer: '', brief: '', requirements: '', forbidden: '', fabrics: '', budget: '',
      hasConcept: false, conceptName: '', rolledConcept: '', outcome: '', notes: '',
    };
  }

  function blankSlots() {
    return [{ current: null, locked: false, attempts: 0 }, { current: null, locked: false, attempts: 0 }];
  }

  function defaultFriendships() {
    return Object.fromEntries(P.CLIENTS.map((c) => [c, 0]));
  }

  function defaultState() {
    return {
      version: SCHEMA_VERSION,
      commission: blankCommission(),
      enabled: Object.fromEntries(D.categories.map((c) => [c.id, true])),
      colours: Object.fromEntries(D.colours.map((c) => [c.name, true])),
      neutralsAllowed: true,
      friendships: defaultFriendships(),
      patternProgress: {},
      includeNone: false,
      conceptPool: D.concepts.slice(),
      slots: blankSlots(),
      log: [],
      past: [],
    };
  }

  function clampStars(n) {
    const v = Math.round(Number(n));
    return Number.isFinite(v) ? Math.min(P.MAX_STARS, Math.max(0, v)) : 0;
  }

  const isObj = (x) => x && typeof x === 'object' && !Array.isArray(x);

  // Fill in anything missing and migrate older saves. Never drops commissions or settings.
  function normalise(raw) {
    const src = isObj(raw) ? raw : {};
    const s = Object.assign(defaultState(), src);
    s.commission = Object.assign(blankCommission(), src.commission);
    s.enabled = Object.assign(defaultState().enabled, src.enabled);
    s.colours = Object.assign(defaultState().colours, src.colours);
    if (!Array.isArray(s.slots) || s.slots.length !== 2) s.slots = blankSlots();
    if (!Array.isArray(s.log)) s.log = [];
    if (!Array.isArray(s.past)) s.past = [];
    if (!Array.isArray(s.conceptPool)) s.conceptPool = D.concepts.slice();

    // v1 → v2: keep the home-made catalogue as-is rather than guessing a mapping.
    if (src.patterns && !src.legacyPatterns) s.legacyPatterns = src.patterns;
    delete s.patterns;

    s.friendships = defaultFriendships();
    for (const [client, stars] of Object.entries(isObj(src.friendships) ? src.friendships : {})) {
      s.friendships[client] = clampStars(stars);
    }

    s.patternProgress = {};
    for (const [id, p] of Object.entries(isObj(src.patternProgress) ? src.patternProgress : {})) {
      if (!isObj(p)) continue;
      s.patternProgress[id] = {
        used: !!p.used,
        unlockOverride: OVERRIDES.includes(p.unlockOverride) ? p.unlockOverride : 'auto',
        notes: typeof p.notes === 'string' ? p.notes : '',
      };
    }
    s.includeNone = !!src.includeNone;

    // Pattern results rolled from the old catalogue still display, but can't be acted on.
    for (const slot of s.slots) {
      const r = slot && slot.current;
      if (r && r.category === 'pattern' && !r.part) r.legacy = true;
    }

    s.version = SCHEMA_VERSION;
    return s;
  }

  const API = {
    STORAGE_KEY, SCHEMA_VERSION, OVERRIDES,
    blankCommission, blankSlots, defaultFriendships, defaultState, normalise, clampStars,
  };

  if (isNode) module.exports = API;
  else root.FR_STATE = API;
})(typeof globalThis !== 'undefined' ? globalThis : this);
