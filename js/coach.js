// Экраны тренера: Подопечные, карточка подопечного, Конструктор, Прописка, Шаблоны, Библиотека.
import {S, schedule, act} from "./state.js";
import {sessionId, repsText, numRu} from "./shared.js";
import {esc, fnum, ic, toast, dshort, clone, uid, todayISO, initials, plural, lsGet, lsSet, SEC, SIMPLE, kindOf, LET, MUSCLES, EQUIP, TYPES, AVC} from "./util.js";
import {accKey} from "./accounts.js";
import {tFor, restOf, itemsOf, byId, fmtT, subLine, groupsOf, secTag, videoBlock, driveId, emptyState, loadingState, progressGrid, sparkline} from "./common.js";

export const TABS = [["clients", "users", "Подопечные", ["clients", "client"]], ["builder", "build", "Конструктор", ["builder", "item"]], ["templates", "copy", "Шаблоны", ["templates"]], ["library", "book", "Библиотека", ["library", "ex"]]];
export const DEFAULT = "clients";
const U = S.ui;
const D = () => S.data || {};
const exById = () => byId(D().exercises);
const cc = id => (D().cc || {})[id];
const pdKey = () => "pd." + accKey(S.auth);
function savePd() { lsSet(pdKey(), U.pd || null); }
export function restore() { U.pd = lsGet(pdKey()); U.cweek = 1; U.allWeeks = true; U.sel = []; }

async function loadClient(id, force) {
  if (!force && cc(id)) return;
  S.data.cc = D().cc || {};
  try { S.data.cc[id] = await act("client.get", {clientId:id}); } catch (e) { /* сообщение уже показано */ }
  schedule();
}
// тихо обновить список подопечных, шаблоны и уведомления (без индикатора)
let refreshing = false;
export async function refreshCoach() {
  if (refreshing || !S.api) return;
  refreshing = true;
  try {
    const b = await S.api.call("bootstrap", {}, S.auth.code);
    ["clients", "templates", "notifications", "exercises", "settings", "video"].forEach(k => { S.data[k] = b[k]; });
    S.online = true;
  } catch (e) { /* без сети — остаёмся на сохранённых данных */ }
  finally { refreshing = false; schedule(); }
}
export function onRoute(name, arg) {
  if (name === "client" && arg) loadClient(arg);
  if (name === "clients" || name === "templates") refreshCoach();
}
function putClientSummary(c) {
  if (!c) return;
  const list = D().clients || [], i = list.findIndex(x => x.id === c.id);
  if (i >= 0) list[i] = {...list[i], ...c}; else list.push(c);
  if (cc(c.id)) cc(c.id).client = {...cc(c.id).client, ...c};
}
const busy = a => S.ui.busy === a ? "disabled" : "";

/* ───────── Подопечные ───────── */
function clients() {
  if (!D().clients) return loadingState();
  const unread = (D().notifications || []).filter(n => !n.read);
  const list = (D().clients || []).slice().sort((a, b) => (a.weeksLeft == null ? 99 : a.weeksLeft) - (b.weeksLeft == null ? 99 : b.weeksLeft) || a.name.localeCompare(b.name, "ru"));
  return `<div class="nav"><h3 class="d">Подопечные</h3></div>
    ${unread.length ? `<div class="alert">${ic("bell")}<div class="stack" style="gap:8px;flex:1">${unread.slice(0, 4).map(n => {
        const c = (D().clients || []).find(x => x.name === n.client);
        return `<div><b>${esc(n.client)}</b>: ${esc(n.text)}<div class="small muted">${esc(dshort(n.date))}</div>${c ? `<a class="mini-btn" style="margin-top:6px" href="#client/${esc(c.id)}" data-act="np-open" data-cid="${esc(c.id)}">Собрать следующую программу</a>` : ""}</div>`; }).join("")}
      <button class="mini-btn" data-act="notif-read" ${busy("notifications.read")}>Отметить прочитанными</button></div></div>` : ""}
    <div class="stack">${list.length ? list.map((c, i) => {
      const pct = c.total ? Math.round(c.done / c.total * 100) : 0, warn = c.weeksLeft != null && c.weeksLeft <= 1 && c.active;
      return `<a class="client" href="#client/${esc(c.id)}"><span class="ava" style="background:${AVC[i % AVC.length]}">${esc(initials(c.name))}</span>
        <span class="cmain"><span class="row between"><b>${esc(c.name)}</b>${c.active ? `<span class="tag ${warn ? "c-y" : ""}">${warn ? "<i></i>" : ""}${c.weeksLeft === 0 ? "пройдена" : c.weeksLeft != null ? "осталось " + c.weeksLeft + " " + plural(c.weeksLeft, "неделя", "недели", "недель") : ""}</span>` : ""}</span>
        <span class="small muted">${esc(c.active || "без программы")}${c.last ? " · был " + esc(dshort(c.last)) : ""}</span>
        <span class="bar-p"><i style="width:${pct}%"></i></span></span></a>`; }).join("") : emptyState("Подопечных пока нет", "Добавьте первого: приложение создаст ему отдельную Google-таблицу и код входа.")}</div>
    <div class="card" style="margin-top:12px"><h4>Новый подопечный</h4>
      <div class="inl"><input class="fi" id="c-name" placeholder="Имя" aria-label="Имя нового подопечного"><input class="fi" id="c-contact" placeholder="Контакт: телефон или Telegram" aria-label="Контакт">
      <button class="btn" data-act="c-add" ${busy("client.add")}>${ic("plus")}${S.ui.busy === "client.add" ? "Создаю таблицу…" : "Добавить"}</button></div>
      ${U.newClient ? `<div class="codebox"><span>Код входа для ${esc(U.newClient.name)}</span><b class="mono">${esc(U.newClient.code)}</b><small>Отправьте подопечному ссылку: приложение откроется сразу с его кодом.</small>
        <button class="btn" style="margin-top:8px" data-act="invite" data-name="${esc(U.newClient.name)}" data-code="${esc(U.newClient.code)}">${ic("users")}Отправить приглашение</button></div>` : ""}</div>`;
}

