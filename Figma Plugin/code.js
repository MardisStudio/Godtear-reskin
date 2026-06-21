// ===========================================================================
// Card Data Populator — main thread (code.js)
// Generates 6 cards per character from a single "Master BW Card" component.
// ===========================================================================

figma.showUI(__html__, { width: 400, height: 600, themeColors: true });

var GEN_TAG = "cardDataPopulator_generated";
var TEMPLATE_NAMES = ["Master BW Card", "CardTemplate"];

var SKILL_ICON_MAP = {
  skill_self: "person",
  skill_friendly: "gear",
  skill_area: "star-of-david",
  skill_enemy: "skull-crossbones",
};

var DICE = ["dice-one", "dice-two", "dice-three", "dice-four", "dice-five", "dice-six"];
var CARDS_PER_CHARACTER = 6;

// --- Flatten nested JSON into dot-path keys --------------------------------
function flatten(obj, prefix, out) {
  out = out || {};
  for (var k in obj) {
    if (!Object.prototype.hasOwnProperty.call(obj, k)) continue;
    var v = obj[k];
    var key = prefix ? prefix + "." + k : k;
    if (v === null || v === undefined) continue;
    if (Array.isArray(v)) {
      for (var i = 0; i < v.length; i++) {
        var item = v[i];
        if (item !== null && typeof item === "object") flatten(item, key + "." + i, out);
        else out[key + "." + i] = String(item);
      }
    } else if (typeof v === "object") {
      flatten(v, key, out);
    } else {
      out[key] = String(v);
    }
  }
  return out;
}

function isCharacterRecord(obj) {
  return obj && typeof obj === "object" && obj.champion && obj.followers && obj.name;
}

function normalizeCharacters(parsed) {
  var list = Array.isArray(parsed) ? parsed : [parsed];
  return list.filter(function (item) {
    if (!isCharacterRecord(item)) return false;
    if (item.description && item.factions) return false;
    if (item.id === "star_wars_id") return false;
    return true;
  });
}

// --- Fonts ------------------------------------------------------------------
var _fontCache = {};
async function loadFontsForNode(node) {
  if (node.fontName === figma.mixed) {
    var fonts = node.getRangeAllFontNames(0, node.characters.length);
    await Promise.all(fonts.map(function (f) { return figma.loadFontAsync(f); }));
  } else {
    var key = node.fontName.family + "::" + node.fontName.style;
    if (!_fontCache[key]) { await figma.loadFontAsync(node.fontName); _fontCache[key] = true; }
  }
}

async function setText(node, value) {
  if (!node || node.type !== "TEXT") return;
  await loadFontsForNode(node);
  node.characters = value == null ? "" : String(value);
}

// --- Component helpers ------------------------------------------------------
function resolvePropKey(definitions, baseName) {
  if (!definitions) return null;
  var keys = Object.keys(definitions);
  for (var i = 0; i < keys.length; i++) {
    if (keys[i] === baseName || keys[i].indexOf(baseName + "#") === 0) return keys[i];
  }
  return null;
}

function setComponentProps(instance, definitions, values) {
  var props = {};
  for (var base in values) {
    if (!Object.prototype.hasOwnProperty.call(values, base)) continue;
    var key = resolvePropKey(definitions, base);
    if (key) props[key] = values[base];
  }
  if (Object.keys(props).length) instance.setProperties(props);
}

function getDefinitions(node) {
  var main = node.type === "INSTANCE" ? node.mainComponent : node;
  if (main.parent && main.parent.type === "COMPONENT_SET") return main.parent.componentPropertyDefinitions;
  return main.componentPropertyDefinitions;
}

function findCardTemplate() {
  var sel = figma.currentPage.selection[0];
  if (sel) {
    if (sel.type === "COMPONENT") return sel;
    if (sel.type === "INSTANCE" && sel.mainComponent) return sel.mainComponent;
  }
  for (var i = 0; i < TEMPLATE_NAMES.length; i++) {
    var name = TEMPLATE_NAMES[i];
    var found = figma.currentPage.findOne(function (n) {
      return n.type === "COMPONENT" && n.name === name;
    });
    if (found) return found;
  }
  return null;
}

function skillIcon(skill) {
  if (!skill) return "scroll";
  return SKILL_ICON_MAP[skill.skillIcon] || "skull-crossbones";
}

function unitsToDice(units) {
  var n = parseInt(units, 10);
  if (isNaN(n) || n < 1) return DICE[0];
  return DICE[Math.min(n, DICE.length) - 1];
}

