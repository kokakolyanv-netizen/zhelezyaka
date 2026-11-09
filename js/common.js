// Общие для обеих ролей вычисления и куски интерфейса: прописка, шаги квеста, видео.
import {repsText, numRu} from "./shared.js";
import {esc, fnum, ic, SEC, SIMPLE, REST_DEF} from "./util.js";

export const tFor = (it, week) => (it && it.targets && (it.targets[String(week)] || it.targets["0"])) || null;
export const restOf = (it, sk) => (it && it.restSec != null ? it.restSec : (REST_DEF[sk] || 0));
export const itemsOf = w => ((w && w.sections) || []).flatMap(s => s.items.map(it => ({...it, _sec:s.kind})));

const memo = new WeakMap();
export function byId(arr) {
  if (!arr) return new Map();
  let m = memo.get(arr);
  if (!m) { m = new Map(arr.map(x => [x.id, x])); memo.set(arr, m); }
  return m;
}

export function fmtT(t) {
  if (!t) return "неделя не расписана";
  if (t.note && Object.keys(t).length === 1) return t.note;
  if (t.workSec) return `${t.workSec} с работа / ${t.restSec || 0} с отдых` + (t.roundsMin ? ` × ${t.roundsMin === t.roundsMax ? t.roundsMin : t.roundsMin + "–" + t.roundsMax}` : "");
  const parts = [], r = repsText(t);
  if (t.sets && r) parts.push(`${t.sets}×${r}`); else if (t.sets) parts.push(`${t.sets} подх.`); else if (r) parts.push(r);
  if (t.perSide) parts.push("на сторону");
  if (t.speedKmh) parts.push(`${numRu(t.speedKmh)} км/ч`);
  if (t.weightKg) parts.push(`${fnum(t.weightKg)} кг`);
  if (t.rpeMin) parts.push(`@${fnum(t.rpeMin)}${t.rpeMax && t.rpeMax !== t.rpeMin ? "–" + fnum(t.rpeMax) : ""}`);
  return parts.join(" · ") || "—";
}
export function rxBig(t) {
  if (!t) return `<span class="rxbig dim">—</span>`;
  if (t.note && Object.keys(t).length === 1) return `<span class="rxbig note">${esc(t.note)}</span>`;
  if (t.workSec) return `<span class="rxbig">${t.workSec}<small>с</small><span class="x">/</span>${t.restSec || 0}<small>с</small></span>`;
  const r = repsText(t);
  if (t.sets && r) return `<span class="rxbig">${t.sets}<span class="x">×</span>${esc(r)}</span>`;
  if (r) return `<span class="rxbig">${esc(r)}</span>`;
  if (t.sets) return `<span class="rxbig">${t.sets}<small>подх.</small></span>`;
  return `<span class="rxbig dim">—</span>`;
}
export function subLine(t, it, sk) {
  const p = [];
  if (t && t.weightKg) p.push(`${fnum(t.weightKg)} кг`);
  if (t && t.rpeMin) p.push(`@${fnum(t.rpeMin)}`);
  if ((t && t.perSide) || (it && it.perSide)) p.push("на сторону");
  if (t && t.speedKmh) p.push(`${numRu(t.speedKmh)} км/ч`);
  const rest = restOf(it, sk); if (rest && sk && !SIMPLE.includes(sk)) p.push(`отдых ${rest} с`);
  return p.join(" · ");
}
export function groupsOf(sec) {
  const groups = [];
  for (const it of sec.items) {
    const g = groups[groups.length - 1];
    if (it.group && it.mode !== "single" && g && g.key === it.group) g.items.push(it);
    else groups.push({key:it.mode !== "single" ? it.group : null, mode:it.mode, items:[it]});
  }
  return groups;
}
// Тренировка, развёрнутая в шаги квеста в порядке выполнения: суперсеты идут по кругам.
export function buildSteps(wo, week) {
  const steps = [];
  for (const sec of (wo && wo.sections) || []) {
    for (const g of groupsOf(sec)) {
      if (SIMPLE.includes(sec.kind)) { g.items.forEach(it => steps.push({it, sec, setNo:1, sets:1, simple:true, g})); continue; }
      const sets = g.items.map(it => Math.max(1, Math.min(12, (tFor(it, week) || {}).sets || 1)));
      if (g.items.length > 1) {
        const rounds = Math.max(...sets);
        for (let r = 1; r <= rounds; r++) g.items.forEach((it, i) => { if (r <= sets[i]) steps.push({it, sec, setNo:r, sets:sets[i], g, round:r, rounds, pos:i}); });
      } else for (let r = 1; r <= sets[0]; r++) steps.push({it:g.items[0], sec, setNo:r, sets:sets[0], g});
    }
  }
  return steps;
}
export const stepKey = st => st.it.id + "#" + st.setNo;
export function restAfter(st, steps, i) {
  if (st.simple || i >= steps.length - 1) return 0;
  if (st.g.items.length > 1 && st.g.mode === "superset" && st.pos < st.g.items.length - 1) return 0;
  return restOf(st.it, st.sec.kind);
}
export function secTag(kind, title) {
  const [c, t] = SEC[kind] || ["", title];
  return `<span class="tag c-${c}"><i></i>${esc(title || t)}</span>`;
}
const direct = u => /\.(mp4|webm|m4v)(\?|$)/i.test(u || "");
export const driveId = u => { const m = String(u || "").match(/drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?(?:[^#]*&)?id=)([\w-]{20,})/); return m ? m[1] : null; };
export function videoBlock(ex) {
  const vid = ex && driveId(ex.videoUrl);
  if (vid) return `<button class="video drive" data-act="video-open" data-vid="${esc(vid)}" data-title="${esc(ex.name || "")}" aria-label="Смотреть видео: ${esc(ex.name || "")}">
    <span class="vthumb" style="background-image:url('https://drive.google.com/thumbnail?id=${esc(vid)}&sz=w720')"></span>
    <span class="vplay">${ic("play")}</span><span class="vmeta"><span class="tag light">Видео тренера</span><span class="vnote">Нажмите, чтобы посмотреть технику</span></span></button>`;
  if (ex && ex.videoUrl && direct(ex.videoUrl)) return `<div class="video" data-st="ready"><video src="${esc(ex.videoUrl)}" controls loop muted playsinline preload="metadata"></video></div>`;
  const st = !ex || !ex.videoUrl ? "none" : ex.videoStatus === "broken" ? "broken" : "source";
  const txt = {source:["Видео тренера", "Откроется в новой вкладке. Ролик в формате mp4 будет играть прямо здесь."], broken:["Ссылка не открывается", "Тренеру нужно заменить видео в библиотеке."], none:["Видео пока нет", "Тренер может добавить его в библиотеке."]}[st];
  return `<div class="video" data-st="${st}"><div class="bars" aria-hidden="true"><div class="bb"><b></b><i class="p10"></i><i class="p15"></i><i class="p20"></i><i class="p25"></i><s></s><i class="p25"></i><i class="p20"></i><i class="p15"></i><i class="p10"></i></div></div>
    <div class="vmeta"><span class="tag light">${esc(txt[0])}</span>
      ${ex && ex.videoUrl && st !== "broken" ? `<a class="vlink" href="${esc(ex.videoUrl)}" target="_blank" rel="noopener">${ic("ext")}Смотреть видео</a>` : ""}
      <span class="vnote">${esc(txt[1])}</span></div></div>`;
}
export function emptyState(title, text) { return `<div class="empty big-empty"><b>${esc(title)}</b>${esc(text || "")}</div>`; }
export function loadingState() { return `<div class="stack" style="margin-top:30px"><div class="skel"></div><div class="skel" style="width:70%"></div><div class="skel" style="width:85%"></div><div class="skel" style="width:55%"></div></div>`; }
// Сетка «неделя × тренировка» со статусами
export function progressGrid(p, sessMap, sid) {
  if (!p) return "";
  let next = null;
  outer: for (let w = 1; w <= p.weeks; w++) for (const wo of p.workouts) { const s = sessMap.get(sid(wo.id, w)); if (!s || s.status === "in_progress") { next = wo.id + "#" + w; break outer; } }
  return `<div class="grid-wrap"><table class="pgrid"><thead><tr><th></th>${Array.from({length:p.weeks}, (_, i) => `<th>Н${i + 1}</th>`).join("")}</tr></thead><tbody>
    ${p.workouts.map(wo => `<tr><th class="wt" scope="row">${esc(wo.title.replace("Тренировка ", "Тр. "))}</th>${Array.from({length:p.weeks}, (_, i) => {
      const w = i + 1, s = sessMap.get(sid(wo.id, w));
      const cls = s ? ({done:"done", skipped:"skip", in_progress:"prog"}[s.status] || "") : (next === wo.id + "#" + w ? "next" : "");
      return `<td><span class="cell ${cls}" title="${esc(wo.title)}, неделя ${w}">${s ? ({done:ic("check"), skipped:ic("dash"), in_progress:ic("dot")}[s.status] || "") : ""}</span></td>`; }).join("")}</tr>`).join("")}
  </tbody></table></div>
  <div class="legend"><span><i style="background:var(--green)"></i>выполнена</span><span><i style="background:var(--blue-soft);border:1.5px solid var(--accent)"></i>в процессе</span><span><i style="background:var(--surface-3)"></i>пропущена</span><span><i style="border:2px solid var(--accent)"></i>следующая</span></div>`;
}
// Мини-график по точкам [{x: подпись, y: число}]
export function sparkline(points, unit) {
  const pts = points.filter(p => p.y != null && !isNaN(p.y));
  if (pts.length < 2) return `<div class="small muted">Нужно минимум два замера, чтобы показать динамику.</div>`;
  const W = 300, H = 90, pad = 8, ys = pts.map(p => p.y), lo = Math.min(...ys), hi = Math.max(...ys), span = hi - lo || 1;
  const x = i => pad + i * (W - 2 * pad) / (pts.length - 1), y = v => H - 18 - (v - lo) / span * (H - 34);
  const d = pts.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.y).toFixed(1)}`).join(" ");
  const area = d + ` L${x(pts.length - 1).toFixed(1)},${H - 18} L${x(0).toFixed(1)},${H - 18} Z`;
  const last = pts[pts.length - 1];
  return `<svg class="spark" viewBox="0 0 ${W} ${H}" role="img" aria-label="Динамика"><path class="ar" d="${area}"/><path class="ln" d="${d}"/>
    <circle cx="${x(pts.length - 1)}" cy="${y(last.y)}" r="4.5" class="pt"/>
    <text x="${pad}" y="${H - 4}">${esc(pts[0].x)}</text><text x="${W - pad}" y="${H - 4}" text-anchor="end">${esc(last.x)} · ${fnum(last.y)} ${esc(unit || "")}</text></svg>`;
}
