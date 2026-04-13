#!/usr/bin/env python3
"""
Normalize subtitle and transcript files into clean text and a traceable segment map.
"""

from __future__ import annotations

import argparse
import html
import json
import re
from pathlib import Path
from typing import Iterable


SUPPORTED_EXTENSIONS = {".srt", ".vtt", ".txt", ".md"}
NOISE_ONLY_PATTERNS = [
    re.compile(r"^\[?(music|applause|laughter|laughing|silence|inaudible)\]?$", re.IGNORECASE),
    re.compile(r"^\(?music\)?$", re.IGNORECASE),
]
LEADING_FILLER_RE = re.compile(
    r"^(?:(?:uh+|um+|erm+|ah+|hmm+|you know|i mean|like|sort of|kind of)[,\s]+){1,4}",
    re.IGNORECASE,
)
TAG_RE = re.compile(r"</?[^>]+>")
TURN_MARKER_RE = re.compile(r"\s*>>\s*")
TIMESTAMP_RE = re.compile(
    r"^\s*(?P<start>\d{2}:\d{2}:\d{2}[,\.]\d{3}|\d{2}:\d{2}[,\.]\d{3})\s*-->\s*"
    r"(?P<end>\d{2}:\d{2}:\d{2}[,\.]\d{3}|\d{2}:\d{2}[,\.]\d{3})(?:\s+.*)?$"
)
VTT_SPEAKER_RE = re.compile(r"^<v(?:\.[^>\s]+)?\s+([^>]+)>(.*)$", re.IGNORECASE)
SPEAKER_PREFIX_RE = re.compile(
    r"^(?:-\s*)?(?P<speaker>(?:[A-Z][A-Za-z0-9&.'-]*|[A-Z]{2,})(?:\s+(?:[A-Z][A-Za-z0-9&.'-]*|[A-Z]{2,})){0,3})\s*:\s+(?P<text>.+)$"
)
NORMALIZED_TEXT_RE = re.compile(r"\W+", re.UNICODE)
WORD_RE = re.compile(r"[A-Za-z0-9]+(?:'[A-Za-z0-9]+)?")
QUESTION_STARTERS = (
    "how ",
    "why ",
    "what ",
    "when ",
    "where ",
    "who ",
    "do you",
    "did you",
    "are you",
    "is it",
    "can you",
    "could you",
    "would you",
    "will you",
    "walk me through",
    "explain",
    "tell me",
    "curious",
    "paint that picture",
    "handicap for me",
    "let's talk about",
)
ANSWER_STARTERS = (
    "well",
    "look",
    "i think",
    "i mean",
    "let me",
    "first off",
    "to me",
    "my view is",
    "the way",
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Normalize subtitle files into clean text plus JSON segments."
    )
    parser.add_argument(
        "inputs",
        nargs="+",
        help="Subtitle files or directories containing subtitle files.",
    )
    parser.add_argument(
        "--output-dir",
        default="normalized",
        help="Directory for .clean.txt and .segments.json outputs. Default: normalized",
    )
    parser.add_argument(
        "--gap-seconds",
        type=float,
        default=1.5,
        help="Maximum time gap for considering adjacent cues part of the same thought.",
    )
    parser.add_argument(
        "--keep-fillers",
        action="store_true",
        help="Keep leading filler phrases instead of stripping them conservatively.",
    )
    return parser.parse_args()


def to_seconds(timestamp: str) -> float:
    timestamp = timestamp.replace(",", ".")
    parts = timestamp.split(":")
    if len(parts) == 2:
        hours = 0
        minutes, seconds = parts
    else:
        hours, minutes, seconds = parts
    return int(hours) * 3600 + int(minutes) * 60 + float(seconds)


def format_timestamp(seconds: float) -> str:
    if seconds < 0:
        seconds = 0
    total_ms = int(round(seconds * 1000))
    hours, remainder = divmod(total_ms, 3600 * 1000)
    minutes, remainder = divmod(remainder, 60 * 1000)
    secs, ms = divmod(remainder, 1000)
    return f"{hours:02d}:{minutes:02d}:{secs:02d}.{ms:03d}"


