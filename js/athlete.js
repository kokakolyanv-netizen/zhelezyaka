// Экраны подопечного: Сегодня, Тренировка (состав), Сейчас (квест), Упражнение, Тело (замеры), Прогресс.
import {S, schedule, send} from "./state.js";
import {sessionId, programProgress, repsText} from "./shared.js";
import {esc, fnum, ic, toast, dshort, mmss, clone, nowISO, todayISO, plural, SEC, SIMPLE, kindOf} from "./util.js";
import {tFor, itemsOf, byId, fmtT, rxBig, subLine, groupsOf, buildSteps, stepKey, restAfter, secTag, videoBlock, emptyState, loadingState, progressGrid, sparkline} from "./common.js";

export const TABS = [["today", "home", "Сегодня", ["today"]], ["workout", "lift", "Тренировка", ["workout", "quest", "exercise"]], ["body", "body", "Тело", ["body"]], ["progress", "chart", "Прогресс", ["progress"]]];
export const DEFAULT = "today";
const U = S.ui;

const D = () => S.data || {};
const prog = () => D().program || null;
const exById = () => byId(D().exercises);
const sessMap = () => byId(D().sessions);
const sid = (wid, week) => sessionId(prog().id, wid, week);
const sess = (wid, week) => sessMap().get(sid(wid, week));
const workout = wid => (prog() && prog().workouts.find(w => w.id === wid)) || null;

function currentRef() {
  const p = prog(); if (!p) return null;
  if (U.ref && U.ref.pid === p.id && workout(U.ref.wid)) return U.ref;
  const live = (D().sessions || []).filter(s => s.program === p.id && s.status === "in_progress").sort((a, b) => String(b.startedAt).localeCompare(String(a.startedAt)))[0];
  if (live && workout(live.workout)) return {pid:p.id, wid:live.workout, week:live.week};
  for (let w = 1; w <= p.weeks; w++) for (const wo of p.workouts) { const s = sess(wo.id, w); if (!s || s.status === "in_progress") return {pid:p.id, wid:wo.id, week:w}; }
  return null;
}
function questState() {
  const ref = currentRef(); if (!ref) return null;
  const wo = workout(ref.wid), steps = buildSteps(wo, ref.week), s = sess(ref.wid, ref.week);
  const logged = new Map(((s && s.sets) || []).map(x => [x.itemId + "#" + x.setNo, x]));
  const idx = steps.findIndex(st => !logged.has(stepKey(st)));
  return {ref, wo, steps, s, logged, idx, p:prog()};
}
function lastSet(exId) {
  let best = null;
  for (const s of D().sessions || []) for (const x of s.sets || []) if (x.exId === exId && !x.skipped && x.weightKg && (!best || String(x.at) > String(best.at))) best = x;
  return best;
}
// изменить тренировку локально и поставить в очередь отправки в таблицу
function upsertSession(ref, change) {
  const id = sid(ref.wid, ref.week);
  const cur = sessMap().get(id);
  const base = cur ? clone(cur) : {id, program:prog().id, workout:ref.wid, week:ref.week, status:"in_progress", startedAt:nowISO(), finishedAt:null, note:"", sets:[]};
  const next = change(base);
  const list = (D().sessions || []).filter(s => s.id !== id);
  if (next) list.push(next);
  S.data.sessions = list;
  if (next) send("session.save", {session:next}, "sess:" + id);
  schedule();
}

