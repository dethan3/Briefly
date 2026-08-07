import test from "node:test";
import assert from "node:assert/strict";
import {
  exportMarkdown,
  normalizeTranscript,
  searchTranscript,
  timestampToSeconds,
} from "../dist/index.js";

test("normalizes fragmented VTT captions into readable segments", () => {
  const input = `WEBVTT

00:00:00.000 --> 00:00:01.000
[Music]

00:00:01.100 --> 00:00:02.000
<v Host>What do you think about the future of AI agents?

00:00:02.200 --> 00:00:03.000
>> Well I think the environment

00:00:03.100 --> 00:00:04.000
around the model matters more than people realize.
`;

  const document = normalizeTranscript({
    content: input,
    format: "vtt",
    source: { type: "youtube", id: "demo", title: "Demo Interview", name: "demo.vtt" },
    meta: { hosts: ["Host"], primary_guest: "Guest" },
  });

  assert.equal(document.segments.length, 2);
  assert.equal(document.segments[0].speaker, "Host");
  assert.equal(document.segments[0].role_hint, "question_candidate");
  assert.equal(document.segments[1].text, "Well I think the environment around the model matters more than people realize.");
  assert.equal(document.segments[1].role_hint, "respondent_candidate");
  assert.equal(document.segments[1].speaker_guess, "Guest");
  assert.match(document.clean_text, /Host: What do you think about the future of AI agents\?/);
  assert.doesNotMatch(document.clean_text, /Music/);
});

test("parses SRT timestamps and keeps traceable source indices", () => {
  const input = `1
00:00:10,000 --> 00:00:11,000
This is a sentence

2
00:00:11,200 --> 00:00:12,000
that continues here.
`;
  const document = normalizeTranscript({ content: input, format: "srt", source: { name: "sample.srt" } });

  assert.equal(document.segments.length, 1);
  assert.equal(document.segments[0].start, 10);
  assert.equal(document.segments[0].end, 12);
  assert.deepEqual(document.segments[0].source_indices, [1, 2]);
  assert.equal(document.segments[0].text, "This is a sentence that continues here.");
});

test("supports local transcript search and Markdown export", () => {
  const document = normalizeTranscript({
    content: `00:00.000 --> 00:02.000\nAgent memory is useful.\n\n00:03.000 --> 00:05.000\nTool environments matter.`,
    format: "vtt",
    source: { title: "Agent Notes", name: "notes.vtt" },
  });

  assert.equal(searchTranscript(document, "memory").length, 1);
  const markdown = exportMarkdown(document);
  assert.match(markdown, /^# Agent Notes/m);
  assert.match(markdown, /00:00:00/);
});

test("converts timestamps without runtime-specific APIs", () => {
  assert.equal(timestampToSeconds("01:02:03.500"), 3723.5);
  assert.equal(timestampToSeconds("02:03,250"), 123.25);
});
