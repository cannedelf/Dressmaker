# Dressmaker — Crobat & Sunshine Fashion Roulette

An app that rolls two random creative challenges for a *Dressmaker* commission, without breaking the commission's own requirements.

## Using it

Open `index.html` in a browser. There's nothing to install. It also works as-is on GitHub Pages (Settings → Pages → deploy from this branch, root folder).

1. Fill in the commission (these are notes only — nothing is checked automatically).
2. Tick **Commission already has a concept**, or optionally roll one (it doesn't use a spin).
3. Switch off any categories the commission already controls.
4. **Spin both.** Reroll either slot on its own (a reason is required), or **Keep** a slot so the next Spin both leaves it alone.
5. Copy the summary, make the dress, then **Finish** to save it and mark used patterns.

Everything is saved in **this browser only**. Use *Save data → Export JSON* to back up or move to another device.

## Patterns & friendship

- **Friendship stars:** set each client's stars (0–5) to match your save. Patterns unlock automatically from the wiki's client + star thresholds.
- **Pattern library:** all 155 wiki patterns (59 bodices, 46 skirts, 30 sleeves, 20 collars), with Used ticks, notes and an unlock override (auto / force unlocked / force locked) for when your save disagrees with the wiki.
- **No Sleeves / No Collar** are listed separately and left out of rolls unless you tick the option to include them.
- Patterns are only marked used when you say so, never automatically.

The data lives in `js/patterns.js` (transcribed from the Dressmaker Wiki, v0.7.0 Build 410). IDs are built from part + name, e.g. `bodice:corset-bodice`.

Older saves upgrade automatically: commissions, history and settings are kept, and the old placeholder catalogue (BO01…) is kept in the save file untouched rather than guessed onto wiki names.

## Editing the other pools

Colours, colour uses, fabrics, print challenges, accessories, trim/detail challenges, concepts and reroll reasons are in `js/data.js`. Colours are the 11 wiki fabric colour categories: Blue, Green, Pink, Purple, Red, Yellow, Orange, Black, White, Grey, Brown.

## Tests

```
node --test
```

Covers the acceptance tests from both briefs: disabled categories, duplicates, Burlap, empty pools, friendship unlocks, Choose Unused, fallbacks, overrides and save migration.