/* ───────── Сегодня ───────── */
let ringShown = false;
function today() {
  const p = prog();
  if (!D().me) return loadingState();
  const hello = `<div class="eyebrow" style="margin-bottom:4px">Привет, ${esc(D().me.name)}</div>`;
  if (!p) return hello + emptyState("Программы пока нет", "Тренер ещё не назначил программу. Как только назначит, она появится здесь.");
  const ref = currentRef(), pr = programProgress(p, D().sessions), [kc, kt] = kindOf(p.kind);
  const week = ref ? ref.week : p.weeks;
  const C = 2 * Math.PI * 42, off = C * (1 - (pr.total ? pr.done / pr.total : 0));
  const anim = ringShown ? "" : (ringShown = true, "anim");
  const weeks = Array.from({length:p.weeks}, (_, i) => {
    const w = i + 1;
    const dots = p.workouts.map(wo => { const s = sess(wo.id, w); return `<i class="${s ? ({done:"done", skipped:"skip", in_progress:"prog"}[s.status] || "") : ""}"></i>`; }).join("");
    return `<div class="wk" data-cur="${w === week ? 1 : 0}"><span>Н${w}</span><div class="dots">${dots}</div></div>`;
  }).join("");
  let card;
  if (ref) {
    const wo = workout(ref.wid), s = sess(ref.wid, ref.week), steps = buildSteps(wo, ref.week);
    const core = itemsOf(wo).filter(it => !SIMPLE.includes(it._sec));
    const done = s ? steps.filter(st => (s.sets || []).some(x => x.itemId === st.it.id && x.setNo === st.setNo)).length : 0;
    card = `<div class="card">
      <div class="row between"><span class="eyebrow">${s ? "В процессе" : "Следующая"}</span><span class="tag c-${kc}"><i></i>${esc(kt)}</span></div>
      <div class="big" style="font-size:22px;margin-top:6px">${esc(wo.title)}</div>
      <div class="muted small">${core.length} ${plural(core.length, "упражнение", "упражнения", "упражнений")} · ${steps.length} шагов${s ? ` · пройдено ${done}` : ""}</div>
      <div class="segbar">${wo.sections.filter(sc => sc.items.length).map(sc => `<i class="c-${(SEC[sc.kind] || [""])[0]}" style="flex:${sc.items.length}"></i>`).join("")}</div>
      <a class="btn block" href="#workout" data-act="open-workout" data-wid="${esc(ref.wid)}" data-week="${ref.week}">${ic("play")}${s ? "Продолжить" : "Открыть тренировку"}</a></div>`;
  } else card = `<div class="card">${emptyState("Цикл пройден", "Все тренировки отмечены. Тренер назначит следующую программу.")}</div>`;
  const supp = (p.notes || []).filter(n => n.kind === "supplements");
  const rules = (p.notes || []).filter(n => n.kind !== "supplements");
  return `${hello}<div class="hero">
      <div><div class="eyebrow">Неделя ${week} из ${p.weeks}</div><div class="big">${esc(p.title)}</div></div>
      <div class="ring" role="img" aria-label="Выполнено ${pr.done} из ${pr.total}"><svg viewBox="0 0 100 100"><circle class="trk" cx="50" cy="50" r="42"/><circle class="val ${anim}" style="--c:${C}" cx="50" cy="50" r="42" stroke-dasharray="${C}" stroke-dashoffset="${off}"/></svg>
        <div class="hub"><div><b class="tnum">${pr.done}</b><span>из ${pr.total}</span></div></div></div></div>
    <div class="weeks">${weeks}</div>
    <div class="stack">${card}
      ${supp.length ? `<div class="card"><h4>Протокол добавок</h4><ul class="supp">${supp.map(n => { const m = n.text.replace(/^\d+\.\s*/, "").match(/^([^:]+):(.*)$/); return `<li>${m ? `<b>${esc(m[1])}:</b>${esc(m[2])}` : esc(n.text)}</li>`; }).join("")}</ul></div>` : ""}
      ${rules.map((n, i) => `<details class="note"><summary>Правило тренера ${i + 1}</summary><p>${esc(n.text)}</p></details>`).join("")}
    </div>`;
}

/* ───────── Тренировка: состав ───────── */
function overview() {
  if (!D().me) return loadingState();
  const q = questState();
  if (!q) return `<div class="nav"><h3 class="d">Тренировка</h3></div>` + emptyState(prog() ? "Нечего выполнять" : "Программы пока нет", prog() ? "В текущей программе отмечены все тренировки." : "Тренер ещё не назначил программу.");
  const {ref, wo, steps, s, logged, p} = q;
  const done = steps.filter(st => logged.has(stepKey(st))).length, pct = steps.length ? Math.round(done / steps.length * 100) : 0;
  let body = "";
  for (const sc of wo.sections) {
    if (!sc.items.length) continue;
    body += `<div class="shead">${secTag(sc.kind, sc.title)}</div>`;
    for (const g of groupsOf(sc)) {
      const rows = g.items.map(it => { const tt = tFor(it, ref.week), sub = subLine(tt, it, sc.kind);
        return `<a class="ov-row" href="#exercise" data-act="open-ex" data-ex="${esc(it.exId || "")}" data-item="${esc(it.id)}"><span class="lbl">${esc(it.label || "•")}</span><span><span class="t">${esc(it.title)}</span>${sub ? `<span class="sub">${esc(sub)}</span>` : ""}</span>${SIMPLE.includes(sc.kind) && !tt ? "" : rxBig(tt)}</a>`; }).join("");
      if (g.items.length > 1) {
        const rounds = Math.max(...g.items.map(it => (tFor(it, ref.week) || {}).sets || 1));
        body += `<div class="ov-group g"><div class="ov-gh"><span>${g.mode === "alternate" ? "Чередование через отдых" : "Суперсет: без отдыха между упражнениями"}</span><span>${rounds} ${plural(rounds, "круг", "круга", "кругов")}</span></div>${rows}</div>`;
      } else body += `<div class="ov-group">${rows}</div>`;
    }
  }
  const restTotal = steps.reduce((a, st, i) => a + 45 + restAfter(st, steps, i), 0);
  const cta = s && s.status === "done"
    ? `<div class="donebar">${ic("check")}Тренировка выполнена ${esc(dshort(s.finishedAt))}</div><button class="btn ghost block" style="margin-top:8px" data-act="next-workout">Следующая тренировка</button>`
    : `${s ? `<div class="row" style="margin-bottom:8px"><div class="bar-p" style="flex:1"><i style="width:${pct}%"></i></div><span class="small muted tnum">${done}/${steps.length}</span></div>` : ""}
       <a class="btn huge go block" href="#quest" data-act="${s ? "goto-quest" : "q-start"}">${ic("play")}${s ? "Продолжить" : "Начать тренировку"}</a>`;
  return `<div class="nav"><a class="icon-btn" href="#today" aria-label="Назад">${ic("back")}</a><h3>${esc(wo.title)}<small>${esc(p.title)} · неделя ${ref.week}</small></h3></div>
    <div class="row wrapr" style="gap:6px"><span class="tag">${itemsOf(wo).filter(it => !SIMPLE.includes(it._sec)).length} упражнений</span><span class="tag">${steps.length} шагов</span><span class="tag">≈ ${Math.max(15, Math.round(restTotal / 60 / 5) * 5)} мин</span></div>
    ${body}<div class="sticky-cta">${cta}</div>`;
}

