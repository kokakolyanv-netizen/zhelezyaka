// Оболочка приложения: входы и переключение между ними, навигация, настройки, установка на телефон,
// синхронизация с таблицей, работа без сети.
import {S, setRenderer, schedule, call, loadQueue, saveCache, readCache, flush, act} from "./state.js";
import {SheetsApi, DemoApi, NetError} from "./api.js";
import {$, esc, ic, toast, lsGet, lsSet, mmss, shareOrCopy, inviteLink, appUrl, initials, AVC} from "./util.js";
import * as ACC from "./accounts.js";
import * as A from "./athlete.js";
import * as C from "./coach.js";
import {helpScreen} from "./help.js";

const CFG = window.PODHOD || {};
const role = () => (S.auth && S.auth.role === "coach" ? C : A);
let demoSeed = null;

async function makeApi(acc) {
  if (acc.mode === "demo") {
    if (!demoSeed) demoSeed = await (await fetch("demo/seed.json")).json();
    return new DemoApi(demoSeed);
  }
  if (!acc.server) throw new Error("Укажите адрес сервера: его присылает тренер");
  return new SheetsApi(acc.server);
}

function route() {
  const h = decodeURIComponent(location.hash.replace(/^#/, ""));
  const [name, ...rest] = h.split("/");
  return {name:name || "", arg:rest.join("/") || null};
}

/* ───────── установка на телефон ───────── */
const standalone = () => matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
let installEvt = null;
window.addEventListener("beforeinstallprompt", e => { e.preventDefault(); installEvt = e; schedule(); });
window.addEventListener("appinstalled", () => { installEvt = null; toast("Железяка установлена на телефон"); schedule(); });
function installHint() {
  if (isIOS()) return "Safari → кнопка «Поделиться» → «На экран „Домой“». Потом откройте иконку и войдите: вставьте ссылку-приглашение или код.";
  return "Меню браузера ⋮ → «Установить приложение» или «Добавить на главный экран».";
}
function installCard() {
  if (standalone()) return `<div class="card"><h4>Приложение</h4><p class="small muted" style="margin:0">Железяка установлена и открыта как приложение. Данные сами обновляются из таблицы при каждом открытии.</p></div>`;
  return `<div class="card stack"><h4>Поставить на экран телефона</h4>
    <p class="small muted" style="margin:0">Иконка на главном экране, запуск на весь экран без браузера, тренировка работает и без сети.</p>
    ${installEvt ? `<button class="btn block" data-act="install">${ic("install")}Установить Железяку</button>` : `<p class="small" style="margin:0">${esc(installHint())}</p>`}</div>`;
}
function installBanner() {
  if (standalone() || lsGet("installHide") || (!installEvt && !isIOS())) return "";
  return `<div class="ibanner">${ic("install")}<div class="ib-t"><b>Железяка на экране телефона</b><span>${installEvt ? "Иконка, запуск без браузера, работа без сети" : esc(installHint())}</span></div>
    ${installEvt ? `<button class="mini-btn" data-act="install">Установить</button>` : ""}<button class="ib-x" data-act="install-hide" aria-label="Скрыть">${ic("x")}</button></div>`;
}

/* ───────── входы ───────── */
const accAvatar = (a, i) => `<span class="ava sm" style="background:${AVC[i % AVC.length]}">${esc(initials(a.name))}</span>`;
function accRows(current) {
  return ACC.list().map((a, i) => {
    const cur = current && a.id === current.id, pend = cur ? S.queue.length : ACC.pending(a);
    return `<div class="acc ${cur ? "cur" : ""}">
      <button class="acc-main" data-act="switch" data-id="${esc(a.id)}" ${cur ? "aria-current=\"true\"" : ""}>${accAvatar(a, i)}
        <span class="acc-t"><b>${esc(a.name || "Без имени")}</b><span class="small muted">${esc(ACC.describe(a))}${pend ? ` · ждут отправки: ${pend}` : ""}</span></span>
        ${cur ? `<span class="tag">сейчас</span>` : ic("swap")}</button>
      ${current ? `<button class="icon-btn ghost" data-act="acc-remove" data-id="${esc(a.id)}" aria-label="Убрать вход ${esc(a.name || "")}">${ic("x")}</button>` : ""}</div>`;
  }).join("");
}
function loginScreen() {
  const adding = !!S.auth, accs = ACC.list();
  const url = adding ? (S.inviteServer || "") : (lsGet("apiUrl") || CFG.apiUrl || "");
  const head = adding
    ? `<div class="nav"><button class="icon-btn" data-act="add-cancel" aria-label="Назад">${ic("back")}</button><h3 class="d">Новый вход</h3></div>
       <p class="muted">Например, вы тренер в своих таблицах и подопечный у другого тренера. Все входы останутся на этом телефоне, переключение — в один тап.</p>`
    : `<div class="brand"><div class="mark" aria-hidden="true"><i></i><i></i><i></i><i></i></div><h1>Железяка</h1></div>
       <p class="muted">Тренировки от вашего тренера: программа, подходы и прогресс. Всё сохраняется в Google Таблицы.</p>`;
  return `<div class="login">${head}
    ${!adding && accs.length ? `<div class="card stack"><h4>Мои входы</h4>${accRows(null)}</div>` : ""}
    <div class="card stack">
      ${!adding && accs.length ? `<h4>Новый вход</h4>` : ""}
      <label class="mf"><span>Код входа или ссылка-приглашение</span><input class="fi codein" id="l-code" inputmode="numeric" autocomplete="one-time-code" placeholder="••••••" aria-label="Код входа или ссылка-приглашение"></label>
      <button class="btn huge block" data-act="login" ${S.loading ? "disabled" : ""}>${S.loading ? "Вхожу…" : "Войти"}</button>
      ${S.error ? `<p class="err">${esc(S.error)}</p>` : ""}
      <details ${url || adding ? "" : "open"} ${adding ? "open" : ""}><summary class="small">${adding ? "Адрес сервера другого тренера" : "Адрес сервера"}${url ? " · настроен" : ""}</summary>
        <div class="inl" style="margin-top:8px"><input class="fi" id="l-url" value="${esc(url)}" placeholder="https://script.google.com/macros/s/…/exec" aria-label="Адрес веб-приложения Apps Script">
        <p class="small muted" style="margin:0">${adding ? "Оставьте пустым, если вход у того же тренера, что и текущий. " : ""}Адрес сервера присылает тренер, он же есть в ссылке-приглашении. Если вставить ссылку в поле кода, адрес подставится сам.</p></div></details>
    </div>
    ${CFG.demo === false ? "" : `<div class="card stack"><h4>Попробовать без настройки</h4><p class="small muted" style="margin:0">Демо на программах Николая. Данные хранятся только в этом браузере.</p>
      <div class="row"><button class="btn ghost" style="flex:1" data-act="demo" data-code="2468">${ic("lift")}Я подопечный</button><button class="btn ghost" style="flex:1" data-act="demo" data-code="0000">${ic("users")}Я тренер</button></div></div>`}
    ${adding ? "" : `<a class="guide" href="#help">Как пользоваться приложением</a>`}
    ${!adding && CFG.guideUrl ? `<a class="guide" href="${esc(CFG.guideUrl)}" target="_blank" rel="noopener">Я тренер: как подключить свои Google Таблицы</a>` : ""}
  </div>`;
}

// Вход по коду (или по вставленной ссылке-приглашению). Новый вход добавляется к остальным.
async function login(input, mode, serverHint) {
  let {server, code} = mode === "demo" ? {server:"", code:String(input || "").trim()} : ACC.parseEntry(input);
  if (mode !== "demo") {
    const typed = ($("#l-url") || {}).value;
    server = server || serverHint || (typed !== undefined ? typed.trim() : "") || lsGet("apiUrl") || CFG.apiUrl || "";
    if (server && ACC.okServer(server)) lsSet("apiUrl", server);
    if (!code) { S.error = server && ACC.okServer(server) ? "Адрес сервера сохранён. Теперь введите код входа." : "Введите код входа"; schedule(); return; }
    if (!server) { S.error = "Нужен адрес сервера: его присылает тренер. Проще всего вставить ссылку-приглашение целиком."; schedule(); return; }
    if (!ACC.okServer(server)) { S.error = "Адрес сервера должен начинаться с https://script.google.com/"; schedule(); return; }
  } else if (!code) { S.error = "Введите код входа"; schedule(); return; }
  S.loading = true; S.error = null; schedule();
  try {
    const base = {mode, server, code};
    const api = await makeApi(base);
    const who = await api.call("login", {}, code);
    const acc = ACC.upsert({...base, id:ACC.accId(base), role:who.role, name:who.name, clientId:who.clientId || null, coachName:who.coach || null});
    await enter(acc, api);
  } catch (e) {
    S.error = e instanceof NetError ? "Нет связи с сервером. Проверьте интернет и адрес сервера." : e.message;
  } finally { S.loading = false; schedule(); }
}
function resetSession() {
  S.data = null; S.api = null; S.queue = []; S.error = null; S.online = navigator.onLine;
  Object.keys(S.ui).forEach(k => { delete S.ui[k]; });
}
// Сделать вход текущим. Перед сменой пробуем отправить очередь текущего входа (не дольше 4 с;
// что не успело — останется на телефоне и уйдёт, когда в этот вход вернутся).
async function enter(acc, api) {
  if (S.auth && S.auth.id !== acc.id && S.queue.length) await Promise.race([flush(), new Promise(r => setTimeout(r, 4000))]);
  resetSession();
  S.adding = false;
  S.auth = acc; lsSet("auth", acc);
  S.api = api || await makeApi(acc);
  location.hash = "#" + role().DEFAULT;
  schedule();
  await load();
}
async function switchTo(id) {
  if (S.auth && S.auth.id === id) { S.adding = false; location.hash = "#" + role().DEFAULT; return; }
  const acc = ACC.list().find(a => a.id === id); if (!acc) return;
  try { await enter(acc); toast("Вход: " + acc.name); } catch (e) { toast(e.message); }
}
// Убрать вход с телефона. Неотправленные записи этого входа пропадут — спрашиваем.
async function removeAccount(id) {
  const acc = ACC.list().find(a => a.id === id); if (!acc) return;
  const cur = S.auth && S.auth.id === id, pend = cur ? S.queue.length : ACC.pending(acc);
  if (!confirm(`Убрать вход «${acc.name}» с этого телефона?` + (pend ? `\n\nНе отправлено в таблицу: ${pend}. Эти записи пропадут.` : "") + "\n\nДанные в Google Таблице останутся, войти снова можно по коду.")) return;
  ACC.remove(id);
  if (!cur) { schedule(); return; }
  resetSession(); S.auth = null; lsSet("auth", null);
  const next = ACC.list()[0];
  if (next) await switchTo(next.id); else { location.hash = ""; schedule(); }
}
async function load() {
  const auth = S.auth;
  loadQueue();
  if (auth.role === "coach") C.restore();
  const cached = readCache();
  if (cached) { S.data = cached; schedule(); }
  try {
    const data = await call("bootstrap");
    if (S.auth !== auth) return;
    if (auth.role === "coach" && S.data && S.data.cc) data.cc = S.data.cc;
    // тренировки, которые ещё ждут отправки, важнее серверной копии
    if (auth.role === "client" && S.queue.length) {
      const pend = new Map(S.queue.filter(q => q.action === "session.save").map(q => [q.body.session.id, q.body.session]));
      data.sessions = (data.sessions || []).filter(s => !pend.has(s.id)).concat([...pend.values()]);
    }
    S.data = data; S.online = true; saveCache();
    S.syncedAt = Date.now();
    flush();
  } catch (e) {
    if (S.auth !== auth) return;
    if (e instanceof NetError) { S.online = false; if (!cached) S.error = "Нет связи с сервером, а сохранённых данных на телефоне нет."; }
    else if (e.code === "auth") { toast("Код входа больше не действует"); ACC.remove(auth.id); resetSession(); S.auth = null; lsSet("auth", null); location.hash = ""; schedule(); return; }
    else toast(e.message);
  }
  schedule();
  const r = route(); if (role().onRoute) role().onRoute(r.name, r.arg);
}

/* ───────── синхронизация с таблицей ───────── */
// Правки тренера в таблице сами приходят в приложение: при каждом открытии и раз в 90 с, пока приложение на экране.
// Во время прохождения тренировки данные не подменяем — отправка подходов идёт своей очередью.
async function refresh(manual) {
  if (!S.auth || !S.api || S.refreshing || document.hidden) return;
  if (S.queue.length) { flush(); if (!manual) return; }
  if (S.auth.role === "coach") { await C.refreshCoach(); S.syncedAt = Date.now(); if (manual) toast("Обновлено из таблицы"); return; }
  const r = route();
  if (!manual && ["quest", "exercise"].includes(r.name)) return;
  const auth = S.auth;
  S.refreshing = true; if (manual) schedule();
  try {
    const b = await call("bootstrap");
    if (S.auth !== auth || S.queue.length) return;
    S.data = b; S.online = true; S.syncedAt = Date.now(); saveCache();
    if (manual) toast("Обновлено из таблицы");
  } catch (e) {
    if (e instanceof NetError) S.online = false;
    if (manual) toast(e instanceof NetError ? "Нет связи с сервером" : e.message);
  } finally { S.refreshing = false; softRender(); }
}
setInterval(() => refresh(false), 90000);

/* ───────── плеер видео ───────── */
// Ролики лежат на Яндекс Диске тренера. Яндекс сам пережимает их в поток HLS; адрес потока со страницы ролика
// достаёт сервер (страницу Яндекса нельзя встроить в чужое окно), а играет его плеер приложения.
// Скачать из плеера нельзя: ни кнопки, ни пункта меню, поток идёт кусочками по 5 секунд.
const HLS_JS = "https://cdn.jsdelivr.net/npm/hls.js@1.5.17/dist/hls.min.js";
const streams = new Map();            // адрес ролика → {at, info}: адреса потока живут несколько часов
let hls = null, playerToken = 0;
let hlsLoading = null;
function loadHls() {
  if (window.Hls) return Promise.resolve();
  if (!hlsLoading) hlsLoading = new Promise((ok, bad) => {
    const s = document.createElement("script"); s.src = HLS_JS; s.onload = ok;
    s.onerror = () => { hlsLoading = null; s.remove(); bad(new Error("Не загрузился плеер видео")); };
    document.head.appendChild(s);
  });
  return hlsLoading;
}
const inflight = new Map();          // запросы адреса потока, которые уже идут
function streamInfo(src) {
  const c = streams.get(src);
  if (c && Date.now() - c.at < 40 * 60000) return Promise.resolve(c.info);
  if (inflight.has(src)) return inflight.get(src);
  const p = (async () => {
    let info;
    try { info = await call("video.stream", {url:src}); }
    catch (e) {   // Яндекс изредка отвечает серверу без потока — одна повторная попытка
      if (!["not_ready", "yandex"].includes(e.code)) throw e;
      await new Promise(r => setTimeout(r, 1500));
      info = await call("video.stream", {url:src});
    }
    streams.set(src, {at:Date.now(), info});
    return info;
  })().finally(() => inflight.delete(src));
  inflight.set(src, p);
  return p;
}
// Экран с видео открыт — заранее узнаём адрес потока и грузим плеер, чтобы «плей» срабатывал сразу
function prefetchVideos() {
  if (!S.auth || !S.api || !S.online) return;
  const els = document.querySelectorAll('#app [data-act="video-open"][data-src]');
  if (!els.length) return;
  els.forEach(el => { streamInfo(el.dataset.src).catch(() => null); });
  if (!isIOS()) loadHls().catch(() => null);
}
function playerShell(title, inner) {
  const box = $("#player");
  box.innerHTML = `<div class="pl-top"><b>${esc(title || "Видео")}</b><button class="icon-btn" data-act="video-close" aria-label="Закрыть">${ic("x")}</button></div>
    <div class="pl-frame">${inner}</div><p class="pl-msg small" id="pl-msg"></p>`;
  box.hidden = false;
  document.body.classList.add("noscroll");
  return box;
}
const playerMsg = (text, link) => { const m = $("#pl-msg"); if (m) m.innerHTML = esc(text || "") + (link ? ` <a href="${esc(link)}" target="_blank" rel="noopener">Открыть на Яндекс Диске</a>` : ""); };
async function openPlayer(d) {
  const title = d.title || "Видео", token = ++playerToken;
  if (d.vid) {   // Google Диск: его встроенный плеер (за пределами России)
    playerShell(title, `<iframe src="https://drive.google.com/file/d/${encodeURIComponent(d.vid)}/preview" allow="autoplay; fullscreen" allowfullscreen referrerpolicy="no-referrer" title="${esc(title)}"></iframe><div class="pl-shield" aria-hidden="true"></div>`);
    return;
  }
  playerShell(title, `<video id="pl-v" playsinline controls loop muted autoplay preload="auto" controlsList="nodownload noremoteplayback noplaybackrate" disablePictureInPicture disableRemotePlayback></video><div class="pl-wait" id="pl-wait"><span class="spin"></span>Загружаю видео…</div>`);
  const v = $("#pl-v");
  v.addEventListener("contextmenu", e => e.preventDefault());
  v.addEventListener("playing", () => { const w = $("#pl-wait"); if (w) w.remove(); playerMsg(v.muted ? "Звук включается в плеере." : ""); });
  if (!S.online) { playerMsg("Нет сети: видео играет только при подключении к интернету."); return; }
  try {
    const info = await streamInfo(d.src);
    if (token !== playerToken) return;
    const pick = q => (info.streams || []).find(s => s.q === q);
    // стартовое качество по скорости связи: медленная — 360p, средняя — 480p, хорошая — 720p
    const conn = navigator.connection || {}, slow = conn.saveData || /2g$/.test(conn.effectiveType || "");
    const want = slow ? 360 : conn.downlink && conn.downlink < 2.5 ? 480 : 720;
    const best = pick("adaptive") || pick("480p") || info.streams[0];
    // iPhone играет такой поток сам. Остальным браузерам — hls.js: встроенный HLS в Chrome стартует с задержкой
    const native = v.canPlayType("application/vnd.apple.mpegurl"), mse = window.MediaSource || window.ManagedMediaSource;
    if (native && (isIOS() || !mse)) v.src = ((slow ? null : pick(want + "p")) || best).url;   // сам начинает с низкого качества — сразу даём нужное
    else {
      await loadHls();
      if (token !== playerToken) return;
      if (!window.Hls || !window.Hls.isSupported()) throw new Error("Этот браузер не умеет играть видео");
      hls = new window.Hls({maxBufferLength:20});
      // начинаем с выбранного качества, дальше hls.js подстраивается под связь сам
      hls.on(window.Hls.Events.MANIFEST_PARSED, (e, data) => {
        const lv = (data && data.levels) || [];
        let i = lv.findIndex(l => l.height >= want); if (i < 0) i = lv.length - 1;
        if (i >= 0) hls.startLevel = i;
      });
      hls.on(window.Hls.Events.ERROR, (e, data) => { if (data && data.fatal) { playerMsg("Видео не загрузилось. Проверьте интернет и попробуйте ещё раз.", d.src); streams.delete(d.src); } });
      hls.loadSource(best.url); hls.attachMedia(v);
    }
    v.play().catch(() => { /* браузер ждёт нажатия на «плей» */ });
  } catch (e) {
    if (token !== playerToken) return;
    const w = $("#pl-wait"); if (w) w.remove();
    playerMsg(e instanceof NetError ? "Нет связи с сервером." : e.message, d.src);
  }
}
function closePlayer() {
  const box = $("#player"); if (!box || box.hidden) return;
  playerToken++;
  if (hls) { try { hls.destroy(); } catch (e) { /* уже закрыт */ } hls = null; }
  box.hidden = true; box.innerHTML = "";
  document.body.classList.remove("noscroll");
}
document.addEventListener("keydown", e => { if (e.key === "Escape") closePlayer(); });
window.addEventListener("hashchange", closePlayer);

/* ───────── настройки ───────── */
function settings() {
  const a = S.auth, coach = a.role === "coach";
  const synced = S.syncedAt ? new Date(S.syncedAt).toLocaleTimeString("ru-RU", {hour:"2-digit", minute:"2-digit"}) : "—";
  return `<div class="nav"><a class="icon-btn" href="#${role().DEFAULT}" aria-label="Назад">${ic("back")}</a><h3 class="d">Настройки</h3></div>
    <div class="stack">
      <div class="card stack"><h4>Входы на этом телефоне</h4>${accRows(a)}
        <button class="btn ghost block" data-act="add-login">${ic("plus")}Добавить вход</button></div>
      <div class="card"><div class="kv"><span>Режим</span><b>${a.mode === "demo" ? "демо, данные в браузере" : "Google Таблицы"}</b>
        <span>Связь</span><b>${S.online ? "есть" : "нет сети"}</b><span>Обновлено</span><b>${synced}</b><span>Ждут отправки</span><b>${S.queue.length}</b></div>
        <div class="row" style="margin-top:10px;gap:8px">
          <button class="btn ghost" style="flex:1" data-act="refresh" ${S.refreshing ? "disabled" : ""}>${ic("sync")}${S.refreshing ? "Обновляю…" : "Обновить из таблицы"}</button>
          ${S.queue.length ? `<button class="btn ghost" style="flex:1" data-act="sync">${ic("cloud")}Отправить</button>` : ""}</div></div>
      ${a.mode !== "demo" ? `<div class="card"><h4>Сервер</h4><p class="small mono" style="word-break:break-all;margin:0">${esc(a.server || "")}</p></div>` : ""}
      <a class="btn ghost block" href="#help">${ic("book")}Как пользоваться</a>
      ${installCard()}
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
      <button class="btn line block" data-act="acc-remove" data-id="${esc(a.id)}">${ic("logout")}Выйти из этого входа</button>
    </div>`;
}
// Плашка «кто я» над главным экраном роли: ведёт в настройки, где переключаются входы
function whoBar() {
  const a = S.auth, accs = ACC.list(), i = Math.max(0, accs.findIndex(x => x.id === a.id));
  return `<a class="whobar" href="#settings" aria-label="Входы и настройки">${accAvatar(a, i)}<span class="acc-t"><b>${esc(a.name || "")}</b><span class="small muted">${esc(ACC.describe(a))}</span></span>
    <span class="who-r">${accs.length > 1 ? `${ic("swap")}<span>Сменить</span>` : ic("gear")}</span></a>`;
}

/* ───────── отрисовка ───────── */
const scrollMem = {};
let lastKey = "";
function render() {
  const app = $("#app");
  const a = document.activeElement;
  if (render.soft && a && app.contains(a) && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)) { render.soft = false; render.pending = true; return; }
  render.soft = false;
  if (!S.auth || S.adding) {
    const help = route().name === "help";
    app.innerHTML = `<main class="scr" id="scr">${help ? `<div class="page">${helpScreen(null, "#")}</div>` : loginScreen()}</main>`;
    lastKey = ""; return;
  }
  const r = route(), mod = role();
  const name = r.name === "settings" || r.name === "help" || mod.SCREENS[r.name] ? r.name : mod.DEFAULT;
  const key = name + "/" + (r.arg || "");
  const scr = $("#scr");
  if (scr && lastKey) scrollMem[lastKey] = scr.scrollTop;
  const top = name === mod.DEFAULT ? whoBar() + installBanner() : "";
  const body = top + (name === "settings" ? settings() : name === "help" ? helpScreen(S.auth.role, "#settings") : mod.SCREENS[name](r.arg));
  const net = !S.online || S.queue.length ? `<div class="netbar ${S.online ? "" : "off"}">${ic(S.online ? "cloud" : "off")}${S.online ? (S.syncing ? "Сохраняю в таблицу…" : `Ждут отправки: ${S.queue.length}`) : `Нет сети${S.queue.length ? ` · сохранится позже (${S.queue.length})` : " · показаны сохранённые данные"}`}</div>` : "";
  const tabs = mod.TABS.map(([t, icon, label, owns]) => `<a href="#${t}" aria-current="${owns.includes(name)}">${ic(icon)}${label}</a>`).join("");
  const side = `<div class="side-brand"><div class="mark" aria-hidden="true"><i></i><i></i><i></i><i></i></div><b>Железяка</b></div>`;
  const sideFoot = `<a class="side-set" href="#settings" aria-current="${name === "settings"}">${ic("gear")}Настройки</a>`;
  app.innerHTML = `${net}<main class="scr" id="scr"><div class="page">${body}</div></main><nav class="tabbar" style="--n:${mod.TABS.length}" aria-label="Разделы">${side}${tabs}${sideFoot}</nav>`;
  const scr2 = $("#scr");
  scr2.scrollTop = scrollMem[key] || 0;
  lastKey = key;
  if (mod.afterRender) mod.afterRender();
  setTimeout(prefetchVideos, 0);
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
  switch:d => switchTo(d.id),
  "acc-remove":d => removeAccount(d.id),
  "add-login":() => { S.adding = true; S.error = null; },
  "add-cancel":() => { S.adding = false; S.error = null; },
  refresh:() => refresh(true),
  install:async () => {
    if (!installEvt) { toast(installHint()); return; }
    const e = installEvt; installEvt = null;
    try { await e.prompt(); await e.userChoice; } catch (err) { /* закрыли окно */ }
  },
  "install-hide":() => { lsSet("installHide", true); },
  "help-tab":d => { S.ui.helpTab = +d.v; const scr = $("#scr"); if (scr) scr.scrollTop = 0; },
  "video-open":d => openPlayer(d),
  "video-close":() => closePlayer(),
  sync:() => flush(),
  "share-app":() => shareOrCopy("Железяка", "Приложение для тренировок. Открой ссылку и войди кодом, который я пришлю.", inviteLink(null)),
  "share-coach":() => shareOrCopy("Железяка для тренера",
    "Железяка — приложение для тренера и подопечных, всё хранится в твоих Google Таблицах.\n" +
    "1) Сделай копию таблицы-шаблона: " + CFG.templateUrl + "\n" +
    "2) В копии: меню «Железяка → Настроить», затем опубликуй сервер по подсказке из того же меню.\n" +
    "3) Открой приложение, вставь адрес сервера и войди кодом тренера." + (CFG.guideUrl ? "\nПодробная инструкция: " + CFG.guideUrl : ""), appUrl()),
  invite:d => shareOrCopy("Железяка", `${d.name}, вот приложение для наших тренировок. Код входа: ${d.code}`, inviteLink(d.code)),
  "copy-close":() => { const b = $("#copybox"); if (b) b.hidden = true; },
  "demo-reset":() => { if (S.api && S.api.reset) { S.api.reset(); lsSet("cache." + ACC.accKey(S.auth), null); Object.keys(S.ui).forEach(k => { delete S.ui[k]; }); load(); toast("Демо-данные сброшены"); } },
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
  const d = el.dataset, fn = MAIN_ACTIONS[d.act] || (S.auth && !S.adding && role().ACTIONS[d.act]);
  if (!fn) return;
  if (el.tagName === "BUTTON") e.preventDefault();
  const res = fn(d, el);
  schedule();
  if (res && res.then) res.then(schedule, schedule);
});
document.addEventListener("input", e => { if (S.auth && !S.adding) role().onInput && role().onInput(e.target); });
document.addEventListener("change", e => { if (S.auth && !S.adding && role().onChange && role().onChange(e.target)) schedule(); });
document.addEventListener("keydown", e => {
  if (e.key !== "Enter") return;
  if (e.target.id === "l-code") { e.preventDefault(); MAIN_ACTIONS.login(); return; }
  if (S.auth && !S.adding && role().onEnter && role().onEnter(e.target)) { e.preventDefault(); schedule(); }
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
  refresh(false);
});

