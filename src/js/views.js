/* cMusic — views (router de conteúdo) */
import { state } from "./state.js";
import { $, escape, toast, fmtListen } from "./utils.js";
import {
  search, exploreHome, related, album,
} from "./api.js";
import {
  carousel, cardsSection, trackList, searchTabsHTML, lineToTrack,
} from "./components/templates.js";
import { getHistory, loadFavorites, toggleFav, getTopPlays, getListenMs, resetStats } from "./store.js";
import { enqueue, replaceQueue } from "./queue.js";
import { playAt, updatePlayingMark } from "./island.js";
import { playWithMix, playOrEnqueue } from "./player.js";

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

/* ── Views ──────────────────────────────────────────── */
export async function goHome() {
  currentTop = { fn: goHome, args: [] };
  beginView(null);
  setNav("home");
  setHeader("Início");
  viewEl.innerHTML = `<div class="status">Preparando seu cMusic...</div>`;
  try {
    const data = await exploreHome();
    state.collectionsCache = data.collections;
    const hist = getHistory().slice(0, 10);
    viewEl.innerHTML =
      carousel("Recentes", hist) +
      carousel("Para você", data.songs.slice(0, 12)) +
      cardsSection("Álbuns recomendados", data.collections);
    state.currentViewData = [...hist, ...data.songs];
    animateView();
    updatePlayingMark();
  } catch (e) {
    viewEl.innerHTML = `<div class="status">Erro: ${escape(e.message)}</div>`;
  }
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
          ? `<img class="pf-cover" src="${most.track.thumbnail}" alt="" onerror="this.outerHTML='<div class=&quot;pf-cover pf-fallback&quot;>♪</div>'" />
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
  if (!state.collectionsCache) {
    viewEl.innerHTML = `<div class="status loading-dots">Buscando álbuns</div>`;
    animateView();
    try {
      const data = await exploreHome();
      state.collectionsCache = data.collections;
    } catch (e) {
      viewEl.innerHTML = `<div class="status">Erro: ${escape(e.message)}</div>`;
      return;
    }
  }
  viewEl.innerHTML = cardsSection("Álbuns e playlists pra você", state.collectionsCache);
  state.currentViewData = [];
  animateView();
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

export async function goSearch(q) {
  currentTop = { fn: goSearch, args: [q] };
  beginView(null);
  setNav("");
  setHeader(`Resultados — “${q}”`);
  viewEl.innerHTML = `<div class="status loading-dots">Buscando “${escape(q)}”</div>`;
  animateView();
  state.searchQ = q;
  state.searchLimits = { songs: 20, albums: 10, playlists: 10 };
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
  const d = state.searchCache || { songs: [], albums: [], playlists: [] };
  const tab = state.searchTab;
  const exhausted = state.searchExhausted || {};
  let body = "";
  let more = false;
  if (tab === "albums") {
    more = d.albums.length >= state.searchLimits.albums && !exhausted.albums;
    body = d.albums.length ? cardsSection("", d.albums) : `<div class="empty">Nenhum álbum</div>`;
  } else if (tab === "playlists") {
    more = d.playlists.length >= state.searchLimits.playlists && !exhausted.playlists;
    body = d.playlists.length ? cardsSection("", d.playlists) : `<div class="empty">Nenhuma playlist</div>`;
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
  viewEl.innerHTML = `<div class="status loading-dots">Abrindo</div>`;
  animateView();
  try {
    const c = await album(id);
    const cover = c.thumbnail
      ? `<img src="${c.thumbnail}" alt="" />`
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
    const tr = lineToTrack(track);
    if (e.target.closest(".add")) { playOrEnqueue(tr, true); return; }
    playWithMix(tr);
    return;
  }
  const card = e.target.closest(".card");
  if (card) goCollection(card.dataset.id);
});