/* ───────── Сейчас: квест ───────── */
function qProgress(q) {
  const segs = q.steps.map((st, i) => { const c = (SEC[st.sec.kind] || [""])[0], L = q.logged.get(stepKey(st)); return `<i class="c-${c} ${L ? "" : i === q.idx ? "cur" : "todo"}" ${L && L.skipped ? 'style="opacity:.35"' : ""}></i>`; }).join("");
  return `<div class="qtop"><a class="icon-btn" href="#workout" aria-label="К составу тренировки">${ic("x")}</a><div class="qseg" role="progressbar" aria-valuemin="0" aria-valuemax="${q.steps.length}" aria-valuenow="${q.logged.size}">${segs}</div></div>`;
}
function quest() {
  if (!D().me) return loadingState();
  const q = questState();
  if (!q) return emptyState(prog() ? "Все тренировки цикла пройдены" : "Программы пока нет", "");
  const {ref, wo, steps, s, logged, idx, p} = q;
  const doneN = steps.filter(st => logged.has(stepKey(st))).length;
  const elapsed = s && s.startedAt && s.status !== "done" ? `<span>${ic("dot")} <span data-elapsed="${esc(s.startedAt)}">${mmss((Date.now() - Date.parse(s.startedAt)) / 1000)}</span></span>` : "";
  const meta = `<div class="qmeta"><span>Шаг ${Math.min(doneN + 1, steps.length)} из ${steps.length} · ${steps.length ? Math.round(doneN / steps.length * 100) : 0}%</span>${elapsed}</div>`;
  if (!s) {
    const first = steps[0];
    return `${qProgress(q)}${meta}<div class="eyebrow">${esc(p.title)} · неделя ${ref.week}</div><div class="qname" style="font-size:28px">${esc(wo.title)}</div>
      <p class="muted small">${steps.length} шагов. Приложение покажет по одному, что делать прямо сейчас. После каждого подхода впишите вес и нажмите «Выполнено».</p>
      ${first ? `<div class="nextcard" style="margin:14px 0"><div class="eyebrow">Первым делом</div><div style="font-weight:600;margin-top:4px">${esc(first.it.title)}</div><div class="muted small">${esc(fmtT(tFor(first.it, ref.week)))}</div></div>` : ""}
      <button class="btn huge go block" data-act="q-start">${ic("play")}Начать</button>`;
  }
  if (s.status === "done" || idx === -1) {
    const sets = (s.sets || []).filter(x => !x.skipped), ton = sets.reduce((a, x) => a + (x.weightKg || 0) * (x.reps || 0), 0);
    const dur = ((s.finishedAt ? Date.parse(s.finishedAt) : Date.now()) - Date.parse(s.startedAt)) / 1000;
    return `${qProgress(q)}<div class="donev"><div class="burst" aria-hidden="true"><i></i><i></i><i></i><i></i></div>
      <div class="qname" style="font-size:26px">${s.status === "done" ? "Тренировка сохранена" : "Все шаги пройдены!"}</div>
      <p class="muted small">${esc(wo.title)} · неделя ${ref.week}</p>
      <div class="tiles"><div class="tile"><b>${mmss(dur)}</b><span>время</span></div><div class="tile"><b>${sets.length}</b><span>подходов</span></div><div class="tile"><b>${ton >= 1000 ? fnum(ton / 1000) + "т" : fnum(ton)}</b><span>${ton >= 1000 ? "тоннаж" : "кг тоннаж"}</span></div></div>
      ${s.status === "done" ? `<button class="btn ghost block" data-act="next-workout">Следующая тренировка</button>` : `<button class="btn huge go block" data-act="q-finish">${ic("check")}Завершить и сохранить</button>`}
      <div class="qfoot center"><button data-act="q-undo">Вернуть последний шаг</button></div></div>`;
  }
  const st = steps[idx], t = tFor(st.it, ref.week), ex = exById().get(st.it.exId);
  if (U.rest && U.rest.sid === sid(ref.wid, ref.week)) {
    const left = (U.rest.until - Date.now()) / 1000, C = 2 * Math.PI * 92;
    return `${qProgress(q)}${meta}<div class="restv"><div class="restring"><svg viewBox="0 0 210 210"><circle class="trk" cx="105" cy="105" r="92"/><circle class="val" data-rest-ring data-c="${C}" cx="105" cy="105" r="92" stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - left / U.rest.total)}"/></svg>
      <div class="hub"><div><b data-rest-left>${mmss(left)}</b><span>отдых</span></div></div></div>
      <div class="row"><button class="btn ghost" data-act="rest-add">+30 с</button><button class="btn" data-act="rest-skip">Начать подход</button></div>
      <div class="nextcard"><div class="eyebrow">Далее · подход ${st.setNo} из ${st.sets}</div><div style="font-weight:700;font-size:17px;margin:4px 0 8px">${esc(st.it.title)}</div>${rxBig(t)}</div></div>`;
  }
  const key = stepKey(st);
  if (!U.draft || U.draft.key !== key) U.draft = {key, weight:"", noWeight:false, reps:t && t.toFailure ? null : (t && t.repsMin != null ? t.repsMin : null), dur:t && t.durationSec ? t.durationSec : null};
  const d = U.draft;
  const timeBased = !!(t && t.durationSec && t.repsMin == null && !t.toFailure);
  const repsVal = t ? repsText(t) : "";
  const groupLine = st.g.items.length > 1 ? `<div class="qgroup">${st.g.mode === "alternate" ? "Чередование" : "Суперсет"} · круг <b>${st.round} из ${st.rounds}</b>${st.pos < st.g.items.length - 1 ? ` · сразу после: <b>${esc(st.g.items[st.pos + 1].title)}</b>` : ""}</div>` : "";
  const extras = [t && t.weightKg ? `цель <b>${fnum(t.weightKg)} кг</b>` : "", t && t.rpeMin ? `RPE <b>${fnum(t.rpeMin)}${t.rpeMax && t.rpeMax !== t.rpeMin ? "–" + fnum(t.rpeMax) : ""}</b>` : "", t && t.history ? `было: ${esc(t.history)}` : ""].filter(Boolean).join(" · ");
  let tiles;
  if (st.simple) {
    const v = t ? (repsText(t) || (t.note || "")) : "";
    tiles = v || (t && t.sets) ? `<div class="tiles2 ${t && t.speedKmh ? "" : "one"}"><div class="bigtile hot"><span>${t && t.durationSec ? "ВРЕМЯ" : t && t.workSec ? "РАБОТА / ОТДЫХ" : "ОБЪЁМ"}</span><b class="${v.length > 3 ? "long" : ""}">${esc(v || t.sets + " подх.")}</b>${t && t.roundsMin ? `<em>${t.roundsMin}–${t.roundsMax} циклов</em>` : ""}</div>${t && t.speedKmh ? `<div class="bigtile"><span>СКОРОСТЬ</span><b class="long">${fnum(t.speedKmh)}<small> км/ч</small></b></div>` : ""}</div>`
      : `<div class="nextcard" style="margin:14px 0 8px">Выполните в своём темпе и нажмите «Сделано».</div>`;
  } else {
    tiles = `<div class="tiles2"><div class="bigtile"><span>ПОДХОД</span><b>${st.setNo}<small>/${st.sets}</small></b></div>
      <div class="bigtile hot"><span>${timeBased ? "ВРЕМЯ" : "ПОВТОРЫ"}</span><b class="${repsVal.length > 3 ? "long" : ""}">${esc(repsVal || "—")}</b>${(t && t.perSide) || st.it.perSide ? "<em>на каждую сторону</em>" : ""}</div></div>`;
  }
  let input = "";
  if (!st.simple) {
    const last = lastSet(st.it.exId), ok = d.noWeight || parseFloat(String(d.weight).replace(",", ".")) > 0;
    input = `<div class="wbox ${ok ? "" : "need"}" id="q-wbox"><label for="q-w">ВЕС, КГ</label>
      <div class="wrow ${d.noWeight ? "off" : ""}"><button data-act="q-w" data-d="-2.5" aria-label="Минус 2,5 кг">−2,5</button><div class="win"><input id="q-w" inputmode="decimal" enterkeyhint="done" autocomplete="off" value="${esc(d.weight)}" placeholder="${t && t.weightKg ? fnum(t.weightKg) : "0"}" aria-label="Вес в килограммах"><span>кг</span></div><button data-act="q-w" data-d="2.5" aria-label="Плюс 2,5 кг">+2,5</button></div>
      <div class="chipset"><button class="ch" data-act="q-now" aria-pressed="${d.noWeight}">Без отягощения</button>
        ${t && t.weightKg ? `<button class="ch" data-act="q-set-w" data-v="${t.weightKg}">Как у тренера: ${fnum(t.weightKg)} кг</button>` : ""}
        ${last && last.weightKg ? `<button class="ch" data-act="q-set-w" data-v="${last.weightKg}">В прошлый раз: ${fnum(last.weightKg)} кг</button>` : ""}</div></div>
      <div class="repsrow"><span>${timeBased ? "Сколько секунд" : "Сколько повторов сделали"}</span><div class="stp"><button data-act="q-reps" data-d="-1" aria-label="Меньше">−</button><b id="q-r">${timeBased ? (d.dur == null ? "—" : d.dur) : (d.reps == null ? "—" : d.reps)}</b><button data-act="q-reps" data-d="1" aria-label="Больше">+</button></div></div>`;
  }
  const canDone = st.simple || d.noWeight || parseFloat(String(d.weight).replace(",", ".")) > 0;
  return `${qProgress(q)}${meta}
    <div class="row between">${secTag(st.sec.kind, st.sec.title)}${st.it.label ? `<span class="mono muted">${esc(st.it.label)}</span>` : ""}</div>
    <div class="qname">${esc(st.it.title)}</div>${groupLine}
    <div class="row" style="margin-top:8px"><a class="mini-btn" href="#exercise" data-act="open-ex" data-ex="${esc(st.it.exId || "")}" data-item="${esc(st.it.id)}">${ic(ex && ex.videoUrl ? "play" : "video")}Видео и техника</a></div>
    ${tiles}${extras ? `<div class="qline">${extras}</div>` : ""}${st.it.cues ? `<div class="qline">${esc(st.it.cues)}</div>` : ""}
    ${input}
    <button class="btn huge go block" style="margin-top:12px" id="q-done" data-act="q-done" ${canDone ? "" : "disabled"}>${ic("check")}${st.simple ? "Сделано" : "Выполнено"}</button>
    <p class="needtxt" id="q-need" ${canDone ? "hidden" : ""}>Впишите вес или нажмите «Без отягощения»</p>
    <div class="qfoot"><button data-act="q-undo" ${doneN ? "" : "disabled"}>Вернуть предыдущий</button><button data-act="q-skip">Пропустить</button></div>`;
}

