/* cMusic — player: mix de similares ao clicar numa música + fila infinita */
import { state } from "./state.js";
import { $, toast } from "./utils.js";
import { related } from "./api.js";
import { renderQueue, enqueue } from "./queue.js";
import { playAt, togglePlayPause } from "./island.js";

const QUEUE_CAP = 100; // limite da fila com mix infinito
let filling = false;
let fillToastShown = false;

/**
 * Puxa relacionados de uma semente e anexa no fim da fila
 * (dedupe por videoId, respeitando o cap da fila).
 * announce = toast de "Mix criado"; autofill usa toast discreto.
 */
export async function fillMix(seedVideoId, announce = false) {
  if (filling || !seedVideoId || state.queue.length >= QUEUE_CAP) return;
  filling = true;
  try {
    const list = await related(seedVideoId);
    const valid = (list || []).filter(
      (r) => r && r.videoId && r.videoId !== seedVideoId &&
             !state.queue.some((x) => x.videoId === r.videoId)
    );
    valid.length = Math.min(valid.length, QUEUE_CAP - state.queue.length);
    if (valid.length) {
      state.queue = [...state.queue, ...valid];
      renderQueue();
      if (announce) toast(`Mix criado — ${valid.length} similares`);
      else if (!fillToastShown) {
        fillToastShown = true;
        toast(`Mix infinito: +${valid.length} na fila`);
      }
    }
  } catch (e) {
    if (announce) toast("Não foi possível montar o mix");
  } finally {
    filling = false;
  }
}

/**
 * Autofill: quando a faixa atual passa da metade da fila,
 * enche o resto com similares dela (mix infinito, sempre ligado).
 */
export function maybeFillQueue() {
  if (!state.infiniteMix) return;
  const n = state.queue.length;
  if (!n || n >= QUEUE_CAP || filling) return;
  if (state.current < Math.floor(n / 2)) return;
  const seed = state.queue[state.current];
  if (!seed || state.fillSeeds.has(seed.videoId)) return;
  state.fillSeeds.add(seed.videoId);
  if (state.fillSeeds.size > 300) { // histórico de sementes não explode
    state.fillSeeds = new Set([seed.videoId]);
  }
  fillMix(seed.videoId, false);
}

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
  state.fillSeeds = new Set([t.videoId]); // a semente do mix não refaz autofill dela mesma
  renderQueue();
  playAt(0);
  await fillMix(t.videoId, true);
}

/* toca na hora (sem mix) ou só enfileira */
export function playOrEnqueue(t, enqueueOnly) {
  if (enqueueOnly) { enqueue(t); return; }
  const existing = state.queue.findIndex((x) => x.videoId === t.videoId);
  if (existing >= 0) playAt(existing);
  else { state.queue.push(t); renderQueue(); playAt(state.queue.length - 1); }
}
