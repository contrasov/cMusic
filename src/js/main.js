/* cMusic — boot, sidebar, busca e atalhos */
import { $ } from "./utils.js";
import { state } from "./state.js";
import { goHome, goRelated, goAlbums, goFavorites, goSearch, goProfile, goPlaylists } from "./views.js";
import { playNext, playPrev, togglePlayPause } from "./island.js";
import "./contextmenu.js";
import "./npview.js";

const appEl = $("#app");
const searchForm = $("#search-form");
const searchInput = $("#search-input");
const volumebar = $("#volumebar");
const islandEl = $("#island");
const btnFav = $("#btn-fav");
const railEl = $("#rail-toggle");

/* ── Navegação ──────────────────────────────────────── */
document.querySelectorAll(".nav-item").forEach((el) =>
  el.addEventListener("click", () => ({
    home: goHome, related: goRelated, albums: goAlbums,
    playlists: goPlaylists, favorites: goFavorites, profile: goProfile,
  })[el.dataset.view]())
);

/* ── Sidebar: aberta (labels) / fechada (ícones) ────── */
function updateRailToggle() {
  const open = appEl.classList.contains("rail-open");
  railEl.classList.toggle("open", open);
  railEl.title = open ? "Recolher sidebar" : "Expandir sidebar";
  railEl.querySelector("path").setAttribute("d",
    open ? "M4 7h16M4 12h16M11 17h9" : "M4 7h16M4 12h16M4 17h10");
}

const railOpenVal = localStorage.getItem("cmusic_rail") === "open";
appEl.classList.toggle("rail-open", railOpenVal);
updateRailToggle();

railEl.addEventListener("click", () => {
  const open = appEl.classList.toggle("rail-open");
  localStorage.setItem("cmusic_rail", open ? "open" : "closed");
  updateRailToggle();
});

/* ── Busca: input full ao focar, colapsa ao clicar fora / Esc ── */
searchForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const q = searchInput.value.trim();
  if (q) {
    searchForm.classList.remove("search-pop"); void searchForm.offsetWidth;
    searchForm.classList.add("search-pop");
    goSearch(q);
  }
});

searchInput.addEventListener("focus", () => searchForm.classList.add("full"));
searchInput.addEventListener("blur", () => searchForm.classList.remove("full"));
searchInput.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    e.target.blur();
    e.target.value = "";
    searchForm.classList.remove("full");
  }
});

/* ── Atalhos ────────────────────────────────────────── */
document.addEventListener("keydown", (e) => {
  if (e.target.tagName === "INPUT") {
    if (e.key === "Escape") e.target.blur();
    return;
  }
  if (e.code === "Space") { e.preventDefault(); togglePlayPause(); }
  const audio = $("audio");
  if (e.key === "ArrowRight" && audio.duration) audio.currentTime += 5;
  if (e.key === "ArrowLeft" && audio.duration) audio.currentTime -= 5;
  if (e.key === "ArrowUp") volumebar.value = Math.min(100, +volumebar.value + 5), volumebar.dispatchEvent(new Event("input"));
  if (e.key === "ArrowDown") volumebar.value = Math.max(0, +volumebar.value - 5), volumebar.dispatchEvent(new Event("input"));
  if (e.ctrlKey && e.key === "f") { e.preventDefault(); searchInput.focus(); searchInput.select(); }
  if (e.key === "n") playNext();
  if (e.key === "p") playPrev();
});

/* ── Rodapé da sidebar: versão (IPC do Electron) ────── */
const versionEl = $("#rail-version");
const rpc = window.cmusicRPC || null;
if (rpc && versionEl) {
  rpc.onVersion?.((v) => { if (v) versionEl.textContent = `v${v}`; });
} else if (versionEl) {
  versionEl.style.opacity = "0.5";
  versionEl.textContent = "web";
}

/* ── Boot ───────────────────────────────────────────── */
goHome();
