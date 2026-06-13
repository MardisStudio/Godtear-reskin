#!/usr/bin/env python3
"""Extract Godtear champion card data from PDF files into JSON."""

from __future__ import annotations

import json
import re
import sys
import unicodedata
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import fitz

from icon_names import name_icons_in_card_data

CHARACTERS_DIR = Path(__file__).resolve().parent.parent / "Characters"
OUTPUT_FILE = Path(__file__).resolve().parent.parent / "cards.json"
ICONS_FILE = Path(__file__).resolve().parent.parent / "icons.json"

COPYRIGHT_RE = re.compile(r"©|Copyright|Steamforged|Games Ltd|Generated|SFU|@", re.I)
STAT_TOKEN_RE = re.compile(r"^[\d\-]+[\*\+]?$")
FACTION_TRAIT_RE = re.compile(r"^(Guardian|Maelstrom|Shaper|Slayer) Champion$", re.I)
FOLLOWERS_HEADER_RE = re.compile(r"^(.+?) \| FOLLOWERS OF (.+)$", re.I)
CHAMPION_NAME_RE = re.compile(r"^[A-Z][A-Z\s']+$")


def parse_filename(path: Path) -> Tuple[str, str]:
    name = path.stem.replace("GT-Cards-Website-", "")
    faction, champion = name.split("-", 1)
    champion = champion.replace("-20250319", "").replace("-", " ")
    fixes = {"RaithMarid": "Raith'Marid", "SneakyPeet": "Sneaky Peet"}
    return faction, fixes.get(champion, champion)


def slugify(name: str) -> str:
    return name.lower().replace("'", "").replace(" ", "-")


def clean_text(text: str) -> str:
    text = unicodedata.normalize("NFKC", text)
    text = text.replace("\ufffd", "")
    text = text.replace("\ufb01", "fi").replace("\ufb02", "fl")
    text = text.replace("E\ufb00 ect", "Effect").replace("Eﬀ ect", "Effect")
    text = re.sub(r"\bHit Eff ect:?", "Hit Effect:", text)
    text = re.sub(r"\bT is skill\b", "This skill", text)
    text = re.sub(r"\bT en\b", "Then", text)
    text = re.sub(r"\bT e\b", "The", text)
    text = re.sub(r"\bAf er\b", "After", text, flags=re.I)
    text = re.sub(r"\s+", " ", text).strip()
    text = re.sub(r"\s+([,.;:!?])", r"\1", text)
    return text


def is_stat_token(token: str) -> bool:
    return token == "-" or bool(STAT_TOKEN_RE.match(token))


def expand_stat_tokens(parts: List[str]) -> List[str]:
    """Flatten segments like '7 1*' into separate stat tokens."""
    tokens = []
    for part in parts:
        subparts = part.split()
        if len(subparts) > 1 and all(is_stat_token(s) for s in subparts):
            tokens.extend(subparts)
        else:
            tokens.append(part)
    return tokens


def parse_stats_from_tokens(tokens: List[str]) -> Optional[Dict]:
    tokens = expand_stat_tokens(tokens)
    if len(tokens) < 3:
        return None
    keys = ["cost", "range", "accuracy", "damage"]
    stats = {}
    for i, token in enumerate(tokens[:4]):
        if is_stat_token(token):
            stats[keys[i]] = token
        else:
            return None
    return stats if len(stats) >= 3 else None


def parse_skill_after_name(parts: List[str]) -> Tuple[Optional[Dict], str]:
    """Parse stat tokens immediately after a skill name, then return remaining description."""
    tokens = expand_stat_tokens(parts)
    stat_tokens = []
    desc_start = 0
    for i, token in enumerate(tokens):
        if is_stat_token(token):
            stat_tokens.append(token)
            desc_start = i + 1
        else:
            break
    if len(stat_tokens) < 3:
        return None, clean_text(" ".join(tokens))
    stats = parse_stats_from_tokens(stat_tokens)
    desc = clean_text(" ".join(tokens[desc_start:]))
    return stats, desc


def extract_alt_profiles(text: str) -> Tuple[str, List[Dict]]:
    """Pull trailing alternate stat profiles from skill text."""
    profiles = []
    cleaned = text

    pipe_parts = [clean_text(p) for p in cleaned.split("|") if clean_text(p)]
    while len(pipe_parts) >= 4:
        stats = parse_stats_from_tokens(pipe_parts[-4:])
        if stats:
            profiles.insert(0, stats)
            pipe_parts = pipe_parts[:-4]
        else:
            break
    if profiles:
        cleaned = clean_text(" | ".join(pipe_parts))

    words = cleaned.split()
    while len(words) >= 4:
        chunk = words[-4:]
        stats = parse_stats_from_tokens(chunk)
        if stats and not any(word.lower().startswith("hit") for word in chunk):
            profiles.insert(0, stats)
            words = words[:-4]
            cleaned = clean_text(" ".join(words))
        else:
            break

    return cleaned, profiles


