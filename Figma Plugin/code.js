// ===========================================================================
// God Tear Card Generator — main thread (code.js)
// Generates 6 cards per character JSON from the colored "card" component:
//   1. Identity (no ultimate)
//   2. Identity (with ultimate)
//   3. Champion plot
//   4. Champion clash
//   5. Follower plot
//   6. Follower clash
// ===========================================================================

figma.showUI(__html__, { width: 400, height: 480, themeColors: true });

var TEMPLATE_NAME = "card";
var CARDS_PER_CHARACTER = 6;

var SKILL_ICON_VARIANTS = {
  skill_self: "Icon=Target Self",
  skill_friendly: "Icon=Target Ally",
  skill_area: "Icon=Target Area",
  skill_enemy: "Icon=Target Enemy",
  trait: "Icon=Passive",
  ultimate: "Icon=Target Area",
};

// Color Ways modes: Red / Blue / Green / Yellow
var SKILL_APPEARANCE_MODES = {
  skill_self: "Blue",
  skill_friendly: "Blue",
  skill_area: "Green",
  skill_enemy: "Red",
  trait: "Yellow",
  ultimate: "Green",
};

var LIGHT_EFFECT_BY_MODE = {
  Yellow: "Show yellow light effect",
  Blue: "Show blue light effect",
  Red: "Show red light effect",
  Green: "Show green light effect",
};

// Tactician/Shaper→Green, Sentinel/Guardian→Blue, Duelist/Slayer→Red, Marauders/Maelstrom→Yellow
var COLOR_WAY_MODE_ALIASES = {
  red: "Red",
  blue: "Blue",
  green: "Green",
  yellow: "Yellow",
  tactician: "Green",
  sentinel: "Blue",
  sentinal: "Blue",
  duelist: "Red",
  marauders: "Yellow",
  maurauders: "Yellow",
  shaper: "Green",
  guardian: "Blue",
  guardians: "Blue",
  slayer: "Red",
  slayers: "Red",
  maelstrom: "Yellow",
};

var TOKEN_MAP = {
  "{protection_boon}": "Protection Up",
  "{damage_die_boon}": "Damage Die Up",
  "{accuracy_boon}": "Accuracy Up",
  "{dodge_boon}": "Dodge Up",
  "{move_boon}": "Move Up",
  "{health_boon}": "Health Up",
  "{protection_blight}": "Protection Down",
  "{damage_die_blight}": "Damage Die Down",
  "{accuracy_blight}": "Accuracy Down",
  "{dodge_blight}": "Dodge Down",
  "{move_blight}": "Move Down",
  "{health_blight}": "Health Down",
};

// --- JSON helpers -----------------------------------------------------------

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

function expandTokens(text) {
  if (!text) return "";
  var out = String(text);
  for (var token in TOKEN_MAP) {
    if (!Object.prototype.hasOwnProperty.call(TOKEN_MAP, token)) continue;
    out = out.split(token).join(TOKEN_MAP[token]);
  }
  return out;
}

function profileField(profiles, index, field) {
  if (!profiles || !profiles[index]) return "";
  var v = profiles[index][field];
  if (v == null || v === "-") return index === 0 ? "-" : "";
  return String(v);
}

function statTriple(profiles, field) {
  return [
    profileField(profiles, 0, field) || "-",
    profileField(profiles, 1, field),
    profileField(profiles, 2, field),
  ];
}

function isTraitItem(item) {
  return item && !item.skillIcon && !item.statProfiles;
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
  if (!instance || !definitions) return;
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
  if (!main) return null;
  if (main.parent && main.parent.type === "COMPONENT_SET") {
    return main.parent.componentPropertyDefinitions;
  }
  return main.componentPropertyDefinitions;
}

function findCardTemplate() {
  var sel = figma.currentPage.selection[0];
  if (sel) {
    if (sel.type === "COMPONENT" && sel.name === TEMPLATE_NAME) return sel;
    if (sel.type === "INSTANCE" && sel.mainComponent && sel.mainComponent.name === TEMPLATE_NAME) {
      return sel.mainComponent;
    }
  }
  return figma.currentPage.findOne(function (n) {
    return n.type === "COMPONENT" && n.name === TEMPLATE_NAME;
  });
}

function findIconVariant(variantName) {
  var set = figma.currentPage.findOne(function (n) {
    return n.type === "COMPONENT_SET" && n.name === "Icons";
  });
  if (!set) return null;
  return set.findOne(function (n) {
    return n.type === "COMPONENT" && n.name === variantName;
  });
}

function skillAppearanceKey(item, isTrait) {
  if (isTrait || !item) return "trait";
  if (item.skillIcon && SKILL_APPEARANCE_MODES[item.skillIcon]) return item.skillIcon;
  if (item.skillIcon) return item.skillIcon;
  return "trait";
}

