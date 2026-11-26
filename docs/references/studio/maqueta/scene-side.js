// Direction B: the studio as an assembly line seen from the side. One conveyor belt snakes
// through every station; at your desks a barrier stops the belt until you approve.

const SN = "http://www.w3.org/2000/svg";
function E(tag, a = {}, p) { const n = document.createElementNS(SN, tag); for (const [k, v] of Object.entries(a)) n.setAttribute(k, v); if (p) p.appendChild(n); return n; }
function T(p, x, y, s, a = {}) { const t = E("text", { x, y, fill: "#e8eaed", "font-family": "Geist, sans-serif", "font-size": 11, ...a }, p); t.textContent = s; return t; }
const SK = ["#e8b894", "#c98d64", "#8d5a3b", "#f1c9a5"], HR = ["#2b1d14", "#6b3d1f", "#141414", "#a8743f"];
const MAN = "#d9b66f";
const LAMPC = { live: "#f2555a", cued: "#f2b53a", ready: "#3dd68c", off: "#7d8491", fail: "#f2555a" };
const SV = Object.fromEntries(STUDIO.videos.map((v) => [v.office, v]));

function sdefs(svg) {
  E("defs", {}, svg).innerHTML = `
    <pattern id="panels" width="74" height="40" patternUnits="userSpaceOnUse"><rect width="74" height="40" fill="#171b22"/><path d="M0 39.5H74M73.5 0V40" stroke="#1f242d"/><circle cx="6" cy="6" r="1.2" fill="#262c36"/><circle cx="68" cy="6" r="1.2" fill="#262c36"/></pattern>
    <pattern id="belt" width="28" height="22" patternUnits="userSpaceOnUse"><rect width="28" height="22" fill="#2a2f38"/><path d="M10 6l6 5-6 5" stroke="#3b414e" stroke-width="2.4" fill="none" stroke-linecap="round"/><path d="M27.5 0V22" stroke="#20242c"/></pattern>
    <pattern id="beltL" width="28" height="22" patternUnits="userSpaceOnUse"><rect width="28" height="22" fill="#2a2f38"/><path d="M18 6l-6 5 6 5" stroke="#3b414e" stroke-width="2.4" fill="none" stroke-linecap="round"/><path d="M27.5 0V22" stroke="#20242c"/></pattern>
    <pattern id="beltD" width="22" height="28" patternUnits="userSpaceOnUse"><rect width="22" height="28" fill="#2a2f38"/><path d="M6 10l5 6 5-6" stroke="#3b414e" stroke-width="2.4" fill="none" stroke-linecap="round"/><path d="M0 27.5H22" stroke="#20242c"/></pattern>
    <radialGradient id="sl"><stop offset="0" stop-color="#ffcf7a" stop-opacity=".32"/><stop offset="1" stop-color="#ffb347" stop-opacity="0"/></radialGradient>
    <radialGradient id="sc"><stop offset="0" stop-color="#7fb8ff" stop-opacity=".3"/><stop offset="1" stop-color="#7fb8ff" stop-opacity="0"/></radialGradient>
    <radialGradient id="sa"><stop offset="0" stop-color="#f2555a" stop-opacity=".45"/><stop offset="1" stop-color="#f2555a" stop-opacity="0"/></radialGradient>
    <radialGradient id="sw"><stop offset="0" stop-color="#f2b53a" stop-opacity=".45"/><stop offset="1" stop-color="#f2b53a" stop-opacity="0"/></radialGradient>
    <linearGradient id="cone" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffd48a" stop-opacity=".22"/><stop offset="1" stop-color="#ffd48a" stop-opacity="0"/></linearGradient>
    <filter id="ds" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="3" stdDeviation="2" flood-color="#000" flood-opacity=".5"/></filter>`;
}