def is_pure_stat_block(parts: List[str]) -> bool:
    tokens = expand_stat_tokens(parts)
    return bool(tokens) and len(tokens) >= 3 and all(is_stat_token(token) for token in tokens)


def parse_block(text: str) -> Optional[Dict]:
    """Parse a single PDF text block into a skill or trait."""
    text = clean_text(text)
    if not text or COPYRIGHT_RE.search(text):
        return None
    if "FOLLOWERS OF" in text.upper():
        return None
    if re.match(r"^[A-Z][A-Z\s']+$", text) and len(text) < 20:
        return None
    if re.match(r"^[\d\-]+$", text):
        return None

    parts = [clean_text(p) for p in text.split("|") if clean_text(p)]
    if not parts:
        return None

    if is_pure_stat_block(parts):
        stats = parse_stats_from_tokens(expand_stat_tokens(parts))
        if stats:
            return {"type": "orphan_stats", **stats}
        return None

    name = parts[0]

    if FACTION_TRAIT_RE.match(name):
        return {
            "type": "faction_trait",
            "name": name,
            "text": clean_text(" ".join(parts[1:])),
        }

    stats, desc = parse_skill_after_name(parts[1:])
    if stats:
        desc, alt_profiles = extract_alt_profiles(desc)
        item = {"type": "skill", "name": name, **stats, "text": desc}
        if alt_profiles:
            item["altProfiles"] = alt_profiles
        return item

    # Continuation block for split trait text
    if name and name[0].islower():
        return {"type": "continuation", "text": clean_text(" ".join(parts))}

    if len(parts) == 1:
        if re.match(r"^[A-Z][a-z]+(\s[A-Z][a-z']+)*$", name):
            return {"type": "unique_trait", "name": name, "text": ""}
        return None

    return {
        "type": "unique_trait",
        "name": name,
        "text": clean_text(" ".join(parts[1:])),
    }


def classify_skill(skill: Dict) -> str:
    text = skill.get("text", "")
    if "Plot phase" in text:
        return "plot"
    if skill.get("range") not in (None, "-", "") or skill.get("accuracy") not in (None, "-", ""):
        return "clash"
    return "plot"


def merge_faction_trait_parts(items: List[Dict]) -> List[Dict]:
    """Merge split faction trait and continuation blocks."""
    merged = []
    for item in items:
        if item.get("type") == "continuation":
            if merged and merged[-1].get("type") == "faction_trait":
                merged[-1]["text"] = clean_text(merged[-1].get("text", "") + " " + item["text"])
            elif merged and merged[-1].get("type") == "unique_trait":
                merged[-1]["text"] = clean_text(merged[-1].get("text", "") + " " + item["text"])
            continue

        if item.get("type") == "unique_trait" and merged and merged[-1].get("type") == "faction_trait":
            if item["name"].lower().startswith(("moves", "they", "when")):
                merged[-1]["text"] = clean_text(
                    merged[-1].get("text", "") + " " + item["name"] + " " + item.get("text", "")
                )
                continue

        merged.append(item)
    return merged


def extract_stat_numbers(page) -> Dict:
    """Extract champion and follower stat diamonds from standalone number blocks."""
    stat_blocks = []
    for block in page.get_text("dict")["blocks"]:
        if block["type"] != 0:
            continue
        text = clean_text("".join(s["text"] for line in block["lines"] for s in line["spans"]))
        if not text or COPYRIGHT_RE.search(text):
            continue
        if re.match(r"^[\d\-]+$", text):
            x0, y0, x1, y1 = block["bbox"]
            stat_blocks.append({"value": text, "x": (x0 + x1) / 2, "y": (y0 + y1) / 2})

    def cluster_stats(blocks, y_min, y_max):
        zone_blocks = [b for b in blocks if y_min <= b["y"] <= y_max]
        if not zone_blocks:
            return {}

        y_values = sorted(set(round(b["y"]) for b in zone_blocks))
        row_centers = []
        for y in y_values:
            if not row_centers or y - row_centers[-1] > 15:
                row_centers.append(y)

        columns = {}
        for b in zone_blocks:
            row_idx = min(range(len(row_centers)), key=lambda i: abs(b["y"] - row_centers[i]))
            col = round(b["x"] / 180)
            columns.setdefault(col, {})[row_idx] = b["value"]
        return columns

    champion_cols = cluster_stats(stat_blocks, 35, 130)
    follower_cols = cluster_stats(stat_blocks, 320, 420)

    def col_to_stats(col: dict, labels: List[str]) -> Optional[Dict]:
        if len(col) < 4:
            return None
        return {labels[i]: col.get(i) for i in range(4)}

    champion_stats = []
    for col_idx in sorted(champion_cols.keys()):
        stats = col_to_stats(champion_cols[col_idx], ["speed", "dodge", "protection", "health"])
        if stats:
            champion_stats.append(stats)
    follower_stats = []
    for col_idx in sorted(follower_cols.keys()):
        stats = col_to_stats(follower_cols[col_idx], ["speed", "dodge", "protection", "count"])
        if stats:
            follower_stats.append(stats)

    return {"champion": champion_stats, "follower": follower_stats}