/* ───────── Карточка подопечного ───────── */
function client(id) {
  const sum = (D().clients || []).find(c => c.id === id);
  const data = cc(id);
  const head = `<div class="nav"><a class="icon-btn" href="#clients" aria-label="Назад">${ic("back")}</a><h3>${esc(sum ? sum.name : "Подопечный")}<small>${esc(sum && sum.contact || "")}</small></h3>
    <button class="icon-btn" data-act="c-refresh" data-cid="${esc(id)}" aria-label="Обновить">${ic("cloud")}</button></div>`;
  if (!data) return head + loadingState();
  const c = data.client, p = data.program;
  const sMap = byId((data.sessions || []).map(s => ({...s, id:s.id || sessionId(s.program, s.workout, s.week)})));
  const sid = (wid, w) => sessionId(p.id, wid, w);
  const ms = data.measurements || [], lastM = ms[ms.length - 1];
  const recent = (data.sessions || []).slice().sort((a, b) => String(b.startedAt).localeCompare(String(a.startedAt))).slice(0, 5);
  const np = U.np && U.np.clientId === id ? U.np : null;
  return head + `<div class="stack">
    <div class="card stack"><div class="row between"><div><div class="small muted">Код входа</div><b class="mono" style="font-size:20px;letter-spacing:.08em">${esc(c.code)}</b></div>
      ${c.url ? `<a class="btn ghost" href="${esc(c.url)}" target="_blank" rel="noopener">${ic("sheet")}Таблица</a>` : ""}</div>
      <button class="btn block" data-act="invite" data-name="${esc(c.name)}" data-code="${esc(c.code)}">${ic("users")}Пригласить: отправить ссылку с кодом</button></div>
    ${p ? `<div class="card stack"><div class="row between"><div><div class="eyebrow">Текущая программа</div><b style="font-size:17px">${esc(p.title)}</b>
        <div class="small muted">${c.done} из ${c.total} тренировок${c.weeksLeft != null ? " · осталось " + c.weeksLeft + " " + plural(c.weeksLeft, "неделя", "недели", "недель") : ""}${c.startDate ? " · старт " + esc(dshort(c.startDate)) : ""}</div></div></div>
        ${progressGrid(p, sMap, sid)}
        <div class="row"><button class="btn ghost" style="flex:1" data-act="d-edit" data-cid="${esc(id)}" data-id="${esc(p.id)}">${ic("build")}Изменить</button><button class="btn" style="flex:1" data-act="np-open" data-cid="${esc(id)}">${ic("plus")}Следующая</button></div></div>`
      : `<div class="card">${emptyState("Программа не назначена", "Соберите программу с нуля или из шаблона.")}<button class="btn block" data-act="np-open" data-cid="${esc(id)}">${ic("plus")}Новая программа</button></div>`}
    ${np ? newProgramForm(id, data) : ""}
    <div class="card"><h4>Все программы</h4>${(data.programs || []).length ? data.programs.map(x => `<div class="rec"><span>${esc(x.title)}<small style="display:block;color:var(--ink-3)">${x.weeks} нед.${x.startDate ? " · старт " + esc(dshort(x.startDate)) : ""}</small></span>
        <span class="row" style="gap:6px">${x.id === c.active ? `<span class="tag c-g"><i></i>текущая</span>` : `<button class="mini-btn" data-act="p-activate" data-cid="${esc(id)}" data-id="${esc(x.id)}">Сделать текущей</button>`}<button class="mini-btn" data-act="d-edit" data-cid="${esc(id)}" data-id="${esc(x.id)}">${ic("build")}</button></span></div>`).join("") : `<div class="small muted">Пока нет</div>`}</div>
    <div class="card"><h4>Тело</h4>${lastM ? `<div class="kv"><span>Дата</span><b>${esc(dshort(lastM.date))}</b>${[["weight", "Вес", "кг"], ["fat", "Жир", "%"], ["muscle", "Мышцы", "%"], ["bone", "Кости", "%"], ["waist", "Талия", "см"], ["hips", "Ягодицы", "см"], ["chest", "Грудь", "см"]].filter(([k]) => lastM[k] != null).map(([k, l, u]) => `<span>${l}</span><b>${fnum(lastM[k])} ${u}</b>`).join("")}</div>
      <div class="chart" style="margin-top:8px">${sparkline(ms.map(m => ({x:dshort(m.date), y:m.weight})), "кг")}</div>` : `<div class="small muted">Замеров пока нет</div>`}</div>
    <div class="card"><h4>Последние тренировки</h4>${recent.length ? recent.map(s => { const sets = (s.sets || []).filter(x => !x.skipped), ton = sets.reduce((a, x) => a + (x.weightKg || 0) * (x.reps || 0), 0);
      return `<div class="rec"><span>${esc(dshort(s.startedAt))} · ${esc(s.workout)} · Н${s.week}<small style="display:block;color:var(--ink-3)">${esc(s.program)}</small></span><b>${{done:"✓", skipped:"пропуск", in_progress:"идёт"}[s.status] || ""} ${sets.length} подх.${ton ? " · " + fnum(ton) + " кг" : ""}</b></div>`; }).join("") : `<div class="small muted">Пока нет</div>`}</div>
  </div>`;
}
function newProgramForm(id, data) {
  const np = U.np, tpls = D().templates || [];
  return `<div class="card stack"><h4>Новая программа</h4>
    <div class="chipset">${[["blank", "С нуля"], ["template", "Из шаблона"], ["copy", "Копия текущей"]].map(([m, l]) => `<button class="ch" data-act="np-mode" data-m="${m}" aria-pressed="${np.mode === m}" ${m === "copy" && !data.program ? "disabled" : ""} ${m === "template" && !tpls.length ? "disabled" : ""}>${l}</button>`).join("")}</div>
    ${np.mode === "template" ? `<label class="mf"><span>Шаблон</span><select class="fi" id="np-tpl">${tpls.map(t => `<option value="${esc(t.name)}" ${np.tpl === t.name ? "selected" : ""}>${esc(t.name)} · ${t.weeks} нед., ${t.workouts} трен.</option>`).join("")}</select></label>` : ""}
    <label class="mf"><span>Название</span><input class="fi" id="np-title" placeholder="Например: Сила, блок 3" value="${esc(np.title || "")}"></label>
    ${np.mode === "blank" ? `<div class="row"><label class="mf" style="flex:1"><span>Недель</span><input class="fi" id="np-weeks" type="number" min="1" max="12" value="${np.weeks || 4}"></label><label class="mf" style="flex:1"><span>Тренировок в неделю</span><input class="fi" id="np-wos" type="number" min="1" max="7" value="${np.wos || 3}"></label></div>` : ""}
    <label class="mf"><span>Старт</span><input class="fi" id="np-start" type="date" value="${esc(np.start || todayISO())}"></label>
    <div class="row"><button class="btn ghost" data-act="np-close">Отмена</button><button class="btn" style="flex:1" data-act="np-build" ${busy("template.get")}>${ic("build")}Открыть в конструкторе</button></div>
    <p class="small muted" style="margin:0">В таблицу подопечного программа попадёт, когда вы нажмёте «Сохранить» в конструкторе.</p></div>`;
}

