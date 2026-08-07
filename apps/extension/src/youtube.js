export function getVideoId(urlLike = globalThis.location?.href ?? "") {
  try {
    const url = new URL(urlLike, "https://www.youtube.com");
    if (url.pathname === "/watch") return url.searchParams.get("v");
    if (url.hostname === "youtu.be") return url.pathname.slice(1) || null;
    return null;
  } catch {
    return null;
  }
}

export function captionTrackName(track) {
  if (typeof track?.name?.simpleText === "string") return track.name.simpleText;
  if (Array.isArray(track?.name?.runs)) {
    const text = track.name.runs.map((run) => run?.text ?? "").join("").trim();
    if (text) return text;
  }
  return track?.languageCode || "Unknown";
}

export function chooseCaptionTrack(tracks, defaultTrackIndex = -1, preferredLanguage = "") {
  if (!Array.isArray(tracks) || tracks.length === 0) return -1;
  if (Number.isInteger(defaultTrackIndex) && defaultTrackIndex >= 0 && defaultTrackIndex < tracks.length) {
    return defaultTrackIndex;
  }

  const preferred = preferredLanguage.toLowerCase();
  const base = preferred.split("-")[0];
  if (preferred) {
    const exact = tracks.findIndex((track) => String(track?.languageCode ?? "").toLowerCase() === preferred);
    if (exact >= 0) return exact;
  }
  if (base) {
    const sameBase = tracks.findIndex((track) => String(track?.languageCode ?? "").toLowerCase().split("-")[0] === base);
    if (sameBase >= 0) return sameBase;
  }

  const manual = tracks.findIndex((track) => track?.kind !== "asr");
  return manual >= 0 ? manual : 0;
}

function formatVttTimestamp(milliseconds) {
  const safe = Math.max(0, Math.round(Number(milliseconds) || 0));
  const hours = Math.floor(safe / 3_600_000);
  const minutes = Math.floor((safe % 3_600_000) / 60_000);
  const seconds = Math.floor((safe % 60_000) / 1000);
  const ms = safe % 1000;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(ms).padStart(3, "0")}`;
}

export function json3ToVtt(payload) {
  const events = Array.isArray(payload?.events) ? payload.events : [];
  const cues = [];

  for (let index = 0; index < events.length; index += 1) {
    const event = events[index];
    if (!event || !Array.isArray(event.segs) || !Number.isFinite(Number(event.tStartMs))) continue;

    const text = event.segs
      .map((segment) => (typeof segment?.utf8 === "string" ? segment.utf8 : ""))
      .join("")
      .replace(/\s+/g, " ")
      .trim();
    if (!text) continue;

    const startMs = Number(event.tStartMs);
    const durationMs = Number(event.dDurationMs);
    const nextStartMs = Number(events[index + 1]?.tStartMs);
    const endMs = Number.isFinite(durationMs) && durationMs > 0
      ? startMs + durationMs
      : Number.isFinite(nextStartMs) && nextStartMs > startMs
        ? nextStartMs
        : startMs + 2000;

    cues.push(`${cues.length + 1}\n${formatVttTimestamp(startMs)} --> ${formatVttTimestamp(endMs)}\n${text}`);
  }

  return `WEBVTT\n\n${cues.join("\n\n")}${cues.length ? "\n" : ""}`;
}
