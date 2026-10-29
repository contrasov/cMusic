/* cMusic — histórico, favoritas e estatísticas (localStorage) */
import { toast, hqThumb } from "./utils.js";

/* ── Histórico ──────────────────────────────────────── */
/* migração: capas salvas Antes do fix (sqdefault 404 / vazias) -> hq/sd */
function sanThumb(t) {
  if (t && t.videoId && (!t.thumbnail || /\/vi\/[^/]+\/(sq|hq)default\.jpg/.test(t.thumbnail))) {
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
      thumbnail: t.thumbnail || (t.videoId ? hqThumb(`https://i.ytimg.com/vi/${t.videoId}/hqdefault.jpg`) : ""),
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

/* ── Artistas mais ouvidos (agrega plays por artista) ── */
export function getTopArtists(n = 3) {
  try {
    const plays = JSON.parse(localStorage.getItem(PLAYS_KEY) || "{}");
    const byArtist = {};
    for (const { n: count, track } of Object.values(plays)) {
      if (!count || !track) continue;
      // "A, B" (múltiplos artistas): conta para o primeiro
      const name = (track.artist || "").split(",")[0].trim();
      if (!name || name === "Desconhecido") continue;
      byArtist[name] = (byArtist[name] || 0) + count;
    }
    return Object.entries(byArtist)
      .sort((a, b) => b[1] - a[1])
      .slice(0, n)
      .map(([name]) => name);
  } catch (e) { return []; }
}

/* ── Playlists locais (sem login) ───────────────────── */
const PLS_KEY = "cmusic_playlists";

function loadPlaylists() {
  try { return JSON.parse(localStorage.getItem(PLS_KEY) || "[]"); }
  catch (e) { return []; }
}

function savePlaylists(list) {
  localStorage.setItem(PLS_KEY, JSON.stringify(list));
}

export function getPlaylists() {
  return loadPlaylists();
}

export function getPlaylist(id) {
  return loadPlaylists().find((p) => p.id === id) || null;
}

export function createPlaylist(name) {
  const list = loadPlaylists();
  const pl = { id: `pl_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, name, tracks: [], createdAt: Date.now() };
  list.unshift(pl);
  savePlaylists(list);
  return pl;
}

export function renamePlaylist(id, name) {
  const list = loadPlaylists();
  const pl = list.find((p) => p.id === id);
  if (pl) { pl.name = name; savePlaylists(list); }
  return pl;
}

export function deletePlaylist(id) {
  savePlaylists(loadPlaylists().filter((p) => p.id !== id));
}

/** retorna true se inseriu (faixa nova), false se já existia */
export function addToPlaylist(id, t) {
  const list = loadPlaylists();
  const pl = list.find((p) => p.id === id);
  if (!pl) return false;
  if (pl.tracks.some((x) => x.videoId === t.videoId)) return false;
  pl.tracks.push({
    videoId: t.videoId, title: t.title, artist: t.artist,
    album: t.album || "", duration: t.duration || "",
    thumbnail: t.thumbnail || (t.videoId ? hqThumb(`https://i.ytimg.com/vi/${t.videoId}/hqdefault.jpg`) : ""),
  });
  savePlaylists(list);
  return true;
}

export function removeFromPlaylist(id, videoId) {
  const list = loadPlaylists();
  const pl = list.find((p) => p.id === id);
  if (!pl) return;
  pl.tracks = pl.tracks.filter((x) => x.videoId !== videoId);
  savePlaylists(list);
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
