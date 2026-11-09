// Железяка — Code.gs. Файл собран автоматически (tools/build_backend.py): не правьте его вручную,
// меняйте app/js/shared.js и backend/server.js.

// Прописка упражнения: объект <-> текст ячейки Google-таблицы.
// Этот файл общий: tools/build_backend.py вставляет его в backend/Code.gs (без слов export).
//
// Объект прописки (target): {sets, repsMin, repsMax, repsPlus, toFailure, perSide, durationSec, distanceM,
//   speedKmh, workSec, restSec, roundsMin, roundsMax, weightKg, rpeMin, rpeMax, history}
// Текст в ячейке: "5×6 90кг @7-7,5", "3×10-12", "3×макс на сторону", "40 с", "5 мин 5,5 км/ч",
//   "20с/40с ×5-8", "4×10 (было: 90/100/90)".

const SECTION_TITLES = {warmup:"Разминка", circuit:"Круг", main:"Основная часть", hypertrophy:"Гипертрофия", cooldown:"Кардиозаминка", intervals:"Интервалы"};
const SECTION_BY_TITLE = {"разминка":"warmup", "круг":"circuit", "основная часть":"main", "основная":"main", "гипертрофия":"hypertrophy", "кардиозаминка":"cooldown", "заминка":"cooldown", "интервалы":"intervals"};

function sectionKind(title) {
  const s = String(title || "").toLowerCase();
  if (SECTION_BY_TITLE[s]) return SECTION_BY_TITLE[s];
  if (s.indexOf("интервал") === 0) return "intervals";
  if (s.indexOf("разминк") >= 0) return "warmup";
  if (s.indexOf("круг") === 0) return "circuit";
  if (s.indexOf("гипертроф") >= 0) return "hypertrophy";
  if (s.indexOf("заминк") >= 0 || s.indexOf("кардио") === 0) return "cooldown";
  return "main";
}

function numRu(n) {
  return String(Math.round(n * 100) / 100).replace(".", ",");
}

function repsText(t) {
  if (!t) return "";
  if (t.toFailure) return "макс";
  if (t.repsMin != null) {
    const r = (t.repsMax == null || t.repsMax === t.repsMin) ? String(t.repsMin) : t.repsMin + "–" + t.repsMax;
    return r + (t.repsPlus ? "+" : "");
  }
  if (t.durationSec) return t.durationSec >= 60 && t.durationSec % 60 === 0 ? (t.durationSec / 60) + " мин" : t.durationSec + " с";
  if (t.distanceM) return t.distanceM + " м";
  if (t.workSec) return t.workSec + "/" + (t.restSec || 0) + " с";
  return "";
}

function formatRx(t) {
  if (!t) return "";
  if (t.note && Object.keys(t).length === 1) return t.note;
  const out = [];
  if (t.workSec) {
    const rounds = t.roundsMin ? " ×" + (t.roundsMax && t.roundsMax !== t.roundsMin ? t.roundsMin + "-" + t.roundsMax : t.roundsMin) : "";
    out.push(t.workSec + "с/" + (t.restSec || 0) + "с" + rounds);
  } else {
    let reps = "";
    if (t.toFailure) reps = "макс";
    else if (t.repsMin != null) reps = (t.repsMax != null && t.repsMax !== t.repsMin ? t.repsMin + "-" + t.repsMax : String(t.repsMin)) + (t.repsPlus ? "+" : "");
    else if (t.durationSec) reps = t.durationSec >= 60 && t.durationSec % 60 === 0 ? (t.durationSec / 60) + " мин" : t.durationSec + " с";
    else if (t.distanceM) reps = t.distanceM + " м";
    if (t.sets && reps) out.push(t.sets + "×" + reps);
    else if (t.sets) out.push(t.sets + " подх.");
    else if (reps) out.push(reps);
  }
  if (t.speedKmh) out.push(numRu(t.speedKmh) + " км/ч");
  if (t.weightKg) out.push(numRu(t.weightKg) + "кг");
  if (t.rpeMin) out.push("@" + numRu(t.rpeMin) + (t.rpeMax && t.rpeMax !== t.rpeMin ? "-" + numRu(t.rpeMax) : ""));
  if (t.perSide) out.push("на сторону");
  if (t.history) out.push("(было: " + t.history + ")");
  return out.join(" ");
}

function parseRx(s) {
  const raw = String(s == null ? "" : s).trim();
  if (!raw || raw === "—" || raw === "-") return null;
  const t = {};
  let low = raw.toLowerCase().replace(/ё/g, "е");
  const hist = low.match(/\((?:было|в таблице)\s*:?\s*([^)]*)\)/);
  if (hist) { t.history = raw.slice(hist.index, hist.index + hist[0].length).replace(/^\((?:было|в таблице)\s*:?\s*/i, "").replace(/\)$/, "").trim(); low = low.replace(hist[0], " "); }
  low = low.replace(/подход[а-я]*|подх\.?/g, " SETS ").replace(/макс|мах|max/g, " MAX ").replace(/[x×х*]/g, "×");
  if (/сторон|к\.\s*[нср]\.?|кажд/.test(low)) { t.perSide = true; low = low.replace(/на\s+(каждую\s+)?сторону|\(?\s*к\.\s*[нср]\.?\s*\)?|на\s+каждую\s+\S+/g, " "); }
  const iv = low.match(/(\d+)\s*с?\s*\/\s*(\d+)\s*с\s*(?:×\s*(\d+)(?:\s*-\s*(\d+))?)?/);
  if (iv) {
    t.workSec = +iv[1]; t.restSec = +iv[2];
    if (iv[3]) { t.roundsMin = +iv[3]; t.roundsMax = +(iv[4] || iv[3]); }
    return t;
  }
  const sp = low.match(/(\d+(?:[.,]\d+)?)\s*км\s*\/\s*ч/); if (sp) { t.speedKmh = +sp[1].replace(",", "."); low = low.replace(sp[0], " "); }
  const kg = low.match(/(\d+(?:[.,]\d+)?)\s*кг/); if (kg) { t.weightKg = +kg[1].replace(",", "."); low = low.replace(kg[0], " "); }
  const rpe = low.match(/@\s*(\d+(?:[.,]\d+)?)(?:\s*[-–]\s*(\d+(?:[.,]\d+)?))?/);
  if (rpe) { t.rpeMin = +rpe[1].replace(",", "."); t.rpeMax = +(rpe[2] || rpe[1]).replace(",", "."); low = low.replace(rpe[0], " "); }
  let rest = low;
  const m = low.match(/^\s*(\d+)\s*[×/]\s*(.*)$/);
  if (m) { t.sets = +m[1]; rest = m[2]; }
  else { const m2 = low.match(/^\s*(\d+)\s*SETS/); if (m2) { t.sets = +m2[1]; rest = low.slice(m2[0].length); } }
  if (/MAX/.test(rest)) { t.toFailure = true; return t; }
  let r;
  if ((r = rest.match(/(\d+)\s*мин/))) t.durationSec = +r[1] * 60;
  else if ((r = rest.match(/(\d+)\s*(?:сек[а-я]*|с(?![а-я]))/))) t.durationSec = +r[1];
  else if ((r = rest.match(/(\d+)\s*(?:метр[а-я]*|м(?![а-я]))/))) t.distanceM = +r[1];
  else if ((r = rest.match(/(\d+)\s*\+\s*(\d+)/))) { t.repsMin = t.repsMax = +r[1]; t.perSide = true; }
  else if ((r = rest.match(/(\d+)\s*[-–]\s*(\d+)/))) { t.repsMin = Math.min(+r[1], +r[2]); t.repsMax = Math.max(+r[1], +r[2]); }
  else if ((r = rest.match(/(\d+)\s*\+/))) { t.repsMin = t.repsMax = +r[1]; t.repsPlus = true; }
  else if ((r = rest.match(/(\d+)/))) t.repsMin = t.repsMax = +r[1];
  return Object.keys(t).length ? t : {note:raw};
}