/* ───────── Конструктор ───────── */
const pdp = () => U.pd && U.pd.program;
function dirty() { if (U.pd) { U.pd.dirty = true; savePd(); } }
function curWo() { const p = pdp(); if (!p) return null; return p.workouts.find(w => w.id === U.cwid) || p.workouts[0] || null; }
function findItem(p, itemId) {
  for (const w of p.workouts) for (const [si, s] of w.sections.entries()) { const i = s.items.findIndex(x => x.id === itemId); if (i >= 0) return {w, s, si, i, it:s.items[i]}; }
  return null;
}
function relabel(wo) {
  let n = 0;
  for (const s of wo.sections) {
    if (SIMPLE.includes(s.kind)) { s.items.forEach(it => { it.label = null; }); continue; }
    for (const g of groupsOf(s)) {
      n++;
      if (g.items.length > 1) g.items.forEach((it, k) => { it.label = n + LET[k % LET.length]; });
      else { const it = g.items[0]; it.label = String(n); if (it.mode !== "single") { it.mode = "single"; it.group = null; } }
    }
  }
}
const newSections = () => [{kind:"warmup", title:"Разминка", items:[]}, {kind:"main", title:"Основная часть", items:[]}, {kind:"cooldown", title:"Кардиозаминка", items:[]}];
function builder() {
  const pd = U.pd, p = pdp();
  if (!p) return `<div class="nav"><h3 class="d">Конструктор</h3></div>${emptyState("Нечего редактировать", "Откройте программу подопечного или создайте шаблон.")}
    <div class="stack"><a class="btn block" href="#clients">${ic("users")}К подопечным</a><button class="btn ghost block" data-act="t-new">${ic("copy")}Новый шаблон</button></div>`;
  const wo = curWo(), week = Math.min(Math.max(1, U.cweek || 1), p.weeks), showWeek = U.allWeeks ? 1 : week;
  const who = pd.kind === "template" ? "Шаблон" : ((D().clients || []).find(c => c.id === pd.clientId) || {}).name || "Подопечный";
  let body = "";
  if (wo) for (const [si, sc] of wo.sections.entries()) {
    body += `<div class="bsec"><div class="bsec-h">${secTag(sc.kind, sc.title)}<span class="small muted">${sc.items.length}</span></div>`;
    for (const g of groupsOf(sc)) {
      const items = g.items.map(it => builderItem(it, sc, showWeek)).join("");
      body += g.items.length > 1 ? `<div class="gframe"><div class="gh"><span>${g.mode === "alternate" ? "Чередование" : "Суперсет"} · ${g.items.map(i => esc(i.label || "")).join(" + ")}</span><button data-act="b-ungroup" data-g="${esc(g.key)}">Разъединить</button></div>${items}</div>` : items;
    }
    body += `<button class="addbtn" data-act="pick" data-mode="add" data-sec="${si}">${ic("plus")}Упражнение в блок</button></div>`;
  }
  const sel = (U.sel || []).filter(id => findItem(p, id));
  const selbar = sel.length ? `<div class="selbar"><div class="small">Выбрано: ${sel.length}. ${sel.length > 1 ? "Объединить в группу:" : "Выберите ещё одно упражнение из того же блока"}</div>
      <div class="row">${sel.length > 1 ? `<button class="pri" data-act="b-group" data-m="superset">Суперсет</button><button data-act="b-group" data-m="alternate">Чередование</button>` : ""}<button data-act="b-clear">Отмена</button></div></div>` : "";
  const saving = S.ui.busy === "program.save" || S.ui.busy === "template.save";
  const savebar = pd.kind === "template"
    ? `<div class="savebar">${pd.dirty ? `<span class="small">Есть несохранённые изменения</span>` : `<span class="small muted">Шаблон сохранён</span>`}<button class="btn" data-act="t-save" ${saving ? "disabled" : ""}>${ic("save")}${saving ? "Сохраняю…" : "Сохранить шаблон"}</button></div>`
    : `<div class="savebar">${pd.dirty ? `<label class="small row" style="gap:6px"><input type="checkbox" id="d-activate" ${pd.activate ? "checked" : ""}>сделать текущей</label>` : `<span class="small muted">Сохранено в таблицу</span>`}<button class="btn" data-act="d-save" ${saving || !pd.dirty ? "disabled" : ""}>${ic("save")}${saving ? "Сохраняю…" : "Сохранить в таблицу"}</button></div>`;
  return `<div class="nav"><h3 class="d">Конструктор</h3>${pd.kind === "client" ? `<button class="icon-btn" data-act="d-as-tpl" aria-label="Сохранить как шаблон" title="Сохранить как шаблон">${ic("copy")}</button>` : ""}<button class="icon-btn" data-act="d-close" aria-label="Закрыть">${ic("x")}</button></div>
    <div class="card" style="padding:12px 14px"><div class="eyebrow">${esc(who)}</div><input class="ttl" id="b-ptitle" value="${esc(p.title || "")}" placeholder="Название программы" aria-label="Название программы">
      <div class="row between" style="margin-top:8px"><span class="small muted">Недель в цикле</span><div class="stp"><button data-act="b-weeks" data-d="-1" aria-label="Меньше недель">−</button><b>${p.weeks}</b><button data-act="b-weeks" data-d="1" aria-label="Больше недель">+</button></div></div></div>
    ${U.asTpl ? `<div class="card inl" style="margin-top:10px"><label class="mf"><span>Название шаблона</span><input class="fi" id="tpl-name" value="${esc(p.title || "")}"></label><div class="row"><button class="btn ghost" data-act="d-as-tpl-x">Отмена</button><button class="btn" style="flex:1" data-act="d-as-tpl-go">${ic("copy")}Сохранить шаблон</button></div></div>` : ""}
    <div class="tabs-s" style="margin-top:12px">${p.workouts.map(w => `<button class="ch" aria-pressed="${wo && w.id === wo.id}" data-act="b-wo" data-wid="${esc(w.id)}">${esc(w.title.replace("Тренировка", "Тр."))}</button>`).join("")}<button class="ch" data-act="b-wo-add" aria-label="Добавить тренировку">${ic("plus")}</button></div>
    ${wo ? `<div class="row"><input class="fi" id="b-wtitle" value="${esc(wo.title)}" aria-label="Название тренировки"><button class="del ${U.confirm === "wo:" + wo.id ? "arm" : ""}" data-act="b-wo-del" aria-label="Удалить тренировку">${U.confirm === "wo:" + wo.id ? "Удалить?" : ic("trash")}</button></div>
    <div class="tabs-s" style="margin-top:10px"><button class="ch" aria-pressed="${!!U.allWeeks}" data-act="allweeks">Все недели</button>${Array.from({length:p.weeks}, (_, i) => `<button class="ch" aria-pressed="${!U.allWeeks && week === i + 1}" data-act="cweek" data-w="${i + 1}">Н${i + 1}</button>`).join("")}</div>
    <div class="small muted">${U.allWeeks ? "Показана неделя 1, правки — на все недели." : `Правки только для недели ${week}.`} Отметьте 2+ упражнения галочкой, чтобы объединить.</div>
    ${body}
    <div class="row wrapr" style="margin-top:12px;gap:6px"><span class="small muted">Добавить блок:</span>${["warmup", "main", "hypertrophy", "circuit", "cooldown"].map(k => `<button class="ch" data-act="b-sec-add" data-k="${k}">${SEC[k][1]}</button>`).join("")}</div>` : emptyState("Нет тренировок", "Добавьте первую кнопкой «+».")}
    <div style="height:${sel.length ? 130 : 70}px"></div>${selbar}${savebar}${U.pick ? pickerSheet() : ""}`;
}
function builderItem(it, sc, week) {
  const t = tFor(it, week), sel = (U.sel || []).includes(it.id), ex = exById().get(it.exId), simple = SIMPLE.includes(sc.kind);
  const big = t ? (t.sets && repsText(t) ? `${t.sets}<span class="x">×</span>${esc(repsText(t))}` : esc(repsText(t) || t.note || "—")) : "—";
  return `<div class="bitem ${sel ? "sel" : ""}">${simple ? `<span></span>` : `<button class="chk" data-act="b-sel" data-item="${esc(it.id)}" aria-pressed="${sel}" aria-label="Выбрать для группы">${ic("check")}</button>`}
    <a class="nm" href="#item/${esc(it.id)}"><b>${it.label ? `<span class="mono muted">${esc(it.label)}</span> ` : ""}${esc(it.title)}</b><small>${ex && ex.videoUrl ? "▶ видео · " : ""}${esc(subLine(t, it, sc.kind) || "нажмите, чтобы прописать")}</small></a>
    <span class="side"><a class="rxbig" href="#item/${esc(it.id)}" aria-label="Прописка">${big}</a>
    <span class="mv"><button data-act="b-move" data-item="${esc(it.id)}" data-d="-1" aria-label="Выше">${ic("up")}</button><button data-act="b-move" data-item="${esc(it.id)}" data-d="1" aria-label="Ниже">${ic("down")}</button></span></span></div>`;
}
function pickerSheet() {
  const list = (D().exercises || []).slice().sort((a, b) => a.name.localeCompare(b.name, "ru")).map(e =>
    `<button class="pk" data-act="pk-choose" data-ex="${esc(e.id)}" data-name="${esc(e.name.toLowerCase())}">${esc(e.name)}<small>${esc(e.muscle || "")}${e.videoUrl ? " ▶" : ""}</small></button>`).join("");
  return `<div class="scrim" data-act="pk-close"></div><div class="sheet" role="dialog" aria-label="Выбор упражнения"><div class="sh-h"><b>${U.pick.mode === "replace" ? "Заменить упражнение" : "Добавить упражнение"}</b><button class="icon-btn" data-act="pk-close" aria-label="Закрыть">${ic("x")}</button></div>
    <div style="padding:0 16px 8px"><input class="fi" id="pk-q" type="search" placeholder="Поиск по библиотеке" aria-label="Поиск по библиотеке" value="${esc(U.pickQ || "")}"></div>
    <div class="sh-l" id="pk-list"><button class="pk" data-act="pk-new" style="color:var(--accent);font-weight:600">${ic("plus")}Новое упражнение в библиотеку</button>${list}</div></div>`;
}

