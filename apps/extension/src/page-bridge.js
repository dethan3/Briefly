(() => {
  const FROM_PAGE = "briefly-page";
  const FROM_EXTENSION = "briefly-extension";
  const retryTimers = new Set();

  function currentVideoId() {
    const url = new URL(location.href);
    return url.pathname === "/watch" ? url.searchParams.get("v") : null;
  }

  function parsePlayerResponse(value) {
    if (!value) return null;
    if (typeof value === "object") return value;
    if (typeof value !== "string") return null;
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  }

  function findPlayerResponse() {
    const videoId = currentVideoId();
    if (!videoId) return null;

    const candidates = [
      parsePlayerResponse(globalThis.ytInitialPlayerResponse),
      parsePlayerResponse(globalThis.ytplayer?.config?.args?.player_response),
    ].filter(Boolean);

    return candidates.find((candidate) => candidate?.videoDetails?.videoId === videoId) ?? null;
  }

  function post(type, payload) {
    window.postMessage({ __briefly: true, source: FROM_PAGE, type, payload }, location.origin);
  }

  function extractTrackPayload() {
    const videoId = currentVideoId();
    if (!videoId) return { videoId: null, title: "", tracks: [], defaultTrackIndex: -1, ready: true };

    const response = findPlayerResponse();
    if (!response) return { videoId, title: "", tracks: [], defaultTrackIndex: -1, ready: false };

    const renderer = response?.captions?.playerCaptionsTracklistRenderer;
    const tracks = Array.isArray(renderer?.captionTracks)
      ? renderer.captionTracks.map((track) => ({
          baseUrl: track?.baseUrl ?? "",
          languageCode: track?.languageCode ?? "",
          kind: track?.kind ?? "",
          isTranslatable: Boolean(track?.isTranslatable),
          name: track?.name ?? null,
        })).filter((track) => track.baseUrl)
      : [];

    const defaultAudioTrackIndex = Number(renderer?.defaultAudioTrackIndex);
    const defaultTrackIndex = Number.isInteger(defaultAudioTrackIndex)
      ? Number(renderer?.audioTracks?.[defaultAudioTrackIndex]?.captionTrackIndices?.[0] ?? -1)
      : -1;

    return {
      videoId,
      title: response?.videoDetails?.title ?? document.title.replace(/\s*-\s*YouTube\s*$/, ""),
      tracks,
      defaultTrackIndex: Number.isInteger(defaultTrackIndex) ? defaultTrackIndex : -1,
      ready: true,
    };
  }

  function scheduleTrackDiscovery() {
    for (const timer of retryTimers) clearTimeout(timer);
    retryTimers.clear();

    [0, 150, 400, 900, 1800, 3200].forEach((delay) => {
      const timer = setTimeout(() => {
        retryTimers.delete(timer);
        const payload = extractTrackPayload();
        post("BRIEFLY_TRACKS", payload);
        if (payload.ready) {
          for (const pending of retryTimers) clearTimeout(pending);
          retryTimers.clear();
        }
      }, delay);
      retryTimers.add(timer);
    });
  }

  function validTimedTextUrl(baseUrl) {
    try {
      const url = new URL(baseUrl, location.href);
      const hostname = url.hostname.toLowerCase();
      const youtubeHost = hostname === "youtube.com" || hostname.endsWith(".youtube.com");
      return url.protocol === "https:" && youtubeHost && url.pathname === "/api/timedtext" ? url : null;
    } catch {
      return null;
    }
  }

  async function fetchCaption(requestId, baseUrl) {
    const url = validTimedTextUrl(baseUrl);
    if (!url) {
      post("BRIEFLY_CAPTION_ERROR", { requestId, message: "Rejected an invalid caption URL." });
      return;
    }

    url.searchParams.set("fmt", "json3");
    try {
      const response = await fetch(url.toString(), { credentials: "include" });
      if (!response.ok) throw new Error(`Caption request failed with HTTP ${response.status}`);
      const payload = await response.json();
      post("BRIEFLY_CAPTION_DATA", { requestId, payload });
    } catch (error) {
      post("BRIEFLY_CAPTION_ERROR", {
        requestId,
        message: error instanceof Error ? error.message : "Unable to fetch captions.",
      });
    }
  }

  window.addEventListener("message", (event) => {
    if (event.source !== window || event.origin !== location.origin) return;
    const message = event.data;
    if (!message?.__briefly || message.source !== FROM_EXTENSION) return;

    if (message.type === "BRIEFLY_REFRESH_TRACKS") {
      scheduleTrackDiscovery();
    } else if (message.type === "BRIEFLY_FETCH_CAPTION") {
      const { requestId, baseUrl } = message.payload ?? {};
      if (typeof requestId === "string" && typeof baseUrl === "string") {
        void fetchCaption(requestId, baseUrl);
      }
    }
  });

  window.addEventListener("yt-navigate-finish", scheduleTrackDiscovery);
  window.addEventListener("popstate", scheduleTrackDiscovery);
  document.addEventListener("DOMContentLoaded", scheduleTrackDiscovery, { once: true });
  scheduleTrackDiscovery();
})();
