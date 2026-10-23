/* cMusic — Electron: sobe o backend Python e a janela principal */
const { app, BrowserWindow, shell, dialog, ipcMain } = require("electron");
const { spawn } = require("child_process");
const path = require("path");
const http = require("http");
const fs = require("fs");

const Mpris = require("mpris-service");

const PORT = 8377;
const BASE = `http://127.0.0.1:${PORT}`;
const ROOT = path.join(__dirname, "..");

let backend = null;
let win = null;
let mpris = null;
let lastState = { title: "Nada tocando", artist: "cMusic", playing: false, durationMs: 0, artUrl: "" };

function pythonBin() {
  const venv = path.join(ROOT, ".venv", "bin", "python");
  return fs.existsSync(venv) ? venv : "python3";
}

function startBackend() {
  backend = spawn(pythonBin(), [path.join(ROOT, "backend", "server.py")], {
    cwd: ROOT,
    env: { ...process.env, YTMUSIC_PORT: String(PORT) },
    stdio: ["ignore", "pipe", "pipe"],
  });
  const tag = "[backend]";
  backend.stdout.on("data", (d) => process.stdout.write(`${tag} ${d}`));
  backend.stderr.on("data", (d) => process.stderr.write(`${tag} ${d}`));
  backend.on("error", (err) =>
    dialog.showErrorBox("Erro no backend", `Falha ao iniciar o Python: ${err.message}`)
  );
}

function waitForBackend(cb, tries = 100) {
  const req = http.get(`${BASE}/api/health`, (res) => {
    res.resume();
    if (res.statusCode === 200) cb();
    else retry();
  });
  req.on("error", retry);
  function retry() {
    if (tries <= 0) {
      dialog.showErrorBox("Erro", "O backend Python não respondeu (timeout).");
      app.quit();
      return;
    }
    setTimeout(() => waitForBackend(cb, tries - 1), 300);
  }
}

/* ── MPRIS2: controles de mídia do KDE/Plasma via D-Bus ── */
function sendCmd(cmd) {
  win && win.webContents.send("mpris", cmd);
}

function setupMpris() {
  try {
    mpris = Mpris({
      name: "cmusic",
      identity: "cMusic",
    });
    mpris.desktopEntry = "cmusic";
    mpris.canSeek = true;
    mpris.getPosition = () => Math.round((lastState.posMs || 0) * 1000); // µs
    mpris.on("next", () => sendCmd("next"));
    mpris.on("previous", () => sendCmd("prev"));
    mpris.on("play", () => sendCmd("play"));
    mpris.on("pause", () => sendCmd("pause"));
    mpris.on("playpause", () => sendCmd("toggle"));
    mpris.on("stop", () => sendCmd("pause"));
    mpris.on("seek", (offsetUs) => {
      if (typeof offsetUs === "number") sendCmd(`seek:${Math.round(offsetUs / 1000)}`);
    });
    mpris.on("position", (ev) => {
      if (ev && typeof ev.position === "number") sendCmd(`seekabs:${Math.round(ev.position / 1000)}`);
    });
    updateMprisState();
  } catch (e) {
    console.warn("[mpris] indisponível:", e.message);
    mpris = null;
  }
}

function updateMprisState(partial = {}) {
  lastState = { ...lastState, ...partial };
  if (!mpris) return;
  try {
    mpris.metadata = {
      "mpris:trackid": mpris.objectPath(stateTrackId()),
      "mpris:length": Math.max(0, Math.round((lastState.durationMs || 0) * 1000)),
      ...(lastState.artUrl ? { "mpris:artUrl": lastState.artUrl } : {}),
      "xesam:title": lastState.title || "Nada tocando",
      "xesam:artist": [lastState.artist || "cMusic"],
    };
    mpris.playbackStatus = lastState.playing ? "Playing" : "Paused";
  } catch (e) {
    console.warn("[mpris] falhou ao atualizar:", e.message);
  }
}

function stateTrackId() {
  return (lastState.videoId || "none").replace(/[^a-zA-Z0-9_-]/g, "");
}

ipcMain.on("player-state", (_e, s) => updateMprisState(s || {}));
ipcMain.on("player-position", (_e, ms) => {
  if (typeof ms !== "number" || ms < 0) return;
  lastState.posMs = ms; // consultado via getPosition() pelo KDE
});

function createWindow() {
  win = new BrowserWindow({
    width: 1160,
    height: 740,
    minWidth: 900,
    minHeight: 560,
    title: "cMusic",
    icon: path.join(ROOT, "assets", "icon.png"),
    backgroundColor: "#000000",
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  win.loadURL(`${BASE}/`);
  win.webContents.on("did-finish-load", () => {
    if (win) win.webContents.send("app-version", app.getVersion());
  });
  win.on("closed", () => (win = null));
}

app.whenReady().then(() => {
  startBackend();
  waitForBackend(() => {
    setupMpris();
    createWindow();
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (backend) backend.kill();
  app.quit();
});

app.on("before-quit", () => {
  if (backend) backend.kill();
});