/* ───────── Прописка упражнения ───────── */
function item(itemId) {
  const p = pdp(), f = p && findItem(p, itemId);
  if (!f) return `<div class="nav"><a class="icon-btn" href="#builder" aria-label="Назад">${ic("back")}</a><h3>Прописка</h3></div>` + emptyState("Упражнение не найдено", "Откройте программу в конструкторе и выберите упражнение.");
  const {it, s} = f, ex = exById().get(it.exId);
  const wk = U.allWeeks ? 1 : Math.min(U.cweek || 1, p.weeks), t = tFor(it, wk) || {};
  const mode = t.toFailure ? "max" : t.durationSec && t.repsMin == null ? "time" : (t.repsMax != null && t.repsMax !== t.repsMin) ? "range" : "reps";
  const stp = (label, fld, val, unit) => `<div class="pbig"><span>${label}</span><div class="stp"><button data-act="it-step" data-f="${fld}" data-d="-1" aria-label="Меньше">−</button><b>${val == null ? "—" : val}${unit ? `<small> ${unit}</small>` : ""}</b><button data-act="it-step" data-f="${fld}" data-d="1" aria-label="Больше">+</button></div></div>`;
  const rest = restOf(it, s.kind);
  return `<div class="nav"><a class="icon-btn" href="#builder" aria-label="Назад">${ic("back")}</a><h3>${esc(it.title)}<small>${esc(f.w.title)} · ${esc(s.title || SEC[s.kind][1])}${it.label ? " · " + esc(it.label) : ""}</small></h3></div>
    <div class="row wrapr" style="gap:6px;margin-bottom:10px"><span class="tag">${ic("book")}${esc(ex ? ex.name : "нет в библиотеке")}</span><button class="mini-btn" data-act="pick" data-mode="replace" data-item="${esc(it.id)}">Заменить</button></div>
    <div class="tabs-s"><button class="ch" aria-pressed="${!!U.allWeeks}" data-act="allweeks">Все недели</button>${Array.from({length:p.weeks}, (_, i) => `<button class="ch" aria-pressed="${!U.allWeeks && wk === i + 1}" data-act="cweek" data-w="${i + 1}">Н${i + 1}</button>`).join("")}</div>
    <div class="stack">
      ${stp("ПОДХОДЫ", "sets", t.sets)}
      <div class="chipset">${[["reps", "Повторы"], ["range", "Диапазон"], ["max", "До отказа"], ["time", "Время"]].map(([m, l]) => `<button class="ch" data-act="it-mode" data-m="${m}" aria-pressed="${mode === m}">${l}</button>`).join("")}</div>
      ${mode === "reps" ? stp("ПОВТОРЫ", "reps", t.repsMin) : ""}
      ${mode === "range" ? stp("ОТ", "reps", t.repsMin) + stp("ДО", "repsMax", t.repsMax) : ""}
      ${mode === "time" ? stp("СЕКУНД", "dur", t.durationSec) : ""}
      ${stp("ЦЕЛЬ, КГ", "kg", t.weightKg != null ? fnum(t.weightKg) : null)}
      <div><h4>Усилие (RPE)</h4><div class="chipset">${["—", 6, 7, 7.5, 8, 8.5, 9, 10].map(v => `<button class="ch" data-act="it-rpe" data-v="${v}" aria-pressed="${(v === "—" && !t.rpeMin) || t.rpeMin === v}">${v === "—" ? "без RPE" : "@" + fnum(v)}</button>`).join("")}</div></div>
      <div><h4>Отдых после подхода</h4><div class="chipset">${[0, 30, 60, 90, 120, 180, 240].map(v => `<button class="ch" data-act="it-rest" data-v="${v}" aria-pressed="${rest === v}">${v ? (v >= 60 && v % 60 === 0 ? v / 60 + " мин" : v + " с") : "без отдыха"}</button>`).join("")}</div></div>
      <div class="chipset"><button class="ch" data-act="it-side" aria-pressed="${!!(t.perSide || it.perSide)}">На каждую сторону</button></div>
      <div><h4>Подсказка подопечному</h4><textarea class="fi" id="i-cues" placeholder="Например: лопатки сведены, пауза внизу 2 секунды">${esc(it.cues || "")}</textarea></div>
      <div class="card"><h4>По неделям</h4><div class="wgrid">${Array.from({length:p.weeks}, (_, i) => { const tt = tFor(it, i + 1);
        return `<button class="wcell" data-act="cweek" data-w="${i + 1}" data-cur="${!U.allWeeks && wk === i + 1 ? 1 : 0}"><b>Неделя ${i + 1}</b>${esc(tt ? fmtT(tt) : "—")}</button>`; }).join("")}</div>
        <div class="chipset" style="margin-top:10px"><button class="ch" data-act="it-copy">Неделю ${wk} на все</button><button class="ch" data-act="it-prog" data-k="reps">+1 повтор в неделю</button><button class="ch" data-act="it-prog" data-k="kg">+2,5 кг в неделю</button><button class="ch" data-act="it-prog" data-k="sets">+1 подход в неделю</button></div></div>
      <button class="del ${U.confirm === "it:" + it.id ? "arm" : ""}" style="justify-self:start;padding:10px 12px" data-act="it-del" data-item="${esc(it.id)}">${U.confirm === "it:" + it.id ? "Точно удалить?" : ic("trash") + " Убрать из тренировки"}</button>
    </div>${U.pick ? pickerSheet() : ""}`;
}
function normT(t) {
  for (const k of Object.keys(t)) if (t[k] === null || t[k] === undefined || t[k] === false || t[k] === "") delete t[k];
  delete t.history; delete t.note;
  return t;
}
function itemPatch(itemId, fn) {
  const p = pdp(), f = p && findItem(p, itemId); if (!f) return;
  const it = f.it; it.targets = it.targets || {};
  const only0 = it.targets["0"] && Object.keys(it.targets).length === 1;
  if (U.allWeeks && (only0 || !Object.keys(it.targets).length)) { const t = {...(it.targets["0"] || {})}; fn(t, it); it.targets = {"0":normT(t)}; dirty(); return; }
  if (only0) { const t0 = it.targets["0"]; it.targets = {}; for (let w = 1; w <= p.weeks; w++) it.targets[w] = {...t0}; }
  const weeks = U.allWeeks ? Array.from({length:p.weeks}, (_, i) => i + 1) : [Math.min(U.cweek || 1, p.weeks)];
  for (const w of weeks) { const t = {...(it.targets[w] || {})}; fn(t, it); it.targets[w] = normT(t); }
  dirty();
}