/* ───────── Упражнение ───────── */
function exercise() {
  if (!D().me) return loadingState();
  let v = U.exView;
  if (!v) { const q = questState(), st = q && (q.steps[q.idx] || q.steps[0]); v = st ? {exId:st.it.exId, itemId:st.it.id} : null; }
  const p = prog(), it = v && p ? itemsOf({sections:p.workouts.flatMap(w => w.sections)}).find(i => i.id === v.itemId) : null;
  const ex = v && exById().get(v.exId);
  if (!ex && !it) return `<div class="nav"><a class="icon-btn" href="#workout" aria-label="Назад">${ic("back")}</a><h3>Упражнение</h3></div>` + emptyState("Выберите упражнение", "Нажмите на упражнение в составе тренировки.");
  const ref = currentRef();
  const cues = [ex && ex.cues, it && it.cues].filter(Boolean).join(", ").split(/[,;]\s*/).map(s => s.trim()).filter(s => s.length > 2);
  const hist = [];
  for (const s of (D().sessions || []).slice().sort((a, b) => String(b.startedAt).localeCompare(String(a.startedAt)))) {
    const xs = (s.sets || []).filter(x => !x.skipped && ((v.exId && x.exId === v.exId) || x.itemId === v.itemId)).sort((a, b) => a.setNo - b.setNo);
    if (xs.length) hist.push({s, xs});
  }
  return `<div class="nav"><a class="icon-btn" href="#quest" data-act="back" aria-label="Назад">${ic("back")}</a><h3>Упражнение</h3></div>
    <div class="stack">${videoBlock(ex)}
      <div><div class="big" style="font-size:22px">${esc((ex && ex.name) || it.title)}</div>
        ${it && ex && it.title !== ex.name ? `<div class="muted small" style="margin-top:4px">У тренера: «${esc(it.title)}»</div>` : ""}
        <div class="row wrapr" style="margin-top:8px;gap:6px">${[ex && ex.muscle, ex && ex.equipment].filter(Boolean).map(x => `<span class="tag">${esc(x)}</span>`).join("")}</div></div>
      ${cues.length ? `<div class="card"><h4>Техника</h4><ul class="tech">${cues.map(c => `<li>${esc(c[0].toUpperCase() + c.slice(1))}</li>`).join("")}</ul></div>` : ""}
      ${it && p ? `<div class="card"><h4>Прописка по неделям</h4><div class="wgrid">${Array.from({length:p.weeks}, (_, i) => { const t = tFor(it, i + 1);
          return `<div class="wcell" data-cur="${ref && ref.week === i + 1 ? 1 : 0}"><b>Неделя ${i + 1}</b>${esc(t ? fmtT(t) : "—")}</div>`; }).join("")}</div></div>` : ""}
      <div class="card"><h4>Мои подходы</h4>${hist.length ? hist.slice(0, 6).map(h => `<div class="rec"><span>${esc(dshort(h.s.startedAt))} · неделя ${h.s.week}</span><b>${h.xs.map(x => x.noWeight ? `${x.reps == null ? "✓" : x.reps} б/в` : x.weightKg ? `${fnum(x.weightKg)}×${x.reps == null ? "?" : x.reps}` : (x.reps != null ? x.reps : x.durationSec ? x.durationSec + "с" : "✓")).join(", ")}</b></div>`).join("")
        : `<div class="empty" style="padding:8px">Пока пусто. Пройдите подход в квесте, и он появится здесь.</div>`}</div>
    </div>`;
}

