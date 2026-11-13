// Экран «Как пользоваться». Текст лежит в help.md — тот же файл попадает в README на GitHub,
// поэтому инструкция в приложении и на сайте всегда одинаковая.
//   # Вкладка      ## Раздел (раскрывается)      - пункт      1. шаг      **жирный**      `код`
import {S, schedule} from "./state.js";
import {esc, ic} from "./util.js";

let text = null, loading = null;
function load() {
  if (!loading) loading = fetch("help.md", {cache:"no-cache"}).then(r => r.ok ? r.text() : "").catch(() => "")
    .then(t => { text = t; schedule(); });
  return loading;
}
const inline = s => esc(s).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/`([^`]+)`/g, "<code>$1</code>");
function parse(src) {
  const tabs = [];
  let tab = null, sec = null, list = null, sub = false;
  const closeSub = () => { if (sec && sub) sec.html += "</ul></li>"; sub = false; };
  const close = () => { closeSub(); if (sec && list) sec.html += `</${list}>`; list = null; };
  for (const raw of src.split(/\r?\n/)) {
    const line = raw.trimEnd();
    let m;
    if (line.startsWith("# ")) { close(); tab = {title:line.slice(2), sections:[]}; tabs.push(tab); sec = null; continue; }
    if (line.startsWith("## ") && tab) { close(); sec = {title:line.slice(3), html:""}; tab.sections.push(sec); continue; }
    if (!sec) continue;
    if ((m = line.match(/^\s+- (.*)/)) && list) {   // вложенный пункт — внутрь предыдущего
      if (!sub) { sec.html = sec.html.replace(/<\/li>$/, "") + "<ul>"; sub = true; }
      sec.html += `<li>${inline(m[1])}</li>`;
      continue;
    }
    if ((m = line.match(/^- (.*)/)) || (m = line.match(/^\d+\. (.*)/))) {
      closeSub();
      const kind = line.startsWith("- ") ? "ul" : "ol";
      if (list !== kind) { close(); sec.html += `<${kind}>`; list = kind; }
      sec.html += `<li>${inline(m[1])}</li>`;
    } else if (line.trim()) { close(); sec.html += `<p>${inline(line)}</p>`; }
    else close();
  }
  close();
  return tabs;
}
// какие разделы раскрыты — помним, чтобы фоновая перерисовка их не сворачивала
document.addEventListener("toggle", e => {
  const d = e.target;
  if (!d.classList || !d.classList.contains("hsec")) return;
  S.ui.helpOpen = S.ui.helpOpen || {};
  S.ui.helpOpen[d.dataset.k] = d.open;
}, true);

export function helpScreen(role, back) {
  const head = `<div class="nav"><a class="icon-btn" href="${back}" aria-label="Назад">${ic("back")}</a><h3 class="d">Как пользоваться</h3></div>`;
  if (text === null) { load(); return head + `<div class="stack"><div class="skel"></div><div class="skel" style="width:70%"></div></div>`; }
  const tabs = parse(text);
  if (!tabs.length) return head + `<div class="card"><p style="margin:0">Инструкция не загрузилась. Проверьте интернет и откройте этот экран ещё раз.</p></div>`;
  const def = role === "coach" ? Math.max(0, tabs.findIndex(t => /тренер/i.test(t.title))) : 0;
  const cur = Math.min(S.ui.helpTab != null ? S.ui.helpTab : def, tabs.length - 1);
  const open = S.ui.helpOpen || {};
  return head + `<div class="chipset helptabs" role="tablist">${tabs.map((t, i) =>
      `<button class="ch" role="tab" data-act="help-tab" data-v="${i}" aria-pressed="${i === cur}" aria-selected="${i === cur}">${esc(t.title)}</button>`).join("")}</div>
    <div class="stack help">${tabs[cur].sections.map((s, i) => {
      const k = cur + ":" + i, isOpen = open[k] != null ? open[k] : i === 0;
      return `<details class="hsec" data-k="${k}" ${isOpen ? "open" : ""}><summary>${esc(s.title)}</summary><div class="hbody">${s.html}</div></details>`;
    }).join("")}</div>`;
}
