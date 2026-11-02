// T3 Code 壁紙パッチ: 起動中のアプリに CDP (127.0.0.1 限定) で CSS を差し込む。ファイルは書き換えない。
// 依存なし（Node 22+ の組み込み WebSocket を使う）。アプリが終了すると自分も終了する。
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));
const cfg = JSON.parse(fs.readFileSync(path.join(dir, "config.json"), "utf8"));
const imgPath = path.resolve(dir, cfg.image);
const ext = path.extname(imgPath).slice(1).toLowerCase().replace("jpg", "jpeg");
const dataUri = `data:image/${ext};base64,` + fs.readFileSync(imgPath).toString("base64");
const veil = Math.min(100, Math.max(0, Number(cfg.veil ?? 78)));
const sideVeil = Math.min(100, Math.max(0, Number(cfg.sidebarVeil ?? 55)));
const sideBlur = Math.min(60, Math.max(0, Number(cfg.sidebarBlur ?? 18)));

const css = `
html::before{content:"";position:fixed;inset:0;z-index:-1;pointer-events:none;background:url("${dataUri}") center/cover no-repeat}
html,body{background-color:transparent!important;background-image:none!important}
main.relative{background-image:none!important;background-color:color-mix(in oklab,var(--app-theme-canvas) ${veil}%,transparent)!important}
main.relative .bg-background{background-color:transparent!important}
${cfg.sidebar ? `[data-slot="sidebar-inner"]{background-image:none!important;background-color:color-mix(in oklab,var(--app-theme-canvas) ${sideVeil}%,transparent)!important;-webkit-backdrop-filter:blur(${sideBlur}px) saturate(1.15);backdrop-filter:blur(${sideBlur}px) saturate(1.15)}` : ""}
`;
const script = `(()=>{const id="wp-style";const put=()=>{const r=document.head||document.documentElement;if(!r)return;const c=${JSON.stringify(css)};let s=document.getElementById(id);if(s){if(s.textContent!==c)s.textContent=c;return}s=document.createElement("style");s.id=id;s.textContent=c;r.appendChild(s)};window.__wpran=Date.now();put();document.addEventListener("DOMContentLoaded",put);new MutationObserver(put).observe(document,{childList:true,subtree:true})})()`;

const base = `http://127.0.0.1:${cfg.port ?? 9333}`;
const done = new Map(); // targetId -> ws
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function attach(t) {
  const ws = new WebSocket(t.webSocketDebuggerUrl);
  done.set(t.id, ws);
  let n = 0;
  const send = (method, params = {}) => ws.send(JSON.stringify({ id: ++n, method, params }));
  ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.error || d.id) console.log("resp", d.id, d.error ? JSON.stringify(d.error) : "ok"); };
  ws.onopen = () => {
    send("Page.enable");
    send("Page.addScriptToEvaluateOnNewDocument", { source: script });
    send("Runtime.evaluate", { expression: script });
    console.log("injected:", t.url);
  };
  ws.onclose = () => done.delete(t.id);
}

let lastSeen = Date.now();
for (;;) {
  try {
    const list = await (await fetch(`${base}/json/list`)).json();
    lastSeen = Date.now();
    for (const t of list) if (t.type === "page" && !done.has(t.id)) attach(t);
  } catch {
    if (Date.now() - lastSeen > 15000) { console.log("app closed"); process.exit(0); }
  }
  await sleep(2000);
}