/* ───────── Тело: замеры ───────── */
const BODY = [["weight", "Вес", "кг"], ["fat", "Жир", "%"], ["muscle", "Мышцы", "%"], ["bone", "Кости", "%"], ["water", "Вода", "%"]];
const GIRTH = [["neck", "Шея"], ["chest", "Грудь"], ["waist", "Талия"], ["belly", "Живот"], ["hips", "Ягодицы"], ["thigh", "Бедро"], ["calf", "Голень"], ["arm", "Плечо"], ["forearm", "Предплечье"]];
function body() {
  if (!D().me) return loadingState();
  const ms = (D().measurements || []).slice().sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const last = ms[ms.length - 1] || {}, prev = ms[ms.length - 2] || {};
  const delta = k => last[k] != null && prev[k] != null ? last[k] - prev[k] : null;
  const fmtD = (k, unit) => { const d = delta(k); return d == null || !d ? "" : `<em class="${d < 0 ? "dn" : "up"}">${d > 0 ? "+" : "−"}${fnum(Math.abs(d))} ${unit}</em>`; };
  const form = U.bodyForm;
  const field = (k, label, unit, big) => `<label class="mf ${big ? "big" : ""}"><span>${label}${unit ? `, ${unit}` : ""}</span><input id="m-${k}" inputmode="decimal" autocomplete="off" placeholder="${last[k] != null ? fnum(last[k]) : "—"}"></label>`;
  return `<div class="nav"><h3 class="d">Тело</h3>${form ? "" : `<button class="btn" style="padding:9px 12px" data-act="m-open">${ic("plus")}Замер</button>`}</div>
    ${form ? `<div class="card stack">
      <label class="mf"><span>Дата</span><input id="m-date" type="date" value="${todayISO()}"></label>
      <div class="mgrid">${BODY.map(([k, l, u], i) => field(k, l, u, i === 0)).join("")}</div>
      <h4 style="margin-top:6px">Обхваты, см</h4>
      <div class="mgrid">${GIRTH.map(([k, l]) => field(k, l, "")).join("")}</div>
      <label class="mf"><span>Заметка</span><input id="m-note" placeholder="Например: утром натощак"></label>
      <div class="row"><button class="btn ghost" data-act="m-cancel">Отмена</button><button class="btn go" style="flex:1" data-act="m-save">${ic("check")}Сохранить замер</button></div></div>` : ""}
    ${ms.length ? `<div class="tiles">${BODY.slice(0, 3).map(([k, l, u]) => `<div class="tile"><b>${last[k] != null ? fnum(last[k]) : "—"}</b><span>${l}, ${u}</span>${fmtD(k, u)}</div>`).join("")}</div>
      <div class="card chart"><h4>Вес, кг</h4>${sparkline(ms.map(m => ({x:dshort(m.date), y:m.weight})), "кг")}</div>
      <div class="card chart" style="margin-top:10px"><h4>Талия, см</h4>${sparkline(ms.map(m => ({x:dshort(m.date), y:m.waist})), "см")}</div>
      <div class="card" style="margin-top:10px"><h4>Последний замер · ${esc(dshort(last.date))}</h4><div class="kv">${BODY.concat(GIRTH.map(g => [g[0], g[1], "см"])).filter(([k]) => last[k] != null).map(([k, l, u]) => `<span>${l}</span><b>${fnum(last[k])} ${u}${fmtD(k, u)}</b>`).join("")}</div>${last.note ? `<p class="small muted" style="margin:8px 0 0">${esc(last.note)}</p>` : ""}</div>
      <div class="card" style="margin-top:10px"><h4>История</h4>${ms.slice().reverse().slice(0, 12).map(m => `<div class="rec"><span>${esc(dshort(m.date))}</span><b>${m.weight != null ? fnum(m.weight) + " кг" : ""}${m.fat != null ? " · " + fnum(m.fat) + "% жира" : ""}${m.waist != null ? " · талия " + fnum(m.waist) : ""}</b></div>`).join("")}</div>`
      : form ? "" : emptyState("Замеров пока нет", "Вес, процент жира, мышц и костей, обхваты. Тренер увидит их в своей таблице.")}`;
}

