/* cMusic — Tela cheia "Tocando agora": abre ao clicar na Dynamic Island */
import { state } from "./state.js";
import { $, fmtTime, escape, hqThumb, paintRange } from "./utils.js";
import {
  playAt, togglePlayPause, audioEl, resetIsland,
} from "./island.js";
import { isFaved, toggleFav } from "./store.js";

const root = $("#np-full");
const ISL = {
  play: $("#btn-play"), prev: $("#btn-prev"), next: $("#btn-next"),
  shuffle: $("#btn-shuffle"), repeat: $("#btn-repeat"),
};
let npSeeking = false;
let dragIdx = -1;

/* ícones */
const IC = {
  shuffle: `<svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor"><path d="M10.59 9.17 5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4zm.33 9.41-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04z"/></svg>`,
  prev: `<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M6 6h2v12H6zm3.5 6 8.5 6V6z"/></svg>`,
  next: `<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6z"/></svg>`,
  repeat: `<svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor"><path d="M7 7h10v3l-4-4-4-4v3H5v6h2zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2z"/></svg>`,
  heart: `<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54z"/></svg>`,
  close: `<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>`,
  vol: `<svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9zm13.5 3A4.5 4.5 0 0 0 14 8v8a4.5 4.5 0 0 0 2.5-4z"/></svg>`,
  rm: `<svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>`,
};

const cur = () => state.queue[state.current] || null;

export function npOpen() {
  if (!cur()) return;
  render();
  root.classList.remove("hidden");
  requestAnimationFrame(() => root.classList.add("open"));
  syncPlayIcon();
  paintRange($("#npf-seekbar"));
  paintRange($("#npf-vol"));
}

export function npClose() {
  root.classList.remove("open");
  setTimeout(() => root.classList.add("hidden"), 180);
}

function coverHTML(t) {
  return hqThumb(t.thumbnail)
    ? `<img src="${hqThumb(t.thumbnail)}" alt="" />`
    : `<div class="npf-fallback">♪</div>`;
}

function render() {
  const t = cur();
  const faved = !!t && isFaved(t.videoId);
  const art = coverHTML(t);
  root.innerHTML = `
    <button class="npf-close" id="npf-close" title="Fechar (Esc)">${IC.close}</button>
    <div class="npf-wrap">
      <div class="npf-left">
        <div class="npf-art">${art}</div>
        <div class="npf-meta">
          <div class="npf-titles">
            <div class="npf-title">${escape(t.title)}</div>
            <div class="npf-artist">${escape(t.artist)}</div>
          </div>
          <button class="npf-heart ${faved ? "faved" : ""}" id="npf-fav" title="Favoritar">${IC.heart}</button>
        </div>
        <div class="npf-seek">
          <span id="npf-tcur">0:00</span>
          <input id="npf-seekbar" type="range" min="0" max="100" value="0" step="0.1" />
          <span id="npf-ttotal">${t.duration || "--:--"}</span>
        </div>
        <div class="npf-controls">
          <button class="npf-btn ${state.shuffle ? "on" : ""}" id="npf-shuffle" title="Aleatório">${IC.shuffle}</button>
          <button class="npf-btn" id="npf-prev" title="Anterior">${IC.prev}</button>
          <button class="npf-main" id="npf-play" title="Tocar/Pausar">
            <svg id="npf-ic-play" viewBox="0 0 24 24" width="26" height="26" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
            <svg id="npf-ic-pause" viewBox="0 0 24 24" width="26" height="26" fill="currentColor" class="hidden"><path d="M6 19h4V5H6zm8-14v14h4V5z"/></svg>
          </button>
          <button class="npf-btn" id="npf-next" title="Próxima">${IC.next}</button>
          <button class="npf-btn ${state.repeat !== "off" ? "on" : ""}" id="npf-repeat" title="Repetir">${IC.repeat}</button>
        </div>
        <div class="npf-vol">
          ${IC.vol}
          <input id="npf-vol" type="range" min="0" max="100" value="${Math.round(audioEl.volume * 100)}" />
        </div>
      </div>
      <div class="npf-right">
        <div class="npf-queue-head">
          <h3>Tocando agora</h3>
          <span class="npf-count">${state.queue.length} faixa${state.queue.length === 1 ? "" : "s"} · arraste para reordenar</span>
        </div>
        <ul class="npf-list" id="npf-list">${rowsHTML()}</ul>
      </div>
    </div>`;
}

