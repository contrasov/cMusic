/* cMusic — views (router de conteúdo) */
import { state } from "./state.js";
import { $, escape, toast, fmtListen, hqThumb } from "./utils.js";
import {
  search, exploreHome, exploreForYou, exploreForYouSongs, exploreCharts, related, album,
} from "./api.js";
import {
  carousel, cardsSection, trackList, searchTabsHTML, lineToTrack,
  cardHTML, coverHTML, X_ICON, ADD_ICON,
} from "./components/templates.js";
import {
  getHistory, loadFavorites, toggleFav, getTopPlays, getTopArtists,
  getListenMs, resetStats,
  getPlaylists, getPlaylist, createPlaylist, addToPlaylist,
  deletePlaylist, removeFromPlaylist, renamePlaylist,
} from "./store.js";
import { enqueue, replaceQueue } from "./queue.js";
import { playAt, updatePlayingMark } from "./island.js";
import { playWithMix, playOrEnqueue } from "./player.js";
import { openPlaylistModal, openConfirmModal } from "./modal.js";

function loadMoreHTML(kind) {
  return `<div class="load-more-wrap">
    <button class="btn-ghost load-more" data-kind="${kind}">Carregar mais</button>
  </div>`;
}

function setMoreBusy(btn, busy = true) {
  if (!btn) return;
  btn.disabled = busy;
  btn.textContent = busy ? "Carregando..." : "Carregar mais";
}

let relatedDone = false;

const viewEl = $("#view");
const headerTitle = $("#header-title");
const btnBack = $("#btn-back");

/* vista de nível superior ativa (para onde o "voltar" retorna) */
let currentTop = { fn: null, args: [] };
btnBack.addEventListener("click", () => {
  btnBack.classList.add("hidden");
  if (currentTop.fn) currentTop.fn(...currentTop.args);
});

/* ── Header / router ────────────────────────────────── */
export function setHeader(title) { headerTitle.textContent = title; }

function beginView(back) {
  btnBack.classList.toggle("hidden", !back);
}

export function setNav(view) {
  document.querySelectorAll(".nav-item").forEach((el) =>
    el.classList.toggle("active", el.dataset.view === view));
}

export function animateView() {
  viewEl.classList.remove("anim-in");
  void viewEl.offsetWidth; // reinicia a animação
  viewEl.classList.add("anim-in");
}

/* Álbuns recomendados: dos artistas mais ouvidos, com fallback p/ os →get_home */
async function recommendedCollections(need = 12) {
  const artists = getTopArtists(3);
  if (!artists.length) {
    try {
      const data = await exploreHome();
      return { collections: data.collections, personalized: false };
    } catch (e) {
      return { collections: [], personalized: false };
    }
  }
  try {
    const data = await exploreForYou(artists);
    if (data.collections?.length >= 4) return { collections: data.collections, personalized: true };
  } catch (e) { /* cai para o home */ }
  try {
    const data = await exploreHome();
    return { collections: data.collections, personalized: false };
  } catch (e) {
    return { collections: [], personalized: false };
  }
}

/* ── Views ──────────────────────────────────────────── */
/* "Para você": músicas dos artistas mais ouvidos; fallback = get_home */
async function profileSongs(fallbackSongs) {
  const artists = getTopArtists(3);
  if (!artists.length) return fallbackSongs;
  try {
    const { songs } = await exploreForYouSongs(artists, 16);
    if (songs?.length >= 6) return songs;
  } catch (e) { /* cai para o fallback do home */ }
  return fallbackSongs;
}

