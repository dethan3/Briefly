import test from "node:test";
import assert from "node:assert/strict";
import { captionTrackName, chooseCaptionTrack, getVideoId, json3ToVtt } from "../src/youtube.js";

test("extracts YouTube video IDs", () => {
  assert.equal(getVideoId("https://www.youtube.com/watch?v=abc123&t=9"), "abc123");
  assert.equal(getVideoId("https://www.youtube.com/"), null);
});

test("chooses the player default track before language heuristics", () => {
  const tracks = [
    { languageCode: "en", kind: "asr" },
    { languageCode: "ja", kind: "" },
  ];
  assert.equal(chooseCaptionTrack(tracks, 1, "en-US"), 1);
  assert.equal(chooseCaptionTrack(tracks, -1, "en-US"), 0);
});

test("renders caption track names", () => {
  assert.equal(captionTrackName({ name: { simpleText: "English (auto-generated)" }, languageCode: "en" }), "English (auto-generated)");
  assert.equal(captionTrackName({ name: { runs: [{ text: "日本語" }] }, languageCode: "ja" }), "日本語");
});

test("converts YouTube json3 events to VTT", () => {
  const vtt = json3ToVtt({
    events: [
      { tStartMs: 1000, dDurationMs: 1500, segs: [{ utf8: "So what " }, { utf8: "I think" }] },
      { tStartMs: 2500, dDurationMs: 1200, segs: [{ utf8: "is happening." }] },
      { tStartMs: 3700, dDurationMs: 500 },
    ],
  });
  assert.match(vtt, /^WEBVTT/);
  assert.match(vtt, /00:00:01\.000 --> 00:00:02\.500/);
  assert.match(vtt, /So what I think/);
  assert.match(vtt, /00:00:02\.500 --> 00:00:03\.700/);
  assert.doesNotMatch(vtt, /undefined/);
});