function statValues(profiles, field) {
  profiles = profiles || [{ range: "-", accuracy: "-", damage: "-" }];
  return [
    profiles[0] ? String(profiles[0][field] != null ? profiles[0][field] : "-") : "-",
    profiles[1] ? String(profiles[1][field] != null ? profiles[1][field] : "-") : "-",
    profiles[2] ? String(profiles[2][field] != null ? profiles[2][field] : "-") : "-",
  ];
}

function isTraitItem(item) {
  return item && !item.skillIcon && !item.statProfiles;
}

function buildComponentIndex() {
  var idx = {};
  var comps = figma.currentPage.findAllWithCriteria
    ? figma.currentPage.findAllWithCriteria({ types: ["COMPONENT"] })
    : figma.currentPage.findAll(function (n) { return n.type === "COMPONENT"; });
  for (var i = 0; i < comps.length; i++) idx[comps[i].name] = comps[i];
  return idx;
}

// --- Fill frame by dot-path layer names (legacy) ------------------------------
async function fillFrame(frame, data, iconIndex) {
  var map = flatten(data, "", {});
  var filled = 0, unmatched = [];

  var textNodes = frame.findAll(function (n) { return n.type === "TEXT"; });
  for (var t = 0; t < textNodes.length; t++) {
    var node = textNodes[t];
    if (Object.prototype.hasOwnProperty.call(map, node.name)) {
      try { await setText(node, map[node.name]); filled++; }
      catch (e) { unmatched.push(node.name + " (font: " + e.message + ")"); }
    }
  }

  var instNodes = frame.findAll(function (n) { return n.type === "INSTANCE"; });
  for (var s = 0; s < instNodes.length; s++) {
    var inst = instNodes[s];
    if (Object.prototype.hasOwnProperty.call(map, inst.name)) {
      var target = iconIndex[map[inst.name]];
      if (target) { try { inst.swapComponent(target); filled++; } catch (e) { unmatched.push(inst.name + " (swap)"); } }
      else unmatched.push(inst.name + " -> no component '" + map[inst.name] + "'");
    }
  }
  return { filled: filled, unmatched: unmatched };
}

// --- Master BW Card helpers -------------------------------------------------
function fillBwskillProps(bwskillInstance, item, isTrait) {
  var defs = getDefinitions(bwskillInstance);
  var profiles = item && item.statProfiles ? item.statProfiles : [];
  var range = statValues(profiles, "range");
  var accuracy = statValues(profiles, "accuracy");
  var damage = statValues(profiles, "damage");
  setComponentProps(bwskillInstance, defs, {
    "skill-name": item ? item.name : "",
    "skill-text": item ? item.text : "",
    icon: item ? (isTrait ? "scroll" : skillIcon(item)) : "minus",
    "range-1": range[0], "range-2": range[1], "range-3": range[2],
    "accuracy-1": accuracy[0], "accuracy-2": accuracy[1], "accuracy-3": accuracy[2],
    "damage-1": damage[0], "damage-2": damage[1], "damage-3": damage[2],
  });
}

function fillCardBwskills(cardInstance, items) {
  var defs = getDefinitions(cardInstance);
  for (var i = 1; i <= 3; i++) {
    var slot = items[i - 1];
    setComponentProps(cardInstance, defs, { ["Show bwskill" + i]: !!slot });
    var node = cardInstance.findOne(function (n) { return n.name === "bwskill" + i; });
    if (node && slot) {
      var data = slot.item || slot;
      var isTrait = slot.isTrait != null ? slot.isTrait : isTraitItem(data);
      fillBwskillProps(node, data, isTrait);
    }
  }
}

function setCardHeader(cardInstance, opts) {
  var defs = getDefinitions(cardInstance);
  setComponentProps(cardInstance, defs, {
    speed: String(opts.speed != null ? opts.speed : "0"),
    dodge: String(opts.dodge != null ? opts.dodge : "0"),
    dodge2: String(opts.dodge2 != null ? opts.dodge2 : "0"),
    health: String(opts.health != null ? opts.health : "0"),
    name: opts.name || "",
    type: opts.type || "medal",
    "plot-clash": opts.phaseIcon || "chart-network",
    "Show stats": opts.showStats !== false,
  });
}

function skillsToItems(skills, isTrait) {
  var items = [];
  if (!skills) return items;
  for (var i = 0; i < skills.length; i++) {
    items.push({ item: skills[i], isTrait: isTrait === true });
  }
  return items;
}