/* ───────── Прогресс ───────── */
function progress() {
  if (!D().me) return loadingState();
  const p = prog();
  if (!p) return `<div class="nav"><h3 class="d">Прогресс</h3></div>` + emptyState("Программы пока нет", "");
  let nSess = 0, nSets = 0, ton = 0; const best = new Map();
  for (const s of D().sessions || []) {
    if (s.status === "done") nSess++;
    for (const x of s.sets || []) { if (x.skipped) continue; nSets++; if (x.weightKg && x.reps) { ton += x.weightKg * x.reps;
      const b = best.get(x.exId); if (!b || x.weightKg > b.weightKg || (x.weightKg === b.weightKg && x.reps > b.reps)) best.set(x.exId, {...x, date:s.startedAt}); } }
  }
  const plan = [], fact = [];
  for (let w = 1; w <= p.weeks; w++) {
    let pv = 0, fv = 0;
    for (const wo of p.workouts) {
      for (const it of itemsOf(wo)) { if (SIMPLE.includes(it._sec)) continue; const t = tFor(it, w); if (t && t.sets && (t.repsMax || t.repsMin)) pv += t.sets * (t.repsMax || t.repsMin); }
      for (const x of ((sess(wo.id, w) || {}).sets || [])) fv += x.reps || 0;
    }
    plan.push(pv); fact.push(fv);
  }
  const W = 300, H = 150, pad = 26, max = Math.max(10, ...plan, ...fact), nice = Math.ceil(max / 50) * 50;
  const bw = (W - pad - 8) / p.weeks, y = v => H - 22 - (v / nice) * (H - 40);
  const grid = [0, .5, 1].map(f => `<line class="gl" x1="${pad}" x2="${W}" y1="${y(nice * f)}" y2="${y(nice * f)}"/><text x="0" y="${y(nice * f) + 3}">${Math.round(nice * f)}</text>`).join("");
  const bars = plan.map((v, i) => { const x = pad + 4 + i * bw;
    return `<rect class="plan" x="${x}" y="${y(v)}" width="${bw - 10}" height="${H - 22 - y(v)}" rx="5"/>${fact[i] ? `<rect class="fact" x="${x + 4}" y="${y(fact[i])}" width="${bw - 18}" height="${H - 22 - y(fact[i])}" rx="4"/>` : ""}<text x="${x + (bw - 10) / 2}" y="${H - 6}" text-anchor="middle">Н${i + 1}</text>`; }).join("");
  const recs = [...best.entries()].sort((a, b) => b[1].weightKg - a[1].weightKg).slice(0, 8);
  return `<div class="nav"><h3 class="d">Прогресс</h3></div>
    <div class="tiles" style="margin-top:0"><div class="tile"><b>${nSess}</b><span>тренировок</span></div><div class="tile"><b>${nSets}</b><span>подходов</span></div><div class="tile"><b>${ton >= 1000 ? fnum(ton / 1000) + "т" : fnum(ton)}</b><span>${ton >= 1000 ? "тоннаж" : "кг тоннаж"}</span></div></div>
    <div class="card chart"><h4>Повторы по неделям · ${esc(p.title)}</h4><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="План тренера и выполненные повторы по неделям">${grid}${bars}</svg>
      <div class="legend"><span><i style="background:var(--surface-3)"></i>план тренера</span><span><i style="background:var(--accent)"></i>сделано</span></div></div>
    <div class="card" style="margin-top:12px"><h4>Сетка программы</h4>${progressGrid(p, sessMap(), sid)}</div>
    <div class="card" style="margin-top:12px"><h4>Лучшие подходы</h4>${recs.length ? recs.map(([exId, r]) => `<div class="rec"><span>${esc((exById().get(exId) || {}).name || exId)}</span><b>${fnum(r.weightKg)} кг × ${r.reps}</b><small>${esc(dshort(r.date))}</small></div>`).join("")
      : `<div class="empty" style="padding:8px">Рекорды появятся после первых подходов с весом.</div>`}</div>`;
}