/* ───────── Шаблоны ───────── */
function templates() {
  const list = D().templates || [];
  const a = U.assign;
  return `<div class="nav"><h3 class="d">Шаблоны</h3><button class="btn" style="padding:9px 12px" data-act="t-new">${ic("plus")}Новый</button></div>
    <p class="small muted" style="margin-top:-4px">Собранная программа, которую можно выдать любому подопечному. Хранятся в мастер-таблице на листе «Шаблоны».</p>
    <div class="stack">${list.length ? list.map(t => `<div class="card"><div class="row between"><div><b>${esc(t.name)}</b><div class="small muted">${t.weeks} нед. · ${t.workouts} ${plural(t.workouts, "тренировка", "тренировки", "тренировок")} · ${t.items} ${plural(t.items, "упражнение", "упражнения", "упражнений")}</div></div>
        <button class="del ${U.confirm === "tpl:" + t.name ? "arm" : ""}" data-act="t-del" data-name="${esc(t.name)}" aria-label="Удалить шаблон">${U.confirm === "tpl:" + t.name ? "Удалить?" : ic("trash")}</button></div>
        <div class="row" style="margin-top:10px"><button class="btn ghost" style="flex:1" data-act="t-open" data-name="${esc(t.name)}">${ic("build")}Открыть</button><button class="btn" style="flex:1" data-act="t-assign" data-name="${esc(t.name)}">${ic("users")}Назначить</button></div>
        ${a && a.name === t.name ? `<div class="inl" style="margin-top:10px"><label class="mf"><span>Кому</span><select class="fi" id="as-client">${(D().clients || []).map(c => `<option value="${esc(c.id)}">${esc(c.name)}</option>`).join("")}</select></label>
          <label class="mf"><span>Название у подопечного</span><input class="fi" id="as-title" value="${esc(t.name)}"></label>
          <label class="mf"><span>Старт</span><input class="fi" id="as-start" type="date" value="${todayISO()}"></label>
          <label class="small row" style="gap:6px"><input type="checkbox" id="as-active" checked>сразу сделать текущей</label>
          <div class="row"><button class="btn ghost" data-act="t-assign-x">Отмена</button><button class="btn go" style="flex:1" data-act="t-assign-go" ${busy("template.assign")}>${S.ui.busy === "template.assign" ? "Записываю в таблицу…" : "Назначить"}</button></div></div>` : ""}</div>`).join("")
      : emptyState("Шаблонов пока нет", "Соберите программу в конструкторе и сохраните её как шаблон, или создайте новый шаблон.")}</div>`;
}

/* ───────── Библиотека ───────── */
function library() {
  const list = (D().exercises || []).slice().sort((a, b) => a.name.localeCompare(b.name, "ru"));
  const nVid = list.filter(e => e.videoUrl && e.videoStatus !== "broken").length;
  return `<div class="nav"><h3 class="d">Библиотека</h3><a class="btn" style="padding:9px 12px" href="#ex/new">${ic("plus")}Новое</a></div>
    <div class="small muted" style="margin-bottom:8px">${list.length} упражнений, видео у ${nVid}. Хранится в мастер-таблице на листе «Упражнения».</div>

    <input class="fi" id="lib-q" type="search" placeholder="Найти упражнение" aria-label="Поиск по библиотеке" style="margin-bottom:10px" value="${esc(U.libQ || "")}">
    <div id="lib-list">${list.map(e => { const st = e.videoStatus === "broken" ? "bad" : e.videoUrl ? "ok" : "";
      return `<a class="lib-item" href="#ex/${esc(e.id)}" data-name="${esc(e.name.toLowerCase())}"><span class="vic ${st}">${ic(st === "bad" ? "x" : e.videoUrl ? "play" : "video")}</span>
        <span><b>${esc(e.name)}</b><small>${esc([e.muscle, e.equipment].filter(Boolean).join(" · ") || "мышцы не указаны")}</small></span><span class="muted">${ic("back", "i flip")}</span></a>`; }).join("")}</div>`;
}
function exEdit(id) {
  const cur = id && id !== "new" ? exById().get(id) : null;
  if (!U.lib || U.lib.forId !== (id || "new")) U.lib = cur ? {forId:id, ...cur} : {forId:"new", name:U.pickQ || "", type:"weight"};
  const d = U.lib;
  const chips = (f, list) => list.map(v => `<button class="ch" data-act="lib-chip" data-f="${f}" data-v="${esc(v)}" aria-pressed="${d[f] === v}">${esc(v)}</button>`).join("");
  return `<div class="nav"><a class="icon-btn" href="${U.pickBack ? "#builder" : "#library"}" aria-label="Назад">${ic("back")}</a><h3>${cur ? "Упражнение" : "Новое упражнение"}</h3></div>
    <div class="stack">
      <input class="fi" id="lf-name" value="${esc(d.name || "")}" placeholder="Название, например «Тяга Т-грифа»" aria-label="Название упражнения">
      <div><h4>Видео</h4>${cur && cur.videoUrl ? videoBlock(cur) : ""}
        <input class="fi" id="lf-url" style="margin-top:8px" value="${esc(d.videoUrl || "")}" placeholder="Ссылка на видео на Яндекс Диске" aria-label="Ссылка на видео">
        <p class="small muted" style="margin:6px 0 0">Ссылка на файл .mp4 будет играть прямо в приложении. Остальные ссылки откроются в браузере.</p></div>
      <div><h4>Мышцы</h4><div class="chipset">${chips("muscle", MUSCLES)}</div></div>
      <div><h4>Оборудование</h4><div class="chipset">${chips("equipment", EQUIP)}</div></div>
      <div><h4>Что записывает подопечный</h4><div class="chipset">${TYPES.map(([v, l]) => `<button class="ch" data-act="lib-chip" data-f="type" data-v="${v}" aria-pressed="${(d.type || "weight") === v}">${l}</button>`).join("")}</div></div>
      <div><h4>Техника</h4><textarea class="fi" id="lf-cues" placeholder="Ключевые подсказки через запятую">${esc(d.cues || "")}</textarea></div>
      <button class="btn huge block" data-act="lib-save" ${busy("exercise.save")}>${S.ui.busy === "exercise.save" ? "Сохраняю…" : cur ? "Сохранить" : "Добавить в библиотеку"}</button>
    </div>`;
}

