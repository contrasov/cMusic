/* cMusic — menu de contexto (botão direito): faixas e cards de coleção */
import { state } from "./state.js";
import { toast, escape } from "./utils.js";
import { album } from "./api.js";
import { enqueue, renderQueue } from "./queue.js";
import { playAt } from "./island.js";
import { playOrEnqueue } from "./player.js";
import { lineToTrack } from "./components/templates.js";
import {
  isFaved, toggleFav,
  getPlaylists, getPlaylist, addToPlaylist, createPlaylist,
} from "./store.js";
import { openPlaylistModal } from "./modal.js";

let menuEl = null;

function ensureMenu() {
  if (menuEl) return menuEl;
  menuEl = document.createElement("div");
  menuEl.id = "ctx-menu";
  menuEl.classList.add("hidden");
  document.body.appendChild(menuEl);
  document.addEventListener("click", (e) => { if (!menuEl.contains(e.target)) close(); }, true);
  document.addEventListener("contextmenu", (e) => { if (!menuEl.contains(e.target)) close(); }, true);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") close(); });
  window.addEventListener("blur", close);
  return menuEl;
}

export function close() {
  if (menuEl) menuEl.classList.add("hidden");
}

function show(x, y, html, ctx) {
  const menu = ensureMenu();
  menu.innerHTML = html;
  menu.classList.remove("hidden");
  const r = menu.getBoundingClientRect();
  const fit = (v, size, max) => Math.max(8, Math.min(v, max - size - 8));
  menu.style.left = `${fit(x, r.width, window.innerWidth)}px`;
  menu.style.top = `${fit(y, r.height, window.innerHeight)}px`;
  menu.onclick = (e) => menuClick(e, { x, y, ...ctx });
}

function itemHTML(id, label, opts = {}) {
  return `<div class="ctx-item ${opts.cls || ""}" data-ctx="${id}" data-arg="${opts.arg ?? ""}">${label}</div>`;
}

/* ── alvo: track (fila, lista, card de música) ───────── */
function trackAt(el) {
  const queueLi = el.closest("#queue-list .track");
  if (queueLi && queueLi.dataset.i != null) {
    return { track: state.queue[+queueLi.dataset.i] };
  }
  const container = el.closest("[data-id]");
  const vid = container?.dataset.id;
  if (!vid) return null;
  const known = state.currentViewData.find((x) => x && x.videoId === vid);
  if (known) return { track: known };
  const row = el.closest(".track");
  if (row && row.querySelector(".track-title")) {
    const t = lineToTrack(row);
    t.videoId = vid;
    return { track: t };
  }
  return null;
}

function trackMenuHTML(t) {
  const faved = isFaved(t.videoId);
  const currentInQueue =
    state.queue[state.current] && state.queue[state.current].videoId === t.videoId;
  return (
    itemHTML("now", "Tocar agora") +
    (currentInQueue ? "" : itemHTML("next", "Tocar a seguir")) +
    (currentInQueue ? "" : itemHTML("end", "Adicionar ao final da fila")) +
    itemHTML("fav", faved ? "Remover dos favoritos" : "Favoritar") +
    itemHTML("pl", 'Adicionar à playlist <span class="ctx-arrow">▸</span>', { cls: "has-sub" })
  );
}

function playlistSubHTML(t) {
  const pls = getPlaylists();
  return (
    itemHTML("back", "‹ Voltar") +
    pls.map((p) =>
      itemHTML("add-to-pl", escape(p.name), {
        arg: p.id,
        cls: p.tracks.some((x) => x.videoId === t.videoId) ? "ctx-done" : "",
      })).join("") +
    itemHTML("new-pl", `
      <span class="ctx-ic"><svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor"><path d="M14 10H2v2h12v-2zm0-4H2v2h12V6zM2 16h8v-2H2v2zm14-4v4h-4v2h4v4h2v-4h4v-2h-4v-4h-2z"/></svg></span>
      Nova playlist…`, { cls: "ctx-accent" })
  );
}

/* ── inserir na fila: "a seguir" (após a atual) ou fim ─ */
function insertInQueue(tracks, where) {
  const cur = Math.max(state.current, -1);
  if (where === "next") state.queue.splice(cur + 1, 0, ...tracks);
  else { state.queue.push(...tracks); }
  renderQueue();
}

/* ── submenu de playlists ────────────────────────────── */
function createAndAddToPlaylist(name, tracks) {
  const pl = createPlaylist(name);
  tracks.forEach((t) => addToPlaylist(pl.id, t));
  document.dispatchEvent(new Event("cmusic-playlists-changed"));
  toast(`“${name}” criada — ${tracks.length} faixa${tracks.length > 1 ? "s" : ""}`);
}