/* ───────── запуск ───────── */
(async function boot() {
  if ("serviceWorker" in navigator && location.protocol !== "file:") navigator.serviceWorker.register("sw.js").catch(() => { /* без офлайна */ });
  ACC.migrate();
  // ссылка-приглашение: ?s=адрес сервера тренера &c=код входа — добавляет вход к уже сохранённым
  const qs = new URLSearchParams(location.search), invS = qs.get("s"), invC = qs.get("c");
  const server = invS && ACC.okServer(invS) ? invS : null;
  if (invS || invC) {
    if (server) lsSet("apiUrl", server);
    history.replaceState(null, "", location.pathname + location.hash);
  }
  const saved = lsGet("auth");
  if (invC) {
    const srv = server || (saved && saved.server) || lsGet("apiUrl") || CFG.apiUrl || "";
    const known = ACC.list().find(a => a.id === ACC.accId({mode:"sheets", server:srv, code:invC}));
    if (known) { await enter(known); return; }
    if (saved) { S.auth = saved; try { S.api = await makeApi(saved); } catch (e) { S.auth = null; } }
    if (S.auth) load();   // текущий вход грузится, пока проверяем новый код
    await login(invC, "sheets", srv);
    // не вышло (нет сети или неверный код) — экран нового входа с ошибкой; «Назад» вернёт в текущий вход
    if (S.auth && saved && S.auth.id === saved.id) S.adding = true;
    schedule();
    return;
  }
  // общая ссылка тренера без кода (?s=…): если это другой сервер — сразу предлагаем добавить вход
  if (server) {
    S.inviteServer = server;
    if (saved && saved.server !== server && !ACC.list().some(a => a.server === server)) S.adding = true;
  }
  if (saved) {
    S.auth = saved;
    try { S.api = await makeApi(saved); } catch (e) { S.error = e.message; S.auth = null; }
    if (S.auth) { if (!location.hash) location.hash = "#" + role().DEFAULT; await load(); }
  }
  schedule();
})();