function buildIdentityItems(character) {
  var items = [];
  var banners = character.bannerMiniatureIdeas || [];
  var vehicles = character.vehicleSuggestions || [];
  var i;
  for (i = 0; i < banners.length && items.length < 3; i++) {
    items.push({ name: "Banner Idea " + (i + 1), text: banners[i], isTrait: true });
  }
  for (i = 0; i < vehicles.length && items.length < 3; i++) {
    items.push({ name: "Vehicle " + (i + 1), text: vehicles[i], isTrait: true });
  }
  if (!items.length) {
    items.push({
      name: character.faction || "Faction",
      text: character.convertedFrom
        ? "Converted from " + character.convertedFrom.name
        : character.name,
      isTrait: true,
    });
  }
  return items.slice(0, 3);
}

function buildUltimateItems(character) {
  var ch = character.champion;
  var items = [];
  if (ch.ultimate) items.push({ item: ch.ultimate, isTrait: false });
  if (ch.factionTrait) items.push({ item: ch.factionTrait, isTrait: true });
  if (ch.uniqueTraits && ch.uniqueTraits[0]) items.push({ item: ch.uniqueTraits[0], isTrait: true });
  return items;
}

function buildFollowerItems(followers, phase) {
  var items = [];
  if (followers.traits && followers.traits[0]) items.push({ item: followers.traits[0], isTrait: true });
  var skills = phase === "plot" ? followers.plotSkills : followers.clashSkills;
  return items.concat(skillsToItems(skills, false)).slice(0, 3);
}

function buildChampionItems(champion, phase) {
  var skills = phase === "plot" ? champion.plotSkills : champion.clashSkills;
  return skillsToItems(skills, false).slice(0, 3);
}

function configureCard(cardInstance, character, cardType, phase) {
  if (cardType === "identity") {
    setCardHeader(cardInstance, {
      name: character.name,
      type: "medal",
      phaseIcon: "chart-network",
      showStats: false,
    });
    fillCardBwskills(cardInstance, buildIdentityItems(character));
    return;
  }

  if (cardType === "ultimate") {
    var uStats = character.champion.stats || {};
    setCardHeader(cardInstance, {
      speed: uStats.plotSpeed,
      dodge: uStats.dodge,
      dodge2: uStats.protection,
      health: uStats.health,
      name: character.name,
      type: "medal",
      phaseIcon: "star-of-david",
      showStats: true,
    });
    fillCardBwskills(cardInstance, buildUltimateItems(character));
    return;
  }

  if (cardType === "champion") {
    var cStats = character.champion.stats || {};
    var cSpeed = phase === "plot" ? cStats.plotSpeed : cStats.clashSpeed;
    setCardHeader(cardInstance, {
      speed: cSpeed,
      dodge: cStats.dodge,
      dodge2: cStats.protection,
      health: cStats.health,
      name: character.name,
      type: "medal",
      phaseIcon: phase === "plot" ? "chart-network" : "axe-battle",
      showStats: true,
    });
    fillCardBwskills(cardInstance, buildChampionItems(character.champion, phase));
    return;
  }

  if (cardType === "follower") {
    var f = character.followers;
    var fStats = f.stats || {};
    var fSpeed = phase === "plot" ? fStats.plotSpeed : fStats.clashSpeed;
    setCardHeader(cardInstance, {
      speed: fSpeed,
      dodge: fStats.dodge,
      dodge2: fStats.protection,
      health: fStats.health,
      name: f.name || "Follower",
      type: unitsToDice(f.units),
      phaseIcon: phase === "plot" ? "chart-network" : "axe-battle",
      showStats: true,
    });
    fillCardBwskills(cardInstance, buildFollowerItems(f, phase));
  }
}

function clearGenerated() {
  var prev = figma.currentPage.findAll(function (n) {
    return n.getPluginData && n.getPluginData(GEN_TAG) === "1";
  });
  for (var i = 0; i < prev.length; i++) prev[i].remove();
  return prev.length;
}

function tagGenerated(node, label) {
  node.name = label;
  node.setPluginData(GEN_TAG, "1");
}

function gridPosition(originX, originY, index, cols, cellW, cellH) {
  return {
    x: originX + (index % cols) * cellW,
    y: originY + Math.floor(index / cols) * cellH,
  };
}