function skillIconVariant(item, isTrait) {
  var key = skillAppearanceKey(item, isTrait);
  if (!isTrait && item && item.statProfiles && !item.skillIcon) return SKILL_ICON_VARIANTS.ultimate;
  return SKILL_ICON_VARIANTS[key] || SKILL_ICON_VARIANTS.skill_enemy;
}

function skillAppearanceModeName(item, isTrait) {
  var key = skillAppearanceKey(item, isTrait);
  if (!isTrait && item && item.statProfiles && !item.skillIcon) return SKILL_APPEARANCE_MODES.ultimate;
  return SKILL_APPEARANCE_MODES[key] || SKILL_APPEARANCE_MODES.skill_enemy;
}

// --- Color Ways -------------------------------------------------------------

var _colorWaysCache = null;
var _colorWaysTried = false;

async function getColorWaysCollection() {
  if (_colorWaysTried) return _colorWaysCache;
  _colorWaysTried = true;

  var cols = await figma.variables.getLocalVariableCollectionsAsync();
  var wanted = ["Red", "Blue", "Green", "Yellow"];
  var best = null;
  var bestScore = 0;

  for (var i = 0; i < cols.length; i++) {
    var col = cols[i];
    var modesByName = {};
    var score = 0;
    for (var j = 0; j < col.modes.length; j++) {
      var m = col.modes[j];
      modesByName[m.name] = m.modeId;
      if (wanted.indexOf(m.name) >= 0) score++;
    }
    if (/^color ways$/i.test(col.name)) score += 10;
    else if (/skill|appearance|faction|color.?way/i.test(col.name)) score += 2;
    if (score > bestScore) {
      bestScore = score;
      best = { collection: col, modesByName: modesByName };
    }
  }

  if (best && bestScore > 0) _colorWaysCache = best;
  return _colorWaysCache;
}

function resolveColorWayMode(faction) {
  if (!faction) return null;
  var raw = String(faction).trim();
  if (!raw) return null;
  var lower = raw.toLowerCase();
  if (COLOR_WAY_MODE_ALIASES[lower]) return COLOR_WAY_MODE_ALIASES[lower];
  var titled = raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
  if (COLOR_WAY_MODE_ALIASES[titled.toLowerCase()]) {
    return COLOR_WAY_MODE_ALIASES[titled.toLowerCase()];
  }
  return raw;
}

function applyColorWayMode(node, modeName) {
  if (!node || !modeName || !_colorWaysCache) return false;
  var modeId = _colorWaysCache.modesByName[modeName];
  if (!modeId) {
    var keys = Object.keys(_colorWaysCache.modesByName);
    for (var i = 0; i < keys.length; i++) {
      if (keys[i].toLowerCase() === modeName.toLowerCase()) {
        modeId = _colorWaysCache.modesByName[keys[i]];
        break;
      }
    }
  }
  if (!modeId) return false;
  try {
    node.setExplicitVariableModeForCollection(_colorWaysCache.collection, modeId);
    return true;
  } catch (e) {
    console.log("Color Ways mode failed:", modeName, e.message);
    return false;
  }
}

/** Lights only on clash + ultimate; color follows card colorway. */
function lightEffectsForColorWay(colorWay, enabled) {
  var flags = {
    "Show yellow light effect": false,
    "Show blue light effect": false,
    "Show red light effect": false,
    "Show green light effect": false,
  };
  if (!enabled) return flags;
  var mode = resolveColorWayMode(colorWay);
  var prop = mode && LIGHT_EFFECT_BY_MODE[mode];
  if (prop) flags[prop] = true;
  return flags;
}

// --- Card content builders --------------------------------------------------

function skillsToItems(skills, isTrait) {
  var items = [];
  if (!skills) return items;
  for (var i = 0; i < skills.length; i++) {
    items.push({ item: skills[i], isTrait: isTrait === true });
  }
  return items;
}

function buildIdentityItems(character) {
  var ch = character.champion;
  var items = [];
  if (ch.factionTrait) items.push({ item: ch.factionTrait, isTrait: true });
  if (ch.uniqueTraits) {
    for (var i = 0; i < ch.uniqueTraits.length && items.length < 3; i++) {
      items.push({ item: ch.uniqueTraits[i], isTrait: true });
    }
  }
  return items.slice(0, 3);
}

function buildUltimateItems(character) {
  var ch = character.champion;
  var items = [];
  if (ch.ultimate) items.push({ item: ch.ultimate, isTrait: false });
  if (ch.factionTrait) items.push({ item: ch.factionTrait, isTrait: true });
  if (ch.uniqueTraits && ch.uniqueTraits[0]) {
    items.push({ item: ch.uniqueTraits[0], isTrait: true });
  }
  return items.slice(0, 3);
}