// ── Общая логика прогресса (используется и приложением, и сервером) ──

const MODE_RU = {single:"", superset:"суперсет", alternate:"чередование"};
const MODE_BY_RU = {"":"single", "суперсет":"superset", "чередование":"alternate"};

function sessionId(programId, workoutId, week) {
  return programId + "|" + workoutId + "|w" + week;
}

// sessions: массив {program, workout, week, status}
function programProgress(p, sessions) {
  if (!p) return {done:0, total:0, nextWeek:null, weeksLeft:0};
  const wos = (p.workouts || []).map(w => w.id);
  const total = (p.weeks || 0) * wos.length;
  const st = {};
  (sessions || []).forEach(s => { if (s.program === p.id) st[sessionId(p.id, s.workout, s.week)] = s.status; });
  let done = 0;
  Object.keys(st).forEach(k => { if (st[k] === "done" || st[k] === "skipped") done++; });
  let nextWeek = null;
  for (let w = 1; w <= (p.weeks || 0) && nextWeek == null; w++) {
    for (let i = 0; i < wos.length; i++) {
      const s = st[sessionId(p.id, wos[i], w)];
      if (s !== "done" && s !== "skipped") { nextWeek = w; break; }
    }
  }
  return {done, total, nextWeek, weeksLeft:nextWeek == null ? 0 : p.weeks - nextWeek + 1};
}


// ═══════════════════════════════════════════════════════════════════════
//  Железяка — сервер на Google Apps Script.
//  Данные живут в Google Таблицах:
//    • мастер-таблица тренера (к ней привязан этот скрипт): Подопечные, Упражнения, Шаблоны, Настройки, Уведомления;
//    • у каждого подопечного своя таблица: по листу на программу + Тренировки, Журнал, Замеры.
//  Установка — см. SETUP.md. Первый запуск: функция setup().
// ═══════════════════════════════════════════════════════════════════════

const VERSION = 1;
const SH = {CLIENTS:"Подопечные", EX:"Упражнения", TPL:"Шаблоны", SET:"Настройки", NOTE:"Уведомления", SESS:"Тренировки", LOG:"Журнал", BODY:"Замеры"};
const H = {
  CLIENTS:["id", "Имя", "Код входа", "Таблица", "Ссылка", "Текущая программа", "Старт программы", "Контакт", "Заметка", "Выполнено", "Всего", "Осталось недель", "Последняя тренировка", "Уведомлён"],
  EX:["id", "Название", "Мышцы", "Оборудование", "Учёт", "Видео", "Техника"],
  NOTE:["Дата", "Подопечный", "Программа", "Текст", "Прочитано"],
  SET:["Параметр", "Значение", "Пояснение"],
  SESS:["id", "Программа", "Неделя", "Тренировка", "Статус", "Начало", "Конец", "Подходов", "Тоннаж, кг", "Заметка"],
  LOG:["Дата", "Программа", "Неделя", "Тренировка", "№", "Упражнение", "Подход", "Вес, кг", "Без отягощения", "Повторы", "Время, с", "Пропущен", "Тренировка id", "Пункт id", "Упражнение id"],
  BODY:["Дата", "Вес, кг", "Жир, %", "Мышцы, %", "Кости, %", "Вода, %", "Шея", "Грудь", "Талия", "Живот", "Ягодицы", "Бедро", "Голень", "Плечо", "Предплечье", "Заметка"],
  PROG:["Пункт id", "Тренировка", "Блок", "№", "Группа", "Режим", "Упражнение id", "Упражнение", "Отдых, с", "Подсказка", "На сторону"],
  TPL_WEEKS:12
};
const BODY_KEYS = ["date", "weight", "fat", "muscle", "bone", "water", "neck", "chest", "waist", "belly", "hips", "thigh", "calf", "arm", "forearm", "note"];
const STATUS_RU = {in_progress:"в процессе", done:"выполнена", skipped:"пропущена"};
const STATUS_BY_RU = {"в процессе":"in_progress", "выполнена":"done", "пропущена":"skipped"};
const SET_KEYS = {coachCode:"Код тренера", coachName:"Имя тренера", email:"Email для уведомлений", tgToken:"Telegram: токен бота", tgChat:"Telegram: chat id", folder:"Папка для таблиц подопечных (id)"};

// ───────────────────────── вход в API ─────────────────────────

function doGet() { return json_({ok:true, app:"Железяка", version:VERSION}); }

function doPost(e) {
  let req;
  try { req = JSON.parse(e.postData.contents); } catch (err) { return json_({ok:false, error:"Неверный формат запроса"}); }
  try {
    const fn = ACTIONS[req.action];
    if (!fn) return json_({ok:false, error:"Неизвестное действие: " + req.action});
    const who = auth_(String(req.code || "").trim());
    if (!who) return json_({ok:false, error:"Неверный код входа", code:"auth"});
    const writes = WRITE_ACTIONS.indexOf(req.action) >= 0;
    const lock = writes ? LockService.getScriptLock() : null;
    if (lock) lock.waitLock(25000);
    try { return json_({ok:true, data:fn(req, who)}); }
    finally { if (lock) lock.releaseLock(); }
  } catch (err) {
    return json_({ok:false, error:String((err && err.message) || err), code:(err && err.code) || "error"});
  }
}

