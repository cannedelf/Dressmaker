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

## Editing the pools

All lists live in `js/data.js`: colours, colour uses, fabrics, print challenges, accessories, trim/detail challenges, concepts and reroll reasons. Patterns and the concept pool can also be edited inside the app.

Still placeholders to check against the wiki / Google Sheet:
- the colour list
- the pattern catalogue (starts with `BO01–BO06`, `CO01–CO06`, etc., all unlocked)

## Tests

```
node --test
```

Covers the acceptance tests in the design spec (disabled categories, duplicates, slot independence, Burlap, pattern rules, empty pools).
