/* cMusic — templates de UI (render puro) */
import { escape, hqThumb } from "../utils.js";
import { isFaved } from "../store.js";

export const HEART_ICON = `<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54z"/></svg>`;
export const ADD_ICON = `<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M14 10H2v2h12v-2zm0-4H2v2h12V6zM2 16h8v-2H2v2zm14-4v4h-4v2h4v4h2v-4h4v-2h-4v-4h-2z"/></svg>`;
export const X_ICON = `<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>`;

export function coverHTML(t, cls = "") {
  const url = hqThumb(t.thumbnail);
  if (url) {
    return `<img class="${cls}" src="${url}" alt="" loading="lazy" onerror="this.outerHTML='<div class=&quot;cover-fallback ${cls}&quot;>♪</div>'" />`;
  }
  return `<div class="cover-fallback ${cls}">♪</div>`;
}

export function trackHTML(t, inQueue, i) {
  const faved = isFaved(t.videoId);
  return `
    <li class="track" data-id="${t.videoId}" ${inQueue ? `data-i="${i}"` : ""}>
      ${coverHTML(t)}
      <div class="track-meta">
        <div class="track-title">${escape(t.title)}</div>
        <div class="track-artist">${escape(t.artist)}${t.album ? " — " + escape(t.album) : ""}</div>
      </div>
      ${inQueue
        ? `<button class="track-action rm" title="Remover da fila">${X_ICON}</button>`
        : `<button class="track-action fav-heart ${faved ? "faved" : ""}" title="Favoritar">${HEART_ICON}</button>
           <button class="track-action add" title="Adicionar à fila">${ADD_ICON}</button>`}
      ${t.duration ? `<span class="track-dur">${t.duration}</span>` : ""}
    </li>`;
}

export function songCardHTML(t, i) {
  const faved = isFaved(t.videoId);
  return `
    <div class="song-card" data-id="${t.videoId}" data-i="${i}">
      <div class="sc-cover">
        ${coverHTML(t)}
        <div class="sc-play">▶</div>
      </div>
      <div class="sc-meta">
        <div class="sc-title">${escape(t.title)}</div>
        <div class="sc-artist">${escape(t.artist)}</div>
      </div>
      <button class="heart-btn fav-heart ${faved ? "faved" : ""}" title="Favoritar">${HEART_ICON}</button>
    </div>`;
}

export function cardHTML(c) {
  const type = c.type === "album" ? "Álbum" : "Playlist";
  const art = hqThumb(c.thumbnail)
    ? `<img src="${hqThumb(c.thumbnail)}" alt="" loading="lazy" />`
    : `<div class="cover-fallback">♪</div>`;
  return `
    <div class="card" data-id="${c.id}">
      <div class="card-art">
        <div class="vinyl-disc"><span></span></div>
        ${art}
      </div>
      <div class="card-title">${escape(c.title)}</div>
      <div class="card-sub">${type} · ${escape(c.artist)}</div>
    </div>`;
}

export function chunk(arr, n) {
  const out = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

/* carrossel 4×2: colunas com 2 cards empilhados + setas */
export function carousel(title, tracks) {
  if (!tracks || !tracks.length) return "";
  return `
    <div class="carousel-wrap">
      <div class="carousel-head">
        <h2>${escape(title)}</h2>
        <div class="car-nav">
          <button title="Anteriores">‹</button>
          <button title="Próximas">›</button>
        </div>
      </div>
      <div class="carousel">
        ${chunk(tracks, 2).map((pair) =>
          `<div class="car-col">${pair.map(songCardHTML).join("")}</div>`).join("")}
      </div>
    </div>`;
}

export function cardsSection(title, collections) {
  if (!collections || !collections.length) return "";
  return `<h2 class="section">${escape(title)}</h2>
    <div class="card-grid">${collections.map(cardHTML).join("")}</div>`;
}

export function trackList(tracks) {
  if (!tracks || !tracks.length) return `<div class="empty">Vazio</div>`;
  return `<ul class="track-list">${tracks.map((t) => trackHTML(t, false)).join("")}</ul>`;
}

export function searchTabsHTML(searchTab) {
  const tab = (id, label) =>
    `<button class="stab ${searchTab === id ? "on" : ""}" data-tab="${id}">${label}</button>`;
  return `
    <div class="stabs">
      ${tab("songs", "Músicas")}
      ${tab("albums", "Álbuns")}
    </div>`;
}

/* extrai track de um elemento da lista */
export function lineToTrack(el) {
  return {
    videoId: el.dataset.id,
    title: el.querySelector(".track-title").textContent,
    artist: el.querySelector(".track-artist").textContent,
    thumbnail: el.querySelector("img") ? el.querySelector("img").src
             : el.querySelector(".cover-fallback") ? "" : "",
  };
}