function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function fail_(msg, code) { const e = new Error(msg); e.code = code || "bad_request"; throw e; }
function coachOnly_(who) { if (who.role !== "coach") fail_("Это действие доступно только тренеру", "forbidden"); }
function ownClient_(who, clientId) {
  if (who.role === "coach") return clientId;
  if (clientId && clientId !== who.clientId) fail_("Нет доступа к чужим данным", "forbidden");
  return who.clientId;
}

const WRITE_ACTIONS = ["client.add", "client.update", "program.save", "program.activate", "template.save", "template.assign", "template.delete",
  "exercise.save", "session.save", "measure.add", "notifications.read", "import", "check"];

const ACTIONS = {
  ping:() => ({pong:true, version:VERSION}),
  login:(req, who) => ({role:who.role, name:who.name, clientId:who.clientId || null}),
  bootstrap:(req, who) => who.role === "coach" ? coachBoot_() : clientBoot_(who.clientId),
  "client.get":(req, who) => { coachOnly_(who); return clientFull_(req.clientId); },
  "client.add":(req, who) => { coachOnly_(who); return addClient_(req.name, req.contact); },
  "client.update":(req, who) => { coachOnly_(who); return updateClient_(req.clientId, req.patch || {}); },
  "program.get":(req, who) => { const cid = ownClient_(who, req.clientId); return readProgram_(programSheet_(clientSS_(cid), req.id)); },
  "program.save":(req, who) => { coachOnly_(who); return saveProgram_(req.clientId, req.program, req.oldId, req.activate); },
  "program.activate":(req, who) => { coachOnly_(who); return activateProgram_(req.clientId, req.id, req.startDate); },
  "template.get":(req, who) => { coachOnly_(who); return getTemplate_(req.name); },
  "template.save":(req, who) => { coachOnly_(who); return saveTemplate_(req.program, req.oldName); },
  "template.delete":(req, who) => { coachOnly_(who); return deleteTemplate_(req.name); },
  "template.assign":(req, who) => { coachOnly_(who); return assignTemplate_(req.name, req.clientId, req.title, req.startDate, req.activate); },
  "exercise.save":(req, who) => { coachOnly_(who); return saveExercise_(req.exercise); },
  "session.save":(req, who) => saveSession_(ownClient_(who, req.clientId), req.session),
  "measure.add":(req, who) => addMeasure_(ownClient_(who, req.clientId), req.measure),
  "notifications.read":(req, who) => { coachOnly_(who); return readNotifications_(); },
  "import":(req, who) => { coachOnly_(who); return importSeed_(req.seed); },
  "check":(req, who) => { coachOnly_(who); return checkAll_(); }
};

// ───────────────────────── таблицы и настройки ─────────────────────────

let MASTER_ = null, SETTINGS_ = null;
function master_() {
  if (MASTER_) return MASTER_;
  // скрипт привязан к таблице: в копии шаблона он сам работает со своей копией
  try { MASTER_ = SpreadsheetApp.getActiveSpreadsheet(); } catch (e) { MASTER_ = null; }
  if (!MASTER_) { const id = PropertiesService.getScriptProperties().getProperty("MASTER_ID"); if (id) MASTER_ = SpreadsheetApp.openById(id); }
  if (!MASTER_) fail_("Не найдена таблица тренера. Откройте её и выберите меню «Железяка → Настроить».", "setup");
  if (!MASTER_.getSheetByName(SH.SET)) fail_("Таблица ещё не настроена: откройте её и выберите меню «Железяка → Настроить».", "setup");
  return MASTER_;
}
function tz_() { return Session.getScriptTimeZone() || "Europe/Moscow"; }
function iso_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, tz_(), "yyyy-MM-dd'T'HH:mm:ss");
  return v === "" || v == null ? null : String(v);
}
function day_(v) { const s = iso_(v); return s ? s.slice(0, 10) : null; }
function toDate_(s) { if (!s) return ""; const d = new Date(s); return isNaN(d.getTime()) ? s : d; }

function sheet_(ss, name, head) {
  let sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    if (head) styleHead_(sh.getRange(1, 1, 1, head.length).setValues([head]), sh);
  }
  return sh;
}
function styleHead_(range, sh) {
  range.setFontWeight("bold").setBackground("#13161B").setFontColor("#FFFFFF");
  sh.setFrozenRows(1);
}
// Таблица → массив объектов {заголовок: значение, _row: номер строки}
function rows_(sh) {
  const v = sh.getDataRange().getValues();
  if (v.length < 1) return [];
  const head = v[0];
  const out = [];
  for (let i = 1; i < v.length; i++) {
    if (!v[i].some(c => c !== "" && c !== null)) continue;
    const o = {_row:i + 1};
    head.forEach((h, j) => { if (h) o[h] = v[i][j]; });
    out.push(o);
  }
  return out;
}
function writeAll_(sh, head, objs) {
  sh.clearContents();
  styleHead_(sh.getRange(1, 1, 1, head.length).setValues([head]), sh);
  if (objs.length) sh.getRange(2, 1, objs.length, head.length).setValues(objs.map(o => head.map(h => o[h] === undefined || o[h] === null ? "" : o[h])));
}
function settings_() {
  if (SETTINGS_) return SETTINGS_;
  const out = {};
  rows_(sheet_(master_(), SH.SET, H.SET)).forEach(r => { out[r["Параметр"]] = String(r["Значение"] === undefined ? "" : r["Значение"]).trim(); });
  SETTINGS_ = out;
  return out;
}
function setting_(key) { return settings_()[SET_KEYS[key]] || ""; }

function auth_(code) {
  if (!code) return null;
  if (code === setting_("coachCode")) return {role:"coach", name:setting_("coachName") || "Тренер"};
  const c = clients_().filter(x => String(x.code) === code)[0];
  return c ? {role:"client", clientId:c.id, name:c.name} : null;
}

// ───────────────────────── подопечные ─────────────────────────

