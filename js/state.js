// Общее состояние приложения, очередь отправки (работает без сети) и перерисовка.
import {lsGet, lsSet, toast} from "./util.js";
import {NetError} from "./api.js";
import {accKey} from "./accounts.js";

export const S = {
  api:null,
  auth:null,          // текущий вход: {id, server, code, role, name, clientId, coachName, mode}
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

const qKey = (a = S.auth) => "queue." + accKey(a);
export function loadQueue() { S.queue = lsGet(qKey(), []); }
export function saveCache() { if (S.auth && S.data) lsSet("cache." + accKey(S.auth), S.data); }
export function readCache() { return S.auth ? lsGet("cache." + accKey(S.auth)) : null; }

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
// Отправка очереди. Если во время отправки переключили вход, остаток очереди того входа
// остаётся на телефоне и уйдёт, когда в него вернутся.
const sameQ = (a, b) => a.at === b.at && a.action === b.action && a.key === b.key;
export function flush() {
  if (S.flushing) return S.flushing;
  if (!S.queue.length || !S.api || !S.auth) return Promise.resolve();
  const auth = S.auth, api = S.api, key = qKey(auth);
  S.syncing = true; schedule();
  S.flushing = (async () => {
    try {
      while (S.auth === auth && S.queue.length) {
        const q = S.queue[0];
        let res, err = null;
        try { res = await api.call(q.action, q.body, auth.code); } catch (e) { err = e; }
        if (S.auth !== auth) {   // вход сменился, пока шла отправка
          if (!(err instanceof NetError)) lsSet(key, (lsGet(key, []) || []).filter(x => !sameQ(x, q)));
          break;
        }
        if (err instanceof NetError) { S.online = false; break; }
        S.queue = S.queue.filter(x => x !== q); lsSet(key, S.queue);
        if (err) toast("Не сохранилось: " + err.message);
        else { S.online = true; S.hooks.synced.forEach(fn => fn(q, res)); }
      }
    } finally {
      S.syncing = false; S.flushing = null;
      if (S.auth === auth) saveCache();
      schedule();
    }
  })();
  return S.flushing;
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