function buildChampionItems(champion, phase) {
  var skills = phase === "plot" ? champion.plotSkills : champion.clashSkills;
  return skillsToItems(skills, false).slice(0, 3);
}

function buildFollowerItems(followers, phase) {
  var items = [];
  if (followers.traits && followers.traits[0]) {
    items.push({ item: followers.traits[0], isTrait: true });
  }
  var skills = phase === "plot" ? followers.plotSkills : followers.clashSkills;
  return items.concat(skillsToItems(skills, false)).slice(0, 3);
}

function cardJobs() {
  return [
    { label: "Identity", type: "identity", phase: "identity", withUltimate: false },
    { label: "Identity + Ultimate", type: "identity", phase: "ultimate", withUltimate: true },
    { label: "Champion plot", type: "champion", phase: "plot" },
    { label: "Champion clash", type: "champion", phase: "clash" },
    { label: "Follower plot", type: "follower", phase: "plot" },
    { label: "Follower clash", type: "follower", phase: "clash" },
  ];
}

function resolveCardContent(character, job) {
  var ch = character.champion;
  var f = character.followers;
  var cStats = ch.stats || {};
  var fStats = f.stats || {};
  var colorWay = character.colorWay || character.faction || "";
  var showLightEffect = job.withUltimate === true || job.phase === "clash";

  if (job.type === "identity") {
    return {
      name: character.name,
      faction: character.faction || "",
      colorWay: colorWay,
      showLightEffect: showLightEffect,
      phaseLabel: job.withUltimate ? "Ultimate" : "Identity",
      typeLabel: "Champion",
      speed: cStats.plotSpeed || "0",
      dodge: cStats.dodge || "0",
      protection: cStats.protection || "0",
      health: cStats.health || "0",
      showStats: true,
      items: job.withUltimate ? buildUltimateItems(character) : buildIdentityItems(character),
    };
  }

  if (job.type === "champion") {
    return {
      name: character.name,
      faction: character.faction || "",
      colorWay: colorWay,
      showLightEffect: showLightEffect,
      phaseLabel: job.phase === "plot" ? "Plot Phase" : "Clash Phase",
      typeLabel: "Champion",
      speed: (job.phase === "plot" ? cStats.plotSpeed : cStats.clashSpeed) || "0",
      dodge: cStats.dodge || "0",
      protection: cStats.protection || "0",
      health: cStats.health || "0",
      showStats: true,
      items: buildChampionItems(ch, job.phase),
    };
  }

  return {
    name: f.name || "Follower",
    faction: character.faction || "",
    colorWay: colorWay,
    showLightEffect: showLightEffect,
    phaseLabel: job.phase === "plot" ? "Plot Phase" : "Clash Phase",
    typeLabel: "Follower",
    speed: (job.phase === "plot" ? fStats.plotSpeed : fStats.clashSpeed) || "0",
    dodge: fStats.dodge || "0",
    protection: fStats.protection || "0",
    health: fStats.health || "0",
    showStats: true,
    items: buildFollowerItems(f, job.phase),
  };
}

// --- Fill colored "card" ----------------------------------------------------

async function fillSkillInstance(skillInst, item, isTrait) {
  if (!skillInst || skillInst.type !== "INSTANCE") return;
  var defs = getDefinitions(skillInst);
  var profiles = item && item.statProfiles ? item.statProfiles : [];
  var range = statTriple(profiles, "range");
  var accuracy = statTriple(profiles, "accuracy");
  var damage = statTriple(profiles, "damage");
  var showStats = !isTrait && !!(item && item.statProfiles);

  if (showStats) {
    var hasReal =
      (range[0] && range[0] !== "-") ||
      (accuracy[0] && accuracy[0] !== "-") ||
      (damage[0] && damage[0] !== "-") ||
      range[1] || accuracy[1] || damage[1];
    showStats = hasReal || !isTrait;
  }

  setComponentProps(skillInst, defs, {
    SkillName: item ? item.name : "",
    SkillText: item ? expandTokens(item.text) : "",
    RangeStat1: range[0],
    RangeStat2: range[1],
    RangeStat3: range[2],
    AccuracyStat1: accuracy[0],
    AccuracyStat2: accuracy[1],
    AccuracyStat3: accuracy[2],
    DamageStat1: damage[0],
    DamageStat2: damage[1],
    DamageStat3: damage[2],
    "Show Icon": true,
    "Show Skill Stats": isTrait ? false : showStats,
  });

  await getColorWaysCollection();
  var modeName = skillAppearanceModeName(item, isTrait);
  applyColorWayMode(skillInst, modeName);

  var variantName = skillIconVariant(item, isTrait);
  var target = findIconVariant(variantName);
  if (!target) return;

  var iconInst = null;
  var skillIconFrame = skillInst.findOne(function (n) { return n.name === "skillIcon"; });
  if (skillIconFrame && "findOne" in skillIconFrame) {
    iconInst = skillIconFrame.findOne(function (n) {
      return n.type === "INSTANCE" && n.name === "Icons";
    });
  }
  if (!iconInst) {
    iconInst = skillInst.findOne(function (n) {
      return n.type === "INSTANCE" && n.name === "Icons" &&
        n.mainComponent && n.mainComponent.parent &&
        n.mainComponent.parent.name === "Icons";
    });
  }
  if (iconInst) {
    try { iconInst.swapComponent(target); } catch (e) { /* ignore */ }
    applyColorWayMode(iconInst, modeName);
  }
}