// ----- side-view props (local station coords: 222 × 300, floor at y=230) -----
const FLOOR = 230;
function chairS(g, x, dir = 1) {
  E("rect", { x: x - 14, y: FLOOR - 52, width: 28, height: 6, rx: 3, fill: "#2b313c" }, g);
  E("rect", { x: x - 14 * dir - (dir > 0 ? 4 : 0), y: FLOOR - 92, width: 6, height: 46, rx: 3, fill: "#2b313c" }, g);
  E("rect", { x: x - 2, y: FLOOR - 46, width: 4, height: 38, fill: "#232832" }, g);
  E("rect", { x: x - 14, y: FLOOR - 8, width: 28, height: 4, rx: 2, fill: "#232832" }, g);
}
function personS(g, x, { dir = 1, shirt = "#4f6d8f", skin = 0, hair = 0, pose = "work", stand = false } = {}) {
  const p = E("g", { transform: `translate(${x} 0) scale(${dir} 1)`, filter: "url(#ds)" }, g);
  const seat = stand ? FLOOR - 4 : FLOOR - 52;
  const hip = stand ? FLOOR - 62 : seat;
  // legs
  if (stand) { E("rect", { x: -9, y: hip, width: 8, height: 58, rx: 3, fill: "#2c3442" }, p); E("rect", { x: 2, y: hip, width: 8, height: 58, rx: 3, fill: "#2c3442" }, p); }
  else { E("path", { d: `M-8 ${seat}h30v8h-6v40h-8v-32h-16Z`, fill: "#2c3442" }, p); }
  // torso
  const sleep = pose === "sleep";
  E("rect", { x: -12, y: hip - 46, width: 24, height: 48, rx: 10, fill: shirt, transform: sleep ? `rotate(38 0 ${hip})` : "" }, p);
  const hx = sleep ? 26 : 2, hy = sleep ? hip - 42 : hip - 58;
  E("circle", { cx: hx, cy: hy, r: 11, fill: SK[skin] }, p);
  E("path", { d: `M${hx - 11} ${hy}a11 11 0 0 1 22 -2c-4 -3 -10 -5 -15 -3c-3 1 -5 3 -7 5Z`, fill: HR[hair] }, p);
  if (!sleep) E("circle", { cx: hx + 6, cy: hy - 1, r: 1.4, fill: "#1a1a1a" }, p);
  // arm toward the desk
  if (pose === "work") E("path", { d: `M0 ${hip - 34}l26 14l14 -2`, stroke: shirt, "stroke-width": 8, fill: "none", "stroke-linecap": "round" }, p);
  if (pose === "alarm") E("path", { d: `M0 ${hip - 36}l12 -26M0 ${hip - 36}l-12 -24`, stroke: shirt, "stroke-width": 7, fill: "none", "stroke-linecap": "round" }, p);
  if (pose === "idle") E("path", { d: `M0 ${hip - 34}l16 18l10 -4`, stroke: shirt, "stroke-width": 8, fill: "none", "stroke-linecap": "round" }, p);
  return p;
}
function robotS(g, x, { dir = 1, on = true } = {}) {
  const r = E("g", { transform: `translate(${x} 0) scale(${dir} 1)`, filter: "url(#ds)" }, g);
  E("rect", { x: -6, y: FLOOR - 40, width: 12, height: 36, fill: "#4a5161" }, r);
  E("rect", { x: -18, y: FLOOR - 6, width: 36, height: 6, rx: 3, fill: "#3a414e" }, r);
  E("rect", { x: -18, y: FLOOR - 92, width: 36, height: 54, rx: 8, fill: "#6b7486" }, r);
  E("rect", { x: -12, y: FLOOR - 84, width: 26, height: 18, rx: 4, fill: "#11151b" }, r);
  E("rect", { x: -6, y: FLOOR - 78, width: 4, height: 6, rx: 1, fill: on ? "#7fe0ff" : "#2b313c" }, r);
  E("rect", { x: 4, y: FLOOR - 78, width: 4, height: 6, rx: 1, fill: on ? "#7fe0ff" : "#2b313c" }, r);
  E("line", { x1: 0, y1: FLOOR - 92, x2: 0, y2: FLOOR - 104, stroke: "#7a8496", "stroke-width": 2 }, r);
  E("circle", { cx: 0, cy: FLOOR - 106, r: 3, fill: on ? "#3dd68c" : "#3a414e" }, r);
  E("path", { d: `M14 ${FLOOR - 66}l20 10`, stroke: "#6b7486", "stroke-width": 7, "stroke-linecap": "round" }, r);
}
function deskS(g, x, w = 96) {
  E("rect", { x: x - w / 2, y: FLOOR - 66, width: w, height: 8, rx: 2, fill: "#6b5140", filter: "url(#ds)" }, g);
  E("rect", { x: x - w / 2 + 6, y: FLOOR - 58, width: 6, height: 58, fill: "#4a3829" }, g);
  E("rect", { x: x + w / 2 - 12, y: FLOOR - 58, width: 6, height: 58, fill: "#4a3829" }, g);
}
function monitorS(g, x, color = "#a8d4ff", on = true) {
  E("rect", { x: x - 22, y: FLOOR - 104, width: 44, height: 32, rx: 3, fill: "#11151b", stroke: "#2b313c" }, g);
  E("rect", { x: x - 18, y: FLOOR - 100, width: 36, height: 24, rx: 1, fill: on ? color : "#1a1e26", opacity: on ? .85 : 1 }, g);
  E("rect", { x: x - 3, y: FLOOR - 72, width: 6, height: 6, fill: "#2b313c" }, g);
}
function lampS(g, x, on) {
  E("path", { d: `M${x} ${FLOOR - 66}v-40l16 -14`, stroke: "#5d6676", "stroke-width": 3, fill: "none" }, g);
  E("path", { d: `M${x + 8} ${FLOOR - 128}l20 6 -6 14Z`, fill: on ? "#f2c46b" : "#3a414e" }, g);
  if (on) E("path", { d: `M${x + 24} ${FLOOR - 112}l-30 46h70Z`, fill: "url(#cone)" }, g);
}
function folderS(g, x, tab, code, { y = FLOOR, tilt = 0, flag } = {}) {
  const f = E("g", { transform: `translate(${x} ${y}) rotate(${tilt})`, filter: "url(#ds)" }, g);
  E("rect", { x: -14, y: -44, width: 14, height: 7, rx: 2, fill: tab }, f);
  E("rect", { x: -16, y: -38, width: 32, height: 38, rx: 2, fill: MAN }, f);
  E("path", { d: "M-16 -30H16", stroke: "#b8964f" }, f);
  T(f, 0, -12, code, { "font-family": "Geist Mono, monospace", "font-size": 11, "font-weight": 600, fill: "#3a2a12", "text-anchor": "middle" });
  if (flag === "fail") { E("circle", { cx: 14, cy: -38, r: 8, fill: "#f2555a" }, f); E("path", { d: "M10 -42l8 8M18 -42l-8 8", stroke: "#fff", "stroke-width": 2 }, f); }
}
function bubbleS(g, x, y, s, kind = "say") {
  const w = s.length * 6.6 + 16, fill = { say: "#e8eaed", alarm: "#f2555a", wait: "#f2b53a" }[kind];
  E("rect", { x: x - w / 2, y: y - 11, width: w, height: 22, rx: 11, fill, filter: "url(#ds)" }, g);
  E("path", { d: `M${x - 5} ${y + 10}l5 8 5-8Z`, fill }, g);
  T(g, x, y + 4, s, { "font-size": 11, "font-weight": 600, fill: kind === "alarm" ? "#fff" : "#16191f", "text-anchor": "middle" });
}
function zzzS(g, x, y) { [[0, 0, 10], [8, -10, 13], [18, -22, 16]].forEach(([dx, dy, s]) => T(g, x + dx, y + dy, "z", { "font-size": s, "font-weight": 600, fill: "#a3a9b4" })); }
function gate(g, x, open) {
  E("rect", { x: x - 5, y: FLOOR - 64, width: 10, height: 64, rx: 2, fill: "#3a414e" }, g);
  E("circle", { cx: x, cy: FLOOR - 70, r: 7, fill: open ? "#3dd68c" : "#f2b53a" }, g);
  const arm = E("g", { transform: open ? `rotate(-70 ${x} ${FLOOR - 40})` : "" }, g);
  E("rect", { x: x - 2, y: FLOOR - 44, width: 82, height: 8, rx: 3, fill: "#e8eaed" }, arm);
  for (let i = 0; i < 4; i++) E("rect", { x: x + 8 + i * 20, y: FLOOR - 44, width: 10, height: 8, fill: "#f2555a" }, arm);
}