def normalize_whitespace(text: str) -> str:
    text = text.replace("\u00a0", " ").replace("\u200b", "")
    text = text.replace("...", "...")
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def clean_caption_text(text: str, keep_fillers: bool) -> str:
    text = html.unescape(text)
    text = text.replace("-->", " ")
    text = TURN_MARKER_RE.sub(" ", text)
    text = TAG_RE.sub("", text)
    text = normalize_whitespace(text)
    if not keep_fillers:
        text = LEADING_FILLER_RE.sub("", text)
        text = normalize_whitespace(text)
    return text


def is_noise_only(text: str) -> bool:
    if not text:
        return True
    stripped = text.strip()
    for pattern in NOISE_ONLY_PATTERNS:
        if pattern.fullmatch(stripped):
            return True
    return False


def normalized_key(text: str) -> str:
    return NORMALIZED_TEXT_RE.sub("", text.casefold())


def split_speaker(text: str) -> tuple[str | None, str]:
    text = html.unescape(text)

    vtt_match = VTT_SPEAKER_RE.match(normalize_whitespace(text))
    if vtt_match:
        speaker = normalize_whitespace(vtt_match.group(1))
        body = normalize_whitespace(vtt_match.group(2))
        return (speaker or None, body)

    cleaned_text = clean_caption_text(text, keep_fillers=True)
    match = SPEAKER_PREFIX_RE.match(cleaned_text)
    if not match:
        return (None, cleaned_text)

    speaker = normalize_whitespace(match.group("speaker"))
    body = normalize_whitespace(match.group("text"))
    if len(speaker.split()) > 4:
        return (None, cleaned_text)
    return (speaker, body)


def join_text(previous: str, current: str) -> str:
    if not previous:
        return current
    if not current:
        return previous
    if previous.endswith("-") and current[:1].islower():
        return previous[:-1] + current
    if current[0] in ",.;:!?)]}":
        return previous + current
    return previous + " " + current


def is_continuation(previous_text: str, current_text: str) -> bool:
    if not previous_text:
        return False
    if not current_text:
        return False
    if previous_text.endswith(("-", "/", "(", "[")):
        return True
    if not re.search(r"[.!?]([\"')\]]*)$", previous_text):
        return True
    if current_text[:1].islower():
        return True
    if current_text.lower().startswith(
        (
            "and ",
            "but ",
            "so ",
            "because ",
            "which ",
            "that ",
            "then ",
            "also ",
            "plus ",
            "or ",
        )
    ):
        return True
    if len(previous_text.split()) <= 6:
        return True
    return False


def load_blocks(path: Path) -> list[list[str]]:
    text = path.read_text(encoding="utf-8-sig")
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    blocks = re.split(r"\n{2,}", text)
    return [block.split("\n") for block in blocks if block.strip()]