function clients_() {
  return rows_(sheet_(master_(), SH.CLIENTS, H.CLIENTS)).map(r => ({
    _row:r._row, id:String(r["id"]), name:String(r["Имя"]), code:String(r["Код входа"]), sheetId:String(r["Таблица"]), url:String(r["Ссылка"] || ""),
    active:String(r["Текущая программа"] || ""), startDate:day_(r["Старт программы"]), contact:String(r["Контакт"] || ""), note:String(r["Заметка"] || ""),
    done:+r["Выполнено"] || 0, total:+r["Всего"] || 0, weeksLeft:r["Осталось недель"] === "" ? null : +r["Осталось недель"],
    last:iso_(r["Последняя тренировка"]), notified:String(r["Уведомлён"] || "")
  }));
}
function client_(id) { const c = clients_().filter(x => x.id === id)[0]; if (!c) fail_("Подопечный не найден", "not_found"); return c; }
function putClient_(c) {
  const sh = sheet_(master_(), SH.CLIENTS, H.CLIENTS);
  const row = [c.id, c.name, c.code, c.sheetId, c.url, c.active, toDate_(c.startDate), c.contact, c.note, c.done, c.total, c.weeksLeft == null ? "" : c.weeksLeft, toDate_(c.last), c.notified];
  if (c._row) sh.getRange(c._row, 1, 1, row.length).setValues([row]);
  else sh.appendRow(row);
}
function publicClient_(c) {
  return {id:c.id, name:c.name, code:c.code, url:c.url, active:c.active, startDate:c.startDate, contact:c.contact, note:c.note,
    done:c.done, total:c.total, weeksLeft:c.weeksLeft, last:c.last};
}
function newCode_() {
  const used = {}; clients_().forEach(c => { used[c.code] = 1; }); used[setting_("coachCode")] = 1;
  for (let i = 0; i < 200; i++) { const c = String(100000 + Math.floor(Math.random() * 900000)); if (!used[c]) return c; }
  fail_("Не удалось подобрать код");
}
function clientSS_(clientId) { return SpreadsheetApp.openById(client_(clientId).sheetId); }
function initClientSS_(ss) {
  const first = ss.getSheets()[0];
  if (!ss.getSheetByName(SH.SESS)) { first.setName(SH.SESS); first.clear(); styleHead_(first.getRange(1, 1, 1, H.SESS.length).setValues([H.SESS]), first); }
  sheet_(ss, SH.LOG, H.LOG);
  sheet_(ss, SH.BODY, H.BODY);
}
function addClient_(name, contact) {
  name = String(name || "").trim();
  if (!name) fail_("Укажите имя подопечного");
  const ss = SpreadsheetApp.create("Железяка — " + name);
  const folder = setting_("folder");
  if (folder) { try { DriveApp.getFileById(ss.getId()).moveTo(DriveApp.getFolderById(folder)); } catch (e) { /* папка недоступна — оставляем в корне */ } }
  initClientSS_(ss);
  const c = {id:"c-" + Utilities.getUuid().slice(0, 8), name, code:newCode_(), sheetId:ss.getId(), url:ss.getUrl(), active:"", startDate:null,
    contact:String(contact || ""), note:"", done:0, total:0, weeksLeft:null, last:null, notified:""};
  putClient_(c);
  return publicClient_(c);
}
function updateClient_(id, patch) {
  const c = client_(id);
  ["name", "contact", "note"].forEach(k => { if (patch[k] !== undefined) c[k] = String(patch[k]); });
  putClient_(c);
  return publicClient_(c);
}

// ───────────────────────── программы ─────────────────────────