// ----- stations -----
const ST = {
  lobby(g) {
    E("path", { d: `M70 ${FLOOR - 150}h82l-22 60h-38Z`, fill: "#3a414e", stroke: "#4a5161" }, g);
    E("rect", { x: 92, y: FLOOR - 90, width: 38, height: 88, fill: "#2b313c" }, g);
    T(g, 111, FLOOR - 120, "TEMAS", { "font-size": 9, "letter-spacing": "1.6", fill: "#a3a9b4", "text-anchor": "middle" });
    E("rect", { x: 150, y: FLOOR - 70, width: 40, height: 22, rx: 4, fill: "#e8eaed" }, g);
    T(g, 170, FLOOR - 55, "+", { "font-size": 16, "font-weight": 700, fill: "#16191f", "text-anchor": "middle" });
    return { state: "off", status: "0 temas", count: "nuevo video" };
  },
  research(g) {
    deskS(g, 120); monitorS(g, 132, "#a8d4ff", false); lampS(g, 86, false);
    for (let i = 0; i < 3; i++) E("rect", { x: 152, y: FLOOR - 74 - i * 8, width: 26, height: 8, fill: ["#8a4b3c", "#3f6b8a", "#c9a24b"][i] }, g);
    chairS(g, 62); personS(g, 62, { shirt: "#6d5a8f", skin: 0, hair: 1, pose: "sleep" }); zzzS(g, 100, FLOOR - 112);
    return { state: "off", status: "Libre", count: "cola 0 · hoy 1 · 3:55" };
  },
  sources(g) {
    deskS(g, 130);
    for (let i = 0; i < 3; i++) E("rect", { x: 112 + i * 4, y: FLOOR - 82 + i * 2, width: 30, height: 16, fill: "#e8e2d4", transform: `rotate(${i * 6 - 6} 126 ${FLOOR - 72})` }, g);
    robotS(g, 70, { on: false });
    return { state: "off", status: "Libre", count: "cola 0 · hoy 1 · 0:06" };
  },
  images(g) {
    E("circle", { cx: 111, cy: 150, r: 110, fill: "url(#sa)" }, g);
    E("rect", { x: 34, y: 70, width: 150, height: 56, rx: 3, fill: "#5a4632" }, g);
    ["#6d7f8f", "#b9a27f", "#4d5a66", "#8f7b5c", "#a3a9b4"].forEach((c, i) => E("rect", { x: 42 + i * 28, y: 78 + (i % 2) * 8, width: 22, height: 30, fill: c, stroke: "#eee", "stroke-width": 2 }, g));
    deskS(g, 138); monitorS(g, 150, "#f2555a");
    T(g, 150, FLOOR - 83, "429", { "font-family": "Geist Mono, monospace", "font-size": 12, "font-weight": 600, fill: "#16191f", "text-anchor": "middle" });
    // siren
    E("rect", { x: 186, y: 58, width: 16, height: 8, fill: "#3a414e" }, g); E("path", { d: "M188 58a6 8 0 0 1 12 0Z", fill: "#f2555a" }, g);
    personS(g, 70, { shirt: "#8f4f4f", skin: 2, hair: 2, pose: "alarm", stand: true });
    bubbleS(g, 70, FLOOR - 150, "¡429!", "alarm");
    return { state: "fail", status: "Falla", count: "reintentar", alarm: true };
  },
  script(g) {
    E("circle", { cx: 120, cy: FLOOR - 70, r: 110, fill: "url(#sl)" }, g);
    deskS(g, 126); lampS(g, 160, true);
    // typewriter with a page coming out
    E("rect", { x: 96, y: FLOOR - 86, width: 50, height: 20, rx: 4, fill: "#2b313c" }, g);
    E("rect", { x: 106, y: FLOOR - 116, width: 30, height: 32, fill: "#e8e2d4" }, g);
    for (let i = 0; i < 4; i++) E("rect", { x: 110, y: FLOOR - 110 + i * 6, width: 22 - (i % 2) * 6, height: 2, fill: "#7d8491" }, g);
    chairS(g, 62); personS(g, 62, { shirt: "#3f7a6a", skin: 3, hair: 0, pose: "work" });
    // the rejected first attempt
    E("rect", { x: 176, y: FLOOR - 26, width: 22, height: 26, rx: 3, fill: "#3a414e" }, g);
    E("circle", { cx: 187, cy: FLOOR - 28, r: 7, fill: "#e8e2d4" }, g);
    bubbleS(g, 128, FLOOR - 150, "intento 2/3");
    return { state: "live", status: "Escribiendo · 1:12", count: "cola 0 · hoy 2 · 2:06", hold: "04" };
  },
  facts(g) {
    E("rect", { x: 132, y: 70, width: 60, height: 70, rx: 2, fill: "#e8e2d4", opacity: .9 }, g);
    for (let i = 0; i < 5; i++) E("path", { d: `M140 ${84 + i * 11}l3 3 6-6M154 ${84 + i * 11}h30`, stroke: "#3f7a4f", "stroke-width": 2, fill: "none" }, g);
    deskS(g, 110); monitorS(g, 116, "#a8d4ff", false);
    chairS(g, 50); personS(g, 50, { shirt: "#4f6d8f", skin: 1, hair: 3, pose: "idle" });
    return { state: "off", status: "Libre", count: "cola 0 · hoy 1 · 1:34" };
  },
  deskScript(g) {
    deskS(g, 104, 110);
    E("rect", { x: 64, y: FLOOR - 82, width: 26, height: 16, rx: 2, fill: "#8a4b3c" }, g);
    E("rect", { x: 70, y: FLOOR - 90, width: 14, height: 8, fill: "#5a3138" }, g);
    chairS(g, 150, -1);
    T(g, 150, FLOOR - 104, "VOS", { "font-size": 9, "font-weight": 600, "letter-spacing": "1.6", fill: "#a3a9b4", "text-anchor": "middle" });
    gate(g, 20, true);
    return { state: "off", status: "Nada que aprobar", count: "guion · hoy 1" , desk: true };
  },
  voice(g) {
    E("rect", { x: 30, y: 72, width: 164, height: 158, rx: 6, fill: "#241e35", stroke: "#3d3354", "stroke-width": 3 }, g);
    E("rect", { x: 44, y: 86, width: 136, height: 64, rx: 3, fill: "#2c2540" }, g);
    E("rect", { x: 140, y: 56, width: 54, height: 16, rx: 3, fill: "#1a0f12", stroke: "#4a2a30" }, g);
    T(g, 167, 68, "ON AIR", { "font-size": 9, "font-weight": 700, "letter-spacing": "1.2", fill: "#5a3138", "text-anchor": "middle" });
    E("line", { x1: 128, y1: FLOOR, x2: 128, y2: FLOOR - 110, stroke: "#5d6676", "stroke-width": 3 }, g);
    E("rect", { x: 120, y: FLOOR - 124, width: 16, height: 22, rx: 8, fill: "#c9cdd4" }, g);
    chairS(g, 82); personS(g, 82, { shirt: "#8f7a4f", skin: 1, hair: 0, pose: "idle" });
    E("path", { d: `M72 ${FLOOR - 118}a12 12 0 0 1 24 0`, stroke: "#141414", "stroke-width": 4, fill: "none" }, g);
    return { state: "off", status: "Libre", count: "cola 0 · 1.917 créditos" };
  },
  render(g) {
    E("circle", { cx: 111, cy: FLOOR - 80, r: 120, fill: "url(#sc)" }, g);
    E("rect", { x: 28, y: 84, width: 130, height: 146, rx: 8, fill: "#3a414e", stroke: "#4a5161", "stroke-width": 2 }, g);
    E("rect", { x: 42, y: 100, width: 102, height: 64, rx: 4, fill: "#0b0e13" }, g);
    E("rect", { x: 48, y: 106, width: 90, height: 52, rx: 2, fill: "#7fb4e8", opacity: .25 }, g);
    T(g, 93, 128, "16:9", { "font-family": "Geist Mono, monospace", "font-size": 12, fill: "#cfe4ff", "text-anchor": "middle" });
    T(g, 93, 146, "41 %", { "font-family": "Geist Mono, monospace", "font-size": 14, "font-weight": 600, fill: "#fff", "text-anchor": "middle" });
    E("rect", { x: 42, y: 176, width: 102, height: 8, rx: 4, fill: "#1e232b" }, g);
    E("rect", { x: 42, y: 176, width: 42, height: 8, rx: 4, fill: "#7fb4e8" }, g);
    for (let i = 0; i < 3; i++) E("circle", { cx: 60 + i * 34, cy: 206, r: 8, fill: "#2b313c", stroke: "#5d6676", "stroke-width": 2 }, g);
    robotS(g, 186, { dir: -1 });
    return { state: "live", status: "16:9 al 41 %", count: "9:16 listo · 6:40", hold: "03" };
  },
  package(g) {
    E("rect", { x: 40, y: 74, width: 146, height: 60, rx: 3, fill: "#5a4632" }, g);
    E("rect", { x: 50, y: 82, width: 70, height: 40, fill: "#3f6b8a", stroke: "#eee", "stroke-width": 2 }, g);
    E("rect", { x: 132, y: 80, width: 26, height: 46, fill: "#8a4b3c", stroke: "#eee", "stroke-width": 2 }, g);
    deskS(g, 124); E("rect", { x: 128, y: FLOOR - 88, width: 16, height: 22, rx: 3, fill: "#8a4b3c" }, g);
    chairS(g, 62); personS(g, 62, { shirt: "#5a7d4f", skin: 2, hair: 1, pose: "idle" });
    return { state: "off", status: "Libre", count: "cola 0 · hoy 1 · 0:41" };
  },
  deskVideo(g) {
    E("circle", { cx: 111, cy: FLOOR - 50, r: 120, fill: "url(#sw)" }, g);
    deskS(g, 118, 110);
    E("rect", { x: 92, y: FLOOR - 106, width: 56, height: 36, rx: 3, fill: "#11151b" }, g);
    E("rect", { x: 96, y: FLOOR - 102, width: 48, height: 28, fill: "#3f6b8a", opacity: .7 }, g);
    E("path", { d: `M114 ${FLOOR - 94}l10 6-10 6Z`, fill: "#fff" }, g);
    chairS(g, 170, -1);
    T(g, 170, FLOOR - 104, "VOS", { "font-size": 9, "font-weight": 600, "letter-spacing": "1.6", fill: "#a3a9b4", "text-anchor": "middle" });
    gate(g, 26, false);
    bubbleS(g, 118, FLOOR - 140, "¡te espera!", "wait");
    return { state: "cued", status: "Te espera", count: "aprobar video · 15 h", desk: true, wait: "02" };
  },
  archive(g) {
    for (let r = 0; r < 3; r++) {
      E("rect", { x: 30, y: 112 + r * 40, width: 110, height: 6, fill: "#4a3829" }, g);
      for (let i = 0; i < 6; i++) { E("rect", { x: 36 + i * 17, y: 86 + r * 40, width: 14, height: 26, fill: MAN, stroke: "#b8964f" }, g); E("rect", { x: 36 + i * 17, y: 86 + r * 40, width: 14, height: 6, fill: ["var(--v4)", "#c9a24b", "#7fb4e8", "#5a7d4f", "var(--v2)", "#7fb4e8"][(i + r) % 6] }, g); }
    }
    E("rect", { x: 146, y: FLOOR - 50, width: 60, height: 50, rx: 3, fill: "#6b5140", stroke: "#2e2219", "stroke-width": 2 }, g);
    T(g, 176, FLOOR - 20, "LISTO", { "font-size": 10, "font-weight": 700, "letter-spacing": "1.6", fill: "#2e2219", "text-anchor": "middle" });
    folderS(g, 176, SV.archive.tab, SV.archive.code, { y: FLOOR - 48, tilt: -6 });
    return { state: "ready", status: "1 paquete listo", count: "descargar" };
  },
};

