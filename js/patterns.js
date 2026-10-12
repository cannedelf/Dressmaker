/*
 * Dressmaker pattern library, transcribed from the Dressmaker Wiki
 * (observed October 2026, wiki v0.7.0 Build 410).
 *
 * Each row: [name] for a starting pattern, or [name, client, friendship star].
 * Names are kept exactly as the wiki writes them. Edit here if the wiki changes;
 * pattern IDs are built from part + name, so don't rename a pattern unless the
 * game really renamed it (its saved Used / notes would no longer match).
 */
(function (root) {
  const SOURCE = 'https://dressmakerwiki.com/patterns/';

  const CLIENTS = ['Rose', 'Prudence', 'Priya', 'Marie', 'Edith', 'Fiona', 'Alice', 'Vivian', 'Dorothy', 'Adora'];
  const MAX_STARS = 5;

  const PARTS = [
    { part: 'bodice', label: 'Bodice', plural: 'Bodices', page: 'bodices' },
    { part: 'collar', label: 'Collar', plural: 'Collars', page: 'collars' },
    { part: 'sleeve', label: 'Sleeves', plural: 'Sleeves', page: 'sleeves' },
    { part: 'skirt', label: 'Skirt', plural: 'Skirts', page: 'skirts' },
  ];

  const ROWS = {
    bodice: [
    ["Princess Bodice"],
    ["Square Bodice"],
    ["Princess Scoop Bodice"],
    ["Milkmaid Bodice"],
    ["Sweetheart Bodice"],
    ["Strapless Bodice"],
    ["Princess V Bodice"],
    ["One Shoulder Bodice"],
    ["Single Keyhole Bodice"],
    ["Plunging Neckline Bodice"],
    ["Elevated Scoop Ruffle Bodice"],
    ["Scoop Ruffle Bodice"],
    ["Cinched Keyhole Blouse"],
    ["Kimono Bodice"],
    ["Waistcoat Bodice", 'Rose', 1],
    ["V Neck Yoked Shirt", 'Rose', 2],
    ["Yoked Shirt", 'Rose', 2],
    ["Split Crew Bodice", 'Rose', 3],
    ["Ruched Bodice", 'Rose', 4],
    ["Upturned Yoked Bodice", 'Rose', 4],
    ["Heart Princess Bodice", 'Prudence', 1],
    ["Elevated Sweetheart Bodice", 'Prudence', 1],
    ["Ruched Sweetheart Bodice", 'Prudence', 2],
    ["Aurora Bodice", 'Prudence', 3],
    ["Bolero Bodice", 'Prudence', 5],
    ["Apron Bodice", 'Priya', 1],
    ["Ruffle Apron Bodice", 'Priya', 1],
    ["Bustier Bodice", 'Priya', 2],
    ["Off-Shoulder Begonia Bodice", 'Priya', 3],
    ["Wrap Bodice", 'Priya', 4],
    ["Sax Bodice", 'Priya', 4],
    ["Flared Begonia Bodice", 'Priya', 5],
    ["Coat Dress Bodice", 'Marie', 1],
    ["Front Lace Bodice", 'Marie', 2],
    ["Halter Neck Bodice", 'Marie', 3],
    ["Straight Begonia Bodice", 'Marie', 3],
    ["Kaftan Wrap Bodice", 'Marie', 4],
    ["Corset Bodice", 'Edith', 1],
    ["Gatsby Bodice", 'Edith', 2],
    ["Queen Anne Bodice", 'Edith', 3],
    ["Front Lace Stays", 'Fiona', 1],
    ["Dirndl", 'Fiona', 3],
    ["Elevated Dirndl", 'Fiona', 4],
    ["Elevated Stays", 'Fiona', 4],
    ["Land Girl Bodice", 'Fiona', 4],
    ["Elevated Scoop Bodice", 'Alice', 1],
    ["Princess V Ruffle Bodice", 'Alice', 2],
    ["Elevated Princess V Bodice", 'Alice', 2],
    ["Princess V Elevated Ruffle Bodice", 'Alice', 2],
    ["Twilight Hour Bodice", 'Vivian', 1],
    ["Viper Bodice", 'Vivian', 2],
    ["Belladonna Bodice", 'Vivian', 3],
    ["Katarina Bodice", 'Dorothy', 1],
    ["Jacket Bodice", 'Dorothy', 2],
    ["Waterfall Bodice", 'Dorothy', 3],
    ["Yoked Jacket Bodice", 'Dorothy', 4],
    ["Double Breasted Bodice", 'Dorothy', 4],
    ["Belted Jacket Bodice", 'Dorothy', 4],
    ["Delilah Bodice", 'Adora', 1],
    ],
    skirt: [
    ["Princess Skirt"],
    ["Circle Skirt"],
    ["Gathered Ballgown Skirt"],
    ["Pencil Skirt"],
    ["Mermaid Skirt"],
    ["Straight Long Skirt"],
    ["Flare Skirt"],
    ["Bias Cut Skirt"],
    ["Puffy Gathered Tiered Skirt"],
    ["Single Tiered Skirt"],
    ["Waistcoat Skirt", 'Rose', 1],
    ["Curved Peplum Skirt", 'Rose', 3],
    ["Yoke Gathered Skirt", 'Prudence', 1],
    ["Petal Peplum Skirt", 'Prudence', 2],
    ["Split Skirt", 'Prudence', 2],
    ["Tulip Hip Skirt", 'Prudence', 3],
    ["Circle Peplum Skirt", 'Prudence', 3],
    ["Bow Ballgown Skirt", 'Prudence', 4],
    ["Apron Skirt", 'Priya', 1],
    ["Straight Gathered Tiered Skirt", 'Priya', 2],
    ["Ruffle Skirt", 'Priya', 3],
    ["Wrap Skirt", 'Priya', 4],
    ["Coat Dress Skirt", 'Marie', 1],
    ["Bow Skirt", 'Marie', 2],
    ["Handkerchief Godet Skirt", 'Marie', 3],
    ["Kaftan Skirt", 'Marie', 4],
    ["Corset Skirt", 'Edith', 1],
    ["Gatsby Skirt", 'Edith', 2],
    ["Koi Skirt", 'Edith', 3],
    ["Dita Pencil Skirt", 'Edith', 4],
    ["Frill Skirt", 'Fiona', 2],
    ["Chrysanthemum Skirt", 'Fiona', 3],
    ["Mother of Pearl Skirt", 'Alice', 1],
    ["Gathered Tiered Ruffle Skirt", 'Alice', 2],
    ["Poinsetta Skirt", 'Alice', 3],
    ["Train Skirt", 'Alice', 4],
    ["Twilight Hour Skirt", 'Vivian', 1],
    ["Viper Skirt", 'Vivian', 2],
    ["Belladonna Skirt", 'Vivian', 3],
    ["Godet Skirt", 'Dorothy', 1],
    ["Scallop Skirt", 'Dorothy', 2],
    ["Waterfall Skirt", 'Dorothy', 3],
    ["Wavecrest Skirt", 'Adora', 1],
    ["Basque Tiered Skirt", 'Adora', 2],
    ["Bustle Skirt", 'Adora', 3],
    ["Odette Skirt", 'Adora', 4],
    ],
    sleeve: [
    ["Cap Sleeve"],
    ["Long Sleeve"],
    ["Bracelet Sleeve"],
    ["Butterfly Sleeve"],
    ["Peasant Sleeve"],
    ["Flounce Sleeve"],
    ["Short Puffed Sleeve"],
    ["Mutton Sleeve"],
    ["Short Sleeve", 'Rose', 1],
    ["Juliette-Bishop Sleeve", 'Priya', 1],
    ["Pleated Drop Sleeve", 'Priya', 2],
    ["Gabriel Sleeve", 'Priya', 3],
    ["Long Cuffed Sleeve", 'Marie', 1],
    ["Godiva Sleeve", 'Marie', 2],
    ["Slit Sleeve", 'Edith', 1],
    ["Tiered Sleeves", 'Edith', 2],
    ["Fae Sleeve", 'Fiona', 1],
    ["Chanterelle Sleeve", 'Fiona', 2],
    ["Petal Sleeve", 'Fiona', 3],
    ["Hecate Sleeve", 'Alice', 1],
    ["Juliette Sleeve", 'Alice', 2],
    ["Peasant Sleeve with Ruffle Cuff", 'Alice', 3],
    ["Elbow Length Juliet Sleeve", 'Alice', 4],
    ["Angel's Trumpet Sleeve", 'Vivian', 4],
    ["Arwen Sleeve", 'Vivian', 4],
    ["Bell Sleeve", 'Dorothy', 1],
    ["Poet Sleeve", 'Dorothy', 2],
    ["Capulet Sleeve", 'Dorothy', 3],
    ["Flutter Sleeve", 'Adora', 2],
    ["Angel Sleeve", 'Adora', 4],
    ],
    collar: [
    ["Peter Pan Collar"],
    ["Notched Shirt Collar"],
    ["Open Shirt Collar"],
    ["Pointed Collar"],
    ["Oversized Wing Collar"],
    ["Pussybow Collar"],
    ["Upright Frill Collar", 'Rose', 2],
    ["Scalloped Collar", 'Rose', 3],
    ["Mandarin Collar", 'Marie', 1],
    ["Whirlpool Collar", 'Edith', 3],
    ["Dagger Collar", 'Edith', 4],
    ["Double Ruffle and Bow Collar", 'Fiona', 1],
    ["Fable Collar", 'Fiona', 2],
    ["Widow's Peak Collar", 'Vivian', 1],
    ["Viper Collar", 'Vivian', 2],
    ["Belladonna Collar", 'Vivian', 3],
    ["Gothic Collar", 'Vivian', 4],
    ["Qipao Collar", 'Adora', 1],
    ["Sailor Collar", 'Adora', 2],
    ["Serafuku Collar", 'Adora', 3],
    ],
  };

  // Available from the start but with no pieces to cut. Not numbered patterns.
  const PICKER_CHOICES = [
    { part: 'sleeve', name: 'No Sleeves', note: 'No pieces to cut (wiki: Cool 10, Simple 10).' },
    { part: 'collar', name: 'No Collar', note: 'No pieces to cut (wiki: Cool 5, Simple 5).' },
  ];

  function slug(s) {
    return s.toLowerCase().replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }

  const patterns = [];
  for (const { part, page } of PARTS) {
    for (const [name, client, stars] of ROWS[part]) {
      patterns.push({
        id: `${part}:${slug(name)}`,
        part,
        name,
        unlock: client ? { kind: 'friendship', client, stars } : { kind: 'start' },
        sourceUrl: SOURCE + page,
      });
    }
  }
  for (const c of PICKER_CHOICES) {
    patterns.push({
      id: `${c.part}:${slug(c.name)}`,
      part: c.part,
      name: c.name,
      unlock: { kind: 'start' },
      none: true,
      note: c.note,
      sourceUrl: SOURCE + PARTS.find((p) => p.part === c.part).page,
    });
  }

  const PATTERNS = { CLIENTS, MAX_STARS, PARTS, patterns };

  if (typeof module !== 'undefined' && module.exports) module.exports = PATTERNS;
  else root.FR_PATTERNS = PATTERNS;
})(typeof globalThis !== 'undefined' ? globalThis : this);
