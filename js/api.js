// Связь с сервером. SheetsApi — настоящий сервер (Google Apps Script + Google Таблицы).
// DemoApi — тот же набор действий, но данные лежат в браузере: для пробы без настройки.
import {programProgress, sessionId} from "./shared.js";
import {clone, lsGet, lsSet, todayISO, nowISO} from "./util.js";

export class NetError extends Error {}

export class SheetsApi {
  constructor(url) { this.url = url; this.kind = "sheets"; }
  async call(action, body = {}, code = "") {
    let res;
    try {
      // text/plain: «простой» запрос без предварительного CORS-запроса — так Apps Script принимает POST
      res = await fetch(this.url, {method:"POST", body:JSON.stringify({action, code, ...body})});
    } catch (e) { throw new NetError("Нет связи с сервером"); }
    if (!res.ok) throw new NetError("Сервер ответил " + res.status);
    let j;
    try { j = await res.json(); } catch (e) { throw new Error("Сервер ответил не так, как ожидалось. Проверьте адрес веб-приложения."); }
    if (!j.ok) { const e = new Error(j.error || "Ошибка сервера"); e.code = j.code; throw e; }
    return j.data;
  }
}

const DEMO_KEY = "demo.v1";
const sleep = ms => new Promise(r => setTimeout(r, ms));