function stationSign(g, x, y, office, info, w) {
  const s = E("g", {}, g);
  const r = E("rect", { x, y, height: 26, rx: 3, fill: "#1a1e26", stroke: "#343a47" }, s);
  let cx = x + 10;
  if (office.n) { T(s, cx, y + 17, String(office.n), { "font-family": "Geist Mono, monospace", fill: "#7d8491" }); cx += 15; }
  const t = T(s, cx, y + 17, office.name.toUpperCase(), { "font-weight": 600, "letter-spacing": "2.2" });
  requestAnimationFrame(() => r.setAttribute("width", Math.min(w - 4, t.getBBox().x + t.getBBox().width - x + 10)));
  const c = LAMPC[info.state];
  E("g", { transform: `translate(${x + 1} ${y + 36})`, color: c }, s).innerHTML = lamp(info.state).replace("<svg", '<svg width="10" height="10"');
  T(s, x + 17, y + 45, info.status.toUpperCase(), { "font-size": 10, "font-weight": 500, "letter-spacing": "1.5", fill: c });
}

const ORDER = [
  ["lobby", { name: "Recepción" }], ["research"], ["sources"], ["images"], ["script"], ["facts"],
  ["deskScript", { name: "Tu escritorio · guion" }], ["voice"], ["render"], ["package"], ["deskVideo", { name: "Tu escritorio · video" }], ["archive"],
];
const OFF = Object.fromEntries(STUDIO.offices.map((o) => [o.id, o]));