export const SCREENS = {clients, client, builder, item, templates, library, ex:exEdit};

/* ───────── действия ───────── */
function startDraft(pd) { U.pd = pd; U.cwid = pd.program.workouts[0] && pd.program.workouts[0].id; U.cweek = 1; U.allWeeks = true; U.sel = []; U.pick = null; U.asTpl = false; savePd(); location.hash = "#builder"; }
function freshIds(p) { p.workouts.forEach(w => w.sections.forEach(s => s.items.forEach(it => { it.id = uid("i"); Object.values(it.targets || {}).forEach(t => { delete t.history; }); }))); return p; }
async function buildNew() {
  const np = U.np, data = cc(np.clientId);
  const title = (document.getElementById("np-title") || {}).value || "", start = (document.getElementById("np-start") || {}).value || todayISO();
  if (!title.trim()) { toast("Назовите программу"); return; }
  if (((data && data.programs) || []).some(x => x.id === title.trim())) { toast("Программа с таким названием уже есть"); return; }
  let program;
  if (np.mode === "template") {
    const name = (document.getElementById("np-tpl") || {}).value;
    try { program = freshIds(await act("template.get", {name})); } catch (e) { return; }
  } else if (np.mode === "copy") program = freshIds(clone(data.program));
  else {
    const weeks = Math.min(12, Math.max(1, +(document.getElementById("np-weeks") || {}).value || 4)), wos = Math.min(7, Math.max(1, +(document.getElementById("np-wos") || {}).value || 3));
    program = {weeks, notes:[], workouts:Array.from({length:wos}, (_, i) => ({id:"Тренировка " + (i + 1), title:"Тренировка " + (i + 1), sections:newSections()}))};
  }
  program.id = null; program.title = title.trim(); program.startDate = start; program.status = "";
  U.np = null;
  startDraft({kind:"client", clientId:np.clientId, oldId:null, program, dirty:true, activate:true});
}
async function saveDraft() {
  const pd = U.pd; if (!pd) return;
  const p = pdp(); p.title = String(p.title || "").trim();
  if (!p.title) { toast("Назовите программу"); return; }
  const el = document.getElementById("d-activate"); if (el) pd.activate = el.checked;
  try {
    const res = await act("program.save", {clientId:pd.clientId, program:p, oldId:pd.oldId, activate:!!pd.activate}, "Сохранено в таблицу подопечного");
    U.pd = {...pd, oldId:res.program.id, program:res.program, dirty:false, activate:false};
    U.cwid = (res.program.workouts.find(w => w.title === (curWo() || {}).title) || res.program.workouts[0] || {}).id;
    putClientSummary(res.client); savePd();
    loadClient(pd.clientId, true);
    refreshCoach();
  } catch (e) { /* показано */ }
}
async function saveTemplate(name) {
  const pd = U.pd; if (!pd) return;
  const p = clone(pdp()); p.title = String(name || p.title || "").trim();
  if (!p.title) { toast("Назовите шаблон"); return; }
  try {
    const res = await act("template.save", {program:p, oldName:pd.kind === "template" ? pd.oldName : null}, "Шаблон сохранён");
    S.data.templates = res.templates;
    if (pd.kind === "template") { pd.oldName = res.name; pd.program.title = res.name; pd.dirty = false; savePd(); }
    U.asTpl = false;
  } catch (e) { /* показано */ }
}
function ensureUniqueTitle(p, title, exceptId) {
  let t = title, n = 2;
  while (p.workouts.some(w => w.title === t && w.id !== exceptId)) t = title + " (" + (n++) + ")";
  return t;
}
async function saveExercise() {
  const d = U.lib; if (!d) return;
  const name = (document.getElementById("lf-name") || {}).value.trim();
  if (!name) { toast("Впишите название упражнения"); return; }
  const ex = {id:d.forId !== "new" ? d.forId : null, name, muscle:d.muscle || null, equipment:d.equipment || null, type:d.type || "weight",
    videoUrl:((document.getElementById("lf-url") || {}).value || "").trim() || null, cues:((document.getElementById("lf-cues") || {}).value || "").trim() || null};
  try {
    const saved = await act("exercise.save", {exercise:ex}, ex.id ? "Упражнение сохранено" : "Упражнение добавлено в библиотеку");
    const list = D().exercises || [], i = list.findIndex(e => e.id === saved.id);
    if (i >= 0) list[i] = {...list[i], ...saved}; else list.push(saved);
    S.data.exercises = list.slice();
    U.lib = null;
    if (U.pickBack) { const back = U.pickBack; U.pickBack = null; addOrReplace(back, saved); location.hash = back.mode === "add" ? "#builder" : "#item/" + back.item; }
    else location.hash = "#library";
  } catch (e) { /* показано */ }
}
function addOrReplace(pk, ex) {
  const p = pdp(), wo = curWo(); if (!p || !wo) return;
  if (pk.mode === "add") {
    const sec = wo.sections[pk.sec]; if (!sec) return;
    const simple = SIMPLE.includes(sec.kind), id = uid("i");
    sec.items.push({id, label:null, group:null, mode:"single", title:ex.name, cues:null, perSide:false, exId:ex.id, restSec:null,
      targets:{"0":simple ? {repsMin:10, repsMax:10} : {sets:3, repsMin:10, repsMax:10}}});
    relabel(wo); toast("Добавлено: " + ex.name);
  } else { const f = findItem(p, pk.item); if (f) { f.it.exId = ex.id; f.it.title = ex.name; toast("Заменено на " + ex.name); } }
  dirty();
}

