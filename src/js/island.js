/* cMusic — Dynamic Island: estado de loading, controles e áudio */
import { state } from "./state.js";
import { $, fmtTime, paintRange, toast } from "./utils.js";
import { pushHistory, isFaved, toggleFav, addListen } from "./store.js";
import { resolveStream } from "./api.js";
import { maybeFillQueue } from "./player.js";

const audio = $("#audio");
const islandEl = $("#island");
const btnPlay = $("#btn-play");
const btnPrev = $("#btn-prev");
const btnNext = $("#btn-next");
const btnShuffle = $("#btn-shuffle");
const btnRepeat = $("#btn-repeat");
const btnFav = $("#btn-fav");
const iconPlay = $("#icon-play");
const iconPause = $("#icon-pause");
const seekbar = $("#seekbar");
const volumebar = $("#volumebar");
const timeCur = $("#time-cur");
const timeTotal = $("#time-total");
const npThumb = $("#np-thumb");
const npFallback = $("#np-fallback");
const npTitle = $("#np-title");
const npArtist = $("#np-artist");
const rpc = window.cmusicRPC || null;
let lastPosSent = -1;

/* ── MPRIS: estado do player para o main (KDE/Plasma) ─ */
function mprisState(playing) {
  if (!rpc) return;
  const t = state.queue[state.current] || {};
  rpc.sendPlayerState({
    playing: !!playing,
    title: npTitle.textContent,
    artist: npArtist.textContent,
    artUrl: npThumb.getAttribute("src") || "",
    durationMs: audio.duration ? Math.round(audio.duration * 1000) : 0,
    videoId: (t && t.videoId) || "",
  });
}

function mprisPosition(force = false) {
  if (!rpc || !audio.duration) return;
  const ms = Math.round(audio.currentTime * 1000);
  if (force || Math.abs(ms - lastPosSent) > 900) {
    lastPosSent = ms;
    rpc.sendPosition(ms);
  }
}

export function setIslandLoading(on) {
  islandEl.classList.toggle("loading", !!on);
  btnPlay.disabled = !!on;
}

export async function playAt(index) {
  if (index < 0 || index >= state.queue.length) return;
  state.current = index;
  const t = state.queue[index];
  state.loadingId = t.videoId;
  npTitle.textContent = t.title;
  npArtist.textContent = t.artist;
  setNpCover(t);
  mprisState(false);
  setIslandLoading(true);
  islandEl.classList.remove("hidden"); // island aparece só com música
  timeCur.textContent = "0:00";
  timeTotal.textContent = "--:--";
  maybeFillQueue(); // mix infinito: ao passar da metade, enche a fila
  try {
    const info = await resolveStream(t.videoId);
    if (state.loadingId !== t.videoId) return;
    audio.src = info.url;
    audio.play();
    pushHistory(t);
    state.lastPlayed = t.videoId;
  } catch (e) {
    if (state.loadingId === t.videoId) setIslandLoading(false);
    state.loadingId = null;
    toast(`Erro: ${t.title} (${e.message})`);
    playNext();
    return;
  }
  syncFavButton();
  updatePlayingMark();
}

export function playNext() {
  if (state.shuffle && state.queue.length > 1) {
    if (!state.shuffleBag.length) {
      state.shuffleBag = state.queue.map((_, i) => i).filter((i) => i !== state.current);
      state.shuffleBag.sort(() => Math.random() - 0.5);
    }
    playAt(state.shuffleBag.shift());
    return;
  }
  let next = state.current + 1;
  if (next >= state.queue.length) {
    if (state.repeat === "all") next = 0;
    else { audio.pause(); setPlayingUI(false); return; }
  }
  playAt(next);
}

export function playPrev() {
  if (audio.currentTime > 3) { audio.currentTime = 0; return; }
  if (state.current <= 0) { audio.currentTime = 0; return; }
  playAt(state.current - 1);
}

export function togglePlayPause() {
  if (!audio.src) {
    if (state.queue.length) playAt(Math.max(state.current, 0));
    return;
  }
  audio.paused ? audio.play() : audio.pause();
}

export function resetIsland() {
  state.loadingId = null;
  audio.pause();
  audio.removeAttribute("src");
  setIslandLoading(false);
  mprisState(false);
  npTitle.textContent = "Nada tocando";
  npArtist.textContent = "cMusic";
  setNpCover({});
  setPlayingUI(false);
  islandEl.classList.add("hidden"); // sem música, sem island
}

function setNpCover(t) {
  if (t.thumbnail) {
    npThumb.src = t.thumbnail;
    npThumb.classList.remove("noimg");
    npFallback.classList.add("hidden");
  } else {
    npThumb.removeAttribute("src");
    npThumb.classList.add("noimg");
    npFallback.classList.remove("hidden");
  }
}