function isProgramSheet_(sh) { return String(sh.getRange(1, 1).getDisplayValue()) === "Программа"; }
function programSheet_(ss, id) {
  const sh = ss.getSheetByName(id);
  if (!sh || !isProgramSheet_(sh)) fail_("Программа «" + id + "» не найдена", "not_found");
  return sh;
}
function programList_(ss) {
  return ss.getSheets().filter(isProgramSheet_).map(sh => {
    const m = sh.getRange(1, 1, 1, 8).getDisplayValues()[0];
    return {id:sh.getName(), title:m[1] || sh.getName(), weeks:+m[3] || 0, startDate:m[5] || null, status:m[7] || ""};
  });
}
function readProgram_(sh) {
  const v = sh.getDataRange().getDisplayValues();
  const meta = v[0] || [], head = v[1] || [];
  const ix = {}; head.forEach((h, i) => { ix[h] = i; });
  const weekCols = [];
  head.forEach((h, i) => { const m = /^Неделя (\d+)$/.exec(h); if (m) weekCols.push([+m[1], i]); });
  const p = {id:sh.getName(), title:meta[1] || sh.getName(), weeks:+meta[3] || weekCols.length, startDate:meta[5] || null, status:meta[7] || "", notes:[], workouts:[]};
  const cell = (r, name) => (ix[name] === undefined ? "" : String(r[ix[name]] || "").trim());
  for (let i = 2; i < v.length; i++) {
    const r = v[i];
    if (!r.some(c => String(c).trim())) continue;
    const block = cell(r, "Блок");
    if (block === "Примечание") { p.notes.push({kind:cell(r, "Подсказка") || "rule", text:cell(r, "Упражнение")}); continue; }
    const woTitle = cell(r, "Тренировка") || "Тренировка 1";
    let wo = p.workouts.filter(w => w.id === woTitle)[0];
    if (!wo) { wo = {id:woTitle, title:woTitle, sections:[]}; p.workouts.push(wo); }
    const kind = sectionKind(block);
    let sec = wo.sections[wo.sections.length - 1];
    if (!sec || sec.kind !== kind || sec.title !== (block || SECTION_TITLES[kind])) { sec = {kind, title:block || SECTION_TITLES[kind], items:[]}; wo.sections.push(sec); }
    const title = cell(r, "Упражнение");
    if (!title) continue;
    const it = {id:cell(r, "Пункт id") || sh.getName() + "-r" + (i + 1), label:cell(r, "№") || null, group:cell(r, "Группа") || null,
      mode:MODE_BY_RU[cell(r, "Режим").toLowerCase()] || "single", exId:cell(r, "Упражнение id") || null, title,
      restSec:cell(r, "Отдых, с") === "" ? null : +cell(r, "Отдых, с"), cues:cell(r, "Подсказка") || null, perSide:cell(r, "На сторону") === "да", targets:{}};
    weekCols.forEach(wc => { const t = parseRx(r[wc[1]]); if (t) it.targets[String(wc[0])] = t; });
    sec.items.push(it);
  }
  return p;
}
const BLOCK_COLORS = {warmup:"#FAEFCB", circuit:"#FAEFCB", main:"#FBE5E2", hypertrophy:"#E2E8FC", cooldown:"#DCF0E3", intervals:"#DCF0E3"};
function programRows_(p, base, extraFirst) {
  const W = Math.max(1, +p.weeks || 1);
  const rows = [], colors = [];
  (p.workouts || []).forEach(wo => {
    (wo.sections || []).forEach(s => {
      const block = s.title || SECTION_TITLES[s.kind] || "Основная часть";
      const items = s.items || [];
      if (!items.length) { rows.push(extraFirst.concat(["", wo.title, block, "", "", "", "", "", "", "", ""]).concat(new Array(W).fill(""))); colors.push(BLOCK_COLORS[s.kind] || "#FFFFFF"); }
      items.forEach(it => {
        const weeks = [];
        for (let w = 1; w <= W; w++) weeks.push(formatRx((it.targets || {})[String(w)] || (it.targets || {})["0"] || null));
        rows.push(extraFirst.concat([it.id || "", wo.title, block, it.label || "", it.group || "", MODE_RU[it.mode] || "", it.exId || "", it.title || "",
          it.restSec == null ? "" : it.restSec, it.cues || "", it.perSide ? "да" : ""]).concat(weeks));
        colors.push(BLOCK_COLORS[s.kind] || "#FFFFFF");
      });
    });
  });
  (p.notes || []).forEach(n => { rows.push(extraFirst.concat(["", "", "Примечание", "", "", "", "", n.text, "", n.kind || "rule", ""]).concat(new Array(W).fill(""))); colors.push("#F3F5F8"); });
  return {rows, colors, W};
}
function writeProgram_(ss, p, oldId) {
  const title = String(p.title || "").trim().replace(/[\[\]\*\?\/\\:]/g, "-").slice(0, 90);
  if (!title) fail_("У программы нет названия");
  if ([SH.SESS, SH.LOG, SH.BODY].indexOf(title) >= 0) fail_("Это название занято служебным листом");
  let sh = oldId ? ss.getSheetByName(oldId) : null;
  const clash = ss.getSheetByName(title);
  if (clash && (!sh || clash.getSheetId() !== sh.getSheetId())) {
    if (!sh && !isProgramSheet_(clash)) fail_("Лист «" + title + "» уже есть в таблице");
    if (sh) fail_("Программа «" + title + "» уже есть у этого подопечного");
    sh = clash;
  }
  if (!sh) sh = ss.insertSheet(title, ss.getSheets().length);
  if (sh.getName() !== title) sh.setName(title);
  const built = programRows_(p, H.PROG, []);
  const head = H.PROG.concat(Array.from({length:built.W}, (_, i) => "Неделя " + (i + 1)));
  const meta = ["Программа", title, "Недель", String(built.W), "Старт", p.startDate || "", "Статус", p.status || ""];
  while (meta.length < head.length) meta.push("");
  const all = [meta.slice(0, Math.max(head.length, 8)), head.concat(new Array(Math.max(0, 8 - head.length)).fill(""))].concat(built.rows.map(r => r.concat(new Array(Math.max(0, 8 - r.length)).fill(""))));
  const width = Math.max(head.length, 8);
  sh.clear();
  const rng = sh.getRange(1, 1, all.length, width);
  rng.setNumberFormat("@");
  rng.setValues(all.map(r => r.slice(0, width).map(x => String(x == null ? "" : x))));
  sh.getRange(1, 1, 1, width).setFontWeight("bold").setBackground("#E7EAEE");
  styleHead_(sh.getRange(2, 1, 1, width), sh);
  sh.setFrozenRows(2);
  if (built.rows.length) sh.getRange(3, 3, built.rows.length, 1).setBackgrounds(built.colors.map(c => [c]));
  sh.getRange(3, 1, Math.max(1, built.rows.length), width).setWrap(true).setVerticalAlignment("middle");
  try { sh.hideColumns(1); sh.hideColumns(7); sh.setColumnWidth(8, 260); sh.setColumnWidth(10, 220); } catch (e) { /* оформление не критично */ }
  return sh;
}
function markActive_(ss, id, startDate) {
  programList_(ss).forEach(x => { if (x.status === "текущая" && x.id !== id) ss.getSheetByName(x.id).getRange(1, 8).setValue("завершена"); });
  const sh = programSheet_(ss, id);
  sh.getRange(1, 6).setNumberFormat("@").setValue(startDate);
  sh.getRange(1, 8).setValue("текущая");
}
function saveProgram_(clientId, p, oldId, activate) {
  const c = client_(clientId), ss = SpreadsheetApp.openById(c.sheetId);
  const sh = writeProgram_(ss, p, oldId);
  if (oldId && c.active === oldId && oldId !== sh.getName()) c.active = sh.getName();
  if (activate) { c.active = sh.getName(); c.startDate = p.startDate || day_(new Date()); c.notified = ""; markActive_(ss, c.active, c.startDate); }
  refreshSummary_(c, ss);
  putClient_(c);
  return {program:readProgram_(sh), client:publicClient_(c)};
}
function activateProgram_(clientId, id, startDate) {
  const c = client_(clientId), ss = SpreadsheetApp.openById(c.sheetId);
  c.active = id; c.startDate = startDate || day_(new Date()); c.notified = "";
  markActive_(ss, id, c.startDate);
  refreshSummary_(c, ss);
  putClient_(c);
  return publicClient_(c);
}

// ───────────────────────── шаблоны ─────────────────────────

