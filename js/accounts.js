// Несколько входов на одном телефоне: например, тренер в своих таблицах и подопечный у другого тренера.
// Вход = сервер тренера + код. У каждого входа своя очередь неотправленных записей, свой кэш и свой черновик.
import {lsGet, lsSet} from "./util.js";

const CFG = window.PODHOD || {};
const PREFIXES = ["queue.", "cache.", "pd."];

export const okServer = s => /^https:\/\/script\.google(usercontent)?\.com\//.test(String(s || ""));
function hashStr(s) { let h = 5381; for (const ch of String(s)) h = (h * 33 + ch.charCodeAt(0)) >>> 0; return h.toString(36); }
export const accId = a => a.mode === "demo" ? "demo." + a.code : hashStr(a.server || "") + "." + a.code;
// ключ для очереди, кэша и черновика этого входа
export const accKey = a => !a ? "anon" : a.mode === "demo" ? "demo." + a.code : "sheets." + hashStr(a.server || "") + "." + a.code;

export const list = () => lsGet("accounts", []) || [];
export function upsert(acc) {
  const all = list(), i = all.findIndex(a => a.id === acc.id);
  if (i >= 0) all[i] = {...all[i], ...acc}; else all.push(acc);
  lsSet("accounts", all);
  return acc;
}
export function remove(id) {
  const a = list().find(x => x.id === id);
  lsSet("accounts", list().filter(x => x.id !== id));
  if (a) PREFIXES.forEach(p => lsSet(p + accKey(a), null));
}
export const pending = a => (lsGet("queue." + accKey(a), []) || []).length;

// подпись входа: «тренер», «подопечный · тренер Иван» (+ короткая метка сервера, если имени тренера нет)
export function describe(a) {
  if (a.mode === "demo") return a.role === "coach" ? "тренер · демо" : "подопечный · демо";
  const coachName = a.coachName && a.coachName !== "Тренер" ? a.coachName : "";
  const tag = "сервер " + hashStr(a.server || "").slice(-4).toUpperCase();
  if (a.role === "coach") return "тренер · " + tag;
  return "подопечный · " + (coachName ? "тренер " + coachName : tag);
}

// Ссылка-приглашение «…/?s=сервер&c=код», просто адрес сервера или код → {server, code}
export function parseEntry(text) {
  const t = String(text || "").trim();
  if (!/^https?:\/\//i.test(t)) return {server:null, code:t || null};
  try {
    const u = new URL(t);
    if (okServer(t)) return {server:t.replace(/[?#].*$/, ""), code:null};
    const s = u.searchParams.get("s"), c = u.searchParams.get("c");
    return {server:okServer(s) ? s : null, code:c || null};
  } catch (e) { return {server:null, code:null}; }
}

// Переход со старой версии: был один вход и общий адрес сервера
export function migrate() {
  const saved = lsGet("auth");
  if (!saved || saved.id) return;
  const acc = {...saved, server:saved.mode === "demo" ? "" : (lsGet("apiUrl") || CFG.apiUrl || "")};
  acc.id = accId(acc);
  const oldK = saved.mode + "." + saved.code, newK = accKey(acc);
  if (oldK !== newK) PREFIXES.forEach(p => {
    const v = lsGet(p + oldK);
    if (v !== null && lsGet(p + newK) === null) lsSet(p + newK, v);
    lsSet(p + oldK, null);
  });
  lsSet("auth", acc);
  upsert(acc);
}
