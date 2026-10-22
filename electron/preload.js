/* cMusic — preload: RPC mínimo renderer <-> main (MPRIS) */
const { contextBridge, ipcRenderer } = require("electron");

window.cmusicRPC = contextBridge.exposeInMainWorld("cmusicRPC", {
  /* estado do player (main alimenta o MPRIS) */
  sendPlayerState: (s) => ipcRenderer.send("player-state", s),
  sendPosition: (ms) => ipcRenderer.send("player-position", ms),
  /* comandos vindos do KDE (teclas de mídia, widget Plasma) */
  onCommand: (cb) => ipcRenderer.on("mpris", (_e, cmd) => cb(cmd)),
});