def load_meta_for_source(path: Path) -> dict:
    meta_path = path.with_suffix(".meta.json")
    if not meta_path.exists():
        return {}
    try:
        payload = json.loads(meta_path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return {}
    return payload if isinstance(payload, dict) else {}


def split_turn_chunks(lines: list[str]) -> list[dict]:
    chunks: list[dict] = []
    for raw_line in lines:
        line = html.unescape(raw_line)
        if not line.strip():
            continue
        parts = TURN_MARKER_RE.split(line)
        line_starts_turn = bool(re.match(r"^\s*>>\s*", line))
        for index, part in enumerate(parts):
            text = normalize_whitespace(part)
            if not text:
                continue
            explicit_turn = line_starts_turn if index == 0 else True
            chunks.append({"text": text, "explicit_turn": explicit_turn})
    return chunks


def parse_caption_file(path: Path, keep_fillers: bool) -> list[dict]:
    blocks = load_blocks(path)
    parsed = []
    cue_counter = 0

    for block in blocks:
        lines = [line.strip("\ufeff") for line in block if line.strip()]
        if not lines:
            continue

        if lines[0].upper() == "WEBVTT":
            continue
        if lines[0].startswith("NOTE"):
            continue

        line_index = 0
        source_index = 0
        if re.fullmatch(r"\d+", lines[0]):
            source_index = int(lines[0])
            line_index = 1
        if line_index >= len(lines):
            continue

        timestamp_match = TIMESTAMP_RE.match(lines[line_index])
        if not timestamp_match:
            continue

        text_lines = lines[line_index + 1 :]
        if not text_lines:
            continue

        cue_counter += 1
        if source_index == 0:
            source_index = cue_counter

        chunks = split_turn_chunks(text_lines)
        if not chunks:
            continue

        for chunk in chunks:
            speaker, cleaned_text = split_speaker(chunk["text"])
            cleaned_text = clean_caption_text(cleaned_text, keep_fillers)
            if is_noise_only(cleaned_text):
                continue

            boundary_reason = None
            if chunk["explicit_turn"]:
                boundary_reason = "chevron"
            elif speaker:
                boundary_reason = "named_speaker"

            parsed.append(
                {
                    "index": source_index,
                    "start_seconds": to_seconds(timestamp_match.group("start")),
                    "end_seconds": to_seconds(timestamp_match.group("end")),
                    "speaker": speaker,
                    "text": cleaned_text,
                    "source": path.name,
                    "source_indices": [source_index],
                    "explicit_turn": chunk["explicit_turn"] or bool(speaker),
                    "turn_boundary_reason": boundary_reason,
                }
            )

    return parsed


def parse_plain_text_file(path: Path, keep_fillers: bool) -> list[dict]:
    text = path.read_text(encoding="utf-8-sig")
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    paragraphs = [chunk.strip() for chunk in re.split(r"\n{2,}", text) if chunk.strip()]
    parsed = []

    for index, paragraph in enumerate(paragraphs, start=1):
        speaker, cleaned_text = split_speaker(paragraph)
        cleaned_text = clean_caption_text(cleaned_text, keep_fillers)
        if is_noise_only(cleaned_text):
            continue
        parsed.append(
            {
                "index": index,
                "start_seconds": float(index - 1),
                "end_seconds": float(index),
                "speaker": speaker,
                "text": cleaned_text,
                "source": path.name,
                "source_indices": [index],
                "explicit_turn": True,
                "turn_boundary_reason": "paragraph",
            }
        )

    return parsed


def unique_preserve(values: list[int]) -> list[int]:
    seen = set()
    ordered = []
    for value in values:
        if value in seen:
            continue
        seen.add(value)
        ordered.append(value)
    return ordered


def dedupe_segments(segments: list[dict]) -> list[dict]:
    deduped = []
    previous_key = None
    for segment in segments:
        key = (segment.get("speaker") or "", normalized_key(segment["text"]))
        if key == previous_key and not segment.get("explicit_turn"):
            deduped[-1]["end_seconds"] = max(deduped[-1]["end_seconds"], segment["end_seconds"])
            deduped[-1]["source_indices"].extend(segment["source_indices"])
            continue
        deduped.append(segment)
        previous_key = key
    return deduped


def merge_segments(segments: list[dict], gap_seconds: float) -> list[dict]:
    merged: list[dict] = []
    for segment in dedupe_segments(segments):
        if not merged:
            merged.append(
                {
                    "index": len(merged) + 1,
                    "start_seconds": segment["start_seconds"],
                    "end_seconds": segment["end_seconds"],
                    "speaker": segment.get("speaker"),
                    "text": segment["text"],
                    "source": segment["source"],
                    "source_indices": segment["source_indices"][:],
                    "explicit_turn": segment.get("explicit_turn", False),
                    "turn_boundary_reason": segment.get("turn_boundary_reason"),
                }
            )
            continue

        previous = merged[-1]
        gap = segment["start_seconds"] - previous["end_seconds"]
        same_speaker = previous.get("speaker") == segment.get("speaker")
        compatible_speaker = same_speaker or not previous.get("speaker") or not segment.get("speaker")

        if (
            not segment.get("explicit_turn")
            and compatible_speaker
            and gap <= gap_seconds
            and is_continuation(previous["text"], segment["text"])
        ):
            previous["text"] = join_text(previous["text"], segment["text"])
            previous["end_seconds"] = segment["end_seconds"]
            previous["speaker"] = previous.get("speaker") or segment.get("speaker")
            previous["source_indices"].extend(segment["source_indices"])
            continue

        merged.append(
            {
                "index": len(merged) + 1,
                "start_seconds": segment["start_seconds"],
                "end_seconds": segment["end_seconds"],
                "speaker": segment.get("speaker"),
                "text": segment["text"],
                "source": segment["source"],
                "source_indices": segment["source_indices"][:],
                "explicit_turn": segment.get("explicit_turn", False),
                "turn_boundary_reason": segment.get("turn_boundary_reason"),
            }
        )

    return merged


def word_count(text: str) -> int:
    return len(WORD_RE.findall(text))


def is_question_candidate(text: str) -> bool:
    stripped = text.strip()
    lowered = stripped.casefold()
    if "?" in stripped:
        return True
    return lowered.startswith(QUESTION_STARTERS)


def is_interjection_candidate(text: str) -> bool:
    if is_question_candidate(text):
        return False
    return word_count(text) <= 5


def is_answer_opener(text: str) -> bool:
    return text.strip().casefold().startswith(ANSWER_STARTERS)


def host_label_from_meta(meta: dict) -> str | None:
    hosts = meta.get("hosts")
    if isinstance(hosts, list):
        cleaned = [normalize_whitespace(str(item)) for item in hosts if str(item).strip()]
        if len(cleaned) == 1:
            return cleaned[0]
        if len(cleaned) > 1:
            return "Host/Panel"
    return None


def guest_label_from_meta(meta: dict) -> str | None:
    primary_guest = meta.get("primary_guest")
    if isinstance(primary_guest, str) and primary_guest.strip():
        return normalize_whitespace(primary_guest)
    guests = meta.get("guests")
    if isinstance(guests, list):
        cleaned = [normalize_whitespace(str(item)) for item in guests if str(item).strip()]
        if len(cleaned) == 1:
            return cleaned[0]
    return None


def annotate_segments(segments: list[dict], meta: dict) -> list[dict]:
    host_label = host_label_from_meta(meta)
    guest_label = guest_label_from_meta(meta)

    turns: list[list[int]] = []
    current_turn: list[int] = []
    for index, segment in enumerate(segments):
        if not current_turn or segment.get("explicit_turn"):
            if current_turn:
                turns.append(current_turn)
            current_turn = [index]
        else:
            current_turn.append(index)
    if current_turn:
        turns.append(current_turn)

    previous_role = "statement"
    for turn_id, turn in enumerate(turns, start=1):
        turn_segments = [segments[index] for index in turn]
        combined_text = " ".join(segment["text"] for segment in turn_segments).strip()
        first_text = turn_segments[0]["text"].strip()
        total_words = sum(word_count(segment["text"]) for segment in turn_segments)

        role_hint = "statement"
        role_confidence = "low"
        if total_words <= 5:
            role_hint = "interjection_candidate"
        elif previous_role == "question_candidate" and total_words >= 8 and not is_question_candidate(first_text):
            role_hint = "respondent_candidate"
            role_confidence = "medium"
        elif is_answer_opener(first_text) and total_words >= 8:
            role_hint = "respondent_candidate"
            role_confidence = "medium"
        elif is_question_candidate(first_text):
            role_hint = "question_candidate"
            role_confidence = "medium"
        elif combined_text.endswith("?") and total_words <= 80:
            role_hint = "question_candidate"
            role_confidence = "low"

        for segment in turn_segments:
            segment["turn_id"] = turn_id
            segment["word_count"] = word_count(segment["text"])
            segment["role_hint"] = role_hint
            segment["role_confidence"] = role_confidence
            segment["speaker_confidence"] = "explicit" if segment.get("speaker") else "unknown"

            if segment.get("speaker"):
                continue

            if guest_label and role_hint == "respondent_candidate":
                segment["speaker_guess"] = guest_label
                segment["speaker_guess_confidence"] = "meta-role"
            elif host_label and role_hint in {"question_candidate", "interjection_candidate"}:
                segment["speaker_guess"] = host_label
                segment["speaker_guess_confidence"] = "meta-role"

        previous_role = role_hint

    return segments


def render_segment_prefix(segment: dict) -> str:
    speaker = segment.get("speaker")
    if speaker:
        return f"{speaker}: "

    speaker_guess = segment.get("speaker_guess")
    if speaker_guess:
        return f"{speaker_guess}?: "

    role_hint = segment.get("role_hint")
    if role_hint == "question_candidate":
        return "[Question?] "
    if role_hint == "respondent_candidate":
        return "[Answer?] "
    if role_hint == "interjection_candidate":
        return "[Interjection?] "
    return ""


def render_clean_text(segments: list[dict]) -> str:
    paragraphs = []
    for segment in segments:
        text = segment["text"].strip()
        prefix = render_segment_prefix(segment)
        paragraphs.append(f"{prefix}{text}")
    return "\n\n".join(paragraphs).strip() + "\n"


def write_outputs(output_dir: Path, source_path: Path, segments: list[dict]) -> tuple[Path, Path]:
    output_dir.mkdir(parents=True, exist_ok=True)
    stem = source_path.stem
    clean_path = output_dir / f"{stem}.clean.txt"
    segments_path = output_dir / f"{stem}.segments.json"

    clean_path.write_text(render_clean_text(segments), encoding="utf-8")

    json_payload = []
    for segment in segments:
        source_indices = unique_preserve(segment["source_indices"])
        json_payload.append(
            {
                "index": segment["index"],
                "start": format_timestamp(segment["start_seconds"]),
                "end": format_timestamp(segment["end_seconds"]),
                "speaker": segment.get("speaker"),
                "speaker_confidence": segment.get("speaker_confidence"),
                "speaker_guess": segment.get("speaker_guess"),
                "speaker_guess_confidence": segment.get("speaker_guess_confidence"),
                "role_hint": segment.get("role_hint"),
                "role_confidence": segment.get("role_confidence"),
                "word_count": segment.get("word_count"),
                "turn_id": segment.get("turn_id"),
                "explicit_turn": segment.get("explicit_turn", False),
                "turn_boundary_reason": segment.get("turn_boundary_reason"),
                "text": segment["text"],
                "source": segment["source"],
                "source_indices": source_indices,
            }
        )

    segments_path.write_text(
        json.dumps(json_payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    return clean_path, segments_path


def expand_inputs(values: Iterable[str]) -> list[Path]:
    files: list[Path] = []
    for value in values:
        path = Path(value)
        if path.is_dir():
            files.extend(
                sorted(
                    candidate
                    for candidate in path.iterdir()
                    if candidate.is_file() and candidate.suffix.lower() in SUPPORTED_EXTENSIONS
                )
            )
        elif path.is_file() and path.suffix.lower() in SUPPORTED_EXTENSIONS:
            files.append(path)
    return files


def parse_source(path: Path, keep_fillers: bool) -> list[dict]:
    if path.suffix.lower() in {".srt", ".vtt"}:
        return parse_caption_file(path, keep_fillers)
    return parse_plain_text_file(path, keep_fillers)


def main() -> int:
    args = parse_args()
    files = expand_inputs(args.inputs)
    if not files:
        raise SystemExit("No supported subtitle or transcript files found.")

    output_dir = Path(args.output_dir)
    for path in files:
        meta = load_meta_for_source(path)
        parsed = parse_source(path, args.keep_fillers)
        merged = annotate_segments(merge_segments(parsed, gap_seconds=args.gap_seconds), meta)
        if not merged:
            print(f"SKIP {path}: no usable text")
            continue
        clean_path, segments_path = write_outputs(output_dir, path, merged)
        print(f"OK {path} -> {clean_path} {segments_path}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