def merge_champion_stats(stats_list: List[Dict]) -> Dict:
    if not stats_list:
        return {}
    base = stats_list[0]
    result = {
        "dodge": base.get("dodge"),
        "protection": base.get("protection"),
        "health": base.get("health"),
    }
    speeds = [s.get("speed") for s in stats_list if s.get("speed") is not None]
    unique_speeds = list(dict.fromkeys(speeds))
    if len(unique_speeds) == 2:
        result["plotSpeed"] = unique_speeds[0]
        result["clashSpeed"] = unique_speeds[1]
    elif unique_speeds:
        result["speed"] = unique_speeds[0]
    return result


def attach_orphan_stat_blocks(items: List[Dict]) -> List[Dict]:
    """Attach stat-only blocks (e.g. '6 | - | 6 | -') to the previous skill."""
    cleaned = []
    for item in items:
        if item.get("type") == "orphan_stats":
            if cleaned and cleaned[-1].get("type") == "skill":
                profile = {k: item[k] for k in ("cost", "range", "accuracy", "damage") if k in item}
                cleaned[-1].setdefault("altProfiles", []).append(profile)
                continue
            continue
        if item.get("type") == "skill" and re.match(r"^[\d\-]+(?:\s[\d\-]+[\*\+]?)*$", item.get("name", "")):
            if cleaned and cleaned[-1].get("type") == "skill":
                profile = {k: item[k] for k in ("cost", "range", "accuracy", "damage") if k in item}
                cleaned[-1].setdefault("altProfiles", []).append(profile)
                continue
        cleaned.append(item)
    return cleaned


def dedupe_items(items: List[Dict]) -> List[Dict]:
    seen = {}
    for item in items:
        key = (item.get("type"), item.get("name", "").lower())
        if key not in seen:
            seen[key] = item
        else:
            existing = seen[key]
            for field in ("text", "cost", "range", "accuracy", "damage", "altProfiles"):
                if field in item and item[field] and field not in existing:
                    existing[field] = item[field]
                elif field == "text" and item.get(field) and item[field] not in existing.get(field, ""):
                    existing[field] = clean_text(existing.get(field, "") + " " + item[field])
    return list(seen.values())


