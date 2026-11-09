// Мелкие помощники интерфейса.
export const $ = (s, r = document) => r.querySelector(s);
export const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"}[c]));
export const fnum = n => (Math.round(n * 100) / 100).toLocaleString("ru-RU");
export const clone = o => JSON.parse(JSON.stringify(o));
export const uid = p => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
export const todayISO = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10); };
export const nowISO = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 19); };
export const dshort = iso => iso ? new Date(String(iso).length === 10 ? iso + "T12:00:00" : iso).toLocaleDateString("ru-RU", {day:"numeric", month:"short"}) : "—";
export function mmss(sec) { sec = Math.max(0, Math.round(sec)); const h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60), s = sec % 60; return (h ? h + ":" + String(m).padStart(2, "0") : m) + ":" + String(s).padStart(2, "0"); }
export const initials = n => String(n || "?").trim().split(/\s+/).map(x => x[0]).join("").slice(0, 2).toUpperCase();
export const plural = (n, one, few, many) => { const a = Math.abs(n) % 100, b = a % 10; return a > 10 && a < 20 ? many : b > 1 && b < 5 ? few : b === 1 ? one : many; };
export const lsGet = (k, def = null) => { try { const v = localStorage.getItem("podhod." + k); return v === null ? def : JSON.parse(v); } catch (_) { return def; } };
export const lsSet = (k, v) => { try { if (v === null || v === undefined) localStorage.removeItem("podhod." + k); else localStorage.setItem("podhod." + k, JSON.stringify(v)); } catch (_) { /* приватный режим */ } };

const ICON = {
  home:'<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  lift:'<path d="M6 7v10M3 9v6M18 7v10M21 9v6M6 12h12"/>',
  chart:'<path d="M4 20V11M10 20V5M16 20v-6M21 20H3"/>',
  body:'<circle cx="12" cy="5" r="2.5"/><path d="M6 9.5l6 1.5 6-1.5M12 11v4.5M12 15.5l-3 5.5M12 15.5l3 5.5"/>',
  users:'<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5M16 4.8a3.5 3.5 0 0 1 0 6.4M18.5 14.8c1.6.8 2.6 2.6 3 5.2"/>',
  build:'<rect x="3.5" y="3.5" width="7" height="7" rx="2"/><rect x="13.5" y="3.5" width="7" height="7" rx="2"/><rect x="3.5" y="13.5" width="7" height="7" rx="2"/><path d="M17 14v6M14 17h6"/>',
  copy:'<rect x="8" y="8" width="12" height="12" rx="2.5"/><path d="M16 8V5.5A1.5 1.5 0 0 0 14.5 4h-9A1.5 1.5 0 0 0 4 5.5v9A1.5 1.5 0 0 0 5.5 16H8"/>',
  book:'<path d="M5 4h10a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z"/><path d="M5 17a3 3 0 0 1 3-3h10"/>',
  back:'<path d="M15 5l-7 7 7 7"/>', x:'<path d="M6 6l12 12M18 6L6 18"/>', check:'<path d="M5 12.5l4.5 4.5L19 7"/>',
  plus:'<path d="M12 5v14M5 12h14"/>', up:'<path d="M6 15l6-6 6 6"/>', down:'<path d="M6 9l6 6 6-6"/>',
  trash:'<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
  ext:'<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
  play:'<path d="M8 5.5v13l10.5-6.5z" fill="currentColor" stroke="none"/>',
  video:'<rect x="3" y="6" width="13" height="12" rx="2.5"/><path d="M16 10.5l5-3v9l-5-3z"/>',
  dash:'<path d="M7 12h10"/>', dot:'<circle cx="12" cy="12" r="3.5" fill="currentColor" stroke="none"/>',
  bell:'<path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 20a2 2 0 0 0 4 0"/>',
  gear:'<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/>',
  sheet:'<rect x="4" y="3" width="16" height="18" rx="2.5"/><path d="M4 9h16M4 15h16M10 9v12"/>',
  save:'<path d="M5 4h11l3 3v12a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1z"/><path d="M8 4v5h7V4M8 20v-6h8v6"/>',
  cloud:'<path d="M7 18a4.5 4.5 0 0 1-.5-9A6 6 0 0 1 18 9.5a4 4 0 0 1-.5 8.5z"/>',
  swap:'<path d="M7 7h12l-3.5-3.5M17 17H5l3.5 3.5"/>',
  install:'<path d="M12 4v11M7.5 10.5L12 15l4.5-4.5M5 20h14"/>',
  sync:'<path d="M20 11a8 8 0 0 0-14.3-4.9L4 8M4 4v4h4M4 13a8 8 0 0 0 14.3 4.9L20 16M20 20v-4h-4"/>',
  logout:'<path d="M14 4h5v16h-5M10 8l-4 4 4 4M6 12h10"/>',
  off:'<path d="M3 3l18 18M7 18a4.5 4.5 0 0 1-1.2-8.8M10 6.2A6 6 0 0 1 18 9.5a4 4 0 0 1 2 7.2"/>'
};
export const ic = (n, cls = "i") => `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICON[n] || ""}</svg>`;

