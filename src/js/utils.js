/* cMusic — utilidades compartilhadas */
export const $ = (sel) => document.querySelector(sel);

export function fmtTime(sec) {
  sec = Math.max(0, Math.floor(sec || 0));
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
}

/* tempo de escuta acumulado (ms) → "1 h 20 min" */
export function fmtListen(ms) {
  const min = Math.max(0, Math.floor(ms / 60000));
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)} h ${min % 60} min`;
}

let toastTimer = null;

export function toast(msg) {
  const el = $("#toast");
  el.textContent = msg;
  el.classList.remove("hidden");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.add("hidden"), 2600);
}

export function escape(s) {
  const d = document.createElement("div");
  d.textContent = s || "";
  return d.innerHTML;
}

export function paintRange(el) {
  el.classList.add("visible-range");
  const pct = ((+el.value - +el.min) / (+el.max - +el.min)) * 100;
  el.style.background =
    `linear-gradient(90deg, var(--accent) 0%, var(--accent) ${pct}%, #3d3d3d ${pct}%, #3d3d3d 100%)`;
}

export async function jsonGet(url) {
  const res = await fetch(url);
  if (!res.ok) {
    let msg = `erro HTTP ${res.status}`;
    try {
      const d = await res.json();
      if (d && typeof d.detail === "string") msg = d.detail;
    } catch (e) { /* sem corpo */ }
    throw new Error(msg);
  }
  return res.json();
}