async function configureColoredCard(root, content) {
  if (root.type !== "INSTANCE") return;

  var colorWayMode = resolveColorWayMode(content.colorWay || content.faction);
  var lights = lightEffectsForColorWay(colorWayMode, content.showLightEffect === true);
  var defs = getDefinitions(root);
  var props = {
    Speed: String(content.speed),
    Dodge: String(content.dodge),
    Protection: String(content.protection),
    Health: String(content.health),
    Name: content.name || "",
    Faction: content.faction || "",
    Phase: content.phaseLabel || "",
    Type: content.typeLabel || "",
    "Show stats": content.showStats !== false,
  };
  for (var lightKey in lights) {
    if (Object.prototype.hasOwnProperty.call(lights, lightKey)) {
      props[lightKey] = lights[lightKey];
    }
  }
  setComponentProps(root, defs, props);

  await getColorWaysCollection();
  if (colorWayMode) applyColorWayMode(root, colorWayMode);

  var skillNodes = root.findAll(function (n) {
    return n.name === "skill" && n.type === "INSTANCE";
  });
  var items = content.items || [];

  for (var i = 0; i < skillNodes.length; i++) {
    var slot = items[i];
    if (!slot) {
      skillNodes[i].visible = false;
      var parent = skillNodes[i].parent;
      if (parent && "children" in parent) {
        var idx = parent.children.indexOf(skillNodes[i]);
        var next = parent.children[idx + 1];
        var prev = parent.children[idx - 1];
        if (next && next.name === "divider") next.visible = false;
        if (prev && prev.name === "divider" && i === skillNodes.length - 1) prev.visible = false;
      }
      continue;
    }
    skillNodes[i].visible = true;
    var data = slot.item || slot;
    var isTrait = slot.isTrait != null ? slot.isTrait : isTraitItem(data);
    await fillSkillInstance(skillNodes[i], data, isTrait);
  }
}

// --- Generate ---------------------------------------------------------------

function gridPosition(originX, originY, index, cols, cellW, cellH) {
  return {
    x: originX + (index % cols) * cellW,
    y: originY + Math.floor(index / cols) * cellH,
  };
}

async function generateCharacterCards(characters, options) {
  var template = findCardTemplate();
  if (!template) {
    figma.notify('Select the "card" component, or place one named "card" on this page.');
    return;
  }

  var gap = 40;
  var cellW = template.width + 20 + gap;
  var cellH = template.height + 20 + gap;
  var cols = Math.max(1, parseInt(options.columns, 10) || CARDS_PER_CHARACTER);
  var originX = template.x;
  var originY = template.y + template.height + 120;

  var jobs = cardJobs();
  var cardIndex = 0;
  var totalCards = characters.length * CARDS_PER_CHARACTER;

  for (var c = 0; c < characters.length; c++) {
    var character = characters[c];
    var prefix = character.name || character.id || ("char_" + c);

    for (var j = 0; j < jobs.length; j++) {
      var job = jobs[j];
      var content = resolveCardContent(character, job);
      var node = template.createInstance();
      await configureColoredCard(node, content);

      var pos = gridPosition(originX, originY, cardIndex, cols, cellW, cellH);
      node.x = pos.x;
      node.y = pos.y;
      node.name = prefix + " — " + job.label;
      figma.currentPage.appendChild(node);
      cardIndex++;
      figma.ui.postMessage({ type: "progress", done: cardIndex, total: totalCards });
    }
  }

  figma.notify(
    "Generated " + cardIndex + " cards (" +
    characters.length + " × " + CARDS_PER_CHARACTER + ")."
  );
}

figma.ui.onmessage = async function (msg) {
  if (msg.type !== "generate") return;

  var parsed;
  try { parsed = JSON.parse(msg.json); }
  catch (e) { figma.notify("Invalid JSON: " + e.message); return; }

  var characters = normalizeCharacters(parsed);
  if (!characters.length) {
    figma.notify("No character JSON found. Each file needs champion, followers, and name.");
    return;
  }

  await generateCharacterCards(characters, { columns: msg.columns });
  figma.ui.postMessage({ type: "done" });
};