function tplHead_() { return ["Шаблон", "Недель"].concat(H.PROG.slice(1)).concat(Array.from({length:H.TPL_WEEKS}, (_, i) => "Неделя " + (i + 1))); }
function tplSheet_() {
  const sh = sheet_(master_(), SH.TPL, tplHead_());
  return sh;
}
function templatesRaw_() {
  const sh = tplSheet_(), v = sh.getDataRange().getDisplayValues();
  const head = v[0] || [], by = {};
  for (let i = 1; i < v.length; i++) { const name = String(v[i][0] || "").trim(); if (!name) continue; (by[name] = by[name] || []).push(v[i]); }
  return {head, by};
}
function templateFromRows_(name, rows, head) {
  // строки шаблона = строки программы без колонки «Пункт id», плюс «Шаблон» и «Недель» спереди
  const fake = [["Программа", name, "Недель", rows[0][1], "", "", "", ""], ["Пункт id"].concat(head.slice(2))];
  rows.forEach((r, i) => fake.push(["t" + (i + 1)].concat(r.slice(2))));
  const p = readProgramValues_(fake, name);
  p.weeks = +rows[0][1] || p.weeks;
  return p;
}
function readProgramValues_(v, name) {
  const sh = {getDataRange:() => ({getDisplayValues:() => v}), getName:() => name};
  return readProgram_(sh);
}
function listTemplates_() {
  const t = templatesRaw_();
  return Object.keys(t.by).map(name => {
    const p = templateFromRows_(name, t.by[name], t.head);
    return {name, weeks:p.weeks, workouts:p.workouts.length, items:p.workouts.reduce((a, w) => a + w.sections.reduce((b, s) => b + s.items.length, 0), 0)};
  });
}
function getTemplate_(name) {
  const t = templatesRaw_();
  if (!t.by[name]) fail_("Шаблон не найден", "not_found");
  return templateFromRows_(name, t.by[name], t.head);
}
function saveTemplate_(p, oldName) {
  const name = String(p.title || "").trim();
  if (!name) fail_("Назовите шаблон");
  const sh = tplSheet_(), head = tplHead_(), t = templatesRaw_();
  if (name !== oldName && t.by[name]) fail_("Шаблон «" + name + "» уже есть");
  const keep = [];
  Object.keys(t.by).forEach(n => { if (n !== name && n !== oldName) t.by[n].forEach(r => keep.push(r)); });
  const weeks = Math.min(H.TPL_WEEKS, Math.max(1, +p.weeks || 1));
  const built = programRows_(Object.assign({}, p, {weeks}), H.PROG, []);
  built.rows.forEach(r => { const row = [name, String(weeks)].concat(r.slice(1)); while (row.length < head.length) row.push(""); keep.push(row.slice(0, head.length)); });
  sh.clearContents();
  sh.getRange(1, 1, 1, head.length).setValues([head]);
  styleHead_(sh.getRange(1, 1, 1, head.length), sh);
  if (keep.length) { const rng = sh.getRange(2, 1, keep.length, head.length); rng.setNumberFormat("@"); rng.setValues(keep.map(r => r.map(x => String(x == null ? "" : x)))); }
  return {name, templates:listTemplates_()};
}
function deleteTemplate_(name) {
  const sh = tplSheet_(), head = tplHead_(), t = templatesRaw_(), keep = [];
  Object.keys(t.by).forEach(n => { if (n !== name) t.by[n].forEach(r => keep.push(r)); });
  sh.clearContents();
  styleHead_(sh.getRange(1, 1, 1, head.length).setValues([head]), sh);
  if (keep.length) { const rng = sh.getRange(2, 1, keep.length, head.length); rng.setNumberFormat("@"); rng.setValues(keep); }
  return {templates:listTemplates_()};
}
function assignTemplate_(name, clientId, title, startDate, activate) {
  const p = getTemplate_(name);
  const c = client_(clientId), ss = SpreadsheetApp.openById(c.sheetId);
  let t = String(title || name).trim(), n = 2;
  while (ss.getSheetByName(t)) t = String(title || name).trim() + " (" + (n++) + ")";
  p.title = t; p.startDate = startDate || ""; p.status = activate ? "текущая" : "";
  let k = 0;
  p.workouts.forEach(w => w.sections.forEach(s => s.items.forEach(it => { it.id = "i" + Utilities.getUuid().slice(0, 8) + (k++); })));
  const sh = writeProgram_(ss, p, null);
  if (activate) { c.active = sh.getName(); c.startDate = startDate || day_(new Date()); c.notified = ""; markActive_(ss, c.active, c.startDate); }
  refreshSummary_(c, ss);
  putClient_(c);
  return {program:readProgram_(sh), client:publicClient_(c)};
}

// ───────────────────────── библиотека ─────────────────────────

function exercises_() {
  return rows_(sheet_(master_(), SH.EX, H.EX)).map(r => ({_row:r._row, id:String(r["id"]), name:String(r["Название"]), muscle:String(r["Мышцы"] || "") || null,
    equipment:String(r["Оборудование"] || "") || null, type:String(r["Учёт"] || "weight"), videoUrl:String(r["Видео"] || "") || null, cues:String(r["Техника"] || "") || null}));
}
function saveExercise_(ex) {
  if (!ex || !String(ex.name || "").trim()) fail_("Укажите название упражнения");
  const sh = sheet_(master_(), SH.EX, H.EX), all = exercises_();
  const id = ex.id || "ex-" + Utilities.getUuid().slice(0, 8);
  const row = [id, String(ex.name).trim(), ex.muscle || "", ex.equipment || "", ex.type || "weight", ex.videoUrl || "", ex.cues || ""];
  const cur = all.filter(x => x.id === id)[0];
  if (cur) sh.getRange(cur._row, 1, 1, row.length).setValues([row]); else sh.appendRow(row);
  return {id, name:row[1], muscle:ex.muscle || null, equipment:ex.equipment || null, type:row[4], videoUrl:ex.videoUrl || null, cues:ex.cues || null};
}

// ───────────────────────── тренировки, журнал, замеры ─────────────────────────

