# Card Data Populator — setup guide (built for ~100 cards)

A local Figma plugin that reads your card JSON and writes each value into the
matching layer in your design. It can do one card or **generate a whole roster
in a grid from an array of cards**. No external services or account needed.

---

## Philosophy for 100 cards: JSON is the source of truth

You do **not** hand-edit generated cards. Your masters are:
1. **One template frame** (the design), and
2. **Your JSON files** (the data).

To restyle every card, edit the template and **regenerate** — the plugin clears
the old output and rebuilds. Because regenerating is one click, you don't need
component instances to "propagate" edits, and you sidestep the biggest pain of a
100-card component library. Name-matching also means cards with different skill
counts or extra traits just work: layers with no data are skipped, data with no
layer is logged.

---

## The one rule that shapes the file

A plugin can freely set the text of a layer inside a **Frame**, but **not**
inside a component **instance** (locked unless exposed as a component property).
So build the card as a **Frame**, using Auto Layout + Text Styles for
consistency. Icons stay as instances — swapping an instance *is* allowed.

---

## 1. Build ONE template frame

- Frame sized to your card. Select it before running batch, or name it
  `CardTemplate` so the plugin finds it automatically.
- Auto Layout so skill lists reflow. Duplicate a styled skill row per skill
  (keep rows as plain frames/text, not components, so text stays writable).
- Design for the common structure; optional slots that get no data keep the
  template's placeholder text (hide or blank those rows in the rare cards that
  don't use them).

## 2. Name text layers with dot-paths

The plugin flattens each card and matches keys to layer **names**. Array items
use their index. Examples from your data:

| Layer name | Value |
|---|---|
| `name` | Han Solo |
| `champion.stats.health` | 5 |
| `champion.factionTrait.text` | A shaper moves the turn token… |
| `champion.uniqueTraits.0.name` | Co-Pilot |
| `champion.ultimate.name` | Asteroid Field |
| `champion.plotSkills.0.name` | Let the Wookiee Win |
| `champion.plotSkills.0.statProfiles.0.range` | 3 |
| `champion.clashSkills.1.name` | Pinning Shot |
| `followers.name` | Chewbacca |
| `followers.stats.protection` | 3 |
| `followers.plotSkills.1.statProfiles.0.accuracy` | 4 |

Name every layer you want filled once in the template; all 100 cards reuse it.

## 3. Icons (skillIcon)

Make a component per icon named exactly `skill_self`, `skill_friendly`,
`skill_area`, `skill_enemy`. Put one instance in the template and name the
**instance** with the dot-path (e.g. `champion.ultimate.skillIcon`). The plugin
reads the value and swaps the instance to the right icon. Keep the icon
components on the same page when you run it.

## 4. Combine your 100 JSON files into one array

The batch button wants a single JSON array. Two easy ways:

**jq (mac/Linux/Windows):**
```
jq -s '.' *_checked.json > all_cards.json
```

**Python (cross-platform):**
```python
import json, glob
cards = [json.load(open(f, encoding="utf-8")) for f in glob.glob("*_checked.json")]
json.dump(cards, open("all_cards.json", "w", encoding="utf-8"), indent=2)
```

(Or just select all 100 files at once in the plugin's file picker — it combines
them for you.)

## 5. Load the plugin

Figma **desktop** app → Plugins → Development → **Import plugin from manifest…**
→ pick `manifest.json` → run from Plugins → Development → Card Data Populator.

## 6. Generate the roster

1. Select your template frame (or name it `CardTemplate`).
2. Paste `all_cards.json` (or multi-select all files).
3. Set **columns** (e.g. 10), leave **Clear previously generated** checked.
4. **Generate all cards (grid)** — a progress bar tracks all 100.

Re-run any time after editing the template; it wipes the prior batch and rebuilds.
Single-card mode (top button) still works for spot-checks.

---

## Notes & limits

- **Inline tokens** like `{protection_boon}` in skill text drop in as literal
  text — Figma can't place an image mid-sentence. Either leave the token, or
  design the icon as its own adjacent layer.
- **Champion + follower on separate physical cards?** Either keep one combined
  template, or make a follower-only template whose layers are named
  `followers.plotSkills.0.name`, etc. The dot-paths already namespace them.
- Generated frames are tagged in plugin data, which is how "clear previous"
  finds them — it only deletes cards this plugin made.

---

## Alternative: a shared component library

Only worth it if these cards must be consumed as library components in *other*
files. Then build the card as a Component, add a **Text property** per field
named with the dot-path, and change `fillFrame` to call
`instance.setProperties(map)` instead of writing `node.characters`. More setup,
and variable skill counts get fiddly — which is why the regenerate-from-data
approach above is recommended for a 100-card set.
