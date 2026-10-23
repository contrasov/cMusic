/* cMusic — histórico, favoritas e estatísticas (localStorage) */
import { toast } from "./utils.js";

/* ── Histórico ──────────────────────────────────────── */
/* migração: capas salvas Antes do fix (sqdefault 404 / vazias) -> hqdefault */
function sanThumb(t) {
  if (t && t.videoId && (!t.thumbnail || /\/vi\/[^/]+\/sqdefault\.jpg/.test(t.thumbnail))) {
    t.thumbnail = `https://i.ytimg.com/vi/${t.videoId}/hqdefault.jpg`;
  }
  return t;
}

const PLAYS_KEY = "cmusic_plays";
const LISTEN_KEY = "cmusic_listen_ms";

/* conta uma execução da faixa (chamado pelo pushHistory no playAt) */
function addPlay(t) {
  try {
    const plays = JSON.parse(localStorage.getItem(PLAYS_KEY) || "{}");
    const cur = plays[t.videoId] || { n: 0 };
    cur.n += 1;
    cur.track = {
      videoId: t.videoId,
      title: t.title,
      artist: t.artist,
      album: t.album || "",
      duration: t.duration || "",
      thumbnail: t.thumbnail || `https://i.ytimg.com/vi/${t.videoId}/hqdefault.jpg`,
    };
    plays[t.videoId] = cur;
    localStorage.setItem(PLAYS_KEY, JSON.stringify(plays));
  } catch (e) { /* ignore */ }
}

/* ── Perfil: tempo real de escuta (ticks do island) ─── */
export function addListen(ms) {
  try {
    localStorage.setItem(LISTEN_KEY, String(getListenMs() + ms));
  } catch (e) { /* ignore */ }
}

export function getListenMs() {
  return +localStorage.getItem(LISTEN_KEY) || 0;
}

/* top de faixas mais tocadas: [{ n, track }] */
export function getTopPlays(n = 6) {
  try {
    const plays = JSON.parse(localStorage.getItem(PLAYS_KEY) || "{}");
    return Object.values(plays)
      .filter((x) => x && x.n && x.track)
      .sort((a, b) => b.n - a.n)
      .slice(0, n);
  } catch (e) { return []; }
}

export function resetStats() {
  localStorage.removeItem(PLAYS_KEY);
  localStorage.removeItem(LISTEN_KEY);
  toast("Estatísticas zeradas");
}

export function pushHistory(t) {
  try {
    let hist = JSON.parse(localStorage.getItem("cmusic_history") || "[]");
    hist = hist.filter((x) => x.videoId !== t.videoId);
    hist.unshift(sanThumb({ ...t, ts: Date.now() }));
    localStorage.setItem("cmusic_history", JSON.stringify(hist.slice(0, 50)));
    localStorage.setItem("cmusic_last", t.videoId);
  } catch (e) { /* ignore */ }
  addPlay(t);
}

export function getHistory() {
  try { return (JSON.parse(localStorage.getItem("cmusic_history") || "[]")).map(sanThumb); }
  catch (e) { return []; }
}

/* ── Favoritas ──────────────────────────────────────── */
export function loadFavorites() {
  try { return (JSON.parse(localStorage.getItem("cmusic_favs") || "[]")).map(sanThumb); }
  catch (e) { return []; }
}

export function saveFavorites(list) {
  localStorage.setItem("cmusic_favs", JSON.stringify(list));
}

export function isFaved(vid) {
  return loadFavorites().some((x) => x.videoId === vid);
}

/** t = track completa (opcional); cai para o DOM quando null */
export function toggleFav(t, videoId) {
  const vid = videoId || t.videoId;
  if (!vid) return null;
  const list = loadFavorites();
  const idx = list.findIndex((x) => x.videoId === vid);
  if (idx >= 0) {
    list.splice(idx, 1);
    saveFavorites(list);
    toast("Removida das favoritas");
  } else {
    if (t) {
      list.unshift({ videoId: vid, title: t.title, artist: t.artist, album: t.album || "", duration: t.duration || "", thumbnail: t.thumbnail || "" });
    } else {
      const src = document.querySelector(`[data-id="${vid}"]`);
      const meta = src ? src.querySelector(".track-meta, .sc-meta") : null;
      const thumb = src && src.querySelector("img") ? src.querySelector("img").src : "";
      list.unshift({ videoId: vid, title: meta ? meta.querySelector(".track-title, .sc-title").textContent : vid, artist: meta ? meta.querySelector(".track-artist, .sc-artist").textContent : "", album: "", duration: "", thumbnail: thumb });
    }
    saveFavorites(list);
    toast("Salva nas favoritas");
  }
  document.querySelectorAll(`#view [data-id="${vid}"] .fav-heart, #btn-fav`)
    .forEach((el) => el.classList.toggle("faved", list.some((x) => x.videoId === vid)));
  return list.some((x) => x.videoId === vid);
}