export const SCREENS = {today, workout:overview, quest, exercise, body, progress};

/* ───────── действия ───────── */
function questDone() {
  const q = questState(); if (!q || q.idx < 0) return;
  const st = q.steps[q.idx], t = tFor(st.it, q.ref.week), d = U.draft || {};
  const vals = {};
  if (!st.simple) {
    const w = parseFloat(String(d.weight || "").replace(",", "."));
    if (d.noWeight) vals.noWeight = true; else if (w > 0) vals.weightKg = w;
    else { toast("Впишите вес или нажмите «Без отягощения»"); const b = document.getElementById("q-wbox"); if (b) b.classList.add("need"); return; }
    const timeBased = t && t.durationSec && t.repsMin == null && !t.toFailure;
    if (timeBased) { if (d.dur != null) vals.durationSec = d.dur; } else if (d.reps != null) vals.reps = d.reps;
  } else if (t && t.durationSec) vals.durationSec = t.durationSec;
  const rest = restAfter(st, q.steps, q.idx), id = sid(q.ref.wid, q.ref.week);
  upsertSession(q.ref, b => ({...b, status:b.status === "done" ? "done" : "in_progress",
    sets:(b.sets || []).filter(x => !(x.itemId === st.it.id && x.setNo === st.setNo)).concat([{itemId:st.it.id, exId:st.it.exId, setNo:st.setNo, ...vals, at:nowISO()}])}));
  U.draft = null;
  U.rest = rest ? {sid:id, until:Date.now() + rest * 1000, total:rest} : null;
  if (navigator.vibrate) { try { navigator.vibrate(30); } catch (_) { /* нет вибро */ } }
}
function questSkip() {
  const q = questState(); if (!q || q.idx < 0) return;
  const st = q.steps[q.idx];
  upsertSession(q.ref, b => ({...b, sets:(b.sets || []).concat([{itemId:st.it.id, exId:st.it.exId, setNo:st.setNo, skipped:true, at:nowISO()}])}));
  U.draft = null; U.rest = null; toast("Шаг пропущен");
}
function questUndo() {
  const q = questState(); if (!q || !q.s) return;
  const last = (q.s.sets || []).slice().sort((a, b) => String(a.at).localeCompare(String(b.at))).pop(); if (!last) return;
  upsertSession(q.ref, b => ({...b, status:"in_progress", finishedAt:null, sets:(b.sets || []).filter(x => !(x.itemId === last.itemId && x.setNo === last.setNo))}));
  U.draft = last.skipped ? null : {key:last.itemId + "#" + last.setNo, weight:last.weightKg ? String(last.weightKg).replace(".", ",") : "", noWeight:!!last.noWeight, reps:last.reps == null ? null : last.reps, dur:last.durationSec == null ? null : last.durationSec};
  U.rest = null; toast("Шаг возвращён");
}
function saveMeasure() {
  const m = {date:(document.getElementById("m-date") || {}).value || todayISO()};
  let any = false;
  for (const [k] of BODY.concat(GIRTH)) { const el = document.getElementById("m-" + k); const v = el && parseFloat(String(el.value).replace(",", ".")); if (v > 0) { m[k] = v; any = true; } }
  const note = (document.getElementById("m-note") || {}).value || ""; if (note) m.note = note;
  if (!any) { toast("Заполните хотя бы одно поле"); return; }
  S.data.measurements = (D().measurements || []).concat([m]).sort((a, b) => String(a.date).localeCompare(String(b.date)));
  send("measure.add", {measure:m}, "m:" + Date.now());
  U.bodyForm = false; toast("Замер сохранён"); schedule();
}