function sessions_(ss) {
  const sets = {};
  rows_(sheet_(ss, SH.LOG, H.LOG)).forEach(r => {
    const sid = String(r["Тренировка id"]);
    (sets[sid] = sets[sid] || []).push({itemId:String(r["Пункт id"]), exId:String(r["Упражнение id"] || "") || null, setNo:+r["Подход"] || 1,
      weightKg:r["Вес, кг"] === "" ? undefined : +r["Вес, кг"], noWeight:r["Без отягощения"] === "да" || undefined,
      reps:r["Повторы"] === "" ? undefined : +r["Повторы"], durationSec:r["Время, с"] === "" ? undefined : +r["Время, с"],
      skipped:r["Пропущен"] === "да" || undefined, at:iso_(r["Дата"])});
  });
  return rows_(sheet_(ss, SH.SESS, H.SESS)).map(r => {
    const id = String(r["id"]);
    return {id, program:String(r["Программа"]), week:+r["Неделя"], workout:String(r["Тренировка"]), status:STATUS_BY_RU[r["Статус"]] || String(r["Статус"]),
      startedAt:iso_(r["Начало"]), finishedAt:iso_(r["Конец"]), note:String(r["Заметка"] || ""), sets:(sets[id] || []).map(clean_)};
  });
}
function clean_(o) { const out = {}; Object.keys(o).forEach(k => { if (o[k] !== undefined && o[k] !== null && !(typeof o[k] === "number" && isNaN(o[k]))) out[k] = o[k]; }); return out; }
function saveSession_(clientId, s) {
  if (!s || !s.program || !s.workout || !s.week) fail_("Неполные данные тренировки");
  const c = client_(clientId), ss = SpreadsheetApp.openById(c.sheetId);
  const id = sessionId(s.program, s.workout, s.week);
  let prog = null;
  try { prog = readProgram_(programSheet_(ss, s.program)); } catch (e) { prog = null; }
  const items = {};
  if (prog) prog.workouts.forEach(w => w.sections.forEach(sec => sec.items.forEach(it => { items[it.id] = it; })));
  const sets = (s.sets || []).filter(x => x && x.itemId);
  const ton = sets.reduce((a, x) => a + (x.skipped ? 0 : (+x.weightKg || 0) * (+x.reps || 0)), 0);
  // Тренировки: одна строка на тренировку
  const sh = sheet_(ss, SH.SESS, H.SESS), cur = rows_(sh).filter(r => String(r["id"]) === id)[0];
  const row = [id, s.program, s.week, s.workout, STATUS_RU[s.status] || s.status || "в процессе", toDate_(s.startedAt), toDate_(s.finishedAt),
    sets.filter(x => !x.skipped).length, Math.round(ton), s.note || ""];
  if (cur) sh.getRange(cur._row, 1, 1, row.length).setValues([row]); else sh.appendRow(row);
  // Журнал: строки этой тренировки заменяются целиком
  const lg = sheet_(ss, SH.LOG, H.LOG), all = lg.getDataRange().getValues(), head = all[0] || H.LOG;
  const sidCol = head.indexOf("Тренировка id");
  const keep = all.slice(1).filter(r => String(r[sidCol]) !== id && r.some(x => x !== ""));
  const add = sets.slice().sort((a, b) => String(a.at).localeCompare(String(b.at))).map(x => {
    const it = items[x.itemId] || {};
    return [toDate_(x.at), s.program, s.week, s.workout, it.label || "", it.title || x.itemId, x.setNo, x.weightKg == null ? "" : x.weightKg, x.noWeight ? "да" : "",
      x.reps == null ? "" : x.reps, x.durationSec == null ? "" : x.durationSec, x.skipped ? "да" : "", id, x.itemId, x.exId || it.exId || ""];
  });
  const rows = keep.concat(add);
  lg.clearContents();
  styleHead_(lg.getRange(1, 1, 1, H.LOG.length).setValues([H.LOG]), lg);
  if (rows.length) lg.getRange(2, 1, rows.length, H.LOG.length).setValues(rows.map(r => r.slice(0, H.LOG.length)));
  c.last = s.finishedAt || s.startedAt || c.last;
  const note = refreshSummary_(c, ss);
  putClient_(c);
  return {id, summary:publicClient_(c), notified:note || null};
}
function measures_(ss) {
  return rows_(sheet_(ss, SH.BODY, H.BODY)).map(r => { const o = {}; H.BODY.forEach((h, i) => { const k = BODY_KEYS[i]; const v = r[h];
    o[k] = k === "date" ? day_(v) : k === "note" ? String(v || "") : (v === "" || v == null ? null : +v); }); return o; })
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));
}
function addMeasure_(clientId, m) {
  const c = client_(clientId), ss = SpreadsheetApp.openById(c.sheetId);
  const sh = sheet_(ss, SH.BODY, H.BODY);
  sh.appendRow(BODY_KEYS.map(k => k === "date" ? toDate_(m.date || day_(new Date())) : (m[k] === undefined || m[k] === null || m[k] === "" ? "" : (k === "note" ? String(m[k]) : +m[k]))));
  return {measurements:measures_(ss)};
}

// ───────────────────────── прогресс и уведомления ─────────────────────────

function refreshSummary_(c, ss) {
  if (!c.active) { c.done = 0; c.total = 0; c.weeksLeft = null; return null; }
  let p;
  try { p = readProgram_(programSheet_(ss, c.active)); } catch (e) { c.weeksLeft = null; return null; }
  const pr = programProgress(p, sessions_(ss));
  c.done = pr.done; c.total = pr.total; c.weeksLeft = pr.weeksLeft;
  let byDate = false;
  if (c.startDate && p.weeks) {
    const start = new Date(c.startDate), lastWeek = new Date(start.getTime() + (p.weeks - 1) * 7 * 864e5);
    byDate = new Date() >= lastWeek;
  }
  if ((pr.total && pr.weeksLeft <= 1) || byDate) {
    if (c.notified !== c.active) {
      c.notified = c.active;
      const text = pr.weeksLeft === 0 ? "Программа «" + c.active + "» пройдена. Пора назначить следующую."
        : "У подопечного осталась последняя неделя программы «" + c.active + "». Пора готовить следующую.";
      notify_(c.name, c.active, text);
      return text;
    }
  }
  return null;
}
function notify_(who, program, text) {
  sheet_(master_(), SH.NOTE, H.NOTE).appendRow([new Date(), who, program, text, ""]);
  const email = setting_("email");
  if (email) { try { MailApp.sendEmail(email, "Железяка: " + who + " — осталась неделя", who + ": " + text); } catch (e) { /* лимит почты или нет прав */ } }
  const token = setting_("tgToken"), chat = setting_("tgChat");
  if (token && chat) {
    try { UrlFetchApp.fetch("https://api.telegram.org/bot" + token + "/sendMessage", {method:"post", contentType:"application/json", muteHttpExceptions:true,
      payload:JSON.stringify({chat_id:chat, text:"🏋 " + who + ": " + text})}); } catch (e) { /* сеть */ }
  }
}
function notifications_() {
  return rows_(sheet_(master_(), SH.NOTE, H.NOTE)).map(r => ({row:r._row, date:iso_(r["Дата"]), client:String(r["Подопечный"]), program:String(r["Программа"]), text:String(r["Текст"]), read:r["Прочитано"] === "да"}))
    .reverse().slice(0, 30);
}
function readNotifications_() {
  const sh = sheet_(master_(), SH.NOTE, H.NOTE);
  rows_(sh).forEach(r => { if (r["Прочитано"] !== "да") sh.getRange(r._row, 5).setValue("да"); });
  return {notifications:notifications_()};
}
function checkAll_() {
  const out = [], all = clients_();
  all.forEach(c => {
    try { const ss = SpreadsheetApp.openById(c.sheetId); const note = refreshSummary_(c, ss); putClient_(c); if (note) out.push(c.name + ": " + note); }
    catch (e) { out.push(c.name + ": таблица недоступна"); }
  });
  return {checked:all.length, messages:out};
}
function dailyCheck() { checkAll_(); }

// ───────────────────────── загрузка экранов ─────────────────────────

