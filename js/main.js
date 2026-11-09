// Оболочка приложения: вход, навигация, настройки, события, работа без сети.
import {S, setRenderer, schedule, call, loadQueue, saveCache, readCache, flush, act} from "./state.js";
import {SheetsApi, DemoApi, NetError} from "./api.js";
import {$, esc, ic, toast, lsGet, lsSet, mmss, shareOrCopy, inviteLink, appUrl} from "./util.js";
import * as A from "./athlete.js";
import * as C from "./coach.js";

const CFG = window.PODHOD || {};
const role = () => (S.auth && S.auth.role === "coach" ? C : A);
let demoSeed = null;

async function makeApi(mode) {
  if (mode === "demo") {
    if (!demoSeed) demoSeed = await (await fetch("demo/seed.json")).json();
    return new DemoApi(demoSeed);
  }
  const url = lsGet("apiUrl") || CFG.apiUrl || "";
  if (!url) throw new Error("Укажите адрес сервера в настройках входа");
  return new SheetsApi(url);
}

function route() {
  const h = decodeURIComponent(location.hash.replace(/^#/, ""));
  const [name, ...rest] = h.split("/");
  return {name:name || "", arg:rest.join("/") || null};
}

/* ───────── вход ───────── */
function loginScreen() {
  const url = lsGet("apiUrl") || CFG.apiUrl || "";
  return `<div class="login">
    <div class="brand"><div class="mark" aria-hidden="true"><i></i><i></i><i></i><i></i></div><h1>Железяка</h1></div>
    <p class="muted">Тренировки от вашего тренера: программа, подходы и прогресс. Всё сохраняется в Google Таблицы.</p>
    <div class="card stack">
      <label class="mf"><span>Код входа</span><input class="fi codein" id="l-code" inputmode="numeric" autocomplete="one-time-code" placeholder="••••••" aria-label="Код входа"></label>
      <button class="btn huge block" data-act="login" ${S.loading ? "disabled" : ""}>${S.loading ? "Вхожу…" : "Войти"}</button>
      ${S.error ? `<p class="err">${esc(S.error)}</p>` : ""}
      <details ${url ? "" : "open"}><summary class="small">Адрес сервера${url ? " · настроен" : ""}</summary>
        <div class="inl" style="margin-top:8px"><input class="fi" id="l-url" value="${esc(url)}" placeholder="https://script.google.com/macros/s/…/exec" aria-label="Адрес веб-приложения Apps Script">
        <p class="small muted" style="margin:0">Адрес выдаёт Google Apps Script после публикации, его присылает тренер. Подробно — в SETUP.md.</p></div></details>
    </div>
    ${CFG.demo === false ? "" : `<div class="card stack"><h4>Попробовать без настройки</h4><p class="small muted" style="margin:0">Демо на программах Николая. Данные хранятся только в этом браузере.</p>
      <div class="row"><button class="btn ghost" style="flex:1" data-act="demo" data-code="2468">${ic("lift")}Я подопечный</button><button class="btn ghost" style="flex:1" data-act="demo" data-code="0000">${ic("users")}Я тренер</button></div></div>`}
    ${CFG.guideUrl ? `<a class="guide" href="${esc(CFG.guideUrl)}" target="_blank" rel="noopener">Я тренер: как подключить свои Google Таблицы</a>` : ""}
  </div>`;
}
async function login(code, mode) {
  code = String(code || "").trim();
  if (!code) { S.error = "Введите код входа"; schedule(); return; }
  S.loading = true; S.error = null; schedule();
  try {
    if (mode !== "demo") { const u = ($("#l-url") || {}).value; if (u !== undefined) lsSet("apiUrl", u.trim() || null); }
    const api = await makeApi(mode);
    const who = await api.call("login", {}, code);
    S.api = api;
    S.auth = {code, role:who.role, name:who.name, clientId:who.clientId, mode};
    lsSet("auth", S.auth);
    location.hash = "#" + role().DEFAULT;
    await load();
  } catch (e) {
    S.error = e instanceof NetError ? "Нет связи с сервером. Проверьте интернет и адрес сервера." : e.message;
  } finally { S.loading = false; schedule(); }
}
function logout() {
  lsSet("auth", null);
  S.auth = null; S.data = null; S.api = null; S.queue = [];
  Object.keys(S.ui).forEach(k => { delete S.ui[k]; });
  location.hash = "";
  schedule();
}
async function load() {
  loadQueue();
  if (S.auth.role === "coach") C.restore();
  const cached = readCache();
  if (cached) { S.data = cached; schedule(); }
  try {
    const data = await call("bootstrap");
    if (S.auth.role === "coach" && S.data && S.data.cc) data.cc = S.data.cc;
    // тренировки, которые ещё ждут отправки, важнее серверной копии
    if (S.auth.role === "client" && S.queue.length) {
      const pend = new Map(S.queue.filter(q => q.action === "session.save").map(q => [q.body.session.id, q.body.session]));
      data.sessions = (data.sessions || []).filter(s => !pend.has(s.id)).concat([...pend.values()]);
    }
    S.data = data; S.online = true; saveCache();
    flush();
  } catch (e) {
    if (e instanceof NetError) { S.online = false; if (!cached) S.error = "Нет связи с сервером, а сохранённых данных на телефоне нет."; }
    else if (e.code === "auth") { toast("Код входа больше не действует"); logout(); return; }
    else toast(e.message);
  }
  schedule();
  const r = route(); if (role().onRoute) role().onRoute(r.name, r.arg);
}

/* ───────── настройки ───────── */
function settings() {
  const a = S.auth, url = lsGet("apiUrl") || CFG.apiUrl || "";
  const coach = a.role === "coach";
  return `<div class="nav"><a class="icon-btn" href="#${role().DEFAULT}" aria-label="Назад">${ic("back")}</a><h3 class="d">Настройки</h3></div>
    <div class="stack">
      <div class="card"><div class="kv"><span>Вход</span><b>${esc(a.name || "")} · ${coach ? "тренер" : "подопечный"}</b><span>Режим</span><b>${a.mode === "demo" ? "демо, данные в браузере" : "Google Таблицы"}</b>
        <span>Связь</span><b>${S.online ? "есть" : "нет сети"}</b><span>Ждут отправки</span><b>${S.queue.length}</b></div>
        ${S.queue.length ? `<button class="btn ghost block" style="margin-top:10px" data-act="sync">${ic("cloud")}Отправить сейчас</button>` : ""}</div>
      ${a.mode !== "demo" ? `<div class="card"><h4>Сервер</h4><p class="small mono" style="word-break:break-all;margin:0">${esc(url)}</p></div>` : ""}
      ${coach ? `<div class="card stack"><h4>Тренеру</h4>
        <button class="btn ghost block" data-act="check" ${S.ui.busy === "check" ? "disabled" : ""}>${ic("bell")}Проверить, у кого заканчивается программа</button>
        ${a.mode !== "demo" && CFG.demo !== false ? `<button class="btn ghost block" data-act="import" ${S.ui.busy === "import" ? "disabled" : ""}>${ic("sheet")}${S.ui.busy === "import" ? "Импортирую…" : "Импорт: библиотека и программы Николая"}</button>
        <p class="small muted" style="margin:0">Импорт создаст таблицу Николая с 8 программами из старой таблицы и заполнит библиотеку на 139 упражнений. Повторный импорт перезапишет эти программы.</p>` : ""}
        ${S.data && S.data.settings && !S.data.settings.email && !S.data.settings.telegram && a.mode !== "demo" ? `<p class="small" style="margin:0">Чтобы получать уведомления о конце программы, впишите email или Telegram на листе «Настройки» мастер-таблицы.</p>` : ""}</div>
      <div class="card stack"><h4>Поделиться</h4>
        <button class="btn ghost block" data-act="share-app">${ic("users")}Ссылка на приложение для подопечных</button>
        <p class="small muted" style="margin:0">Откроет Железяку уже подключённой к вашим таблицам — подопечному останется ввести свой код. Ссылку с кодом конкретного человека даёт кнопка «Пригласить» в его карточке.</p>
        ${CFG.templateUrl ? `<button class="btn ghost block" data-act="share-coach">${ic("copy")}Дать Железяку другу-тренеру</button>
        <p class="small muted" style="margin:0">Друг сделает свою копию таблицы-шаблона — его подопечные и программы будут в его Google Таблицах, ваши он не увидит.</p>` : ""}</div>` : ""}
      ${a.mode === "demo" ? `<button class="btn ghost block" data-act="demo-reset">Сбросить демо-данные</button>` : ""}
      <button class="btn line block" data-act="logout">Выйти</button>
    </div>`;
}

/* ───────── отрисовка ───────── */
const scrollMem = {};
let lastKey = "";
function render() {
  const app = $("#app");
  const a = document.activeElement;
  if (render.soft && a && app.contains(a) && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)) { render.soft = false; render.pending = true; return; }
  render.soft = false;
  if (!S.auth) { app.innerHTML = `<main class="scr" id="scr">${loginScreen()}</main>`; return; }
  const r = route(), mod = role();
  const name = r.name === "settings" || mod.SCREENS[r.name] ? r.name : mod.DEFAULT;
  const key = name + "/" + (r.arg || "");
  const scr = $("#scr");
  if (scr && lastKey) scrollMem[lastKey] = scr.scrollTop;
  const body = name === "settings" ? settings() : mod.SCREENS[name](r.arg);
  const net = !S.online || S.queue.length ? `<div class="netbar ${S.online ? "" : "off"}">${ic(S.online ? "cloud" : "off")}${S.online ? (S.syncing ? "Сохраняю в таблицу…" : `Ждут отправки: ${S.queue.length}`) : `Нет сети${S.queue.length ? ` · сохранится позже (${S.queue.length})` : " · показаны сохранённые данные"}`}</div>` : "";
  const tabs = mod.TABS.map(([t, icon, label, owns]) => `<a href="#${t}" aria-current="${owns.includes(name)}">${ic(icon)}${label}</a>`).join("");
  app.innerHTML = `${net}<main class="scr" id="scr">${body}</main><nav class="tabbar" style="--n:${mod.TABS.length}" aria-label="Разделы">${tabs}</nav>`;
  const scr2 = $("#scr");
  scr2.scrollTop = key === lastKey ? (scrollMem[key] || 0) : (scrollMem[key] || 0);
  lastKey = key;
  if (mod.afterRender) mod.afterRender();
}
setRenderer(render);
// фоновые перерисовки (синхронизация, таймеры) не сбивают ввод
const softRender = () => { render.soft = true; schedule(); };
S.hooks.synced.push((q, res) => {
  if (q.action === "session.save" && S.auth && S.auth.role === "client" && res && res.summary && S.data) S.data.client = res.summary;
  softRender();
});

/* ───────── события ───────── */
const MAIN_ACTIONS = {
  login:() => login(($("#l-code") || {}).value, "sheets"),
  demo:d => login(d.code, "demo"),
  logout,
  sync:() => flush(),
  "share-app":() => shareOrCopy("Железяка", "Приложение для тренировок. Открой ссылку и войди кодом, который я пришлю.", inviteLink(null)),
  "share-coach":() => shareOrCopy("Железяка для тренера",
    "Железяка — приложение для тренера и подопечных, всё хранится в твоих Google Таблицах.\n" +
    "1) Сделай копию таблицы-шаблона: " + CFG.templateUrl + "\n" +
    "2) В копии: меню «Железяка → Настроить», затем опубликуй сервер по подсказке из того же меню.\n" +
    "3) Открой приложение, вставь адрес сервера и войди кодом тренера." + (CFG.guideUrl ? "\nПодробная инструкция: " + CFG.guideUrl : ""), appUrl()),
  invite:d => shareOrCopy("Железяка", `${d.name}, вот приложение для наших тренировок. Код входа: ${d.code}`, inviteLink(d.code)),
  "copy-close":() => { const b = $("#copybox"); if (b) b.hidden = true; },
  "demo-reset":() => { if (S.api && S.api.reset) { S.api.reset(); lsSet("cache.demo." + S.auth.code, null); Object.keys(S.ui).forEach(k => { delete S.ui[k]; }); load(); toast("Демо-данные сброшены"); } },
  check:async () => { try { const r = await act("check", {}); toast(r.messages.length ? r.messages.join("; ") : `Проверено подопечных: ${r.checked}. Новых уведомлений нет`); const b = await call("bootstrap"); b.cc = S.data.cc; S.data = b; saveCache(); } catch (e) { /* */ } },
  import:async () => {
    try {
      const seed = await (await fetch("demo/seed.json")).json();
      const r = await act("import", {seed}, "Импорт завершён");
      toast(r.report.join("; "));
      const b = await call("bootstrap"); S.data = b; saveCache();
    } catch (e) { /* показано */ }
  }
};
document.addEventListener("click", e => {
  const el = e.target.closest("[data-act]");
  if (!el || el.disabled) return;
  const d = el.dataset, fn = MAIN_ACTIONS[d.act] || (S.auth && role().ACTIONS[d.act]);
  if (!fn) return;
  if (el.tagName === "BUTTON") e.preventDefault();
  const res = fn(d, el);
  schedule();
  if (res && res.then) res.then(schedule, schedule);
});
document.addEventListener("input", e => { if (S.auth) role().onInput && role().onInput(e.target); });
document.addEventListener("change", e => { if (S.auth && role().onChange && role().onChange(e.target)) schedule(); });
document.addEventListener("keydown", e => {
  if (e.key !== "Enter") return;
  if (e.target.id === "l-code") { e.preventDefault(); MAIN_ACTIONS.login(); return; }
  if (S.auth && role().onEnter && role().onEnter(e.target)) { e.preventDefault(); schedule(); }
});
document.addEventListener("focusout", () => setTimeout(() => { if (render.pending) { render.pending = false; schedule(); } }, 0));
window.addEventListener("hashchange", () => { const r = route(); if (S.auth && role().onRoute) role().onRoute(r.name, r.arg); schedule(); });
setInterval(() => {
  document.querySelectorAll("[data-elapsed]").forEach(el => { el.textContent = mmss((Date.now() - Date.parse(el.dataset.elapsed)) / 1000); });
  if (S.auth && role().tick) role().tick();
}, 1000);
document.addEventListener("visibilitychange", () => {
  if (document.hidden || !S.auth) return;
  if (S.queue.length) flush();
  if (S.auth.role === "coach") C.refreshCoach();
});

/* ───────── запуск ───────── */
(async function boot() {
  if ("serviceWorker" in navigator && location.protocol !== "file:") navigator.serviceWorker.register("sw.js").catch(() => { /* без офлайна */ });
  // ссылка-приглашение: ?s=адрес сервера тренера &c=код входа
  const qs = new URLSearchParams(location.search), invS = qs.get("s"), invC = qs.get("c");
  if (invS || invC) {
    if (invS && /^https:\/\/script\.google(usercontent)?\.com\//.test(invS)) lsSet("apiUrl", invS);
    history.replaceState(null, "", location.pathname + location.hash);
  }
  const saved = lsGet("auth");
  if (invC && (!saved || saved.code !== invC || saved.mode !== "sheets")) {
    if (saved) logout();
    await login(invC, "sheets");
    schedule();
    return;
  }
  if (saved) {
    S.auth = saved;
    try { S.api = await makeApi(saved.mode); } catch (e) { S.error = e.message; S.auth = null; }
    if (S.auth) { if (!location.hash) location.hash = "#" + role().DEFAULT; await load(); }
  }
  schedule();
})();