function stationGroup(parent, id, office, x, y, w, phone) {
  const g = E("g", { transform: `translate(${x} ${y})` }, parent);
  E("rect", { x: 4, y: 60, width: w - 8, height: FLOOR - 60, rx: 4, fill: "url(#panels)" }, g);
  const props = E("g", {}, g);
  const info = ST[id](props);
  const dark = !["live", "fail", "cued", "ready"].includes(info.state);
  if (dark) E("rect", { x: 4, y: 60, width: w - 8, height: FLOOR - 60, rx: 4, fill: "#05070a", opacity: .45 }, g);
  if (!phone) {
    stationSign(g, 8, 4, office, info, w);
    T(g, 10, FLOOR + 50, info.count.toUpperCase(), { "font-family": "Geist Mono, monospace", "font-size": 10, "letter-spacing": "1", fill: "#7d8491" });
  }
  return info;
}

window.drawLine = (host, phone) => {
  const svg = E("svg", { width: "100%", role: "img", "aria-label": "Línea de montaje del estudio" }, host);
  sdefs(svg);
  if (!phone) {
    const W = 1336, sw = W / 6, rowH = 300, gap = 34, H = rowH * 2 + gap + 16;
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    E("rect", { width: W, height: H, rx: 10, fill: "#101318" }, svg);
    const rows = [ORDER.slice(0, 6), ORDER.slice(6).reverse()];
    const belts = E("g", {}, svg), st = E("g", {}, svg), fronts = E("g", {}, svg);
    rows.forEach((row, ri) => {
      const y = 8 + ri * (rowH + gap);
      // belt along the row (in front of the stations)
      E("rect", { x: 10, y: y + FLOOR, width: W - 44, height: 22, rx: 11, fill: `url(#${ri ? "beltL" : "belt"})`, stroke: "#3b414e", "stroke-width": 2 }, fronts);
      for (let k = 0; k < 24; k++) E("circle", { cx: 30 + k * 55, cy: y + FLOOR + 11, r: 3, fill: "#4a5161" }, fronts);
      row.forEach(([id, over], i) => {
        const office = over ? { ...OFF[id], ...over } : OFF[id];
        const realIndex = i;
        const info = stationGroup(st, id, office, realIndex * sw, y, sw, false);
        const fx = realIndex * sw;
        if (info.hold) { const v = STUDIO.videos.find((v) => v.code === info.hold); folderS(fronts, fx + sw * 0.78, v.tab, v.code, { y: y + FLOOR + 2 }); }
        if (info.wait) { const v = SV.desk; folderS(fronts, fx + 132, v.tab, v.code, { y: y + FLOOR + 2 }); }
        if (info.alarm) { const v = SV.images; folderS(fronts, fx + sw * 0.8, v.tab, v.code, { y: y + FLOOR + 2, flag: "fail" }); }
      });
    });
    // chute: the belt leaves row 1 on the right and comes back into row 2 on the right
    const y1 = 8 + FLOOR + 11, y2 = 8 + rowH + gap + FLOOR + 11;
    fronts.insertBefore(E("path", { d: `M${W - 40} ${y1}H${W - 30}q22 0 22 26V${y2 - 26}q0 26 -22 26H${W - 40}`, stroke: "#3b414e", "stroke-width": 26, fill: "none" }), fronts.firstChild);
    fronts.insertBefore(E("path", { d: `M${W - 40} ${y1}H${W - 30}q22 0 22 26V${y2 - 26}q0 26 -22 26H${W - 40}`, stroke: "#2a2f38", "stroke-width": 22, fill: "none" }), fronts.children[1]);
    [y1 + 90, y1 + 170, y1 + 250].forEach((cy) => E("path", { d: `M${W - 14} ${cy - 4}l6 7 6-7`, stroke: "#4a5161", "stroke-width": 2.4, fill: "none", "stroke-linecap": "round" }, fronts));
  } else {
    const W = 358, ph = 132, H = ORDER.length * ph + 16;
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    E("rect", { width: W, height: H, rx: 10, fill: "#101318" }, svg);
    E("rect", { x: 16, y: 10, width: 22, height: H - 20, rx: 11, fill: "url(#beltD)", stroke: "#3b414e", "stroke-width": 2 }, svg);
    ORDER.forEach(([id, over], i) => {
      const office = over ? { ...OFF[id], ...over } : OFF[id];
      const y = 8 + i * ph;
      const box = E("g", {}, svg);
      E("rect", { x: 48, y: y + 4, width: W - 56, height: ph - 10, rx: 6, fill: "#13161c", stroke: "#252a34" }, box);
      // mini scene on the right, scaled from the 222×300 station
      const mini = E("svg", { x: W - 8 - 132, y: y + 6, width: 128, height: ph - 14, viewBox: "0 50 222 200", preserveAspectRatio: "xMidYMid slice" }, box);
      E("rect", { x: 0, y: 50, width: 222, height: 200, fill: "url(#panels)" }, mini);
      const info = ST[id](E("g", {}, mini));
      if (!["live", "fail", "cued", "ready"].includes(info.state)) E("rect", { x: 0, y: 50, width: 222, height: 200, fill: "#05070a", opacity: .45 }, mini);
      // text column
      const tx = 60;
      if (office.n) T(box, tx, y + 30, String(office.n), { "font-family": "Geist Mono, monospace", fill: "#7d8491" });
      T(box, tx + (office.n ? 14 : 0), y + 30, office.name.replace("Tu escritorio · ", "Escritorio · ").toUpperCase(), { "font-weight": 600, "letter-spacing": "1.6", "font-size": 10.5 });
      const c = LAMPC[info.state];
      E("g", { transform: `translate(${tx} ${y + 44})`, color: c }, box).innerHTML = lamp(info.state).replace("<svg", '<svg width="10" height="10"');
      T(box, tx + 16, y + 53, info.status.toUpperCase(), { "font-size": 9.5, "font-weight": 500, "letter-spacing": "1.2", fill: c });
      T(box, tx, y + 76, info.count.toUpperCase(), { "font-family": "Geist Mono, monospace", "font-size": 9, fill: "#7d8491" });
      const code = info.hold || info.wait || (info.alarm ? "05" : id === "archive" ? "01" : null);
      if (code) { const v = STUDIO.videos.find((v) => v.code === code); folderS(svg, 27, v.tab, v.code, { y: y + 82, flag: info.alarm ? "fail" : undefined }); }
    });
  }
};
