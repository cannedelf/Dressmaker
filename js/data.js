/*
 * Fashion Roulette — starting pools.
 *
 * Everything here is meant to be edited by hand.
 */
(function (root) {
  const DATA = {
    categories: [
      { id: 'colour', label: 'Colour', icon: '🎨' },
      { id: 'fabric', label: 'Fabric', icon: '🧵' },
      { id: 'accessory', label: 'Accessory', icon: '🎀' },
      { id: 'detail', label: 'Trim / Detail', icon: '✂️' },
      { id: 'pattern', label: 'Pattern Piece', icon: '📐' },
    ],

    // The 11 fabric colour categories from https://dressmakerwiki.com/fabrics.
    // Shades like teal, cream or navy are fabrics within these, not categories of their own.
    colours: [
      { name: 'Blue' },
      { name: 'Green' },
      { name: 'Pink' },
      { name: 'Purple' },
      { name: 'Red' },
      { name: 'Yellow' },
      { name: 'Orange' },
      { name: 'Black', neutral: true },
      { name: 'White', neutral: true },
      { name: 'Grey', neutral: true },
      { name: 'Brown', neutral: true },
    ],

    // How a rolled colour must be used. {c} = rolled colour, {c2} = second roll.
    colourUses: [
      { id: 'main', label: 'Main colour', text: 'Main colour: {c}',
        rule: '{c} is the dominant colour — the clear majority of what you see.' },
      { id: 'accent', label: 'Accent colour', text: 'Accent colour: {c}',
        rule: '{c} appears as a visibly intentional accent — placed on purpose, not hidden.' },
      { id: 'twoFabric', label: 'Two-fabric colour', text: 'Two-fabric colour: {c}',
        rule: '{c} appears in at least two different fabrics / sections.' },
      { id: 'twoColour', label: 'Two-colour challenge', text: 'Two-colour challenge: {c} + {c2}', needsSecond: true,
        rule: 'Both {c} and {c2} must play a meaningful, visible role.' },
      { id: 'limited', label: 'Limited palette', text: 'Limited palette: {c}',
        rule: 'Use only {c}, related shades of {c}, and any allowed supporting neutrals.' },
      { id: 'contrast', label: 'Contrast challenge', text: 'Contrast challenge: {c} with a {c2} accent', needsSecond: true,
        rule: '{c} is the main colour and {c2} is a clearly contrasting accent.' },
    ],

    // Never include Burlap.
    fabricTypes: ['Cotton', 'Lace', 'Linen', 'Sequin', 'Silk', 'Velvet', 'Wool'],

    printChallenges: [
      { name: 'Hero print', rule: 'One patterned fabric is the obvious star of the dress.' },
      { name: 'Two prints', rule: 'Use two different patterned fabrics, both clearly visible.' },
      { name: 'Unusual print placement', rule: 'Put a patterned fabric somewhere unexpected (e.g. only the sleeves, collar or a panel).' },
      { name: 'Pattern clash', rule: 'Combine two prints that deliberately clash — but make it work.' },
      { name: 'Least-used fabric', rule: 'Use the fabric type you have used least so far (check your past commissions).' },
    ],

    // The 11 wiki accessory types. "line" = line-based trims counted by area.
    accessories: [
      { name: 'Appliqué', plural: 'appliqués' },
      { name: 'Bell', plural: 'bells' },
      { name: 'Bow', plural: 'bows' },
      { name: 'Brooch', plural: 'brooches' },
      { name: 'Button', plural: 'buttons' },
      { name: 'Feather', plural: 'feathers' },
      { name: 'Flower', plural: 'flowers' },
      { name: 'Jewel', plural: 'jewels' },
      { name: 'Lace Trim', plural: 'lace trim', line: true },
      { name: 'Tassel', plural: 'tassels' },
      { name: 'Trim', plural: 'trim (piping counts)', line: true },
    ],

    details: [
      { name: 'Framed shape', rule: 'Use piping or trim to frame a clear shape — the bodice, a panel or the neckline.' },
      { name: 'Diagonal cascade', rule: 'Run accessories diagonally across the dress in a cascade — at least 3 placements.' },
      { name: 'Statement neckline', rule: 'Make the neckline the focal point of the whole dress.' },
      { name: 'Decorated hem', rule: 'The hem gets deliberate, visible decoration.' },
      { name: 'Repeated motif', rule: 'Repeat the same small motif at least 3 times.' },
      { name: 'Asymmetric detail', rule: 'Decorate one side differently from the other, on purpose.' },
    ],

    // Pattern library: see js/patterns.js.

    concepts: [
      'Food: Strawberry', 'Food: Lemon tart', 'Food: Blueberry', 'Food: Macaron', 'Food: Honeycomb',
      'Animal: Bumblebee', 'Animal: Peacock', 'Animal: Fox', 'Animal: Jellyfish', 'Animal: Swan',
      'Botanical: Rose garden', 'Botanical: Wisteria', 'Botanical: Mushroom', 'Botanical: Sunflower', 'Botanical: Ivy',
      'Celestial: Starry night', 'Celestial: Sunrise', 'Celestial: Moon phases', 'Celestial: Comet',
      'Storybook: Fairy queen', 'Storybook: Little Red', 'Storybook: Mermaid', 'Storybook: Witch\'s apprentice',
      'Object: Teacup', 'Object: Stained glass', 'Object: Music box', 'Object: Candle',
      'Place: Seaside', 'Place: Autumn forest', 'Place: Carnival', 'Place: Snowy village',
    ],

    rerollReasons: [
      'Exact duplicate',
      'Conflicts with commission',
      'Not unlocked / incompatible',
      'Other (note)',
    ],
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = DATA;
  else root.FR_DATA = DATA;
})(typeof globalThis !== 'undefined' ? globalThis : this);