// erro de load de capa -> fallback ♪ (nada de imagem quebrada)
npThumb.addEventListener("error", () => {
  npThumb.removeAttribute("src");
  npThumb.classList.add("noimg");
  npFallback.classList.remove("hidden");
});

export function updatePlayingMark() {
  const id = state.queue[state.current] ? state.queue[state.current].videoId : null;
  document
    .querySelectorAll("#view .track, #view .song-card, #queue-list .track")
    .forEach((el) => el.classList.toggle("playing", el.dataset.id === id));
}

export function syncFavButton() {
  const id = state.queue[state.current] ? state.queue[state.current].videoId : null;
  btnFav.classList.toggle("faved", !!id && isFaved(id));
}

function setPlayingUI(playing) {
  iconPlay.classList.toggle("hidden", playing);
  iconPause.classList.toggle("hidden", !playing);
}

/* ── Wiring dos controles ───────────────────────────── */
btnPlay.addEventListener("click", togglePlayPause);

audio.addEventListener("play", () => { setPlayingUI(true); setIslandLoading(false); mprisState(true); });
audio.addEventListener("playing", () => setIslandLoading(false));
audio.addEventListener("pause", () => { setPlayingUI(false); mprisState(false); });
audio.addEventListener("canplay", () => setIslandLoading(false));
audio.addEventListener("error", () => setIslandLoading(false));
audio.addEventListener("ended", () => {
  if (state.repeat === "one") { audio.currentTime = 0; audio.play(); }
  else { mprisState(false); playNext(); }
});

/* perfil: contagem de tempo real de escuta (tick seguro a cada 10s) */
setInterval(() => {
  if (!audio.paused && audio.src && !audio.ended) addListen(10000);
}, 10000);
audio.addEventListener("volumechange", () => {
  volumebar.value = audio.volume * 100;
  paintRange(volumebar);
});

btnNext.addEventListener("click", playNext);
btnPrev.addEventListener("click", playPrev);

btnFav.addEventListener("click", () => {
  const t = state.queue[state.current];
  if (!t) return;
  toggleFav(t, t.videoId);
  btnFav.classList.add("pop");
  setTimeout(() => btnFav.classList.remove("pop"), 320);
  syncFavButton();
});

btnShuffle.addEventListener("click", () => {
  state.shuffle = !state.shuffle;
  btnShuffle.classList.toggle("on", state.shuffle);
  state.shuffleBag = [];
  toast(state.shuffle ? "Aleatório ligado" : "Aleatório desligado");
});

btnRepeat.addEventListener("click", () => {
  state.repeat = state.repeat === "off" ? "all" : state.repeat === "all" ? "one" : "off";
  btnRepeat.classList.toggle("on", state.repeat !== "off");
  toast(state.repeat === "off" ? "Repetir desligado" : state.repeat === "all" ? "Repetir fila" : "Repetir música");
});

/* ── Seek / Volume ──────────────────────────────────── */
audio.addEventListener("timeupdate", () => {
  if (state.seeking || !audio.duration) return;
  seekbar.value = (audio.currentTime / audio.duration) * 100;
  paintRange(seekbar);
  timeCur.textContent = fmtTime(audio.currentTime);
  timeTotal.textContent = fmtTime(audio.duration);
  mprisPosition();
});
seekbar.addEventListener("input", () => { state.seeking = true; paintRange(seekbar); });
seekbar.addEventListener("change", () => {
  if (audio.duration) audio.currentTime = (seekbar.value / 100) * audio.duration;
  state.seeking = false;
  mprisPosition(true);
});
volumebar.addEventListener("input", () => {
  audio.volume = volumebar.value / 100;
  paintRange(volumebar);
});
paintRange(volumebar);

/* ── Comandos do KDE (widget de mídia / teclas multimídia) ── */
if (rpc) {
  rpc.onCommand((cmd) => {
    if (typeof cmd !== "string") return;
    if (cmd === "toggle") togglePlayPause();
    else if (cmd === "play") audio.src ? audio.play() : togglePlayPause();
    else if (cmd === "pause") audio.pause();
    else if (cmd === "next") playNext();
    else if (cmd === "prev") playPrev();
    else if (cmd.startsWith("seekabs:")) {
      const ms = parseFloat(cmd.slice(8));
      if (audio.duration) audio.currentTime = Math.min(Math.max(0, ms / 1000), audio.duration);
    } else if (cmd.startsWith("seek:")) {
      const ms = parseFloat(cmd.slice(5));
      if (audio.duration)
        audio.currentTime = Math.min(Math.max(0, audio.currentTime + ms / 1000), audio.duration);
    }
  });
}
