/* cMusic — player: mix de similares ao clicar numa música */
import { state } from "./state.js";
import { $, toast } from "./utils.js";
import { related } from "./api.js";
import { renderQueue, enqueue } from "./queue.js";
import { playAt, togglePlayPause } from "./island.js";

/**
 * Clique numa música => toca e monta um MIX de similares na fila
 * (substitui a fila atual). Se similar falhar, toca só a música.
 */
export async function playWithMix(t) {
  if (state.queue[state.current] && state.queue[state.current].videoId === t.videoId && $("audio").src) {
    togglePlayPause();
    return;
  }
  state.queue = [t];
  state.current = -1;
  renderQueue();
  playAt(0);
  try {
    const relatedList = await related(t.videoId);
    const valid = (relatedList || []).filter(
      (r) => r && r.videoId && r.videoId !== t.videoId &&
             !state.queue.some((x) => x.videoId === r.videoId)
    );
    state.queue = [t, ...valid];
    renderQueue();
    if (valid.length) toast(`Mix criado — ${valid.length} similares`);
  } catch (e) {
    toast("Não foi possível montar o mix");
  }
}

/* toca na hora (sem mix) ou só enfileira */
export function playOrEnqueue(t, enqueueOnly) {
  if (enqueueOnly) { enqueue(t); return; }
  const existing = state.queue.findIndex((x) => x.videoId === t.videoId);
  if (existing >= 0) playAt(existing);
  else { state.queue.push(t); renderQueue(); playAt(state.queue.length - 1); }
}
