(() => {
  if (globalThis.__brieflyTranscriptReaderLoaded) return;
  globalThis.__brieflyTranscriptReaderLoaded = true;

  const FROM_PAGE = "briefly-page";
  const FROM_EXTENSION = "briefly-extension";
  const pendingCaptionRequests = new Map();

  const state = {
    core: null,
    youtube: null,
    videoId: null,
    title: "",
    tracks: [],
    defaultTrackIndex: -1,
    selectedTrackIndex: -1,
    document: null,
    query: "",
    open: false,
    loading: false,
    error: "",
  };

  let root;
  let trigger;
  let titleElement;
  let statusElement;
  let trackSelect;
  let searchInput;
  let copyButton;
  let listElement;

  function post(type, payload = {}) {
    window.postMessage({ __briefly: true, source: FROM_EXTENSION, type, payload }, location.origin);
  }

  function requestCaption(baseUrl) {
    const requestId = crypto.randomUUID();
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        pendingCaptionRequests.delete(requestId);
        reject(new Error("Timed out while reading YouTube captions."));
      }, 15000);
      pendingCaptionRequests.set(requestId, { resolve, reject, timeout });
      post("BRIEFLY_FETCH_CAPTION", { requestId, baseUrl });
    });
  }

  function settleCaptionRequest(type, payload) {
    const requestId = payload?.requestId;
    if (typeof requestId !== "string") return;
    const pending = pendingCaptionRequests.get(requestId);
    if (!pending) return;
    clearTimeout(pending.timeout);
    pendingCaptionRequests.delete(requestId);
    if (type === "BRIEFLY_CAPTION_DATA") pending.resolve(payload.payload);
    else pending.reject(new Error(payload?.message || "Unable to fetch captions."));
  }

  function isWatchPage() {
    return location.pathname === "/watch" && Boolean(new URL(location.href).searchParams.get("v"));
  }

  function setStatus(message, kind = "") {
    if (!statusElement) return;
    statusElement.textContent = message;
    statusElement.dataset.kind = kind;
  }

  function createUi() {
    if (root) return;

    trigger = document.createElement("button");
    trigger.id = "briefly-trigger";
    trigger.type = "button";
    trigger.textContent = "Briefly";
    trigger.addEventListener("click", () => {
      state.open = true;
      root.dataset.open = "true";
      void ensureTranscript();
    });

    root = document.createElement("aside");
    root.id = "briefly-reader";
    root.dataset.open = "false";
    root.innerHTML = `
      <div class="briefly-header">
        <div>
          <div class="briefly-brand">Briefly</div>
          <div class="briefly-title"></div>
        </div>
        <button class="briefly-close" type="button" aria-label="Close Briefly">×</button>
      </div>
      <div class="briefly-toolbar">
        <select class="briefly-track" aria-label="Caption language"></select>
        <button class="briefly-copy" type="button">Copy</button>
      </div>
      <div class="briefly-search-wrap">
        <input class="briefly-search" type="search" placeholder="Search transcript" autocomplete="off" />
      </div>
      <div class="briefly-status"></div>
      <div class="briefly-list"></div>
    `;

    titleElement = root.querySelector(".briefly-title");
    statusElement = root.querySelector(".briefly-status");
    trackSelect = root.querySelector(".briefly-track");
    searchInput = root.querySelector(".briefly-search");
    copyButton = root.querySelector(".briefly-copy");
    listElement = root.querySelector(".briefly-list");

    root.querySelector(".briefly-close").addEventListener("click", () => {
      state.open = false;
      root.dataset.open = "false";
    });

    trackSelect.addEventListener("change", () => {
      state.selectedTrackIndex = Number(trackSelect.value);
      state.document = null;
      state.query = "";
      searchInput.value = "";
      void ensureTranscript();
    });

    searchInput.addEventListener("input", () => {
      state.query = searchInput.value;
      renderSegments();
    });

    copyButton.addEventListener("click", async () => {
      if (!state.document?.clean_text) return;
      try {
        await navigator.clipboard.writeText(state.document.clean_text);
        copyButton.textContent = "Copied";
        setTimeout(() => { copyButton.textContent = "Copy"; }, 1200);
      } catch {
        setStatus("Copy failed. Select the transcript text manually.", "error");
      }
    });

    document.documentElement.append(trigger, root);
    updateVisibility();
  }

  function updateVisibility() {
    if (!trigger || !root) return;
    const visible = isWatchPage();
    trigger.hidden = !visible;
    if (!visible) {
      root.dataset.open = "false";
      state.open = false;
    }
  }

  function renderTracks() {
    if (!trackSelect || !state.youtube) return;
    trackSelect.replaceChildren();
    state.tracks.forEach((track, index) => {
      const option = document.createElement("option");
      option.value = String(index);
      option.textContent = state.youtube.captionTrackName(track);
      option.selected = index === state.selectedTrackIndex;
      trackSelect.append(option);
    });
    trackSelect.disabled = state.tracks.length <= 1;
  }

  function shortTimestamp(seconds) {
    const full = state.core.formatTimestamp(seconds).slice(0, 8);
    return full.startsWith("00:") ? full.slice(3) : full;
  }

  function jumpTo(seconds) {
    const video = document.querySelector("video");
    if (video) {
      video.currentTime = seconds;
      void video.play().catch(() => {});
      return;
    }

    const url = new URL(location.href);
    url.searchParams.set("t", String(Math.max(0, Math.floor(seconds))));
    location.href = url.toString();
  }

  function renderSegments() {
    if (!listElement || !state.document || !state.core) return;
    const segments = state.query.trim()
      ? state.core.searchTranscript(state.document, state.query)
      : state.document.segments;

    listElement.replaceChildren();
    const fragment = document.createDocumentFragment();
    for (const segment of segments) {
      const row = document.createElement("article");
      row.className = "briefly-segment";

      const time = document.createElement("button");
      time.type = "button";
      time.className = "briefly-time";
      time.textContent = shortTimestamp(segment.start);
      time.addEventListener("click", () => jumpTo(segment.start));

      const text = document.createElement("p");
      text.textContent = segment.text;

      row.append(time, text);
      fragment.append(row);
    }
    listElement.append(fragment);

    if (!segments.length) {
      const empty = document.createElement("div");
      empty.className = "briefly-empty";
      empty.textContent = state.query ? "No matching transcript text." : "No usable transcript segments.";
      listElement.append(empty);
    }

    setStatus(`${segments.length} ${state.query ? "matches" : "clean segments"}`);
  }

  async function ensureTranscript() {
    if (!state.open || state.loading || state.document) return;
    if (!state.tracks.length) {
      setStatus(state.error || "No captions found for this video.", state.error ? "error" : "");
      return;
    }

    const track = state.tracks[state.selectedTrackIndex];
    if (!track?.baseUrl) return;

    state.loading = true;
    state.error = "";
    setStatus("Reading YouTube captions…");
    listElement?.replaceChildren();

    try {
      const json3 = await requestCaption(track.baseUrl);
      const vtt = state.youtube.json3ToVtt(json3);
      const transcript = state.core.normalizeTranscript({
        content: vtt,
        format: "vtt",
        source: {
          type: "youtube",
          id: state.videoId,
          url: location.href,
          title: state.title,
          language: track.languageCode,
          name: `${state.videoId}.${track.languageCode || "unknown"}.vtt`,
        },
      });
      if (!transcript.segments.length) throw new Error("YouTube returned an empty caption track.");
      state.document = transcript;
      renderSegments();
    } catch (error) {
      state.error = error instanceof Error ? error.message : "Unable to read captions.";
      setStatus(state.error, "error");
    } finally {
      state.loading = false;
    }
  }

  function applyTrackPayload(payload) {
    updateVisibility();
    if (!payload?.videoId || payload.videoId !== new URL(location.href).searchParams.get("v")) return;

    const videoChanged = state.videoId !== payload.videoId;
    if (videoChanged) {
      state.videoId = payload.videoId;
      state.document = null;
      state.query = "";
      state.error = "";
      if (searchInput) searchInput.value = "";
    }

    state.title = payload.title || document.title.replace(/\s*-\s*YouTube\s*$/, "");
    state.tracks = Array.isArray(payload.tracks) ? payload.tracks : [];
    state.defaultTrackIndex = Number(payload.defaultTrackIndex ?? -1);
    state.selectedTrackIndex = state.youtube.chooseCaptionTrack(
      state.tracks,
      state.defaultTrackIndex,
      navigator.language,
    );

    if (titleElement) titleElement.textContent = state.title;
    renderTracks();

    if (!payload.ready) setStatus("Waiting for YouTube player data…");
    else if (!state.tracks.length) setStatus("No captions found for this video.");
    else setStatus(`${state.tracks.length} caption track${state.tracks.length === 1 ? "" : "s"} available`);

    if (state.open && state.tracks.length) void ensureTranscript();
  }

  async function start() {
    [state.core, state.youtube] = await Promise.all([
      import(chrome.runtime.getURL("core.js")),
      import(chrome.runtime.getURL("youtube.js")),
    ]);
    createUi();
    post("BRIEFLY_REFRESH_TRACKS");
  }

  window.addEventListener("message", (event) => {
    if (event.source !== window || event.origin !== location.origin) return;
    const message = event.data;
    if (!message?.__briefly || message.source !== FROM_PAGE) return;

    if (message.type === "BRIEFLY_TRACKS") applyTrackPayload(message.payload);
    else if (message.type === "BRIEFLY_CAPTION_DATA" || message.type === "BRIEFLY_CAPTION_ERROR") {
      settleCaptionRequest(message.type, message.payload);
    }
  });

  window.addEventListener("yt-navigate-finish", () => {
    state.document = null;
    state.tracks = [];
    state.error = "";
    updateVisibility();
    post("BRIEFLY_REFRESH_TRACKS");
  });

  void start().catch((error) => {
    console.error("[Briefly] Failed to start", error);
  });
})();
