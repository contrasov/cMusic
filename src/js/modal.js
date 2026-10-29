/* cMusic — modal reutilizável com motion (criar/renomear playlist + confirmação) */
import { escape } from "./utils.js";

const CLOSE_MS = 210;

const X_ICON = `<svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><path d="M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>`;
const ICONS = {
  playlist: `<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M15 6H3v2h12V6zm0 4H3v2h12v-2zM3 16h8v-2H3v2zm16-2v-4h-2v4h-4v2h4v4h2v-4h4v-2z"/></svg>`,
  rename: `<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>`,
  trash: `<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M16 9v10H8V9h8m-1.5-6h-5l-1 1H5v2h14V4h-3.5l-1-1zM18 7H6v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7z"/></svg>`,
};

function shake(el) {
  el.classList.remove("modal-shake");
  void el.offsetWidth;
  el.classList.add("modal-shake");
}

/**
 * Casca comum: backdrop + card + head + foot, motion e teclado.
 * Retorna { root, card, settle, done } — settle(result) fecha e resolve.
 */
function openShell({
  title,
  subtitle = "",
  icon = ICONS.playlist,
  iconDanger = false,
  bodyHTML = "",
  okLabel = "Confirmar",
  okDisabled = false,
  danger = false,
  onOk = null,          // padrão: resolve com o botão
}) {
  let settle = null;
  const done = new Promise((resolve) => { settle = resolve; });

  const root = document.createElement("div");
  root.className = "modal-root";
  root.innerHTML = `
    <div class="modal-backdrop"></div>
    <div class="modal-card" role="dialog" aria-modal="true" aria-label="${title}">
      <button class="modal-x" title="Fechar">${X_ICON}</button>
      <div class="modal-head">
        <div class="modal-icon${iconDanger ? " danger" : ""}">${icon}</div>
        <div class="modal-titles">
          <div class="modal-title">${title}</div>
          ${subtitle ? `<div class="modal-sub">${subtitle}</div>` : ""}
        </div>
      </div>
      <div class="modal-body">${bodyHTML}</div>
      <div class="modal-foot">
        <button class="btn-ghost" id="modal-cancel">Cancelar</button>
        <button class="btn-accent${danger ? " danger" : ""}" id="modal-ok"${okDisabled ? " disabled" : ""}>${okLabel}</button>
      </div>
    </div>`;
  document.body.appendChild(root);

  const card = root.querySelector(".modal-card");
  const okBtn = root.querySelector("#modal-ok");

  let closed = false;
  function close(result) {
    if (closed) return;
    closed = true;
    kBinds.forEach(([t, fn]) => t.removeEventListener("keydown", fn));
    root.classList.remove("show");
    setTimeout(() => root.remove(), CLOSE_MS);
    settle(result);
  }

  requestAnimationFrame(() => requestAnimationFrame(() => root.classList.add("show")));

  root.querySelector(".modal-backdrop").addEventListener("click", () => close(null));
  root.querySelector(".modal-x").addEventListener("click", () => close(null));
  root.querySelector("#modal-cancel").addEventListener("click", () => close(null));
  okBtn.addEventListener("click", () => {
    if (onOk) onOk();
    else close(true);
  });
  const esc = (e) => { if (e.key === "Escape") close(null); };
  const enter = (e) => { if (e.key === "Enter") { e.preventDefault(); okBtn.click(); } };
  const kBinds = [[document, esc], [document, enter]];
  kBinds.forEach(([t, fn]) => t.addEventListener("keydown", fn));

  return { root, card, okBtn, close, settle, done };
}

/**
 * Modal de confirmação (prevenção de erro) para ações destrutivas.
 * Resolve true (confirmado) ou null/undefined (cancelado).
 */
export function openConfirmModal({
  title = "Confirmar",
  subtitle = "",
  message = "",
  okLabel = "Confirmar",
  danger = false,
} = {}) {
  const shell = openShell({
    title,
    subtitle,
    icon: ICONS.trash,
    iconDanger: danger,
    bodyHTML: message ? `<div class="modal-confirm-msg">${message}</div>` : "",
    okLabel,
    danger,
  });
  requestAnimationFrame(() => setTimeout(() => shell.okBtn.focus(), CLOSE_MS));
  return shell.done;
}

/**
 * Abre um modal centralizado com backdrop e motion.
 * Resolve com o nome (confirmado) ou null (cancelado).
 */
export function openPlaylistModal({
  mode = "create",      // create | rename
  value = "",
} = {}) {
  const isRename = mode === "rename";
  const strings = isRename
    ? {
        title: "Renomear playlist",
        subtitle: "Um novo nome para a sua playlist",
        submit: "Salvar",
        hint: "Enter para salvar · Esc para cancelar",
      }
    : {
        title: "Nova playlist",
        subtitle: "Crie uma coleção com as suas faixas",
        submit: "Criar playlist",
        hint: "Enter para criar · você adiciona faixas depois com o botão direito",
      };

  const shell = openShell({
    title: strings.title,
    subtitle: strings.subtitle,
    icon: isRename ? ICONS.rename : ICONS.playlist,
    bodyHTML: `
      <label class="modal-label" for="modal-input">Nome</label>
      <input id="modal-input" type="text" placeholder="Ex.: Correr no fim de semana" maxlength="60" autocomplete="off" />
      <div class="modal-hint">${strings.hint}</div>`,
    onOk: confirm,
    okLabel: strings.submit,
    okDisabled: true,
  });
  const { card, okBtn, settle, done } = shell;

  const input = shell.root.querySelector("#modal-input");
  input.value = value;
  okBtn.disabled = !input.value.trim();

  function confirm() {
    const name = input.value.trim();
    if (!name) { shake(card); input.focus(); return; }
    shell.close(name);
  }

  setTimeout(() => input.focus(), CLOSE_MS);
  input.addEventListener("input", () => { okBtn.disabled = !input.value.trim(); });

  return done;
}