/* dado única da home (músicas p/ perfil + coleções) */
async function fetchHomeData() {
  const [data, rec, charts] = await Promise.all([
    exploreHome(),
    recommendedCollections().catch(() => ({ collections: [], personalized: false })),
    exploreCharts().catch(() => ({ collections: [] })),
  ]);
  const songs = await profileSongs(data.songs);
  const ids = new Set(rec.collections.map((c) => c.id));
  const popular = charts.collections?.length
    ? charts.collections.filter((c) => !ids.has(c.id))
    : (data.collections || []).filter((c) => !ids.has(c.id)).slice(0, 12);
  return { songs, collections: rec.collections, personalized: rec.personalized, popular };
}
/* skeleton da home (shimmer) — só na primeira sessão */
function homeSkeletonHTML() {
  const skSong = (n) => `
    <div class="car-col">${Array.from({ length: n }, () => `
      <div class="song-card sk">
        <div class="sc-cover sk-shimmer"></div>
        <div class="sk-lines">
          <div class="sk-line sk-shimmer" style="width:72%"></div>
          <div class="sk-line sk-shimmer" style="width:46%"></div>
        </div>
      </div>`).join("")}</div>`;
  const skRow = () => `
    <div class="carousel-wrap">
      <div class="carousel-head"><h2><span class="sk-line sk-shimmer sk-h2"></span></h2></div>
      <div class="carousel">${skSong(2)}${skSong(2)}${skSong(2)}${skSong(2)}</div>
    </div>`;
  const skGrid = (n) => `
    <h2 class="section"><span class="sk-line sk-shimmer sk-h2"></span></h2>
    <div class="card-grid">
      ${Array.from({ length: n }, () => `
        <div class="card sk">
          <div class="card-art"><div class="sk-cover sk-shimmer"></div></div>
          <div class="sk-line sk-shimmer" style="width:64%"></div>
          <div class="sk-line sk-shimmer" style="width:40%"></div>
        </div>`).join("")}
    </div>`;
  return `
    <div id="home-wrap" class="home-wrap">
      <div class="home-greet">
        <span class="sk-line sk-shimmer sk-greet1"></span>
        <span class="sk-line sk-shimmer sk-greet2"></span>
      </div>
      ${skRow()}
      ${skRow()}
      ${skGrid(6)}
      ${skGrid(6)}
    </div>`;
}

function currentHomeHTML({ hist, songs, collections, personalized, popular }) {
  return `
    <div id="home-wrap" class="home-wrap">
      <div class="home-greet">
        <h1>Eae? O que vai ouvir hoje?</h1>
        <p>Já foram <span class="greet-hrs">${fmtListen(getListenMs())}</span> de música</p>
      </div>
      ${carousel("Recentes", hist)}
      ${carousel("Para você", songs.slice(0, 12))}
      ${cardsSection(personalized ? "Baseado no que você escuta" : "Álbuns recomendados", collections)}
      ${popular?.length ? cardsSection("Populares do momento", popular) : ""}
    </div>`;
}

/* aplica o conteúdo da home; withMotion = fade-out → swap → view-in */
function applyHome(data, withMotion) {
  const swap = () => {
    if (currentTop.fn !== goHome) return;
    viewEl.innerHTML = currentHomeHTML(data);
    state.currentViewData = [...data.hist, ...data.songs];
    animateView();
    updatePlayingMark();
  };
  const wrap = $("#home-wrap");
  if (withMotion && wrap) {
    wrap.classList.add("home-fade"); // some de leve antes do swap
    setTimeout(swap, 200);
    return;
  }
  swap();
}

/* refresh silencioso em segundo plano: atualiza o cache e, se a home está
 * visível, faz o swap com motion */
async function refreshHomeBackground() {
  if (state.homeRefreshing) return;
  state.homeRefreshing = true;
  try {
    state.homeCache = await fetchHomeData();
    state.collectionsCache = state.homeCache.collections;
    state.recsPersonalized = state.homeCache.personalized;
    if (currentTop.fn !== goHome) return; // usuário saiu da home: só cache
    applyHome({ hist: getHistory().slice(0, 10), ...state.homeCache }, true);
  } catch (e) {
    /* silencioso: mantém o contexto atual */
  } finally {
    state.homeRefreshing = false;
  }
}

export function goHome() {
  currentTop = { fn: goHome, args: [] };
  beginView(null);
  setNav("home");
  setHeader("Início");

  /* primeira visita da sessão: skeleton até chegar (rápido via paralelo) */
  if (!state.homeCache) {
    viewEl.innerHTML = homeSkeletonHTML();
    animateView();
    fetchHomeData().then((homeData) => {
      state.homeCache = homeData;
      state.collectionsCache = homeData.collections;
      state.recsPersonalized = homeData.personalized;
      if (currentTop.fn !== goHome) return;
      applyHome({ hist: getHistory().slice(0, 10), ...state.homeCache }, false);
    }).catch((e) => {
      if (currentTop.fn === goHome)
        viewEl.innerHTML = `<div class="status">Erro: ${escape(e.message)}</div>`;
    });
    return;
  }

  /* contexto retomado: render instantâneo + refresh silencioso */
  applyHome({ hist: getHistory().slice(0, 10), ...state.homeCache }, false);
  refreshHomeBackground();
}

