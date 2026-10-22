/* cMusic — views (router de conteúdo) */
import { state } from "./state.js";
import { $, escape, toast } from "./utils.js";
import {
  search, exploreHome, related, album,
} from "./api.js";
import {
  carousel, cardsSection, trackList, searchTabsHTML, lineToTrack,
} from "./components/templates.js";
import { getHistory, loadFavorites, toggleFav } from "./store.js";
import { enqueue, replaceQueue } from "./queue.js";
import { playAt, updatePlayingMark } from "./island.js";
import { playWithMix, playOrEnqueue } from "./player.js";

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
  if (!state.lastPlayed) {
    viewEl.innerHTML = `<div class="status">Toque uma música primeiro — as similares aparecem aqui.</div>`;
    animateView();
    return;
  }
  viewEl.innerHTML = `<div class="status loading-dots">Buscando similares</div>`;
  animateView();
  try {
    const data = await related(state.lastPlayed);
    viewEl.innerHTML = trackList(data);
    state.currentViewData = data;
    animateView();
    updatePlayingMark();
  } catch (e) {
    viewEl.innerHTML = `<div class="status">Erro: ${escape(e.message)}</div>`;
  }
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
  try {
    const data = await search(q);
    state.searchCache = data;
    renderSearchTab();
  } catch (e) {
    viewEl.innerHTML = `<div class="status">Erro na busca: ${escape(e.message)}</div>`;
  }
}

function renderSearchTab() {
  const d = state.searchCache || { songs: [], albums: [] };
  let body = "";
  if (state.searchTab === "albums") {
    if (!d.albums.length) body = `<div class="empty">Nenhum álbum</div>`;
    else body = cardsSection("", d.albums);
  } else {
    body = d.songs.length ? trackList(d.songs) : `<div class="empty">Nenhuma música</div>`;
  }
  viewEl.innerHTML = searchTabsHTML(state.searchTab) + `<div class="stab-body">${body}</div>`;
  state.currentViewData = state.searchTab === "songs" ? d.songs : [];
  animateView();
  updatePlayingMark();
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