/* ── coleções (cards): injeta todas as faixas na fila ── */
async function injectCollection(collId, where) {
  toast("Carregando coleção…");
  try {
    const c = await album(collId);
    if (!c.tracks?.length) { toast("Coleção vazia"); return; }
    if (where === "now") {
      state.queue = [...c.tracks];
      state.current = -1;
      renderQueue();
      playAt(0);
      return;
    }
    insertInQueue(c.tracks, where);
    toast(`“${c.title}” ${where === "next" ? "a seguir" : "no fim da fila"} — ${c.tracks.length} faixas`);
  } catch (e) {
    toast(`Erro: ${e.message}`);
  }
}

/* ── delegação interna do menu ───────────────────────── */
function menuClick(e, ctx) {
  const item = e.target.closest(".ctx-item");
  if (!item) return;
  const id = item.dataset.ctx;
  const arg = item.dataset.arg;
  const { x, y } = ctx;

  if (ctx.type === "track") {
    const t = ctx.track;
    switch (id) {
      case "back": show(x, y, trackMenuHTML(t), { type: "track", track: t }); return;
      case "pl": show(x, y, playlistSubHTML(t), { type: "track", track: t }); return;
      case "new-pl":
        close();
        openPlaylistModal({ mode: "create" }).then((name) => {
          if (name) createAndAddToPlaylist(name, [t]);
        });
        return;
      case "add-to-pl": {
        close();
        const ok = addToPlaylist(arg, t);
        toast(ok ? "Adicionada à playlist" : "Já está na playlist");
        document.dispatchEvent(new Event("cmusic-playlists-changed"));
        return;
      }
      case "now": close(); playOrEnqueue(t); return;
      case "next":
        close();
        insertInQueue([t], "next");
        toast(`“${t.title}” a seguir`);
        return;
      case "end": close(); enqueue(t); return;
      case "fav": close(); toggleFav(t); return;
    }
  }

  if (ctx.type === "local-playlist") {
    close();
    if (id === "coll-open") {
      document.querySelector(`.card[data-id="${ctx.collId}"]`)?.click();
    } else if (!ctx.tracks.length) {
      toast("Playlist vazia");
    } else if (id === "locpl-now") {
      state.queue = [...ctx.tracks];
      state.current = -1;
      renderQueue();
      playAt(0);
    } else if (id === "locpl-next") {
      insertInQueue(ctx.tracks, "next");
      toast(`Tocando ${ctx.tracks.length} faixa(s) a seguir`);
    } else if (id === "locpl-end") {
      insertInQueue(ctx.tracks, "end");
      toast(`${ctx.tracks.length} faixa(s) no fim da fila`);
    }
    return;
  }

  if (ctx.type === "collection") {
    close();
    if (id === "coll-open") {
      document.querySelector(`.card[data-id="${ctx.collId}"]`)?.click();
    } else if (id === "coll-now") {
      injectCollection(ctx.collId, "now");
    } else if (id === "coll-next") {
      injectCollection(ctx.collId, "next");
    } else if (id === "coll-end") {
      injectCollection(ctx.collId, "end");
    }
  }
}

function collectionMenuHTML() {
  return (
    itemHTML("coll-open", "Abrir") +
    itemHTML("coll-now", "Tocar do início") +
    itemHTML("coll-next", "Tocar a seguir") +
    itemHTML("coll-end", "Adicionar ao final da fila")
  );
}

/* playlists locais (ids pl_*): usa as faixas salvas, sem API */
function localPlaylistMenuHTML(pl) {
  return (
    itemHTML("coll-open", "Abrir") +
    (pl.tracks?.length
      ? itemHTML("locpl-now", "Tocar do início") +
        itemHTML("locpl-next", "Tocar a seguir") +
        itemHTML("locpl-end", "Adicionar ao final da fila")
      : "")
  );
}

/* ── API pública p/ uso em views (ex.: abrir via botão) ─ */
export function openTrackMenu(t, x, y) {
  show(x, y, trackMenuHTML(t), { type: "track", track: t });
}

/* ── listener global de botão direito ────────────────── */
document.addEventListener("contextmenu", (e) => {
  const cardEl = e.target.closest(".card");
  const trackEl = e.target.closest(".track, .song-card");
  if (!cardEl && !trackEl) return;
  e.preventDefault();
  if (cardEl && !trackEl) {
    const collId = cardEl.dataset.id;
    if (collId?.startsWith("pl_") || collId?.startsWith("playlist_")) {
      const pl = currentTopPlaylist(collId);
      show(e.clientX, e.clientY, localPlaylistMenuHTML(pl), {
        type: "local-playlist", collId, tracks: pl?.tracks || [],
      });
      return;
    }
    show(e.clientX, e.clientY, collectionMenuHTML(), {
      type: "collection",
      collId,
    });
    return;
  }
  const found = trackAt(e.target);
  if (found) openTrackMenu(found.track, e.clientX, e.clientY);
});

function currentTopPlaylist(plId) {
  return getPlaylist(plId) ||
         (getPlaylists().find((p) => p.id === plId) ?? null);
}
