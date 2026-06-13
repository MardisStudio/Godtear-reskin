"""Insert named icon placeholders into Godtear card text."""

from __future__ import annotations

import re
from typing import Callable, List, Tuple

APOS = r"[''\u2019]"


def icon(name: str) -> str:
    return "{" + name + "}"


ICON_RULES: List[Tuple[re.Pattern, Callable[[re.Match], str]]] = [
    # Bough Strike-style accuracy bonus from exceeding dodge
    (
        re.compile(
            rf"This skill gains equal to the amount the hit roll exceeds the target{APOS}s,\s*",
            re.I,
        ),
        lambda m: f"This skill gains {icon('accuracy')} equal to the amount the hit roll exceeds the target's {icon('dodge')}, ",
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
        lambda m: f"skills have +{m.group(1)} {icon('accuracy')} and +{m.group(2)} {icon('damage')}",
    ),
    (
        re.compile(r"skill has \+(\d+) and \+(\d+)", re.I),
        lambda m: f"skill has +{m.group(1)} {icon('accuracy')} and +{m.group(2)} {icon('damage')}",
    ),
    (
        re.compile(r"skill gains \+(\d+) and \+(\d+)", re.I),
        lambda m: f"skill gains +{m.group(1)} {icon('accuracy')} and +{m.group(2)} {icon('damage')}",
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
        lambda m: f"gains +{m.group(1)} {icon('accuracy')} and +{m.group(2)} {icon('damage')} for each",
    ),
    (
        re.compile(r"has -(\d+) and -(\d+) for each", re.I),
        lambda m: f"has -{m.group(1)} {icon('accuracy')} and -{m.group(2)} {icon('damage')} for each",
    ),
    (
        re.compile(r"has \+(\d+) and for each", re.I),
        lambda m: f"has +{m.group(1)} {icon('accuracy')} and {icon('damage')} for each",
    ),
    (
        re.compile(r"\+(\d+) against followers' hit rolls and \+(\d+) against followers' damage rolls", re.I),
        lambda m: f"+{m.group(1)} {icon('accuracy')} against followers' hit rolls and +{m.group(2)} {icon('damage')} against followers' damage rolls",
    ),
    (
        re.compile(r"this skill has \+(\d+)\.", re.I),
        lambda m: f"this skill has +{m.group(1)} {icon('accuracy')}.",
    ),
    (
        re.compile(r"gains \+(\d+) for that action", re.I),
        lambda m: f"gains +{m.group(1)} {icon('speed')} for that action",
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
        lambda m: f"After Jeen gains 1 or more wounds from an enemy skill, she may gain {icon('boon')} or {icon('blight')}.",
    ),
    (
        re.compile(r"has,, or,", re.I),
        lambda m: f"has {icon('move_blight')}, {icon('dodge_blight')}, or {icon('protection_blight')},",
    ),
    # Die roll references
    (
        re.compile(r"add 1 die to ([^']+?)'s roll", re.I),
        lambda m: f"add 1 {icon('accuracy')} die to {m.group(1)}'s roll",
    ),
    (
        re.compile(r"make a (\d+) damage roll", re.I),
        lambda m: f"make a {m.group(1)} {icon('damage')} damage roll",
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
        re.compile(r"remove up to 1 of ([^']+?)'s wounds", re.I),
        lambda m: f"remove up to 1 of {m.group(1)}'s {icon('wound')}s",
    ),
    (
        re.compile(r"remove 1 of ([^']+?)'s wounds", re.I),
        lambda m: f"remove 1 of {m.group(1)}'s {icon('wound')}s",
    ),
    (
        re.compile(r"does not have any wounds", re.I),
        lambda m: f"does not have any {icon('wound')}s",
    ),
    (
        re.compile(r"Clear a champion's wounds", re.I),
        lambda m: f"Clear a champion's {icon('wound')}s",
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
]


def fix_ocr(text: str) -> str:
    replacements = [
        (r"\bHalf usk\b", "Halftusk"),
        (r"\bT e\b", "The"),
        (r"\bAf er\b", "After"),
        (r"battleﬁ eld", "battlefield"),
        (r"diﬀ erent", "different"),
        (r"suﬀ ers", "suffers"),
        (r"aﬀ ect", "affect"),
        (r"aﬀ ected", "affected"),
        (r"Te ", "The "),
    ]
    for pattern, repl in replacements:
        text = re.sub(pattern, repl, text)
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