export const ACTIONS = {
  "open-workout":d => { U.ref = {pid:prog().id, wid:d.wid, week:+d.week}; },
  "goto-quest":() => {},
  "q-start":() => { const ref = currentRef(); if (!ref) return; U.ref = ref; U.rest = null; if (!sess(ref.wid, ref.week)) upsertSession(ref, b => b); location.hash = "#quest"; },
  "q-done":questDone, "q-skip":questSkip, "q-undo":questUndo,
  "q-finish":() => { const q = questState(); if (q) { upsertSession(q.ref, b => ({...b, status:"done", finishedAt:nowISO()})); toast("Тренировка сохранена в таблицу"); } },
  "q-now":() => { if (U.draft) { U.draft.noWeight = !U.draft.noWeight; if (U.draft.noWeight) U.draft.weight = ""; } },
  "q-set-w":d => { if (U.draft) { U.draft.weight = String(d.v).replace(".", ","); U.draft.noWeight = false; } },
  "q-w":d => { if (U.draft) { const el = document.getElementById("q-w"); const cur = parseFloat(String(U.draft.weight || (el && el.placeholder) || "0").replace(",", ".")) || 0; U.draft.weight = String(Math.max(0, cur + +d.d)).replace(".", ","); U.draft.noWeight = false; } },
  "q-reps":d => { if (!U.draft) return; const q = questState(), st = q && q.steps[q.idx], t = st && tFor(st.it, q.ref.week), tb = t && t.durationSec && t.repsMin == null && !t.toFailure;
    if (tb) U.draft.dur = Math.max(0, (U.draft.dur || 0) + +d.d * 5); else U.draft.reps = Math.max(0, (U.draft.reps || 0) + +d.d); },
  "rest-add":() => { if (U.rest) { U.rest.until += 30000; U.rest.total += 30; } },
  "rest-skip":() => { U.rest = null; },
  "next-workout":() => { U.ref = null; U.draft = null; location.hash = "#workout"; },
  "open-ex":d => { U.exView = {exId:d.ex || null, itemId:d.item || null}; },
  "back":() => { history.length > 1 ? history.back() : (location.hash = "#quest"); },
  "m-open":() => { U.bodyForm = true; },
  "m-cancel":() => { U.bodyForm = false; },
  "m-save":saveMeasure
};
export function onInput(el) {
  if (el.id === "q-w" && U.draft) {
    U.draft.weight = el.value; if (el.value) U.draft.noWeight = false;
    const ok = parseFloat(el.value.replace(",", ".")) > 0 || U.draft.noWeight;
    const b = document.getElementById("q-done"); if (b) b.disabled = !ok;
    const n = document.getElementById("q-need"); if (n) n.hidden = ok;
    const box = document.getElementById("q-wbox"); if (box) box.classList.toggle("need", !ok);
    return true;
  }
  return false;
}
export function onEnter(el) { if (el.id === "q-w") { questDone(); return true; } return false; }
export function tick() {
  if (!U.rest) return;
  const left = (U.rest.until - Date.now()) / 1000;
  if (left <= 0) { U.rest = null; toast("Отдых закончился: следующий подход"); if (navigator.vibrate) { try { navigator.vibrate([80, 60, 80]); } catch (_) { /* нет */ } } schedule(); return; }
  document.querySelectorAll("[data-rest-left]").forEach(el => { el.textContent = mmss(left); });
  document.querySelectorAll("[data-rest-ring]").forEach(el => { el.setAttribute("stroke-dashoffset", +el.dataset.c * (1 - left / U.rest.total)); });
}
