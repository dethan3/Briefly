export type TranscriptFormat = "srt" | "vtt" | "txt" | "md";

export type TranscriptRole =
  | "question_candidate"
  | "respondent_candidate"
  | "interjection_candidate"
  | "statement";

export interface TranscriptSource {
  type: "youtube" | "upload" | "paste" | "unknown";
  id?: string;
  url?: string;
  title?: string;
  language?: string;
  name?: string;
}

export interface TranscriptMeta {
  hosts?: string[];
  guests?: string[];
  primary_guest?: string;
}

export interface TranscriptSegment {
  index: number;
  start: number;
  end: number;
  speaker?: string;
  speaker_confidence: "explicit" | "unknown";
  speaker_guess?: string;
  speaker_guess_confidence?: "meta-role";
  role_hint: TranscriptRole;
  role_confidence: "medium" | "low";
  word_count: number;
  turn_id: number;
  explicit_turn: boolean;
  turn_boundary_reason?: "chevron" | "named_speaker" | "paragraph";
  text: string;
  source: string;
  source_indices: number[];
}

export interface TranscriptDocument {
  version: "1.0";
  source: TranscriptSource;
  segments: TranscriptSegment[];
  clean_text: string;
}

export interface NormalizeTranscriptInput {
  content: string;
  format: TranscriptFormat;
  source?: Partial<TranscriptSource>;
  meta?: TranscriptMeta;
  options?: {
    gapSeconds?: number;
    keepFillers?: boolean;
  };
}

interface ParsedSegment {
  index: number;
  start: number;
  end: number;
  speaker?: string;
  text: string;
  source: string;
  sourceIndices: number[];
  explicitTurn: boolean;
  turnBoundaryReason?: "chevron" | "named_speaker" | "paragraph";
}

const NOISE_ONLY_PATTERNS = [
  /^\[?(music|applause|laughter|laughing|silence|inaudible)\]?$/i,
  /^\(?music\)?$/i,
];

const LEADING_FILLER_RE = /^(?:(?:uh+|um+|erm+|ah+|hmm+|you know|i mean|like|sort of|kind of)[,\s]+){1,4}/i;
const TAG_RE = /<\/?[^>]+>/g;
const TURN_MARKER_RE = /\s*>>\s*/g;
const TIMESTAMP_RE = /^\s*(?<start>\d{2}:\d{2}:\d{2}[,.]\d{3}|\d{2}:\d{2}[,.]\d{3})\s*-->\s*(?<end>\d{2}:\d{2}:\d{2}[,.]\d{3}|\d{2}:\d{2}[,.]\d{3})(?:\s+.*)?$/;
const VTT_SPEAKER_RE = /^<v(?:\.[^>\s]+)?\s+([^>]+)>(.*)$/i;
const SPEAKER_PREFIX_RE = /^(?:-\s*)?(?<speaker>(?:[A-Z][A-Za-z0-9&.'-]*|[A-Z]{2,})(?:\s+(?:[A-Z][A-Za-z0-9&.'-]*|[A-Z]{2,})){0,3})\s*:\s+(?<text>.+)$/;
const WORD_RE = /[A-Za-z0-9]+(?:'[A-Za-z0-9]+)?/g;

const QUESTION_STARTERS = [
  "how ", "why ", "what ", "when ", "where ", "who ", "do you", "did you",
  "are you", "is it", "can you", "could you", "would you", "will you",
  "walk me through", "explain", "tell me", "curious", "paint that picture",
  "handicap for me", "let's talk about",
];

const ANSWER_STARTERS = [
  "well", "look", "i think", "i mean", "let me", "first off", "to me",
  "my view is", "the way",
];

function decodeHtml(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, value: string) => String.fromCodePoint(Number(value)))
    .replace(/&#x([0-9a-f]+);/gi, (_, value: string) => String.fromCodePoint(Number.parseInt(value, 16)));
}

export function timestampToSeconds(timestamp: string): number {
  const parts = timestamp.replace(",", ".").split(":");
  const seconds = Number(parts.pop());
  const minutes = Number(parts.pop() ?? 0);
  const hours = Number(parts.pop() ?? 0);
  return hours * 3600 + minutes * 60 + seconds;
}