export async function goRelated() {
  currentTop = { fn: goRelated, args: [] };
  beginView(null);
  setNav("related");
  setHeader("Similares");
  state.relatedLimit = 20;
  relatedDone = false;
  if (!state.lastPlayed) {
    viewEl.innerHTML = `<div class="status">Toque uma música primeiro — as similares aparecem aqui.</div>`;
    animateView();
    return;
  }
  viewEl.innerHTML = `<div class="status loading-dots">Buscando similares</div>`;
  animateView();
  try {
    state.relatedCache = await related(state.lastPlayed, state.relatedLimit);
    renderRelatedBody();
  } catch (e) {
    viewEl.innerHTML = `<div class="status">Erro: ${escape(e.message)}</div>`;
  }
}

function renderRelatedBody() {
  const data = state.relatedCache || [];
  viewEl.innerHTML = trackList(data) +
    (data.length >= state.relatedLimit && !relatedDone ? loadMoreHTML("related") : "");
  state.currentViewData = data;
  animateView();
  updatePlayingMark();
}

async function loadMoreRelated(btn) {
  const prev = (state.relatedCache || []).length;
  state.relatedLimit += 25;
  setMoreBusy(btn);
  try {
    const fresh = await related(state.lastPlayed, state.relatedLimit);
    if (fresh.length <= prev) {
      state.relatedLimit -= 25;
      relatedDone = true;
      toast("É isso — fim das similares");
    } else {
      state.relatedCache = fresh;
    }
    renderRelatedBody();
  } catch (e) {
    setMoreBusy(btn, false);
    toast(`Erro ao carregar mais: ${e.message}`);
  }
}

export function goProfile() {
  currentTop = { fn: goProfile, args: [] };
  beginView(null);
  setNav("profile");
  setHeader("Perfil");
  const top = getTopPlays(6);
  const most = top.length ? top[0] : null;
  const rest = top.slice(1, 5).map((x) => x.track);
  viewEl.innerHTML = `
    <div class="pf-grid">
      <div class="pf-card pf-stat">
        <div class="pf-num">${fmtListen(getListenMs())}</div>
        <div class="pf-sub">Tempo ouvindo música</div>
      </div>
      <div class="pf-card">
        ${most
          ? `<img class="pf-cover" src="${hqThumb(most.track.thumbnail)}" alt="" onerror="this.outerHTML='<div class=&quot;pf-cover pf-fallback&quot;>♪</div>'" />
             <div class="pf-meta">
               <div class="pf-num">${most.n}</div>
               <div class="pf-sub">toque${most.n > 1 ? "s" : ""}</div>
             </div>
             <div class="pf-info">
               <div class="pf-title" data-id="${most.track.videoId}">${escape(most.track.title)}</div>
               <div class="pf-sub">${escape(most.track.artist)}</div>
             </div>
             <button class="pf-play" id="btn-play-top" title="Tocar">▶</button>`
          : `<div class="pf-cover pf-fallback">♪</div>
             <div class="pf-info">
               <div class="pf-title">Nada ainda</div>
               <div class="pf-sub">Toque músicas para virar sua estatística</div>
             </div>`}
      </div>
    </div>
    <h2 class="section">Top músicas</h2>
    ${rest.length ? trackList(rest) : `<div class="empty">Ainda sem história — toque algo!</div>`}
    <div class="load-more-wrap">
      <button class="btn-ghost" id="btn-reset-stats">Zerar estatísticas</button>
    </div>`;
  state.currentViewData = top.map((x) => x.track);
  animateView();
  updatePlayingMark();
  $("#btn-reset-stats").addEventListener("click", (e) => {
    if (e.target.dataset.confirm) { resetStats(); goProfile(); return; }
    e.target.dataset.confirm = "1";
    e.target.textContent = "Confirmar: zerar tudo?";
    setTimeout(() => {
      const b = $("#btn-reset-stats");
      if (b) { b.dataset.confirm = ""; b.textContent = "Zerar estatísticas"; }
    }, 2600);
  });
  const pt = $("#btn-play-top");
  if (pt) pt.addEventListener("click", () => { if (state.currentViewData[0]) playWithMix(state.currentViewData[0]); });
}

