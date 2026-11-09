// Прописка упражнения: объект <-> текст ячейки Google-таблицы.
// Этот файл общий: tools/build_backend.py вставляет его в backend/Code.gs (без слов export).
//
// Объект прописки (target): {sets, repsMin, repsMax, repsPlus, toFailure, perSide, durationSec, distanceM,
//   speedKmh, workSec, restSec, roundsMin, roundsMax, weightKg, rpeMin, rpeMax, history}
// Текст в ячейке: "5×6 90кг @7-7,5", "3×10-12", "3×макс на сторону", "40 с", "5 мин 5,5 км/ч",
//   "20с/40с ×5-8", "4×10 (было: 90/100/90)".

export const SECTION_TITLES = {warmup:"Разминка", circuit:"Круг", main:"Основная часть", hypertrophy:"Гипертрофия", cooldown:"Кардиозаминка", intervals:"Интервалы"};
export const SECTION_BY_TITLE = {"разминка":"warmup", "круг":"circuit", "основная часть":"main", "основная":"main", "гипертрофия":"hypertrophy", "кардиозаминка":"cooldown", "заминка":"cooldown", "интервалы":"intervals"};

export function sectionKind(title) {
  const s = String(title || "").toLowerCase();
  if (SECTION_BY_TITLE[s]) return SECTION_BY_TITLE[s];
  if (s.indexOf("интервал") === 0) return "intervals";
  if (s.indexOf("разминк") >= 0) return "warmup";
  if (s.indexOf("круг") === 0) return "circuit";
  if (s.indexOf("гипертроф") >= 0) return "hypertrophy";
  if (s.indexOf("заминк") >= 0 || s.indexOf("кардио") === 0) return "cooldown";
  return "main";
}

export function numRu(n) {
  return String(Math.round(n * 100) / 100).replace(".", ",");
}

export function repsText(t) {
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

export function formatRx(t) {
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

export function parseRx(s) {
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

export const MODE_RU = {single:"", superset:"суперсет", alternate:"чередование"};
export const MODE_BY_RU = {"":"single", "суперсет":"superset", "чередование":"alternate"};

export function sessionId(programId, workoutId, week) {
  return programId + "|" + workoutId + "|w" + week;
}

// sessions: массив {program, workout, week, status}
export function programProgress(p, sessions) {
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