function coachBoot_() {
  return {role:"coach", name:setting_("coachName") || "Тренер", clients:clients_().map(publicClient_), exercises:exercises_().map(clean_), templates:listTemplates_(),
    notifications:notifications_(), settings:{email:!!setting_("email"), telegram:!!(setting_("tgToken") && setting_("tgChat"))}};
}
function clientFull_(clientId) {
  const c = client_(clientId), ss = SpreadsheetApp.openById(c.sheetId);
  const list = programList_(ss);
  let program = null;
  if (c.active) { try { program = readProgram_(programSheet_(ss, c.active)); } catch (e) { program = null; } }
  return {client:publicClient_(c), programs:list, program, sessions:sessions_(ss), measurements:measures_(ss)};
}
function clientBoot_(clientId) {
  const full = clientFull_(clientId);
  return {role:"client", me:{id:full.client.id, name:full.client.name}, client:full.client, programs:full.programs, program:full.program,
    sessions:full.sessions, measurements:full.measurements, exercises:exercises_().map(clean_)};
}

// ───────────────────────── импорт демо-данных ─────────────────────────

function importSeed_(seed) {
  if (!seed || !seed.exercises) fail_("Нет данных для импорта");
  const sh = sheet_(master_(), SH.EX, H.EX), have = {};
  exercises_().forEach(e => { have[e.id] = 1; });
  const add = seed.exercises.filter(e => !have[e.id]).map(e => [e.id, e.name, e.muscle || "", e.equipment || "", e.type || "weight", e.videoUrl || "", e.cues || ""]);
  if (add.length) sh.getRange(sh.getLastRow() + 1, 1, add.length, H.EX.length).setValues(add);
  const report = [];
  (seed.clients || []).forEach(sc => {
    let c = clients_().filter(x => x.name === sc.name)[0];
    if (!c) { addClient_(sc.name, sc.contact); c = clients_().filter(x => x.name === sc.name)[0]; }
    const ss = SpreadsheetApp.openById(c.sheetId);
    const progs = (seed.programs || {})[sc.id] || [];
    progs.forEach(p => writeProgram_(ss, Object.assign({}, p, {status:p.title === sc.activeProgram ? "текущая" : ""}), null));
    if (sc.activeProgram) { c.active = sc.activeProgram; c.startDate = sc.startDate || null; }
    refreshSummary_(c, ss);
    putClient_(c);
    report.push(sc.name + ": " + progs.length + " программ, код входа " + c.code);
  });
  return {exercisesAdded:add.length, report};
}

// ───────────────────────── установка ─────────────────────────

// Если скрипт создан отдельно от таблицы (не через «Расширения → Apps Script»), впишите сюда id таблицы тренера.
const MASTER_SHEET_ID = "";

function setup() {
  let ss = null;
  try { ss = SpreadsheetApp.getActiveSpreadsheet(); } catch (e) { ss = null; }
  if (!ss) {
    const id = MASTER_SHEET_ID || PropertiesService.getScriptProperties().getProperty("MASTER_ID");
    if (!id) throw new Error("Скрипт не привязан к таблице: откройте таблицу и создайте скрипт через «Расширения → Apps Script» или впишите MASTER_SHEET_ID.");
    ss = SpreadsheetApp.openById(id);
  }
  PropertiesService.getScriptProperties().setProperty("MASTER_ID", ss.getId());
  MASTER_ = ss;
  sheet_(ss, SH.CLIENTS, H.CLIENTS);
  sheet_(ss, SH.EX, H.EX);
  tplSheet_();
  sheet_(ss, SH.NOTE, H.NOTE);
  const set = sheet_(ss, SH.SET, H.SET), have = {};
  rows_(set).forEach(r => { have[r["Параметр"]] = 1; });
  let email = "";
  try { email = Session.getEffectiveUser().getEmail(); } catch (e) { email = ""; }
  const defaults = [
    [SET_KEYS.coachCode, String(100000 + Math.floor(Math.random() * 900000)), "Код входа тренера в приложение. Поменяйте на свой."],
    [SET_KEYS.coachName, "Тренер", "Как вас называть в приложении"],
    [SET_KEYS.email, email, "Сюда придёт письмо, когда у подопечного останется неделя программы"],
    [SET_KEYS.tgToken, "", "Необязательно: токен Telegram-бота от @BotFather"],
    [SET_KEYS.tgChat, "", "Необязательно: ваш chat id в Telegram"],
    [SET_KEYS.folder, "", "Необязательно: id папки на Диске для таблиц подопечных"]
  ].filter(r => !have[r[0]]);
  if (defaults.length) set.getRange(set.getLastRow() + 1, 1, defaults.length, 3).setValues(defaults);
  const first = ss.getSheets()[0];
  if (["Лист1", "Sheet1"].indexOf(first.getName()) >= 0 && first.getLastRow() === 0) ss.deleteSheet(first);
  ScriptApp.getProjectTriggers().forEach(t => { if (t.getHandlerFunction() === "dailyCheck") ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger("dailyCheck").timeBased().everyDays(1).atHour(9).create();
  SETTINGS_ = null;
  const msg = "Готово! Ваш код тренера: " + setting_("coachCode") + " (он же на листе «Настройки»).\n\n" + PUBLISH_HELP;
  Logger.log(msg);
  try { SpreadsheetApp.getUi().alert("Железяка", msg, SpreadsheetApp.getUi().ButtonSet.OK); } catch (e) { /* запуск не из таблицы */ }
  return msg;
}

const PUBLISH_HELP = "Последний шаг — опубликовать сервер:\n" +
  "1. Меню «Расширения → Apps Script».\n" +
  "2. Справа вверху «Начать развёртывание → Новое развёртывание».\n" +
  "3. Шестерёнка «Выберите тип» → «Веб-приложение». Запуск от имени: «Я». Доступ: «Все».\n" +
  "4. «Развернуть» → скопируйте URL веб-приложения (заканчивается на /exec).\n" +
  "5. Откройте приложение Железяка, вставьте этот адрес в «Адрес сервера» и войдите кодом тренера.";

function showHelp() {
  try { SpreadsheetApp.getUi().alert("Железяка", PUBLISH_HELP, SpreadsheetApp.getUi().ButtonSet.OK); } catch (e) { /* без интерфейса */ }
}

function onOpen() {
  try {
    SpreadsheetApp.getUi().createMenu("Железяка")
      .addItem("Настроить", "setup")
      .addItem("Как опубликовать сервер", "showHelp")
      .addItem("Проверить окончания программ", "dailyCheck")
      .addToUi();
  } catch (e) { /* без интерфейса */ }
}