export async function goAlbums() {
  currentTop = { fn: goAlbums, args: [] };
  beginView(null);
  setNav("albums");
  setHeader("Álbuns");
  const btn = `<div class="load-more-wrap"><button class="btn-ghost" id="btn-reload-alb">Recarregar recomendações</button></div>`;
  if (!state.collectionsCache) {
    viewEl.innerHTML = `<div class="status loading-dots">Buscando álbuns</div>`;
    animateView();
  }
  try {
    const rec = state.collectionsCache && state.collectionsCache.length
      ? { collections: state.collectionsCache, personalized: state.recsPersonalized }
      : await recommendedCollections();
    state.collectionsCache = rec.collections;
    state.recsPersonalized = rec.personalized;
    viewEl.innerHTML = cardsSection(
      state.recsPersonalized ? "Baseado no que você escuta" : "Álbuns e playlists pra você",
      state.collectionsCache) + btn;
  } catch (e) {
    viewEl.innerHTML = `<div class="status">Erro: ${escape(e.message)}</div>`;
  }
  state.currentViewData = [];
  animateView();
  $("#btn-reload-alb").addEventListener("click", () => {
    state.collectionsCache = null;
    goAlbums();
  });
}

export async function goFavorites() {
  currentTop = { fn: goFavorites, args: [] };
  beginView(null);
  setNav("favorites");
  setHeader("Favoritas");
  const data = loadFavorites();
  state.currentViewData = data;
  viewEl.innerHTML = trackList(data) +
    (data.length ? "" : `<div class="empty">Vazia — toque algo e aperte o ♥<br><span class="empty-sub">Salvas neste dispositivo, sem login.</span></div>`);
  animateView();
  updatePlayingMark();
}

/* ── Playlists locais ────────────────────────────────── */
let activePlaylistId = null;

export function goPlaylists() {
  currentTop = { fn: goPlaylists, args: [] };
  activePlaylistId = null;
  beginView(null);
  setNav("playlists");
  setHeader("Playlists");
  renderPlaylistsView();
  animateView();
}

function renderPlaylistsView() {
  const pls = getPlaylists();
  viewEl.innerHTML = `
    <div class="pl-head">
      <button class="btn-accent" id="btn-new-pl">
        <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor"><path d="M14 10H2v2h12v-2zm0-4H2v2h12V6zM2 16h8v-2H2v2zm14-4v4h-4v2h4v4h2v-4h4v-2h-4v-4h-2z"/></svg>
        Nova playlist
      </button>
      <span class="empty-sub" id="pl-count">${pls.length ? `${pls.length} playlist${pls.length > 1 ? "s" : ""} (locais)` : ""}</span>
    </div>
    ${pls.length
      ? cardsSection("", pls.map((p) => ({
          id: p.id, title: p.name, artist: `${p.tracks.length} faixa${p.tracks.length === 1 ? "" : "s"}`,
          type: "playlist", thumbnail: p.tracks[0]?.thumbnail || "", _local: true,
        })))
      : `<div class="empty">Nenhuma playlist — crie a primeira!</div>`}`;
  $("#btn-new-pl").addEventListener("click", async () => {
    const name = await openPlaylistModal({ mode: "create" });
    if (!name) return;
    const pl = createPlaylist(name);
    document.dispatchEvent(new Event("cmusic-playlists-changed"));
    toast(`“${name}” criada`);
    goPlaylist(pl.id);
  });
  updatePlayingMark();
}

export function goPlaylist(id) {
  beginView(true);
  setNav("playlists");
  setHeader("Playlist");
  const pl = getPlaylist(id);
  if (!pl) {
    viewEl.innerHTML = `<div class="status" id="pl-body">Playlist não encontrada</div>`;
    animateView();
    return;
  }
  renderPlaylistBody(id, pl);
}

