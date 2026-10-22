/* cMusic — fila lateral: render, cliques (tocar/remover) e controles do painel */
import { state } from "./state.js";
import { $, toast } from "./utils.js";
import { trackHTML } from "./components/templates.js";
import { playAt, updatePlayingMark, resetIsland } from "./island.js";
import { toggleFav } from "./store.js";

const appEl = $("#app");
const queueList = $("#queue-list");
const queueEmpty = $("#queue-empty");
const btnQueue = $("#btn-queue");
const btnQueueMin = $("#btn-queue-min");
const btnClearQueue = $("#btn-clear-queue");

export function replaceQueue(tracks) {
  state.queue = [...tracks];
  renderQueue();
}

export function renderQueue() {
  queueEmpty.style.display = state.queue.length ? "none" : "";
  queueList.innerHTML = state.queue.map((t, i) => trackHTML(t, true, i)).join("");
  updatePlayingMark();
  syncQueueHeader();
}

function syncQueueHeader() {
  btnQueue.classList.toggle("on", appEl.classList.contains("qc-hidden"));
}

export function enqueue(t) {
  state.queue.push(t);
  renderQueue();
  toast(`“${t.title}” na fila`);
}

/* ── Cliques na fila: tocar item / remover ──────────── */
queueList.addEventListener("click", (e) => {
  const li = e.target.closest(".track");
  if (!li) return;
  const i = +li.dataset.i;
  if (e.target.closest(".rm")) {
    state.queue.splice(i, 1);
    if (i < state.current) state.current--;
    else if (i === state.current) {
      if (state.queue.length) playAt(Math.min(i, state.queue.length - 1));
      else { replaceQueue([]); resetIsland(); }
      updatePlayingMark();
      return;
    }
    renderQueue();
    toast("Removida da fila");
    return;
  }
  if (e.target.closest(".track-action")) return;
  if (Number.isInteger(i)) playAt(i);
});

/* ── Minimizar / reabrir / limpar ───────────────────── */
btnQueueMin.addEventListener("click", () => {
  appEl.classList.add("qc-hidden");
  syncQueueHeader();
  toast("Fila oculta — botão no island reabre");
});

btnQueue.addEventListener("click", () => {
  appEl.classList.remove("qc-hidden");
  syncQueueHeader();
});

btnClearQueue.addEventListener("click", () => {
  if (!state.queue.length) return;
  replaceQueue([]);
  resetIsland();
  updatePlayingMark();
});

export { toggleFav };