export const SEC = {warmup:["y", "Разминка"], circuit:["y", "Круг"], main:["r", "Основная часть"], hypertrophy:["b", "Гипертрофия"], cooldown:["g", "Кардиозаминка"], intervals:["g", "Интервалы"]};
export const SIMPLE = ["warmup", "cooldown", "intervals"];
export const REST_DEF = {main:120, hypertrophy:90, circuit:60};
export const KIND = {prep:["y", "Подготовка"], hypertrophy:["b", "Гипертрофия"], strength:["r", "Сила"], bodybuilding:["g", "Бодибилдинг"]};
export const kindOf = k => KIND[k] || ["", "Цикл"];
export const LET = ["А", "В", "С", "D", "Е", "F"];
export const MUSCLES = ["Грудь", "Спина", "Ноги", "Ягодицы", "Плечи", "Руки", "Кор", "Всё тело", "Кардио"];
export const EQUIP = ["Штанга", "Гантели", "Гиря", "Блок", "Тренажёр", "Резина", "Свой вес", "Фитбол"];
export const TYPES = [["weight", "Вес и повторы"], ["reps", "Только повторы"], ["time", "Время"], ["distance", "Дистанция"]];
export const AVC = ["var(--blue)", "var(--red)", "var(--green)", "var(--yellow)"];

// Ссылки-приглашения: адрес приложения + сервер тренера (+ код подопечного)
export function appUrl() { return location.origin + location.pathname.replace(/index\.html$/, ""); }
export function serverUrl() { const a = lsGet("auth"); return (a && a.server) || lsGet("apiUrl") || (window.PODHOD || {}).apiUrl || ""; }
export function inviteLink(code) {
  const p = new URLSearchParams();
  if (serverUrl()) p.set("s", serverUrl());
  if (code) p.set("c", code);
  return appUrl() + (p.toString() ? "?" + p.toString() : "");
}
// Поделиться: системное меню телефона, иначе копия в буфер, иначе показать текст для ручного копирования
export function shareOrCopy(title, text, url) {
  const full = url ? (text ? text + "\n" + url : url) : text;
  if (navigator.share) {
    navigator.share(url ? {title, text, url} : {title, text}).catch(e => { if (!e || e.name !== "AbortError") copy(full); });
    return;
  }
  copy(full);
}
function copy(full) {
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(full).then(() => toast("Скопировано: можно вставить в мессенджер"), () => showCopy(full));
  else showCopy(full);
}
function showCopy(full) {
  const box = document.getElementById("copybox"); if (!box) { toast(full); return; }
  box.hidden = false; const ta = box.querySelector("textarea"); ta.value = full; ta.focus(); ta.select();
}

let toastT;
export function toast(msg) {
  const t = $("#toast"); if (!t) return;
  t.textContent = msg; t.classList.add("show");
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove("show"), 2800);
}