function renderPlaylistBody(id, pl) {
  const fresh = getPlaylist(id) || pl;
  activePlaylistId = id;
  const rows = fresh.tracks.map((t) => `
    <li class="track" data-id="${t.videoId}">
      ${coverHTML(t)}
      <div class="track-meta">
        <div class="track-title">${escape(t.title)}</div>
        <div class="track-artist">${escape(t.artist)}${t.album ? " — " + escape(t.album) : ""}</div>
      </div>
      <button class="track-action rmpl" title="Remover da playlist">${X_ICON}</button>
      ${t.duration ? `<span class="track-dur">${t.duration}</span>` : ""}
    </li>`).join("");
  viewEl.innerHTML = `
    <div id="coll-head">
      ${fresh.tracks[0]
        ? `<img src="${fresh.tracks[0].thumbnail}" alt="" onerror="this.outerHTML='<div class=&quot;cover-fallback&quot; style=&quot;aspect-ratio:1&quot;>♪</div>'" />`
        : `<div class="cover-fallback" style="aspect-ratio:1">♪</div>`}
      <div id="coll-head-info">
        <div id="coll-sub">Playlist · local</div>
        <div id="coll-title">${escape(fresh.name)}</div>
        <div id="coll-sub">${fresh.tracks.length} faixa${fresh.tracks.length === 1 ? "" : "s"}</div>
        <div id="coll-actions">
          <button class="btn-accent" id="btn-play-pl" ${fresh.tracks.length ? "" : "disabled"}>
            <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
            Tocar
          </button>
          <button class="btn-ghost" id="btn-enq-pl" ${fresh.tracks.length ? "" : "disabled"}>
            <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor"><path d="M14 10H2v2h12v-2zm0-4H2v2h12V6zM2 16h8v-2H2v2zm14-4v4h-4v2h4v4h2v-4h4v-2h-4v-4h-2z"/></svg>
            Adicionar à fila
          </button>
          <button class="btn-ghost" id="btn-ren-pl">Renomear</button>
          <button class="btn-ghost danger" id="btn-del-pl">Excluir</button>
        </div>
      </div>
    </div>
    ${fresh.tracks.length ? `<ul class="track-list">${rows}</ul>` : `<div class="empty">Vazia — botão direito numa música ▸ Adicionar à playlist</div>`}
    <div id="pl-suggest"></div>`;
  state.currentViewData = fresh.tracks;
  animateView();
  updatePlayingMark();

  $("#btn-play-pl").onclick = () => { replaceQueue(fresh.tracks); playAt(0); };
  $("#btn-enq-pl").onclick = () => {
    fresh.tracks.forEach((tr) => enqueue(tr));
    toast(`${fresh.tracks.length} faixas na fila`);
  };
  $("#btn-ren-pl").onclick = async () => {
    const name = await openPlaylistModal({ mode: "rename", value: fresh.name });
    if (!name || name === fresh.name) return;
    renamePlaylist(id, name);
    document.dispatchEvent(new Event("cmusic-playlists-changed"));
    toast("Renomeada");
  };
  $("#btn-del-pl").onclick = async () => {
    const ok = await openConfirmModal({
      title: "Excluir playlist",
      subtitle: "Esta ação é permanente",
      message: `A playlist “${escape(fresh.name)}” e suas ${fresh.tracks.length} faixa${fresh.tracks.length === 1 ? "" : "s"} serão removidas. Suas músicas preferidas e o histórico não são afetados.`,
      okLabel: "Excluir",
      danger: true,
    });
    if (!ok) return;
    deletePlaylist(id);
    document.dispatchEvent(new Event("cmusic-playlists-changed"));
    goPlaylists();
  };

  /* sugestões "Pra colocar na playlist" (mesma pegada dos similares) */
  if (state.plSuggest?.plId === id) renderSuggestions();
  else initPlaylistSuggestions(id, fresh);
}

/* ── Pra colocar na playlist: similares com base na playlist/perfil ── */
function playlistVisible(id) {
  return activePlaylistId === id && !!$("#pl-suggest");
}

async function initPlaylistSuggestions(id, pl) {
  const seed = pl.tracks[0]?.videoId || state.lastPlayed;
  const box = $("#pl-suggest");
  if (!box || !seed) return;
  box.innerHTML = `<h2 class="section">Pra colocar na playlist</h2>
    <div class="status loading-dots">Buscando sugestões</div>`;
  try {
    const items = (await related(seed, 20)) || [];
    if (!playlistVisible(id)) return;
    state.plSuggest = { plId: id, items, limit: 12, seed };
    renderSuggestions();
  } catch (e) {
    if (playlistVisible(id)) box.innerHTML = "";
  }
}

function renderSuggestions() {
  const s = state.plSuggest;
  const box = $("#pl-suggest");
  if (!box || !s) return;
  const pl = getPlaylist(activePlaylistId);
  const fresh = (s.items || []).filter((x) =>
    x?.videoId && !pl?.tracks.some((t) => t.videoId === x.videoId));
  if (!fresh.length) { box.innerHTML = ""; return; }
  const shown = fresh.slice(0, s.limit);
  box.innerHTML = `
    <h2 class="section">Pra colocar na playlist</h2>
    <ul class="track-list">${trackHTMLSuggestion(shown)}</ul>
    ${fresh.length > s.limit ? loadMoreHTML("plsuggest") : ""}`;
  updatePlayingMark();
}

