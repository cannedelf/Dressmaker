/*
 * Fashion Roulette — saved state shape and migrations. No DOM code, so it can be tested in Node.
 *
 * Schema history:
 *   1 — first prototype; home-made pattern catalogue in `patterns` (BO01, SK01, …).
 *   2 — wiki pattern library: `friendships`, `patternProgress`, `includeNone`.
 *       The v1 catalogue is kept untouched in `legacyPatterns` (not mapped, since
 *       its IDs don't follow the wiki's order).
 *   3 — concept progression: `conceptPool` becomes [{ id, text }] with stable IDs,
 *       `usedConcepts`, `chapter`, `practice`. The v2 string list is kept untouched
 *       in `conceptPoolBackup`. Nothing is marked used by the migration.
 */
(function (root) {
  const isNode = typeof module !== 'undefined' && module.exports;
  const D = isNode ? require('./data.js') : root.FR_DATA;
  const P = isNode ? require('./patterns.js') : root.FR_PATTERNS;

  const STORAGE_KEY = 'crobat-sunshine-fashion-roulette-v1';
  const SCHEMA_VERSION = 3;
  const OVERRIDES = ['auto', 'unlocked', 'locked'];

  const isObj = (x) => x && typeof x === 'object' && !Array.isArray(x);

  function blankCommission() {
    return {
      customer: '', brief: '', requirements: '', forbidden: '', fabrics: '', budget: '',
      hasConcept: false, conceptName: '', rolledConcept: '', rolledConceptId: null, rolledInPractice: false,
      outcome: '', notes: '',
    };
  }

  function blankSlots() {
    return [{ current: null, locked: false, attempts: 0 }, { current: null, locked: false, attempts: 0 }];
  }

  function slug(text) {
    return String(text).toLowerCase().replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'concept';
  }

  // Give each concept a stable ID based on its original wording. Renaming later keeps the ID.
  function newConceptId(text, taken) {
    const base = `concept:${slug(text)}`;
    let id = base;
    for (let n = 2; taken.has(id); n++) id = `${base}-${n}`;
    taken.add(id);
    return id;
  }

  function toConceptItems(list) {
    const taken = new Set();
    const items = [];
    for (const entry of list) {
      if (typeof entry === 'string') {
        const text = entry.trim();
        if (text) items.push({ id: newConceptId(text, taken), text });
      } else if (isObj(entry) && typeof entry.text === 'string' && entry.text.trim()) {
        const id = typeof entry.id === 'string' && entry.id && !taken.has(entry.id) ? entry.id : newConceptId(entry.text, taken);
        taken.add(id);
        items.push({ id, text: entry.text.trim() });
      }
    }
    return items;
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
      conceptPool: toConceptItems(D.concepts),
      usedConcepts: {},
      chapter: 1,
      practice: false,
      slots: blankSlots(),
      log: [],
      past: [],
    };
  }

  function clampStars(n) {
    const v = Math.round(Number(n));
    return Number.isFinite(v) ? Math.min(P.MAX_STARS, Math.max(0, v)) : 0;
  }

  // Fill in anything missing and migrate older saves. Never drops commissions or settings.
  function normalise(raw) {
    const src = isObj(raw) ? raw : {};
    const s = Object.assign(defaultState(), src);
    s.commission = Object.assign(blankCommission(), src.commission);
    s.enabled = Object.assign(defaultState().enabled, src.enabled);
    // Only the official colour categories; drops old ones like Teal or Cream from earlier saves.
    s.colours = defaultState().colours;
    for (const name of Object.keys(s.colours)) {
      if (isObj(src.colours) && name in src.colours) s.colours[name] = !!src.colours[name];
    }
    if (!Array.isArray(s.slots) || s.slots.length !== 2) s.slots = blankSlots();
    if (!Array.isArray(s.log)) s.log = [];
    if (!Array.isArray(s.past)) s.past = [];

    // v2 → v3: plain concept strings become { id, text }; keep the original list as a backup.
    if (Array.isArray(src.conceptPool)) {
      if (src.conceptPool.some((x) => typeof x === 'string') && !Array.isArray(src.conceptPoolBackup)) {
        s.conceptPoolBackup = src.conceptPool.slice();
      }
      s.conceptPool = toConceptItems(src.conceptPool);
    } else {
      s.conceptPool = toConceptItems(D.concepts);
    }
    s.usedConcepts = {};
    for (const [id, u] of Object.entries(isObj(src.usedConcepts) ? src.usedConcepts : {})) {
      if (isObj(u)) s.usedConcepts[id] = { usedAt: u.usedAt || null, by: typeof u.by === 'string' ? u.by : '' };
    }
    const chapter = Math.floor(Number(src.chapter));
    s.chapter = Number.isFinite(chapter) && chapter >= 1 ? chapter : 1;
    s.practice = !!src.practice;
    // A concept rolled before IDs existed: link it to its pool entry by exact text.
    if (s.commission.rolledConcept && !s.commission.rolledConceptId) {
      const match = s.conceptPool.find((c) => c.text === s.commission.rolledConcept);
      s.commission.rolledConceptId = match ? match.id : null;
    }

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
    blankCommission, blankSlots, defaultFriendships, defaultState, normalise, clampStars, toConceptItems, newConceptId,
  };

  if (isNode) module.exports = API;
  else root.FR_STATE = API;
})(typeof globalThis !== 'undefined' ? globalThis : this);
