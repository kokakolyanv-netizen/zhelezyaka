// Общее состояние приложения, очередь отправки (работает без сети) и перерисовка.
import {lsGet, lsSet, toast} from "./util.js";
import {NetError} from "./api.js";

export const S = {
  api:null,
  auth:null,          // {code, role, name, clientId, mode}
  data:null,          // ответ bootstrap (кэшируется для работы без сети)
  queue:[],           // отложенные записи: [{action, body, key}]
  online:navigator.onLine,
  syncing:false,
  loading:false,
  error:null,
  ui:{},
  hooks:{synced:[]}
};

let renderFn = null, pending = false;
export function setRenderer(fn) { renderFn = fn; }
// перерисовка один раз за кадр; запасной таймер — если вкладка в фоне и кадры не идут
export function schedule() {
  if (pending) return;
  pending = true;
  const run = () => { if (!pending) return; pending = false; if (renderFn) renderFn(); };
  requestAnimationFrame(run);
  setTimeout(run, 80);
}

export function call(action, body = {}) {
  return S.api.call(action, body, S.auth && S.auth.code);
}

const qKey = () => "queue." + (S.auth ? S.auth.mode + "." + S.auth.code : "anon");
export function loadQueue() { S.queue = lsGet(qKey(), []); }
export function saveCache() { if (S.auth && S.data) lsSet("cache." + S.auth.mode + "." + S.auth.code, S.data); }
export function readCache() { return S.auth ? lsGet("cache." + S.auth.mode + "." + S.auth.code) : null; }

// Запись, которая не должна потеряться без сети: кладём в очередь, отправляем, повторяем при появлении связи.
// key: одинаковый ключ = более новая запись заменяет старую (например, вся тренировка целиком).
export function send(action, body, key) {
  S.queue = S.queue.filter(q => !(key && q.key === key));
  S.queue.push({action, body, key:key || null, at:Date.now()});
  lsSet(qKey(), S.queue);
  saveCache();
  clearTimeout(send.t);
  send.t = setTimeout(flush, 600);
  schedule();
}
export async function flush() {
  if (S.syncing || !S.queue.length || !S.api) return;
  S.syncing = true; schedule();
  try {
    while (S.queue.length) {
      const q = S.queue[0];
      try {
        const res = await call(q.action, q.body);
        S.queue.shift(); lsSet(qKey(), S.queue);
        S.online = true;
        S.hooks.synced.forEach(fn => fn(q, res));
      } catch (e) {
        if (e instanceof NetError) { S.online = false; break; }
        S.queue.shift(); lsSet(qKey(), S.queue);
        toast("Не сохранилось: " + e.message);
      }
    }
  } finally { S.syncing = false; saveCache(); schedule(); }
}
window.addEventListener("online", () => { S.online = true; flush(); schedule(); });
window.addEventListener("offline", () => { S.online = false; schedule(); });
setInterval(() => { if (S.queue.length) flush(); }, 20000);

// Действие тренера, которое нужно сделать сразу (не в очередь): с индикатором и понятной ошибкой
export async function act(action, body, okMsg) {
  S.ui.busy = action; schedule();
  try {
    const res = await call(action, body);
    S.online = true;
    if (okMsg) toast(okMsg);
    return res;
  } catch (e) {
    toast(e instanceof NetError ? "Нет связи. Действие тренера требует интернета" : e.message);
    throw e;
  } finally { S.ui.busy = null; schedule(); }
}