def parse_pdf(path: Path) -> Dict:
    faction, champion = parse_filename(path)
    doc = fitz.open(path)
    page = doc[0]

    stat_data = extract_stat_numbers(page)
    champion_stats = merge_champion_stats(stat_data["champion"])
    follower_stats = stat_data["follower"][0] if stat_data["follower"] else None

    champion_items = []
    follower_items = []
    follower_name = None

    for block in page.get_text("dict")["blocks"]:
        if block["type"] != 0:
            continue
        x0, y0, x1, y1 = block["bbox"]
        text = clean_text(
            " | ".join("".join(s["text"] for s in line["spans"]) for line in block["lines"])
        )
        if not text or COPYRIGHT_RE.search(text):
            continue
        if re.match(r"^[\d\-]+$", text):
            continue

        if "FOLLOWERS OF" in text.upper():
            m = re.search(r"([A-Z][A-Z\s']+?)\s*\|\s*FOLLOWERS OF", text, re.I)
            if m:
                follower_name = m.group(1).strip().title()
            else:
                lines_in_block = [
                    clean_text("".join(s["text"] for s in line["spans"])) for line in block["lines"]
                ]
                for idx, line_text in enumerate(lines_in_block):
                    if re.match(r"^FOLLOWERS OF", line_text, re.I) and idx > 0:
                        follower_name = lines_in_block[idx - 1].title()
                        break

        item = parse_block(text)
        if not item:
            continue
        if y0 < 300:
            champion_items.append(item)
        else:
            follower_items.append(item)

    doc.close()

    champion_items = attach_orphan_stat_blocks(merge_faction_trait_parts(dedupe_items(champion_items)))
    follower_items = attach_orphan_stat_blocks(dedupe_items(follower_items))

    faction_trait = None
    unique_traits = []
    plot_skills = []
    clash_skills = []

    for item in champion_items:
        if item["type"] == "faction_trait":
            faction_trait = {"name": item["name"], "text": item["text"]}
        elif item["type"] == "unique_trait":
            unique_traits.append({
                "name": clean_text(item["name"]),
                "text": item["text"],
            })
        elif item["type"] == "skill":
            entry = {k: v for k, v in item.items() if k != "type"}
            if isinstance(entry.get("name"), str):
                entry["name"] = clean_text(entry["name"])
            if classify_skill(item) == "plot":
                plot_skills.append(entry)
            else:
                clash_skills.append(entry)

    f_traits = []
    f_plot = []
    f_clash = []
    for item in follower_items:
        if item["type"] == "unique_trait":
            f_traits.append({"name": item["name"], "text": item["text"]})
        elif item["type"] == "skill":
            entry = {k: v for k, v in item.items() if k != "type"}
            if isinstance(entry.get("name"), str):
                entry["name"] = clean_text(entry["name"])
            if classify_skill(item) == "clash":
                f_clash.append(entry)
            else:
                f_plot.append(entry)

    if not follower_name:
        follower_name = guess_follower_name(champion, follower_items)

    result = {
        "id": slugify(champion),
        "name": champion,
        "faction": faction,
        "champion": {
            "stats": champion_stats,
            "factionTrait": faction_trait,
            "uniqueTraits": unique_traits,
            "plotSkills": plot_skills,
            "clashSkills": clash_skills,
        },
        "followers": {
            "name": follower_name,
            "stats": follower_stats,
            "traits": f_traits,
            "plotSkills": f_plot,
            "clashSkills": f_clash,
        },
    }
    return name_icons_in_card_data(result)


FOLLOWER_NAMES = {
    "durthax": "Treekin",
    "finvarr": "Shadow Sentinels",
    "halftusk": "Boarfolk",
    "helena": "Shield Maidens",
    "jaak": "Crew",
    "mournblade": "Shades",
    "rhodri": "Thunder Brothers",
    "blackjaw": "Hounds",
    "fenra": "Chainless Curs",
    "grimgut": "Maggotkin",
    "jeen": "Spites",
    "kailinn": "Elementals",
    "luella": "Hogs",
    "titus": "Cohort",
    "landslide": "Rocklings",
    "lily": "Thornlings",
    "nia": "Froggies",
    "raith'marid": "Daughters of the Deep",
    "rattlebone": "Bone Crow",
    "styx": "Hags",
    "keera": "Huntresses",
    "lorsann": "House Guard",
    "maxen": "Paladins",
    "morrigan": "Crows",
    "rangosh": "Blood Claws",
    "skullbreaker": "Ogres",
    "sneaky peet": "Sneaky Stabbers",
}


def guess_follower_name(champion: str, items: List[Dict]) -> Optional[str]:
    return FOLLOWER_NAMES.get(champion.lower())


def main():
    characters_dir = Path(sys.argv[1]) if len(sys.argv) > 1 else CHARACTERS_DIR
    output_file = Path(sys.argv[2]) if len(sys.argv) > 2 else OUTPUT_FILE

    pdfs = sorted(characters_dir.glob("GT-Cards-Website-*.pdf"))
    if not pdfs:
        print(f"No PDF files found in {characters_dir}", file=sys.stderr)
        sys.exit(1)

    champions = []
    for pdf in pdfs:
        try:
            data = parse_pdf(pdf)
            champions.append(data)
            print(f"Parsed {data['name']} ({data['faction']})", file=sys.stderr)
        except Exception as exc:
            print(f"Error parsing {pdf.name}: {exc}", file=sys.stderr)
            raise

    output = {
        "game": "Godtear",
        "version": "1.0",
        "iconReference": "icons.json",
        "iconPlaceholderFormat": "{icon_id}",
        "championCount": len(champions),
        "champions": sorted(champions, key=lambda c: (c["faction"], c["name"])),
    }

    output_file.write_text(
        json.dumps(output, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    print(f"Wrote {len(champions)} champions to {output_file}", file=sys.stderr)


if __name__ == "__main__":
    main()