/* fileira de sugestão: mesmo template das tracks, clicando em + entra na playlist */
function trackHTMLSuggestion(list) {
  return list.map((t) => `
    <li class="track sg-track" data-id="${t.videoId}">
      ${coverHTML(t)}
      <div class="track-meta">
        <div class="track-title">${escape(t.title)}</div>
        <div class="track-artist">${escape(t.artist)}${t.album ? " — " + escape(t.album) : ""}</div>
      </div>
      <button class="track-action add" title="Adicionar à playlist">${ADD_ICON}</button>
      ${t.duration ? `<span class="track-dur">${t.duration}</span>` : ""}
    </li>`).join("");
}

function loadMoreSuggestions(btn) {
  const s = state.plSuggest;
  if (!s) return;
  s.limit += 8;
  renderSuggestions();
}

document.addEventListener("cmusic-playlists-changed", () => {
  if (currentTop.fn === goPlaylists) renderPlaylistsView();
  if (currentTop.fn === goPlaylist && currentTop.args[0]) {
    const pl = getPlaylist(currentTop.args[0]);
    if (!pl) goPlaylists();
    else renderPlaylistBody(pl.id, pl);
  }
});

export async function goSearch(q) {
  currentTop = { fn: goSearch, args: [q] };
  beginView(null);
  setNav("");
  setHeader(`Resultados — “${q}”`);
  viewEl.innerHTML = `<div class="status loading-dots">Buscando “${escape(q)}”</div>`;
  animateView();
  state.searchQ = q;
  state.searchTab = "songs";
  state.searchLimits = { songs: 20, albums: 10 };
  state.searchExhausted = {};
  try {
    const data = await search(q, state.searchLimits);
    state.searchCache = data;
    renderSearchTab();
  } catch (e) {
    viewEl.innerHTML = `<div class="status">Erro na busca: ${escape(e.message)}</div>`;
  }
}

function renderSearchTab() {
  const d = state.searchCache || { songs: [], albums: [] };
  const tab = state.searchTab;
  const exhausted = state.searchExhausted || {};
  let body = "";
  let more = false;
  if (tab === "albums") {
    more = d.albums.length >= state.searchLimits.albums && !exhausted.albums;
    body = d.albums.length ? cardsSection("", d.albums) : `<div class="empty">Nenhum álbum</div>`;
  } else {
    more = d.songs.length >= state.searchLimits.songs && !exhausted.songs;
    body = d.songs.length ? trackList(d.songs) : `<div class="empty">Nenhuma música</div>`;
  }
  if (more) body += loadMoreHTML("search");
  viewEl.innerHTML = searchTabsHTML(state.searchTab) + `<div class="stab-body">${body}</div>`;
  state.currentViewData = state.searchTab === "songs" ? d.songs : [];
  animateView();
  updatePlayingMark();
}

async function loadMoreSearch(btn) {
  const tab = state.searchTab;
  const step = tab === "songs" ? 20 : 10;
  const prev = (state.searchCache?.[tab] || []).length;
  state.searchLimits[tab] += step;
  setMoreBusy(btn);
  try {
    const fresh = await search(state.searchQ, state.searchLimits);
    const len = (fresh?.[tab] || []).length;
    if (len <= prev) {
      state.searchLimits[tab] -= step;
      state.searchExhausted[tab] = true;
      toast("Chegou ao fim dos resultados");
    } else {
      state.searchCache = fresh;
    }
    renderSearchTab();
  } catch (e) {
    setMoreBusy(btn, false);
    toast(`Erro ao carregar mais: ${e.message}`);
  }
}

