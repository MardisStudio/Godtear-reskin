# God Tear Card Generator

Local Figma plugin that maps character JSON → **6 cards per champion**.

## What it generates

| # | Card | JSON source |
|---|---|---|
| 1 | Identity | `champion.factionTrait` + `champion.uniqueTraits` |
| 2 | Identity + Ultimate | `champion.ultimate` + traits |
| 3 | Champion plot | `champion.stats` (plot speed) + `champion.plotSkills` |
| 4 | Champion clash | `champion.stats` (clash speed) + `champion.clashSkills` |
| 5 | Follower plot | `followers.*` + trait + `plotSkills` |
| 6 | Follower clash | `followers.*` + trait + `clashSkills` |

## Template

Keep a component named **`card`** on the Card Templates page. The plugin creates instances (not detached) and sets:

- Stats / Name / Faction / Phase / Type / Show stats
- Nested `skill` props + Icons
- Color Ways mode from `faction`
- Light effect on clash + Identity+Ultimate only

## Run it

1. Figma → Plugins → Development → **Import plugin from manifest…** → this folder  
   (or use the symlink at `God Tear/Figma Plugin` if already imported)
2. Open the God Tear file, Card Templates page
3. Run **Card Data Populator** → load JSON → **Generate**

## Faction → Color Ways + light

| Faction (JSON) | Color Ways | Light |
|---|---|---|
| Tactician / Shaper | Green | green |
| Sentinel / Guardian | Blue | blue |
| Duelist / Slayer | Red | red |
| Marauders / Maelstrom | Yellow | yellow |

| `skillIcon` | Icon | Appearance |
|---|---|---|
| `skill_enemy` | Target Enemy | Red |
| `skill_friendly` / `skill_self` | Target Ally / Self | Blue |
| `skill_area` | Target Area | Green |
| traits | Passive | Yellow |