function rowsHTML() {
  const nowId = cur()?.videoId;
  return state.queue.map((t, i) => `
    <li class="npf-track ${t.videoId === nowId ? "playing" : ""}" draggable="true"
        data-i="${i}" data-id="${t.videoId}">
      <span class="npf-num">${i === state.current ? "♪" : i + 1}</span>
      ${hqThumb(t.thumbnail) ? `<img class="npf-thumb" src="${hqThumb(t.thumbnail)}" alt="" loading="lazy" onerror="this.removeAttribute('src'); this.classList.add('noimg');" />`
        : `<span class="npf-thumb noimg"></span>`}
      <div class="npf-track-meta">
        <div class="npf-track-title">${escape(t.title)}</div>
        <div class="npf-track-artist">${escape(t.artist)}</div>
      </div>
      ${t.duration ? `<span class="npf-dur">${t.duration}</span>` : ""}
      <button class="npf-rm" title="Remover da fila">${IC.rm}</button>
    </li>`).join("");
}

/* ── Sync de estado ─────────────────────────────────── */
function syncPlayIcon() {
  const playing = !audioEl.paused && !!audioEl.src;
  $("#npf-ic-play")?.classList.toggle("hidden", playing);
  $("#npf-ic-pause")?.classList.toggle("hidden", !playing);
}

function syncAll() {
  if (root.classList.contains("hidden")) return;
  const t = cur();
  if (!t) return;
  const artEl = root.querySelector(".npf-art");
  if (artEl) artEl.innerHTML = coverHTML(t);
  const title = root.querySelector(".npf-title");
  const artist = root.querySelector(".npf-artist");
  if (title) title.textContent = t.title;
  if (artist) artist.textContent = t.artist;
  const heart = $("#npf-fav");
  if (heart) heart.classList.toggle("faved", isFaved(t.videoId));
  const total = $("#npf-ttotal");
  if (total) total.textContent = audioEl.duration ? fmtTime(audioEl.duration) : (t.duration || "--:--");
  /* fila reordenada: re-render preserva o drag */
  const list = $("#npf-list");
  if (list && dragIdx < 0) list.innerHTML = rowsHTML();
  [...(list?.children || [])].forEach((li) => li.classList.toggle("playing", li.dataset.id === t.videoId));
}

/* ── Timeupdate próprio do overlay ──────────────────── */
audioEl.addEventListener("timeupdate", () => {
  if (root.classList.contains("hidden")) return;
  const bar = $("#npf-seekbar");
  if (!bar || npSeeking || !audioEl.duration) return;
  bar.value = (audioEl.currentTime / audioEl.duration) * 100;
  paintRange(bar);
  const tcur = $("#npf-tcur");
  if (tcur) tcur.textContent = fmtTime(audioEl.currentTime);
  const ttotal = $("#npf-ttotal");
  if (ttotal && audioEl.duration) ttotal.textContent = fmtTime(audioEl.duration);
});

document.addEventListener("cmusic-playstate", () => { syncPlayIcon(); syncAll(); });
document.addEventListener("cmusic-queue-changed", syncAll);

audioEl.addEventListener("volumechange", () => {
  const v = $("#npf-vol");
  if (!v) return;
  v.value = audioEl.volume * 100;
  paintRange(v);
});

/* ── Abrir: clique no info da island (botões não abrem) ── */
$("#np-info").addEventListener("click", (e) => {
  if (e.target.closest("button")) return;
  npOpen();
});