export async function goCollection(id) {
  beginView(true);
  setNav("");
  setHeader("Coleção");
  activePlaylistId = null;
  viewEl.innerHTML = `<div class="status loading-dots">Abrindo</div>`;
  animateView();
  try {
    const c = await album(id);
    const cover = hqThumb(c.thumbnail)
      ? `<img src="${hqThumb(c.thumbnail)}" alt="" />`
      : `<div class="cover-fallback" style="aspect-ratio:1">♪</div>`;
    viewEl.innerHTML = `
      <div id="coll-head">
        ${cover}
        <div id="coll-head-info">
          <div id="coll-sub">${c.type === "album" ? "Álbum" : "Playlist"}${c.year ? " · " + escape(c.year) : ""}</div>
          <div id="coll-title">${escape(c.title)}</div>
          <div id="coll-sub">${escape(c.artist)}</div>
          <div id="coll-actions">
            <button class="btn-accent" id="btn-play-coll">
              <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
              Tocar
            </button>
            <button class="btn-ghost" id="btn-enq-coll">
              <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor"><path d="M14 10H2v2h12v-2zm0-4H2v2h12V6zM2 16h8v-2H2v2zm14-4v4h-4v2h4v4h2v-4h4v-2h-4v-4h-2z"/></svg>
              Adicionar à fila
            </button>
          </div>
        </div>
      </div>
      ${trackList(c.tracks)}`;
    state.currentViewData = c.tracks;
    animateView();
    updatePlayingMark();
    $("#btn-play-coll").onclick = () => { replaceQueue(c.tracks); playAt(0); };
    $("#btn-enq-coll").onclick = () => {
      c.tracks.forEach((tr) => enqueue(tr));
      toast(`${c.tracks.length} faixas na fila`);
    };
  } catch (e) {
    viewEl.innerHTML = `<div class="status">Erro: ${escape(e.message)}</div>`;
  }
}

/* ── Delegação global de cliques da view ────────────── */
viewEl.addEventListener("click", (e) => {
  const lm = e.target.closest(".load-more");
  if (lm) {
    if (lm.dataset.kind === "related") loadMoreRelated(lm);
    else if (lm.dataset.kind === "plsuggest") loadMoreSuggestions(lm);
    else loadMoreSearch(lm);
    return;
  }
  const carBtn = e.target.closest(".car-nav button");
  if (carBtn) {
    const wrap = carBtn.closest(".carousel-wrap");
    const car = wrap.querySelector(".carousel");
    car.scrollBy({ left: car.clientWidth * (carBtn.textContent.trim() === "‹" ? -1 : 1) });
    return;
  }
  const stabs = e.target.closest(".stab");
  if (stabs) {
    state.searchTab = stabs.dataset.tab;
    document.querySelectorAll(".stab").forEach((el) =>
      el.classList.toggle("on", el.dataset.tab === state.searchTab));
    renderSearchTab();
    return;
  }
  const heart = e.target.closest(".fav-heart");
  if (heart) {
    const container = heart.closest("[data-id]");
    if (container) toggleFav(null, container.dataset.id);
    return;
  }
  const sc = e.target.closest(".song-card");
  if (sc) {
    const tr = state.currentViewData.find((x) => x.videoId === sc.dataset.id);
    if (tr) playWithMix(tr);
    return;
  }
  const track = e.target.closest(".track");
  if (track) {
    if (e.target.closest(".rmpl")) {
      const pl = getPlaylist(currentTop.fn === goPlaylist ? currentTop.args[0] : null)
        || getPlaylist(activePlaylistId);
      if (pl) {
        removeFromPlaylist(pl.id, track.dataset.id);
        const fresh = getPlaylist(pl.id);
        if (fresh) {
          if (!fresh.tracks.length) goPlaylist(pl.id);
          else renderPlaylistBody(pl.id, fresh);
        }
        toast("Removida da playlist");
      }
      return;
    }
    const tr = lineToTrack(track);
    if (e.target.closest(".add")) {
      /* dentro de "Pra colocar na playlist": + entra na playlist */
      if (track.closest("#pl-suggest") && activePlaylistId) {
        const sg = (state.plSuggest?.items || []).find((x) => x.videoId === tr.videoId) || tr;
        const ok = addToPlaylist(activePlaylistId, sg);
        if (!ok) { toast("Já está na playlist"); return; }
        document.dispatchEvent(new Event("cmusic-playlists-changed"));
        toast(`“${sg.title}” na playlist`);
        const pl = getPlaylist(activePlaylistId);
        if (pl) renderPlaylistBody(pl.id, pl); // reusa as sugestões já buscadas
        return;
      }
      playOrEnqueue(tr, true);
      return;
    }
    playWithMix(tr);
    return;
  }
  const card = e.target.closest(".card");
  if (card) {
    if (card.dataset.id?.startsWith("pl_") || card.dataset.id?.startsWith("playlist_")) {
      goPlaylist(card.dataset.id);
    } else goCollection(card.dataset.id);
  }
});