// --- Generate all cards for character roster --------------------------------
async function generateCharacterCards(characters, options) {
  var template = findCardTemplate();
  if (!template) {
    figma.notify('Select "Master BW Card" or name your template component "Master BW Card".');
    return;
  }

  if (options.clearPrevious) {
    var removed = clearGenerated();
    if (removed) figma.notify("Cleared " + removed + " previously generated cards.");
  }

  var cardW = template.width + 20;
  var cardH = template.height + 20;
  var gap = 40;
  var cellW = cardW + gap;
  var cellH = cardH + gap;
  var cols = Math.max(1, parseInt(options.columns, 10) || CARDS_PER_CHARACTER);

  var originX = template.x;
  var originY = template.y + template.height + 120;

  var cardIndex = 0;
  var totalCards = characters.length * CARDS_PER_CHARACTER;

  var cardJobs = [
    { label: "Identity", type: "identity", phase: "plot" },
    { label: "Ultimate", type: "ultimate", phase: "plot" },
    { label: "Champion plot", type: "champion", phase: "plot" },
    { label: "Champion clash", type: "champion", phase: "clash" },
    { label: "Follower plot", type: "follower", phase: "plot" },
    { label: "Follower clash", type: "follower", phase: "clash" },
  ];

  for (var c = 0; c < characters.length; c++) {
    var character = characters[c];
    var prefix = character.name || character.id || ("char_" + c);

    for (var j = 0; j < cardJobs.length; j++) {
      var job = cardJobs[j];
      var card = template.createInstance();
      configureCard(card, character, job.type, job.phase);

      var pos = gridPosition(originX, originY, cardIndex, cols, cellW, cellH);
      card.x = pos.x;
      card.y = pos.y;
      tagGenerated(card, prefix + " — " + job.label);
      figma.currentPage.appendChild(card);
      cardIndex++;
      figma.ui.postMessage({ type: "progress", done: cardIndex, total: totalCards });
    }
  }

  figma.notify("Generated " + cardIndex + " cards from Master BW Card (" +
    characters.length + " characters × " + CARDS_PER_CHARACTER + ").");
}

// --- Message handler --------------------------------------------------------
figma.ui.onmessage = async function (msg) {
  if (msg.type === "generate") {
    var parsed;
    try { parsed = JSON.parse(msg.json); }
    catch (e) { figma.notify("Invalid JSON: " + e.message); return; }

    var characters = normalizeCharacters(parsed);
    if (!characters.length) {
      figma.notify("No character JSON found. Each file needs champion, followers, and name.");
      return;
    }

    await generateCharacterCards(characters, {
      columns: msg.columns,
      clearPrevious: msg.clearPrevious,
    });
    figma.ui.postMessage({ type: "done" });
    return;
  }

  if (msg.type !== "fill") return;

  var parsedFill;
  try { parsedFill = JSON.parse(msg.json); }
  catch (e) { figma.notify("Invalid JSON: " + e.message); return; }

  var cards = Array.isArray(parsedFill) ? parsedFill : [parsedFill];
  var iconIndex = buildComponentIndex();
  var template = findCardTemplate();

  if (!msg.batch) {
    if (!template) { figma.notify('Select "Master BW Card" on canvas first.'); return; }
    var node = template;
    if (msg.clone) {
      node = template.createInstance();
      node.x = template.x + template.width + 80;
      node.name = cards[0].name || template.name;
      node.setPluginData(GEN_TAG, "1");
      figma.currentPage.appendChild(node);
    }
    var r = await fillFrame(node, cards[0], iconIndex);
    figma.notify("Filled " + r.filled + " layers." + (r.unmatched.length ? " " + r.unmatched.length + " issue(s)." : ""));
    if (r.unmatched.length) console.log(r.unmatched.join("\n"));
    figma.ui.postMessage({ type: "done" });
    return;
  }

  if (!template) { figma.notify('Missing "Master BW Card" component on this page.'); return; }

  if (msg.clearPrevious) {
    var removed = clearGenerated();
    if (removed) figma.notify("Cleared " + removed + " previously generated cards.");
  }

  var cols = Math.max(1, parseInt(msg.columns, 10) || 10);
  var gap = 60;
  var cellW = template.width + gap;
  var cellH = template.height + gap;
  var originX = template.x;
  var originY = template.y + template.height + 160;

  var totalFilled = 0, issues = [];
  for (var c = 0; c < cards.length; c++) {
    var copy = template.createInstance();
    copy.x = originX + (c % cols) * cellW;
    copy.y = originY + Math.floor(c / cols) * cellH;
    copy.name = (cards[c].name || cards[c].id || ("card_" + c));
    copy.setPluginData(GEN_TAG, "1");
    figma.currentPage.appendChild(copy);

    var res = await fillFrame(copy, cards[c], iconIndex);
    totalFilled += res.filled;
    issues += res.unmatched.length;
    if (res.unmatched.length) console.log("[" + copy.name + "] " + res.unmatched.join("; "));

    figma.ui.postMessage({ type: "progress", done: c + 1, total: cards.length });
  }

  figma.notify("Generated " + cards.length + " cards (" + totalFilled + " layers filled" +
    (issues ? ", " + issues + " issues — see console" : "") + ").");
  figma.ui.postMessage({ type: "done" });
};