/* ── Cliques do overlay ─────────────────────────────── */
root.addEventListener("click", (e) => {
  if (e.target === root) { npClose(); return; }
  if (e.target.closest("#npf-close")) { npClose(); return; }
  if (e.target.closest("#npf-play")) { togglePlayPause(); return; }
  if (e.target.closest("#npf-prev")) { ISL.prev.click(); return; }
  if (e.target.closest("#npf-next")) { ISL.next.click(); return; }
  if (e.target.closest("#npf-shuffle")) { ISL.shuffle.click(); syncShuffleRepeat(); return; }
  if (e.target.closest("#npf-repeat")) { ISL.repeat.click(); syncShuffleRepeat(); return; }
  if (e.target.closest("#npf-fav")) {
    const t = cur();
    if (!t) return;
    toggleFav(t, t.videoId);
    $("#npf-fav").classList.toggle("faved", isFaved(t.videoId));
    return;
  }
  const row = e.target.closest(".npf-track");
  if (row && dragIdx < 0) {
    if (e.target.closest(".npf-rm")) {
      const i = +row.dataset.i;
      state.queue.splice(i, 1);
      if (i < state.current) state.current--;
      else if (i === state.current) {
        if (state.queue.length) playAt(Math.min(i, state.queue.length - 1));
        else { resetIsland(); npClose(); return; }
      }
      document.dispatchEvent(new Event("cmusic-queue-changed"));
      render();
      return;
    }
    playAt(+row.dataset.i);
  }
});

function syncShuffleRepeat() {
  const sh = $("#npf-shuffle");
  if (sh) sh.classList.toggle("on", state.shuffle);
  const rp = $("#npf-repeat");
  if (rp) rp.classList.toggle("on", state.repeat !== "off");
}

/* ── Seek / volume do overlay ───────────────────────── */
root.addEventListener("input", (e) => {
  const t = e.target;
  if (t.id === "npf-seekbar") {
    npSeeking = true;
    paintRange(t);
    const tcur = $("#npf-tcur");
    if (tcur && audioEl.duration) {
      tcur.textContent = fmtTime((t.value / 100) * audioEl.duration);
    }
  } else if (t.id === "npf-vol") {
    audioEl.volume = t.value / 100;
    paintRange(t);
  }
});
root.addEventListener("change", (e) => {
  const t = e.target;
  if (t.id === "npf-seekbar" && audioEl.duration) {
    audioEl.currentTime = (t.value / 100) * audioEl.duration;
    npSeeking = false;
  }
});

/* ── Drag & drop: reordenar a fila ──────────────────── */
root.addEventListener("dragstart", (e) => {
  const row = e.target.closest(".npf-track");
  if (!row) return;
  dragIdx = +row.dataset.i;
  row.classList.add("dragging");
  e.dataTransfer.effectAllowed = "move";
  try { e.dataTransfer.setData("text/plain", String(dragIdx)); } catch (_) { /* webview */ }
});

root.addEventListener("dragover", (e) => {
  if (dragIdx < 0) return;
  e.preventDefault();
  const list = $("#npf-list");
  const row = e.target.closest(".npf-track");
  if (!list || !row || +row.dataset.i === dragIdx) return;
  e.dataTransfer.dropEffect = "move";
  const target = +row.dataset.i;
  const rect = row.getBoundingClientRect();
  const after = e.clientY > rect.top + rect.height / 2;
  /* ajusta state com o índice pós-remoção */
  const tIdx = target > dragIdx ? target - 1 : target;
  const insertIdx = after ? tIdx + 1 : tIdx;
  const [moved] = state.queue.splice(dragIdx, 1);
  state.queue.splice(insertIdx, 0, moved);
  if (state.current === dragIdx) state.current = insertIdx;
  else if (dragIdx < state.current && insertIdx >= state.current) state.current--;
  else if (dragIdx > state.current && insertIdx <= state.current) state.current++;
  dragIdx = insertIdx;
  /* move o node no DOM de acordo */
  list.insertBefore(row, after ? row.nextSibling : row);
  [...list.children].forEach((li, i) => {
    li.dataset.i = i;
    li.classList.toggle("playing", li.dataset.id === (state.queue[state.current]?.videoId || ""));
    li.querySelector(".npf-num").textContent =
      state.queue[i].videoId === cur()?.videoId ? "♪" : i + 1;
  });
  row.classList.add("dragging");
});

root.addEventListener("dragend", () => {
  dragIdx = -1;
  document.dispatchEvent(new Event("cmusic-queue-changed"));
  $("#npf-list")?.classList.remove("scroll-hint");
  syncAll();
});

/* ── Fechar com Esc ─────────────────────────────────── */
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !root.classList.contains("hidden")) {
    e.stopPropagation();
    npClose();
  }
});