export function formatTimestamp(seconds: number): string {
  const safe = Math.max(0, seconds);
  const totalMs = Math.round(safe * 1000);
  const hours = Math.floor(totalMs / 3_600_000);
  const minutes = Math.floor((totalMs % 3_600_000) / 60_000);
  const secs = Math.floor((totalMs % 60_000) / 1000);
  const ms = totalMs % 1000;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}.${String(ms).padStart(3, "0")}`;
}

function normalizeWhitespace(text: string): string {
  return text.replace(/\u00a0/g, " ").replace(/\u200b/g, "").replace(/\s+/g, " ").trim();
}

export function cleanCaptionText(text: string, keepFillers = false): string {
  let cleaned = decodeHtml(text).replace(/-->/g, " ").replace(TURN_MARKER_RE, " ").replace(TAG_RE, "");
  cleaned = normalizeWhitespace(cleaned);
  if (!keepFillers) {
    cleaned = normalizeWhitespace(cleaned.replace(LEADING_FILLER_RE, ""));
  }
  return cleaned;
}

function isNoiseOnly(text: string): boolean {
  if (!text.trim()) return true;
  return NOISE_ONLY_PATTERNS.some((pattern) => pattern.test(text.trim()));
}

function normalizedKey(text: string): string {
  return text.toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
}

function splitSpeaker(text: string): { speaker?: string; text: string } {
  const decoded = decodeHtml(text);
  const vtt = normalizeWhitespace(decoded).match(VTT_SPEAKER_RE);
  if (vtt) {
    const speaker = normalizeWhitespace(vtt[1] ?? "");
    return { speaker: speaker || undefined, text: normalizeWhitespace(vtt[2] ?? "") };
  }

  const cleaned = cleanCaptionText(decoded, true);
  const match = cleaned.match(SPEAKER_PREFIX_RE);
  if (!match?.groups) return { text: cleaned };

  const speaker = normalizeWhitespace(match.groups.speaker ?? "");
  const body = normalizeWhitespace(match.groups.text ?? "");
  if (speaker.split(/\s+/).length > 4) return { text: cleaned };
  return { speaker, text: body };
}

function splitTurnChunks(lines: string[]): Array<{ text: string; explicitTurn: boolean }> {
  const chunks: Array<{ text: string; explicitTurn: boolean }> = [];
  for (const rawLine of lines) {
    const line = decodeHtml(rawLine);
    if (!line.trim()) continue;
    const lineStartsTurn = /^\s*>>\s*/.test(line);
    const parts = line.split(/\s*>>\s*/);
    parts.forEach((part, index) => {
      const text = normalizeWhitespace(part);
      if (!text) return;
      chunks.push({ text, explicitTurn: index === 0 ? lineStartsTurn : true });
    });
  }
  return chunks;
}

function loadBlocks(content: string): string[][] {
  const normalized = content.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  return normalized.split(/\n{2,}/).filter((block) => block.trim()).map((block) => block.split("\n"));
}

function parseCaptionFile(content: string, sourceName: string, keepFillers: boolean): ParsedSegment[] {
  const parsed: ParsedSegment[] = [];
  let cueCounter = 0;

  for (const block of loadBlocks(content)) {
    const lines = block.map((line) => line.replace(/^\uFEFF/, "")).filter((line) => line.trim());
    if (!lines.length || lines[0].toUpperCase() === "WEBVTT" || lines[0].startsWith("NOTE")) continue;

    let lineIndex = 0;
    let sourceIndex = 0;
    if (/^\d+$/.test(lines[0])) {
      sourceIndex = Number(lines[0]);
      lineIndex = 1;
    }
    if (lineIndex >= lines.length) continue;

    const timestampMatch = lines[lineIndex].match(TIMESTAMP_RE);
    if (!timestampMatch?.groups) continue;
    const textLines = lines.slice(lineIndex + 1);
    if (!textLines.length) continue;

    cueCounter += 1;
    if (sourceIndex === 0) sourceIndex = cueCounter;

    for (const chunk of splitTurnChunks(textLines)) {
      const split = splitSpeaker(chunk.text);
      const text = cleanCaptionText(split.text, keepFillers);
      if (isNoiseOnly(text)) continue;

      const explicitTurn = chunk.explicitTurn || Boolean(split.speaker);
      parsed.push({
        index: sourceIndex,
        start: timestampToSeconds(timestampMatch.groups.start),
        end: timestampToSeconds(timestampMatch.groups.end),
        speaker: split.speaker,
        text,
        source: sourceName,
        sourceIndices: [sourceIndex],
        explicitTurn,
        turnBoundaryReason: chunk.explicitTurn ? "chevron" : split.speaker ? "named_speaker" : undefined,
      });
    }
  }
  return parsed;
}

function parsePlainText(content: string, sourceName: string, keepFillers: boolean): ParsedSegment[] {
  const normalized = content.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  return normalized.split(/\n{2,}/).map((value) => value.trim()).filter(Boolean).flatMap((paragraph, offset) => {
    const split = splitSpeaker(paragraph);
    const text = cleanCaptionText(split.text, keepFillers);
    if (isNoiseOnly(text)) return [];
    return [{
      index: offset + 1,
      start: offset,
      end: offset + 1,
      speaker: split.speaker,
      text,
      source: sourceName,
      sourceIndices: [offset + 1],
      explicitTurn: true,
      turnBoundaryReason: "paragraph" as const,
    }];
  });
}

function isContinuation(previousText: string, currentText: string): boolean {
  if (!previousText || !currentText) return false;
  if (/[\-/([]$/.test(previousText)) return true;
  if (!/[.!?]["')\]]*$/.test(previousText)) return true;
  if (/^[a-z]/.test(currentText)) return true;
  if (/^(and|but|so|because|which|that|then|also|plus|or)\s/i.test(currentText)) return true;
  return previousText.trim().split(/\s+/).length <= 6;
}

function joinText(previous: string, current: string): string {
  if (!previous) return current;
  if (!current) return previous;
  if (previous.endsWith("-") && /^[a-z]/.test(current)) return previous.slice(0, -1) + current;
  if (/^[,.;:!?\])}]/.test(current)) return previous + current;
  return `${previous} ${current}`;
}

function dedupeSegments(segments: ParsedSegment[]): ParsedSegment[] {
  const result: ParsedSegment[] = [];
  let previousKey: string | undefined;

  for (const segment of segments) {
    const key = `${segment.speaker ?? ""}\u0000${normalizedKey(segment.text)}`;
    if (key === previousKey && !segment.explicitTurn && result.length) {
      const previous = result[result.length - 1];
      previous.end = Math.max(previous.end, segment.end);
      previous.sourceIndices.push(...segment.sourceIndices);
      continue;
    }
    result.push({ ...segment, sourceIndices: [...segment.sourceIndices] });
    previousKey = key;
  }
  return result;
}

function mergeSegments(segments: ParsedSegment[], gapSeconds: number): ParsedSegment[] {
  const merged: ParsedSegment[] = [];
  for (const segment of dedupeSegments(segments)) {
    const previous = merged[merged.length - 1];
    if (!previous) {
      merged.push({ ...segment, index: 1, sourceIndices: [...segment.sourceIndices] });
      continue;
    }

    const gap = segment.start - previous.end;
    const sameSpeaker = previous.speaker === segment.speaker;
    const compatibleSpeaker = sameSpeaker || !previous.speaker || !segment.speaker;
    if (!segment.explicitTurn && compatibleSpeaker && gap <= gapSeconds && isContinuation(previous.text, segment.text)) {
      previous.text = joinText(previous.text, segment.text);
      previous.end = segment.end;
      previous.speaker ||= segment.speaker;
      previous.sourceIndices.push(...segment.sourceIndices);
      continue;
    }

    merged.push({ ...segment, index: merged.length + 1, sourceIndices: [...segment.sourceIndices] });
  }
  return merged;
}

function countWords(text: string): number {
  return text.match(WORD_RE)?.length ?? 0;
}

function isQuestionCandidate(text: string): boolean {
  const stripped = text.trim();
  const lowered = stripped.toLocaleLowerCase();
  return stripped.includes("?") || QUESTION_STARTERS.some((starter) => lowered.startsWith(starter));
}

function isAnswerOpener(text: string): boolean {
  const lowered = text.trim().toLocaleLowerCase();
  return ANSWER_STARTERS.some((starter) => lowered.startsWith(starter));
}

function annotateSegments(segments: ParsedSegment[], meta: TranscriptMeta): TranscriptSegment[] {
  const hosts = (meta.hosts ?? []).map(normalizeWhitespace).filter(Boolean);
  const guests = (meta.guests ?? []).map(normalizeWhitespace).filter(Boolean);
  const hostLabel = hosts.length === 1 ? hosts[0] : hosts.length > 1 ? "Host/Panel" : undefined;
  const guestLabel = meta.primary_guest?.trim() || (guests.length === 1 ? guests[0] : undefined);

  const turns: number[][] = [];
  let currentTurn: number[] = [];
  segments.forEach((segment, index) => {
    if (!currentTurn.length || segment.explicitTurn) {
      if (currentTurn.length) turns.push(currentTurn);
      currentTurn = [index];
    } else {
      currentTurn.push(index);
    }
  });
  if (currentTurn.length) turns.push(currentTurn);

  const output: TranscriptSegment[] = segments.map((segment) => ({
    ...segment,
    speaker_confidence: segment.speaker ? "explicit" : "unknown",
    role_hint: "statement",
    role_confidence: "low",
    word_count: countWords(segment.text),
    turn_id: 0,
    explicit_turn: segment.explicitTurn,
    turn_boundary_reason: segment.turnBoundaryReason,
    source_indices: [...new Set(segment.sourceIndices)],
  }));

  let previousRole: TranscriptRole = "statement";
  turns.forEach((turn, turnOffset) => {
    const turnSegments = turn.map((index) => output[index]);
    const combined = turnSegments.map((segment) => segment.text).join(" ").trim();
    const first = turnSegments[0].text.trim();
    const totalWords = turnSegments.reduce((sum, segment) => sum + segment.word_count, 0);

    let role: TranscriptRole = "statement";
    let confidence: "medium" | "low" = "low";
    if (totalWords <= 5 && !isQuestionCandidate(first)) {
      role = "interjection_candidate";
    } else if (previousRole === "question_candidate" && totalWords >= 8 && !isQuestionCandidate(first)) {
      role = "respondent_candidate";
      confidence = "medium";
    } else if (isAnswerOpener(first) && totalWords >= 8) {
      role = "respondent_candidate";
      confidence = "medium";
    } else if (isQuestionCandidate(first)) {
      role = "question_candidate";
      confidence = "medium";
    } else if (combined.endsWith("?") && totalWords <= 80) {
      role = "question_candidate";
    }

    turnSegments.forEach((segment) => {
      segment.turn_id = turnOffset + 1;
      segment.role_hint = role;
      segment.role_confidence = confidence;
      if (!segment.speaker && guestLabel && role === "respondent_candidate") {
        segment.speaker_guess = guestLabel;
        segment.speaker_guess_confidence = "meta-role";
      } else if (!segment.speaker && hostLabel && (role === "question_candidate" || role === "interjection_candidate")) {
        segment.speaker_guess = hostLabel;
        segment.speaker_guess_confidence = "meta-role";
      }
    });
    previousRole = role;
  });

  return output;
}

function renderSegmentPrefix(segment: TranscriptSegment): string {
  if (segment.speaker) return `${segment.speaker}: `;
  if (segment.speaker_guess) return `${segment.speaker_guess}?: `;
  if (segment.role_hint === "question_candidate") return "[Question?] ";
  if (segment.role_hint === "respondent_candidate") return "[Answer?] ";
  if (segment.role_hint === "interjection_candidate") return "[Interjection?] ";
  return "";
}

export function renderCleanText(segments: TranscriptSegment[]): string {
  const body = segments.map((segment) => `${renderSegmentPrefix(segment)}${segment.text.trim()}`).join("\n\n").trim();
  return body ? `${body}\n` : "";
}

export function normalizeTranscript(input: NormalizeTranscriptInput): TranscriptDocument {
  const sourceName = input.source?.name ?? `input.${input.format}`;
  const keepFillers = input.options?.keepFillers ?? false;
  const gapSeconds = input.options?.gapSeconds ?? 1.5;
  const parsed = input.format === "srt" || input.format === "vtt"
    ? parseCaptionFile(input.content, sourceName, keepFillers)
    : parsePlainText(input.content, sourceName, keepFillers);
  const segments = annotateSegments(mergeSegments(parsed, gapSeconds), input.meta ?? {});

  return {
    version: "1.0",
    source: {
      ...input.source,
      type: input.source?.type ?? "unknown",
      name: sourceName,
    },
    segments,
    clean_text: renderCleanText(segments),
  };
}

export function searchTranscript(document: TranscriptDocument, query: string): TranscriptSegment[] {
  const needle = normalizeWhitespace(query).toLocaleLowerCase();
  if (!needle) return [];
  return document.segments.filter((segment) => segment.text.toLocaleLowerCase().includes(needle));
}

export function exportMarkdown(document: TranscriptDocument): string {
  const title = document.source.title?.trim() || "Transcript";
  const lines = [`# ${title}`, ""];
  for (const segment of document.segments) {
    const time = formatTimestamp(segment.start).slice(0, 8);
    lines.push(`**${time}** ${renderSegmentPrefix(segment)}${segment.text}`.trimEnd(), "");
  }
  return `${lines.join("\n").trim()}\n`;
}

export function exportJson(document: TranscriptDocument): string {
  return `${JSON.stringify(document, null, 2)}\n`;
}
