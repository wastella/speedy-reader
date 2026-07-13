(() => {
  "use strict";

  const STORAGE_KEY = "speedy-reader:last-settings";

  // ---- DOM refs ----
  const setupView = document.getElementById("setup-view");
  const readerView = document.getElementById("reader-view");
  const doneView = document.getElementById("done-view");

  const textInput = document.getElementById("text-input");
  const wordCountEl = document.getElementById("word-count");
  const clearBtn = document.getElementById("clear-btn");
  const sampleBtn = document.getElementById("sample-btn");

  const wpmInput = document.getElementById("wpm-input");
  const chunkInput = document.getElementById("chunk-input");
  const startBtn = document.getElementById("start-btn");
  const bestWpmHint = document.getElementById("best-wpm-hint");

  const wordDisplay = document.getElementById("word-display");
  const progressFill = document.getElementById("progress-fill");
  const progressLabel = document.getElementById("progress-label");

  const playPauseBtn = document.getElementById("play-pause-btn");
  const restartBtn = document.getElementById("restart-btn");
  const backBtn = document.getElementById("back-btn");

  const liveWpmInput = document.getElementById("live-wpm-input");
  const liveChunkInput = document.getElementById("live-chunk-input");

  const finalWpmEl = document.getElementById("final-wpm");
  const doneRestartBtn = document.getElementById("done-restart-btn");
  const doneNewTextBtn = document.getElementById("done-new-text-btn");
  const repoLink = document.getElementById("repo-link");

  // ---- State ----
  let words = [];
  let chunks = [];
  let chunkIndex = 0;
  let playing = false;
  let timerId = null;

  const SAMPLE_TEXT = `Speed reading drills work by forcing your eyes and brain to process words faster than feels comfortable, then letting comfort catch up to the new pace. Start slow enough that you can repeat every word out loud, then nudge the rate upward in small steps. When you start stumbling, back off slightly and hold that pace until it feels stable before pushing again. The goal is not to read once at an impossible speed, it is to gradually raise the speed at which you can accurately keep up, one small increment at a time, over many repetitions.`;

  // ---- Persisted settings ----
  function loadSettings() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (typeof parsed.wpm === "number" && typeof parsed.chunk === "number") return parsed;
    } catch (e) { /* ignore corrupt storage */ }
    return null;
  }

  function saveSettings(wpm, chunk) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ wpm, chunk }));
    } catch (e) { /* storage unavailable, ignore */ }
  }

  function applySavedSettings() {
    const saved = loadSettings();
    if (saved) {
      wpmInput.value = saved.wpm;
      liveWpmInput.value = saved.wpm;
      chunkInput.value = saved.chunk;
      liveChunkInput.value = saved.chunk;
      bestWpmHint.textContent = `Last session's setting: ${saved.wpm} WPM, chunk size ${saved.chunk}.`;
    }
  }

  // ---- Word counting / chunking ----
  function tokenize(text) {
    return text.trim().split(/\s+/).filter(Boolean);
  }

  function buildChunks(wordList, chunkSize) {
    const size = Math.max(1, chunkSize | 0);
    const result = [];
    for (let i = 0; i < wordList.length; i += size) {
      result.push(wordList.slice(i, i + size));
    }
    return result;
  }

  function updateWordCount() {
    const w = tokenize(textInput.value);
    wordCountEl.textContent = `${w.length} word${w.length === 1 ? "" : "s"}`;
    startBtn.disabled = w.length === 0;
  }

  function renderChunk(chunkWords) {
    wordDisplay.textContent = chunkWords.join(" ");
  }

  // ---- Timing ----
  // Base duration per chunk from WPM, with small readability adjustments
  // for longer words and sentence-ending punctuation (mirrors how real
  // RSVP tools avoid feeling metronomic at higher speeds).
  function chunkDurationMs(chunkWords, wpm) {
    const msPerWord = 60000 / Math.max(50, wpm);
    let duration = msPerWord * chunkWords.length;

    const lastWord = chunkWords[chunkWords.length - 1] || "";
    if (/[.!?]["')\]]?$/.test(lastWord)) duration *= 1.6;
    else if (/[,;:]["')\]]?$/.test(lastWord)) duration *= 1.25;

    const longWords = chunkWords.filter((w) => w.length >= 8).length;
    duration += longWords * (msPerWord * 0.15);

    return duration;
  }

  function currentLiveWpm() {
    return clampInt(liveWpmInput.value, 50, 1500, 200);
  }

  function currentLiveChunkSize() {
    return clampInt(liveChunkInput.value, 1, 10, 1);
  }

  function clampInt(val, min, max, fallback) {
    const n = parseInt(val, 10);
    if (Number.isNaN(n)) return fallback;
    return Math.min(max, Math.max(min, n));
  }

  // ---- Playback ----
  function rebuildChunksPreservingPosition() {
    const wordsSoFar = chunkIndex * (chunks[0] ? chunks[0].length : 1);
    const newChunkSize = currentLiveChunkSize();
    chunks = buildChunks(words, newChunkSize);
    chunkIndex = Math.min(chunks.length - 1, Math.floor(wordsSoFar / newChunkSize));
    if (chunkIndex < 0) chunkIndex = 0;
  }

  function clampDisplayedValue(input) {
    const min = parseInt(input.min, 10);
    const max = parseInt(input.max, 10);
    input.value = clampInt(input.value, min, max, min);
  }

  function updateProgress() {
    const total = chunks.length;
    const pos = Math.min(chunkIndex + 1, total);
    progressFill.style.width = total ? `${(pos / total) * 100}%` : "0%";
    progressLabel.textContent = `${pos} / ${total}`;
  }

  function scheduleNext() {
    clearTimeout(timerId);
    if (!playing) return;
    if (chunkIndex >= chunks.length) {
      finishDrill();
      return;
    }
    const chunkWords = chunks[chunkIndex];
    renderChunk(chunkWords);
    updateProgress();
    const wpm = currentLiveWpm();
    const duration = chunkDurationMs(chunkWords, wpm);
    timerId = setTimeout(() => {
      chunkIndex += 1;
      scheduleNext();
    }, duration);
  }

  function play() {
    if (words.length === 0) return;
    if (chunkIndex >= chunks.length) chunkIndex = 0;
    playing = true;
    playPauseBtn.textContent = "Pause";
    scheduleNext();
  }

  function pause() {
    playing = false;
    clearTimeout(timerId);
    playPauseBtn.textContent = "Play";
  }

  function togglePlayPause() {
    if (playing) pause();
    else play();
  }

  function finishDrill() {
    playing = false;
    clearTimeout(timerId);
    playPauseBtn.textContent = "Play";
    finalWpmEl.textContent = currentLiveWpm();
    saveSettings(currentLiveWpm(), currentLiveChunkSize());
    showView(doneView);
  }

  function onLiveChunkSizeChanged() {
    clampDisplayedValue(liveChunkInput);
    rebuildChunksPreservingPosition();
    if (playing) {
      scheduleNext();
    } else {
      renderChunk(chunks[chunkIndex] || []);
      updateProgress();
    }
  }

  function jumpChunks(delta) {
    if (chunks.length === 0) return;
    chunkIndex = Math.min(chunks.length - 1, Math.max(0, chunkIndex + delta));
    if (playing) {
      scheduleNext();
    } else {
      renderChunk(chunks[chunkIndex]);
      updateProgress();
    }
  }

  function nudgeWpm(delta) {
    const next = clampInt(parseInt(liveWpmInput.value, 10) + delta, 50, 1500, 200);
    liveWpmInput.value = next;
  }

  // ---- View switching ----
  function showView(view) {
    [setupView, readerView, doneView].forEach((v) => v.classList.add("hidden"));
    view.classList.remove("hidden");
  }

  function startDrill() {
    words = tokenize(textInput.value);
    if (words.length === 0) return;
    const wpm = clampInt(wpmInput.value, 50, 1500, 200);
    const chunkSize = clampInt(chunkInput.value, 1, 10, 1);
    liveWpmInput.value = wpm;
    liveChunkInput.value = chunkSize;
    chunks = buildChunks(words, chunkSize);
    chunkIndex = 0;
    wordDisplay.textContent = "Ready";
    updateProgress();
    showView(readerView);
    pause();
  }

  // ---- Event wiring ----
  textInput.addEventListener("input", updateWordCount);

  clearBtn.addEventListener("click", () => {
    textInput.value = "";
    updateWordCount();
    textInput.focus();
  });

  sampleBtn.addEventListener("click", () => {
    textInput.value = SAMPLE_TEXT;
    updateWordCount();
  });

  document.querySelectorAll(".step-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const targetId = btn.dataset.target;
      const step = parseInt(btn.dataset.step, 10);
      const input = document.getElementById(targetId);
      const min = parseInt(input.min, 10);
      const max = parseInt(input.max, 10);
      const next = clampInt(parseInt(input.value, 10) + step, min, max, min);
      input.value = next;
      if (targetId === "live-chunk-input") onLiveChunkSizeChanged();
    });
  });

  startBtn.addEventListener("click", startDrill);

  playPauseBtn.addEventListener("click", togglePlayPause);

  restartBtn.addEventListener("click", () => {
    pause();
    chunkIndex = 0;
    wordDisplay.textContent = "Ready";
    updateProgress();
  });

  backBtn.addEventListener("click", () => {
    pause();
    showView(setupView);
  });

  doneRestartBtn.addEventListener("click", () => {
    pause();
    chunkIndex = 0;
    wordDisplay.textContent = "Ready";
    updateProgress();
    showView(readerView);
  });

  doneNewTextBtn.addEventListener("click", () => {
    showView(setupView);
  });

  wpmInput.addEventListener("change", () => clampDisplayedValue(wpmInput));
  chunkInput.addEventListener("change", () => clampDisplayedValue(chunkInput));
  liveWpmInput.addEventListener("change", () => clampDisplayedValue(liveWpmInput));
  liveChunkInput.addEventListener("change", onLiveChunkSizeChanged);

  document.addEventListener("keydown", (e) => {
    if (readerView.classList.contains("hidden")) return;
    if (e.target.tagName === "INPUT") return;
    switch (e.code) {
      case "Space":
        e.preventDefault();
        togglePlayPause();
        break;
      case "ArrowRight":
        jumpChunks(5);
        break;
      case "ArrowLeft":
        jumpChunks(-5);
        break;
      case "ArrowUp":
        e.preventDefault();
        nudgeWpm(25);
        break;
      case "ArrowDown":
        e.preventDefault();
        nudgeWpm(-25);
        break;
    }
  });

  // ---- Init ----
  applySavedSettings();
  updateWordCount();
})();