export class DemoApi {
  constructor(seed) { this.kind = "demo"; this.seed = seed; this.db = lsGet(DEMO_KEY) || this.fresh(); }
  fresh() {
    const s = clone(this.seed);
    s.coachCode = "0000"; s.coachName = "Тренер"; s.notifications = []; s.templates = s.templates || [];
    s.clients.forEach(c => { if (c.active === undefined) c.active = c.activeProgram || ""; c.notified = ""; });
    return s;
  }
  reset() { this.db = this.fresh(); this.save(); }
  save() { lsSet(DEMO_KEY, this.db); }
  auth(code) {
    if (code === this.db.coachCode) return {role:"coach", name:this.db.coachName};
    const c = this.db.clients.find(x => x.code === code);
    return c ? {role:"client", clientId:c.id, name:c.name} : null;
  }
  client(id) { const c = this.db.clients.find(x => x.id === id); if (!c) throw new Error("Подопечный не найден"); return c; }
  progs(id) { return this.db.programs[id] || (this.db.programs[id] = []); }
  sess(id) { return this.db.sessions[id] || (this.db.sessions[id] = []); }
  meas(id) { return this.db.measurements[id] || (this.db.measurements[id] = []); }
  pub(c) {
    const p = this.progs(c.id).find(x => x.id === c.active), pr = programProgress(p, this.sess(c.id));
    const last = this.sess(c.id).map(s => s.finishedAt || s.startedAt).filter(Boolean).sort().pop() || null;
    return {id:c.id, name:c.name, code:c.code, url:"", active:c.active || "", startDate:c.startDate || null, contact:c.contact || "", note:c.note || "",
      done:pr.done, total:pr.total, weeksLeft:p ? pr.weeksLeft : null, last};
  }
  list(id) { const c = this.client(id); return this.progs(id).map(p => ({id:p.id, title:p.title, weeks:p.weeks, startDate:p.startDate || null, status:p.id === c.active ? "текущая" : ""})); }
  full(id) {
    const c = this.client(id);
    return {client:this.pub(c), programs:this.list(id), program:this.progs(id).find(p => p.id === c.active) || null, sessions:this.sess(id), measurements:this.meas(id)};
  }
  tplInfo(t) { return {name:t.title, weeks:t.weeks, workouts:t.workouts.length, items:t.workouts.reduce((a, w) => a + w.sections.reduce((b, s) => b + s.items.length, 0), 0)}; }
  notify(c) {
    const p = this.progs(c.id).find(x => x.id === c.active); if (!p) return null;
    const pr = programProgress(p, this.sess(c.id));
    if (pr.total && pr.weeksLeft <= 1 && c.notified !== c.active) {
      c.notified = c.active;
      const text = pr.weeksLeft === 0 ? `Программа «${c.active}» пройдена. Пора назначить следующую.` : `У подопечного осталась последняя неделя программы «${c.active}». Пора готовить следующую.`;
      this.db.notifications.unshift({row:Date.now(), date:nowISO(), client:c.name, program:c.active, text, read:false});
      return text;
    }
    return null;
  }
  putProgram(cid, p, oldId) {
    const list = this.progs(cid), title = String(p.title || "").trim();
    if (!title) throw new Error("У программы нет названия");
    const at = list.findIndex(x => x.id === (oldId || title));
    if (list.some((x, i) => x.id === title && i !== at)) throw new Error(`Программа «${title}» уже есть у этого подопечного`);
    const doc = {...clone(p), id:title, title};
    if (at >= 0) list[at] = doc; else list.push(doc);
    const c = this.client(cid);
    if (oldId && c.active === oldId) c.active = title;
    return doc;
  }
  async call(action, body = {}, code = "") {
    await sleep(140);
    const who = this.auth(String(code || "").trim());
    if (!who) { const e = new Error("Неверный код входа"); e.code = "auth"; throw e; }
    const coach = () => { if (who.role !== "coach") throw new Error("Это действие доступно только тренеру"); };
    const own = id => { if (who.role === "coach") return id; if (id && id !== who.clientId) throw new Error("Нет доступа к чужим данным"); return who.clientId; };
    let out;
    switch (action) {
      case "login": out = {role:who.role, name:who.name, clientId:who.clientId || null, coach:this.db.coachName}; break;
      case "bootstrap":
        if (who.role === "coach") out = {role:"coach", name:this.db.coachName, clients:this.db.clients.map(c => this.pub(c)), exercises:this.db.exercises,
          templates:this.db.templates.map(t => this.tplInfo(t)), notifications:this.db.notifications.slice(0, 30), settings:{email:false, telegram:false}};
        else { const f = this.full(who.clientId); out = {role:"client", me:{id:who.clientId, name:who.name}, ...f, exercises:this.db.exercises}; }
        break;
      case "client.get": coach(); out = this.full(body.clientId); break;
      case "client.add": {
        coach(); const name = String(body.name || "").trim(); if (!name) throw new Error("Укажите имя подопечного");
        let code2; do { code2 = String(100000 + Math.floor(Math.random() * 900000)); } while (this.db.clients.some(c => c.code === code2));
        const c = {id:"c-" + Date.now().toString(36), name, code:code2, active:"", startDate:null, contact:body.contact || "", note:"", notified:""};
        this.db.clients.push(c); out = this.pub(c); break;
      }
      case "client.update": { coach(); const c = this.client(body.clientId); Object.assign(c, body.patch || {}); out = this.pub(c); break; }
      case "program.get": { const cid = own(body.clientId); const p = this.progs(cid).find(x => x.id === body.id); if (!p) throw new Error("Программа не найдена"); out = p; break; }
      case "program.save": {
        coach(); const c = this.client(body.clientId), doc = this.putProgram(c.id, body.program, body.oldId);
        if (body.activate) { c.active = doc.id; c.startDate = body.program.startDate || todayISO(); c.notified = ""; }
        this.notify(c); out = {program:doc, client:this.pub(c)}; break;
      }
      case "program.activate": { coach(); const c = this.client(body.clientId); c.active = body.id; c.startDate = body.startDate || todayISO(); c.notified = ""; this.notify(c); out = this.pub(c); break; }
      case "template.get": { coach(); const t = this.db.templates.find(x => x.title === body.name); if (!t) throw new Error("Шаблон не найден"); out = t; break; }
      case "template.save": {
        coach(); const name = String(body.program.title || "").trim(); if (!name) throw new Error("Назовите шаблон");
        if (name !== body.oldName && this.db.templates.some(t => t.title === name)) throw new Error(`Шаблон «${name}» уже есть`);
        this.db.templates = this.db.templates.filter(t => t.title !== name && t.title !== body.oldName);
        this.db.templates.push({...clone(body.program), id:name, title:name});
        out = {name, templates:this.db.templates.map(t => this.tplInfo(t))}; break;
      }
      case "template.delete": coach(); this.db.templates = this.db.templates.filter(t => t.title !== body.name); out = {templates:this.db.templates.map(t => this.tplInfo(t))}; break;
      case "template.assign": {
        coach(); const t = this.db.templates.find(x => x.title === body.name); if (!t) throw new Error("Шаблон не найден");
        const c = this.client(body.clientId); let title = String(body.title || body.name).trim(), n = 2;
        while (this.progs(c.id).some(p => p.id === title)) title = String(body.title || body.name).trim() + ` (${n++})`;
        const p = clone(t); p.title = title; p.startDate = body.startDate || null;
        p.workouts.forEach(w => w.sections.forEach(s => s.items.forEach(it => { it.id = "i" + Math.random().toString(36).slice(2, 10); })));
        const doc = this.putProgram(c.id, p, null);
        if (body.activate) { c.active = doc.id; c.startDate = body.startDate || todayISO(); c.notified = ""; }
        out = {program:doc, client:this.pub(c)}; break;
      }
      case "exercise.save": {
        coach(); const ex = {...body.exercise}; if (!String(ex.name || "").trim()) throw new Error("Укажите название упражнения");
        ex.id = ex.id || "ex-" + Date.now().toString(36);
        const i = this.db.exercises.findIndex(e => e.id === ex.id); if (i >= 0) this.db.exercises[i] = ex; else this.db.exercises.push(ex);
        out = ex; break;
      }
      case "session.save": {
        const cid = own(body.clientId), s = clone(body.session); s.id = sessionId(s.program, s.workout, s.week);
        const list = this.sess(cid), i = list.findIndex(x => x.id === s.id); if (i >= 0) list[i] = s; else list.push(s);
        const c = this.client(cid); const note = this.notify(c); out = {id:s.id, summary:this.pub(c), notified:note}; break;
      }
      case "measure.add": { const cid = own(body.clientId); this.meas(cid).push({...body.measure, date:body.measure.date || todayISO()}); this.meas(cid).sort((a, b) => String(a.date).localeCompare(String(b.date))); out = {measurements:this.meas(cid)}; break; }
      case "notifications.read": coach(); this.db.notifications.forEach(n => { n.read = true; }); out = {notifications:this.db.notifications.slice(0, 30)}; break;
      case "check": coach(); { const msgs = this.db.clients.map(c => this.notify(c) && c.name).filter(Boolean); out = {checked:this.db.clients.length, messages:msgs}; } break;
      case "import": coach(); out = {exercisesAdded:0, report:["В демо-режиме данные уже загружены"]}; break;
      case "video.import": case "video.status": coach(); throw new Error("В демо-режиме видео не переносится");
      case "video.stream": throw new Error("В демо-режиме видео открывается на Яндекс Диске.");
      default: throw new Error("Неизвестное действие: " + action);
    }
    this.save();
    return clone(out);
  }
}