export const ACTIONS = {
  "notif-read":async () => { try { const r = await act("notifications.read"); S.data.notifications = r.notifications; } catch (e) { /* */ } },
  "c-add":async () => {
    const name = (document.getElementById("c-name") || {}).value.trim(), contact = (document.getElementById("c-contact") || {}).value.trim();
    if (!name) { toast("Впишите имя"); return; }
    try { const c = await act("client.add", {name, contact}, "Подопечный добавлен, таблица создана"); putClientSummary(c); U.newClient = c; } catch (e) { /* */ }
  },
  "c-refresh":d => loadClient(d.cid, true),
  "np-open":d => { U.np = {clientId:d.cid, mode:(D().templates || []).length ? "template" : "blank"}; if (location.hash !== "#client/" + d.cid) location.hash = "#client/" + d.cid; },
  "np-mode":d => { if (U.np) { U.np.title = (document.getElementById("np-title") || {}).value || U.np.title; U.np.mode = d.m; } },
  "np-close":() => { U.np = null; },
  "np-build":buildNew,
  "p-activate":async d => { try { const c = await act("program.activate", {clientId:d.cid, id:d.id}, "Программа стала текущей"); putClientSummary(c); loadClient(d.cid, true); } catch (e) { /* */ } },
  "d-edit":async d => {
    if (U.pd && U.pd.dirty && !(U.pd.kind === "client" && U.pd.clientId === d.cid && U.pd.oldId === d.id)) { if (U.confirm !== "drop") { U.confirm = "drop"; toast("В конструкторе есть несохранённые изменения. Нажмите ещё раз, чтобы открыть другую программу"); return; } }
    U.confirm = null;
    if (U.pd && U.pd.kind === "client" && U.pd.clientId === d.cid && U.pd.oldId === d.id) { location.hash = "#builder"; return; }
    try { const p = await act("program.get", {clientId:d.cid, id:d.id}); startDraft({kind:"client", clientId:d.cid, oldId:p.id, program:p, dirty:false, activate:false}); } catch (e) { /* */ }
  },
  "d-close":() => { if (U.pd && U.pd.dirty && U.confirm !== "close") { U.confirm = "close"; toast("Есть несохранённые изменения. Нажмите ещё раз, чтобы закрыть без сохранения"); return; } U.confirm = null; U.pd = null; savePd(); },
  "d-save":saveDraft,
  "d-as-tpl":() => { U.asTpl = true; },
  "d-as-tpl-x":() => { U.asTpl = false; },
  "d-as-tpl-go":() => saveTemplate((document.getElementById("tpl-name") || {}).value),
  "t-new":() => startDraft({kind:"template", oldName:null, program:{id:null, title:"Новый шаблон", weeks:4, notes:[], workouts:[1, 2, 3].map(i => ({id:"Тренировка " + i, title:"Тренировка " + i, sections:newSections()}))}, dirty:true}),
  "t-open":async d => { try { const p = await act("template.get", {name:d.name}); startDraft({kind:"template", oldName:d.name, program:p, dirty:false}); } catch (e) { /* */ } },
  "t-save":() => saveTemplate(pdp() && pdp().title),
  "t-del":async d => { if (U.confirm !== "tpl:" + d.name) { U.confirm = "tpl:" + d.name; return; } U.confirm = null; try { const r = await act("template.delete", {name:d.name}, "Шаблон удалён"); S.data.templates = r.templates; } catch (e) { /* */ } },
  "t-assign":d => { U.assign = {name:d.name}; },
  "t-assign-x":() => { U.assign = null; },
  "t-assign-go":async () => {
    const a = U.assign; if (!a) return;
    const clientId = document.getElementById("as-client").value, title = document.getElementById("as-title").value.trim(), startDate = document.getElementById("as-start").value, activate = document.getElementById("as-active").checked;
    try { const r = await act("template.assign", {name:a.name, clientId, title, startDate, activate}, "Программа записана в таблицу подопечного"); putClientSummary(r.client); U.assign = null; if (cc(clientId)) loadClient(clientId, true); refreshCoach(); } catch (e) { /* */ }
  },
  /* конструктор */
  "b-wo":d => { U.cwid = d.wid; U.sel = []; },
  "b-wo-add":() => { const p = pdp(); if (!p) return; const title = ensureUniqueTitle(p, "Тренировка " + (p.workouts.length + 1)); const w = {id:uid("w"), title, sections:newSections()}; p.workouts.push(w); U.cwid = w.id; dirty(); },
  "b-wo-del":() => { const p = pdp(), wo = curWo(); if (!p || !wo) return; if (U.confirm !== "wo:" + wo.id) { U.confirm = "wo:" + wo.id; return; } U.confirm = null;
    if (p.workouts.length < 2) { toast("В программе должна остаться хотя бы одна тренировка"); return; } p.workouts = p.workouts.filter(w => w !== wo); U.cwid = p.workouts[0].id; dirty(); },
  "b-weeks":d => { const p = pdp(); if (!p) return; p.weeks = Math.min(12, Math.max(1, p.weeks + +d.d)); dirty(); },
  "allweeks":() => { U.allWeeks = true; },
  "cweek":d => { U.allWeeks = false; U.cweek = +d.w; },
  "b-sel":d => { U.sel = U.sel || []; const i = U.sel.indexOf(d.item); if (i >= 0) { U.sel.splice(i, 1); return; }
    const p = pdp(), f = findItem(p, d.item), f0 = U.sel[0] && findItem(p, U.sel[0]);
    if (f0 && f && (f0.si !== f.si || f0.w !== f.w)) { toast("Объединять можно упражнения одного блока"); return; } U.sel.push(d.item); },
  "b-clear":() => { U.sel = []; },
  "b-group":d => { const p = pdp(), ids = [...(U.sel || [])], f = findItem(p, ids[0]); if (!f) return; const s = f.s, key = uid("g");
    const picked = s.items.filter(it => ids.includes(it.id)); if (picked.length < 2) return;
    const at = s.items.findIndex(it => ids.includes(it.id)), rest = s.items.filter(it => !ids.includes(it.id));
    picked.forEach(it => { it.group = key; it.mode = d.m; }); rest.splice(at, 0, ...picked); s.items = rest; relabel(f.w); U.sel = []; dirty();
    toast(d.m === "superset" ? "Объединено в суперсет" : "Объединено: чередование"); },
  "b-ungroup":d => { const wo = curWo(); if (!wo) return; wo.sections.forEach(s => s.items.forEach(it => { if (it.group === d.g) { it.group = null; it.mode = "single"; } })); relabel(wo); dirty(); },
  "b-move":d => { const p = pdp(), f = findItem(p, d.item); if (!f) return; const j = f.i + +d.d; if (j < 0 || j >= f.s.items.length) return;
    [f.s.items[f.i], f.s.items[j]] = [f.s.items[j], f.s.items[f.i]]; relabel(f.w); dirty(); },
  "b-sec-add":d => { const wo = curWo(); if (!wo) return; const order = ["warmup", "circuit", "main", "hypertrophy", "intervals", "cooldown"];
    const sec = {kind:d.k, title:SEC[d.k][1], items:[]}; const at = wo.sections.findIndex(s => order.indexOf(s.kind) > order.indexOf(d.k));
    if (at < 0) wo.sections.push(sec); else wo.sections.splice(at, 0, sec); dirty(); },
  "pick":d => { U.pick = {mode:d.mode, sec:d.sec != null ? +d.sec : null, item:d.item || null}; U.pickQ = ""; setTimeout(() => { const q = document.getElementById("pk-q"); if (q) q.focus(); }, 60); },
  "pk-close":() => { U.pick = null; },
  "pk-choose":d => { const pk = U.pick; U.pick = null; const ex = exById().get(d.ex); if (pk && ex) addOrReplace(pk, ex); },
  "pk-new":() => { U.pickBack = U.pick; U.pick = null; U.lib = null; location.hash = "#ex/new"; },
  /* прописка */
  "it-step":(d, el) => { const itemId = location.hash.split("/")[1]; itemPatch(decodeURIComponent(itemId), t => { const dd = +d.d;
    if (d.f === "sets") t.sets = Math.max(1, Math.min(12, (t.sets || 0) + dd));
    if (d.f === "reps") { const wasRange = t.repsMin != null && t.repsMax != null && t.repsMax > t.repsMin; t.repsMin = Math.max(1, (t.repsMin || 0) + dd);
      if (!wasRange) t.repsMax = t.repsMin; else if (t.repsMax <= t.repsMin) t.repsMax = t.repsMin + 1; delete t.toFailure; delete t.durationSec; }
    if (d.f === "repsMax") t.repsMax = Math.max((t.repsMin || 1) + 1, (t.repsMax || t.repsMin || 1) + dd);
    if (d.f === "dur") t.durationSec = Math.max(5, (t.durationSec || 0) + dd * 5);
    if (d.f === "kg") { const v = Math.max(0, (t.weightKg || 0) + dd * 2.5); if (v) t.weightKg = v; else delete t.weightKg; } }); },
  "it-mode":d => itemPatch(curItemId(), t => { const base = t.repsMin || 10; delete t.toFailure; delete t.durationSec;
    if (d.m === "reps") { t.repsMin = t.repsMax = base; }
    if (d.m === "range") { t.repsMin = base; t.repsMax = Math.max(base + 2, t.repsMax || 0); }
    if (d.m === "max") { delete t.repsMin; delete t.repsMax; t.toFailure = true; }
    if (d.m === "time") { delete t.repsMin; delete t.repsMax; t.durationSec = 30; } }),
  "it-rpe":d => itemPatch(curItemId(), t => { if (d.v === "—") { delete t.rpeMin; delete t.rpeMax; } else { t.rpeMin = t.rpeMax = +d.v; } }),
  "it-side":() => itemPatch(curItemId(), (t, it) => { const v = !(t.perSide || it.perSide); t.perSide = v; it.perSide = v; }),
  "it-rest":d => { const f = findItem(pdp(), curItemId()); if (f) { f.it.restSec = +d.v; dirty(); } },
  "it-copy":() => { const p = pdp(), f = findItem(p, curItemId()); if (!f) return; const src = U.allWeeks ? 1 : U.cweek; const t = clone(tFor(f.it, src) || {});
    f.it.targets = {}; for (let w = 1; w <= p.weeks; w++) f.it.targets[w] = {...t}; dirty(); toast(`Неделя ${src} скопирована на все`); },
  "it-prog":d => { const p = pdp(), f = findItem(p, curItemId()); if (!f) return; const src = U.allWeeks ? 1 : U.cweek, base = clone(tFor(f.it, src) || {});
    if (d.k === "kg" && !base.weightKg) { toast("Сначала задайте целевой вес"); return; }
    const T = {};
    for (let w = 1; w <= p.weeks; w++) { if (w < src) { T[w] = clone(tFor(f.it, w) || base); continue; } const t = clone(base), k = w - src;
      if (d.k === "reps" && t.repsMin != null) { const span = (t.repsMax || t.repsMin) - t.repsMin; t.repsMin += k; t.repsMax = t.repsMin + span; }
      if (d.k === "kg") t.weightKg = Math.round((t.weightKg + 2.5 * k) * 100) / 100;
      if (d.k === "sets") t.sets = Math.min(12, (t.sets || 1) + k);
      T[w] = normT(t); }
    f.it.targets = T; U.allWeeks = false; U.cweek = src; dirty(); toast({reps:"Прогрессия: +1 повтор в неделю", kg:"Прогрессия: +2,5 кг в неделю", sets:"Прогрессия: +1 подход в неделю"}[d.k]); },
  "it-del":d => { if (U.confirm !== "it:" + d.item) { U.confirm = "it:" + d.item; return; } U.confirm = null; const p = pdp(), f = findItem(p, d.item); if (!f) return; f.s.items.splice(f.i, 1); relabel(f.w); dirty(); location.hash = "#builder"; },
  /* библиотека */
  "lib-chip":d => { if (!U.lib) return; const n = document.getElementById("lf-name"), u = document.getElementById("lf-url"), c = document.getElementById("lf-cues");
    if (n) U.lib.name = n.value; if (u) U.lib.videoUrl = u.value; if (c) U.lib.cues = c.value; U.lib[d.f] = U.lib[d.f] === d.v && d.f !== "type" ? null : d.v; },
  "lib-save":saveExercise
};
function curItemId() { return decodeURIComponent(location.hash.split("/")[1] || ""); }

