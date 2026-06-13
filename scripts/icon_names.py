"""Insert named icon placeholders into Godtear card text."""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Callable, Dict, List, Tuple

APOS = r"(?:'|\u2019)"
ICONS_FILE = Path(__file__).resolve().parent.parent / "icons.json"


def icon(name: str) -> str:
    return "{" + name + "}"


def load_icon_ids(path: Path = ICONS_FILE) -> Dict[str, str]:
    """Load icon ids from icons.json keyed by category."""
    data = json.loads(path.read_text(encoding="utf-8"))
    ids: Dict[str, str] = {}
    for category, entries in data.get("categories", {}).items():
        for entry in entries:
            ids[entry["id"]] = category
    return ids


ICON_IDS = load_icon_ids()


def build_icon_rules() -> List[Tuple[re.Pattern, Callable[[re.Match], str]]]:
    """Build replacement rules aligned with icons.json."""
    rules: List[Tuple[re.Pattern, Callable[[re.Match], str]]] = [
        # OCR cleanup before icon insertion
        (re.compile(r"\bT en\b"), lambda m: "Then"),
        (re.compile(r"\bAf er\b", re.I), lambda m: "After"),
        (re.compile(r"\bHit Eff ect:?\b"), lambda m: "Hit Effect:"),
        (re.compile(r"\bHalf usk\b"), lambda m: "Halftusk"),
        (re.compile(r"\bT e\b"), lambda m: "The"),
        (re.compile(r"battleﬁ eld"), lambda m: "battlefield"),
        (re.compile(r"diﬀ erent"), lambda m: "different"),
        (re.compile(r"suﬀ ers"), lambda m: "suffers"),
        (re.compile(r"aﬀ ect\b"), lambda m: "affect"),
        (re.compile(r"aﬀ ected"), lambda m: "affected"),
        # Bough Strike-style accuracy bonus from exceeding dodge
        (
            re.compile(
                rf"This skill gains equal to the amount the hit roll exceeds the target{APOS}s,\s*",
                re.I,
            ),
            lambda m: (
                f"This skill gains {icon('accuracy')} equal to the amount the hit roll exceeds "
                f"the target's {icon('dodge')}, "
            ),
        ),
        (
            re.compile(rf"target{APOS}s,\s", re.I),
            lambda m: f"target's {icon('dodge')}, ",
        ),
        (
            re.compile(rf"target{APOS}s\s+dodge\s+exactly", re.I),
            lambda m: f"target's {icon('dodge')} exactly",
        ),
        (
            re.compile(r"to a maximum of (\d+) additional\.", re.I),
            lambda m: f"to a maximum of {m.group(1)} additional {icon('accuracy')}.",
        ),
        # Paired stat bonuses on skills
        (
            re.compile(r"skills have \+(\d+) and \+(\d+)", re.I),
            lambda m: (
                f"skills have +{m.group(1)} {icon('accuracy')} and +{m.group(2)} {icon('damage')}"
            ),
        ),
        (
            re.compile(r"skill has \+(\d+) and \+(\d+)", re.I),
            lambda m: (
                f"skill has +{m.group(1)} {icon('accuracy')} and +{m.group(2)} {icon('damage')}"
            ),
        ),
        (
            re.compile(r"skill gains \+(\d+) and \+(\d+)", re.I),
            lambda m: (
                f"skill gains +{m.group(1)} {icon('accuracy')} and +{m.group(2)} {icon('damage')}"
            ),
        ),
        (
            re.compile(r"skills have \+(\d+)\.", re.I),
            lambda m: f"skills have +{m.group(1)} {icon('accuracy')}.",
        ),
        (
            re.compile(r"skill has \+(\d+)\.", re.I),
            lambda m: f"skill has +{m.group(1)} {icon('accuracy')}.",
        ),
        (
            re.compile(r"skills have \+(\d+) for each", re.I),
            lambda m: f"skills have +{m.group(1)} {icon('accuracy')} for each",
        ),
        (
            re.compile(r"has \+(\d+) for each", re.I),
            lambda m: f"has +{m.group(1)} {icon('accuracy')} for each",
        ),
        (
            re.compile(r"has \+(\d+) and\.", re.I),
            lambda m: f"has +{m.group(1)} {icon('accuracy')} and {icon('damage')}.",
        ),
        (
            re.compile(r"has \+(\d+) and while", re.I),
            lambda m: f"has +{m.group(1)} {icon('accuracy')} and {icon('damage')} while",
        ),
        (
            re.compile(r"gains \+(\d+) and \+(\d+) for each", re.I),
            lambda m: (
                f"gains +{m.group(1)} {icon('accuracy')} and +{m.group(2)} {icon('damage')} "
                f"for each"
            ),
        ),
        (
            re.compile(r"has -(\d+) and -(\d+) for each", re.I),
            lambda m: (
                f"has -{m.group(1)} {icon('accuracy')} and -{m.group(2)} {icon('damage')} "
                f"for each"
            ),
        ),
        (
            re.compile(r"has \+(\d+) and for each", re.I),
            lambda m: f"has +{m.group(1)} {icon('accuracy')} and {icon('damage')} for each",
        ),
        (
            re.compile(
                r"\+(\d+) against followers' hit rolls and \+(\d+) against followers' damage rolls",
                re.I,
            ),
            lambda m: (
                f"+{m.group(1)} {icon('accuracy')} against followers' hit rolls and "
                f"+{m.group(2)} {icon('damage')} against followers' damage rolls"
            ),
        ),
        (
            re.compile(r"this skill has \+(\d+)\.", re.I),
            lambda m: f"this skill has +{m.group(1)} {icon('accuracy')}.",
        ),
        (
            re.compile(r"gains \+(\d+) for that action", re.I),
            lambda m: f"gains +{m.group(1)} {icon('speed')} for that action",
        ),
        # Phases and actions from icons.json
        (
            re.compile(r"\bPlot phase only\b", re.I),
            lambda m: f"{icon('plot_phase')} only",
        ),
        (
            re.compile(r"\bPlot phase\b", re.I),
            lambda m: icon("plot_phase"),
        ),
        (
            re.compile(r"\bClash phase\b", re.I),
            lambda m: icon("clash_phase"),
        ),
        (
            re.compile(r"\bmake (?:a )?claim actions?\b", re.I),
            lambda m: m.group(0).replace("claim", icon("claim"), 1),
        ),
        (
            re.compile(r"\btake (?:a )?claim actions?\b", re.I),
            lambda m: m.group(0).replace("claim", icon("claim"), 1),
        ),
        (
            re.compile(r"\bclaim actions?\b", re.I),
            lambda m: m.group(0).replace("claim", icon("claim"), 1),
        ),
        (
            re.compile(r"\bmake (?:a )?recruit actions?\b", re.I),
            lambda m: m.group(0).replace("recruit", icon("recruit"), 1),
        ),
        (
            re.compile(r"\btake (?:a )?recruit actions?\b", re.I),
            lambda m: m.group(0).replace("recruit", icon("recruit"), 1),
        ),
        (
            re.compile(r"\brecruit actions?\b", re.I),
            lambda m: m.group(0).replace("recruit", icon("recruit"), 1),
        ),
        (
            re.compile(r"\bmake (?:an )?advance actions?\b", re.I),
            lambda m: m.group(0).replace("advance", icon("advance"), 1),
        ),
        (
            re.compile(r"\badvance actions?\b", re.I),
            lambda m: m.group(0).replace("advance", icon("advance"), 1),
        ),
        (
            re.compile(r"\bmake (?:a )?rally actions?\b", re.I),
            lambda m: m.group(0).replace("rally", icon("rally"), 1),
        ),
        (
            re.compile(r"\brally actions?\b", re.I),
            lambda m: m.group(0).replace("rally", icon("rally"), 1),
        ),
        # Boon / blight patterns
        (
            re.compile(r"within range gain\.", re.I),
            lambda m: f"within range gain {icon('protection_boon')}.",
        ),
        (
            re.compile(r"adjacent to Landslide gain\.", re.I),
            lambda m: f"adjacent to Landslide gain {icon('protection_boon')}.",
        ),
        (
            re.compile(r"within range gain and\.", re.I),
            lambda m: f"within range gain {icon('boon')} and {icon('blight')}.",
        ),
        (
            re.compile(r"choose or\.", re.I),
            lambda m: f"choose {icon('boon')} or {icon('blight')}.",
        ),
        (
            re.compile(r", it gains or\.", re.I),
            lambda m: f", it gains {icon('boon')} or {icon('blight')}.",
        ),
        (
            re.compile(r"target gains or\.", re.I),
            lambda m: f"target gains {icon('boon')} or {icon('blight')}.",
        ),
        (
            re.compile(r"The target gains or\.", re.I),
            lambda m: f"The target gains {icon('boon')} or {icon('blight')}.",
        ),
        (
            re.compile(r"she gains or\.", re.I),
            lambda m: f"she gains {icon('boon')} or {icon('blight')}.",
        ),
        (
            re.compile(r"they gain\s*$", re.I),
            lambda m: f"they gain {icon('boon')}",
        ),
        (
            re.compile(
                r"After Jeen gains 1 or more wounds from an enemy skill, she may gain or\.",
                re.I,
            ),
            lambda m: (
                f"After Jeen gains 1 or more wounds from an enemy skill, "
                f"she may gain {icon('boon')} or {icon('blight')}."
            ),
        ),
        (
            re.compile(r"has,, or,", re.I),
            lambda m: (
                f"has {icon('move_blight')}, {icon('dodge_blight')}, or "
                f"{icon('protection_blight')},"
            ),
        ),
        (
            re.compile(r"\bthe boon you chose\b", re.I),
            lambda m: f"the {icon('boon')} you chose",
        ),
        (
            re.compile(r"\ba boon\b", re.I),
            lambda m: f"a {icon('boon')}",
        ),
        (
            re.compile(r"\ba blight\b", re.I),
            lambda m: f"a {icon('blight')}",
        ),
        # Banner references
        (
            re.compile(r"\bfriendly banners\b", re.I),
            lambda m: f"friendly {icon('banner')}s",
        ),
        (
            re.compile(r"\bchoose a banner\b", re.I),
            lambda m: f"choose a {icon('banner')}",
        ),
        (
            re.compile(rf"\btheir banner\b", re.I),
            lambda m: f"their {icon('banner')}",
        ),
        (
            re.compile(rf"\bhis banner\b", re.I),
            lambda m: f"his {icon('banner')}",
        ),
        (
            re.compile(rf"\bher banner\b", re.I),
            lambda m: f"her {icon('banner')}",
        ),
        (
            re.compile(rf"\ba banner\b", re.I),
            lambda m: f"a {icon('banner')}",
        ),
        (
            re.compile(rf"\bbanner is\b", re.I),
            lambda m: f"{icon('banner')} is",
        ),
        (
            re.compile(rf"\bbanner within\b", re.I),
            lambda m: f"{icon('banner')} within",
        ),
        # Die roll references
        (
            re.compile(r"add 1 die to ([^']+?)'s roll", re.I),
            lambda m: f"add 1 {icon('accuracy_die_boon')} to {m.group(1)}'s roll",
        ),
        (
            re.compile(r"make a (\d+) damage roll", re.I),
            lambda m: f"make a {m.group(1)} {icon('damage')} damage roll",
        ),
        (
            re.compile(r"\bhit roll\b", re.I),
            lambda m: f"{icon('accuracy')} hit roll",
        ),
        (
            re.compile(r"\bdamage roll\b", re.I),
            lambda m: f"{icon('damage')} damage roll",
        ),
        # Faction trait step bonus
        (
            re.compile(r"moves the turn token \+1 step when", re.I),
            lambda m: f"moves the turn token +1 {icon('step')} when",
        ),
        # Wound references
        (
            re.compile(r"gains 1 wound\.", re.I),
            lambda m: f"gains 1 {icon('wound')}.",
        ),
        (
            re.compile(r"gains 2 wounds\.", re.I),
            lambda m: f"gains 2 {icon('wound')}s.",
        ),
        (
            re.compile(r"remove 1 wound from", re.I),
            lambda m: f"remove 1 {icon('wound')} from",
        ),
        (
            re.compile(r"remove a wound from", re.I),
            lambda m: f"remove a {icon('wound')} from",
        ),
        (
            re.compile(rf"remove up to 1 of (.+?){APOS}s wounds\.?", re.I),
            lambda m: re.sub(r"wounds\.?$", f"{icon('wound')}s.", m.group(0), flags=re.I),
        ),
        (
            re.compile(rf"remove up to 2 of (.+?){APOS}s wounds\.?", re.I),
            lambda m: re.sub(r"wounds\.?$", f"{icon('wound')}s.", m.group(0), flags=re.I),
        ),
        (
            re.compile(rf"remove 1 of (.+?){APOS}s wounds\.?", re.I),
            lambda m: re.sub(r"wounds\.?$", f"{icon('wound')}s.", m.group(0), flags=re.I),
        ),
        (
            re.compile(r"does not have any wounds", re.I),
            lambda m: f"does not have any {icon('wound')}s",
        ),
        (
            re.compile(r"Clear a champion's wounds", re.I),
            lambda m: f"Clear a champion's {icon('wound')}s",
        ),
        (
            re.compile(r"\bwounds from\b", re.I),
            lambda m: f"{icon('wound')}s from",
        ),
        # Leading stat asterisk patterns (missing accuracy icon)
        (
            re.compile(r"^\* (\d+)", re.I),
            lambda m: f"{icon('accuracy')} {m.group(1)}",
        ),
        (
            re.compile(r"^(\d+)\* (\d+)\*", re.I),
            lambda m: f"{icon('accuracy')} {m.group(1)}* {icon('damage')} {m.group(2)}*",
        ),
        (
            re.compile(r"Hit Effect:\s*\.", re.I),
            lambda m: "Hit Effect:",
        ),
    ]
    return rules


ICON_RULES = build_icon_rules()


def fix_ocr(text: str) -> str:
    for pattern, repl in ICON_RULES[:8]:
        text = pattern.sub(repl, text)
    return text


def name_icons_in_text(text: str) -> str:
    if not text:
        return text
    text = fix_ocr(text)
    for pattern, repl in ICON_RULES:
        text = pattern.sub(repl, text)
    return text


def name_icons_in_card_data(data: dict) -> dict:
    """Apply icon naming to card text fields only."""

    def walk(obj):
        if isinstance(obj, dict):
            for key, value in obj.items():
                if key in ("text",) and isinstance(value, str):
                    obj[key] = name_icons_in_text(value)
                elif key not in ("iconPlaceholderFormat",):
                    walk(value)
        elif isinstance(obj, list):
            for item in obj:
                walk(item)

    walk(data)
    return data
