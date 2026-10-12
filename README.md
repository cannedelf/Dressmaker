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

## Chapters, practice and concepts

- **Chapter:** the random Concept roller unlocks in Chapter 2. In Chapter 1 you can still enter a concept the commission gives you.
- **Practice / Testing mode:** try anything without touching your real playthrough. Finishing a practice commission just clears it; nothing is saved or marked used.
- **Concept collection:** every concept with Available / Used, search, grouping, rename, add/remove and undo. A concept becomes Used only when a real commission with it is finished, and Used concepts are never rolled again. A concept the commission gives you always works.
- Changes to the default concepts go in `conceptUpdates` in `js/data.js`. Each one is applied once to existing saves: exact-match renames keep Used status, removals leave past commissions alone, and missing defaults are added without touching custom concepts.
- Concepts have stable IDs (e.g. `concept:botanical-sunflower`), so renaming one keeps its status. The original concept list from older saves is kept in `conceptPoolBackup`.

## Editing the other pools

Colours, colour uses, fabrics, print challenges, accessories, trim/detail challenges, concepts and reroll reasons are in `js/data.js`. Colours are the 11 wiki fabric colour categories: Blue, Green, Pink, Purple, Red, Yellow, Orange, Black, White, Grey, Brown.

## Tests

```
node --test
```

Covers the acceptance tests from both briefs: disabled categories, duplicates, Burlap, empty pools, friendship unlocks, Choose Unused, fallbacks, overrides and save migration.