export function onInput(el) {
  if (el.id === "pk-q") { U.pickQ = el.value; filter("#pk-list", el.value); return true; }
  if (el.id === "lib-q") { U.libQ = el.value; filter("#lib-list", el.value); return true; }
  if (U.lib && el.id === "lf-name") { U.lib.name = el.value; return true; }
  if (U.lib && el.id === "lf-url") { U.lib.videoUrl = el.value; return true; }
  if (U.lib && el.id === "lf-cues") { U.lib.cues = el.value; return true; }
  return false;
}
export function onChange(el) {
  const p = pdp();
  if (el.id === "b-ptitle" && p) { p.title = el.value.trim(); dirty(); return true; }
  if (el.id === "b-wtitle" && p) { const wo = curWo(); if (wo && el.value.trim()) { wo.title = ensureUniqueTitle(p, el.value.trim(), wo.id); dirty(); } return true; }
  if (el.id === "i-cues" && p) { const f = findItem(p, curItemId()); if (f) { f.it.cues = el.value.trim() || null; dirty(); } return true; }
  if (el.id === "d-activate" && U.pd) { U.pd.activate = el.checked; savePd(); return true; }
  return false;
}
function filter(sel, q) { q = String(q).trim().toLowerCase(); document.querySelectorAll(`${sel} [data-name]`).forEach(el => { el.hidden = !!q && !el.dataset.name.includes(q); }); }
export function afterRender() {
  if (U.pickQ) filter("#pk-list", U.pickQ);
  if (U.libQ) filter("#lib-list", U.libQ);
}
