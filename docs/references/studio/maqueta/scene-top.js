// Direction A: the studio as a floor plan seen from above, at night.
// Lights on = the office is working. Claude's offices have people, code offices have robots,
// your desk has an empty chair. Each video is a manila folder with its colored tab.

const NS = "http://www.w3.org/2000/svg";
const C = {
  wall: "#3b414e", wallHi: "#4a5161", corridor: "#16191f", corridorLine: "#1e222a",
  wood: "#3d2d22", woodLine: "#47362a", carpet: "#1d3236", carpetDot: "#24403f",
  tile: "#1e232b", tileLine: "#272d37", foam: "#2c2540", foamDark: "#241e35", rug: "#3e1f27", rugEdge: "#5a2e38",
  concrete: "#22262d", desk: "#5b4433", deskTop: "#6b5140", deskEdge: "#2e2219",
  manila: "#d9b66f", paper: "#e8e2d4", metal: "#5d6676", metalHi: "#7a8496",
  skin: ["#e8b894", "#c98d64", "#8d5a3b", "#f1c9a5"], hair: ["#2b1d14", "#6b3d1f", "#141414", "#a8743f"],
};

let K = 1;
var FORCE_LIT = false;
function station(g, x, y) { return el("g", { transform: `translate(${x} ${y}) scale(${K}) translate(${-x} ${-y})` }, g); }
function el(tag, attrs = {}, parent) {
  const n = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  if (parent) parent.appendChild(n);
  return n;
}
function text(parent, x, y, str, attrs = {}) {
  const t = el("text", { x, y, fill: "#e8eaed", "font-family": "Geist, sans-serif", "font-size": 11, ...attrs }, parent);
  t.textContent = str;
  return t;
}

function defs(svg) {
  const d = el("defs", {}, svg);
  d.innerHTML = `
    <pattern id="wood" width="60" height="14" patternUnits="userSpaceOnUse"><rect width="60" height="14" fill="${C.wood}"/><path d="M0 13.5H60M22 0V14" stroke="${C.woodLine}" stroke-width="1"/></pattern>
    <pattern id="wood2" width="60" height="14" patternUnits="userSpaceOnUse"><rect width="60" height="14" fill="${C.wood}"/><path d="M0 13.5H60M44 0V14" stroke="${C.woodLine}" stroke-width="1"/></pattern>
    <pattern id="carpet" width="10" height="10" patternUnits="userSpaceOnUse"><rect width="10" height="10" fill="${C.carpet}"/><circle cx="5" cy="5" r="1" fill="${C.carpetDot}"/></pattern>
    <pattern id="tile" width="24" height="24" patternUnits="userSpaceOnUse"><rect width="24" height="24" fill="${C.tile}"/><path d="M0 .5H24M.5 0V24" stroke="${C.tileLine}"/></pattern>
    <pattern id="foam" width="12" height="12" patternUnits="userSpaceOnUse"><rect width="12" height="12" fill="${C.foam}"/><path d="M0 0 6 6 0 12M6 0 12 6 6 12" fill="${C.foamDark}"/></pattern>
    <pattern id="concrete" width="80" height="80" patternUnits="userSpaceOnUse"><rect width="80" height="80" fill="${C.corridor}"/><path d="M0 79.5H80M79.5 0V80" stroke="${C.corridorLine}"/></pattern>
    <radialGradient id="lamp"><stop offset="0" stop-color="#ffcf7a" stop-opacity=".34"/><stop offset=".55" stop-color="#ffb347" stop-opacity=".12"/><stop offset="1" stop-color="#ffb347" stop-opacity="0"/></radialGradient>
    <radialGradient id="cool"><stop offset="0" stop-color="#7fb8ff" stop-opacity=".28"/><stop offset="1" stop-color="#7fb8ff" stop-opacity="0"/></radialGradient>
    <radialGradient id="alarm"><stop offset="0" stop-color="#f2555a" stop-opacity=".42"/><stop offset=".6" stop-color="#f2555a" stop-opacity=".12"/><stop offset="1" stop-color="#f2555a" stop-opacity="0"/></radialGradient>
    <radialGradient id="wait"><stop offset="0" stop-color="#f2b53a" stop-opacity=".45"/><stop offset="1" stop-color="#f2b53a" stop-opacity="0"/></radialGradient>
    <filter id="soft" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="2" stdDeviation="1.6" flood-color="#000" flood-opacity=".55"/></filter>`;
}

// ---------- props ----------
function person(g, x, y, { rot = 0, shirt = "#4f6d8f", skin = 0, hair = 0, sleep = false } = {}) {
  const p = el("g", { transform: `translate(${x} ${y}) rotate(${rot})`, filter: "url(#soft)" }, g);
  el("ellipse", { cx: 0, cy: 2, rx: 13, ry: 8, fill: shirt }, p);
  el("ellipse", { cx: -10, cy: -4, rx: 3.6, ry: 6, fill: shirt, transform: "rotate(18 -10 -4)" }, p);
  el("ellipse", { cx: 10, cy: -4, rx: 3.6, ry: 6, fill: shirt, transform: "rotate(-18 10 -4)" }, p);
  el("circle", { cx: 0, cy: sleep ? -5 : -1, r: 6.6, fill: C.skin[skin] }, p);
  el("path", { d: `M-6.6 ${sleep ? -4 : 0}a6.6 6.6 0 0 1 13.2 0c-2-3.4-11.2-3.4-13.2 0Z`, fill: C.hair[hair], transform: "rotate(180 0 -1)" }, p);
  return p;
}
function robot(g, x, y, rot = 0) {
  const r = el("g", { transform: `translate(${x} ${y}) rotate(${rot})`, filter: "url(#soft)" }, g);
  el("rect", { x: -12, y: -9, width: 24, height: 18, rx: 6, fill: C.metal }, r);
  el("rect", { x: -9, y: -6, width: 18, height: 6, rx: 3, fill: "#11151b" }, r);
  el("rect", { x: -6, y: -4.5, width: 12, height: 2.4, rx: 1.2, fill: "#7fe0ff" }, r);
  el("circle", { cx: 0, cy: 6, r: 1.6, fill: C.metalHi }, r);
  el("line", { x1: 0, y1: 9, x2: 0, y2: 14, stroke: C.metalHi, "stroke-width": 1.4 }, r);
  el("circle", { cx: 0, cy: 15, r: 2, fill: "#3dd68c" }, r);
}
function chair(g, x, y, empty = false) {
  el("circle", { cx: x, cy: y, r: 12, fill: empty ? "#2b3140" : "#232832", stroke: empty ? "#4a5161" : "none", "stroke-width": 1.5 }, g);
  el("rect", { x: x - 12, y: y + 8, width: 24, height: 5, rx: 2.5, fill: empty ? "#353c4d" : "#1c2029" }, g);
}
// Desk with its monitor at the far edge; the seat is below (+y).
function desk(g, x, y, w = 70, h = 32, { screen = "off", laptop = false } = {}) {
  el("rect", { x: x - w / 2, y: y - h / 2, width: w, height: h, rx: 3, fill: C.deskTop, stroke: C.deskEdge, "stroke-width": 1.5, filter: "url(#soft)" }, g);
  if (laptop) {
    el("rect", { x: x - 13, y: y - 6, width: 26, height: 14, rx: 1.5, fill: "#1a1e26" }, g);
    el("rect", { x: x - 13, y: y - 9, width: 26, height: 3, fill: screen === "on" ? "#a8d4ff" : "#2b313c" }, g);
  } else {
    el("rect", { x: x - 17, y: y - h / 2 + 3, width: 34, height: 6, rx: 1.5, fill: "#11151b" }, g);
    if (screen !== "off") el("rect", { x: x - 15, y: y - h / 2 + 8, width: 30, height: 2, fill: screen === "alarm" ? "#f2555a" : "#a8d4ff", opacity: .9 }, g);
  }
}
function papers(g, x, y, n = 3) {
  for (let i = 0; i < n; i++) el("rect", { x: x + i * 3, y: y - i * 2, width: 13, height: 16, fill: C.paper, transform: `rotate(${i * 9 - 8} ${x} ${y})`, opacity: .92 }, g);
}
function folder(g, x, y, tab, code, rot = -8, scale = 1) {
  const f = el("g", { transform: `translate(${x} ${y}) rotate(${rot}) scale(${scale})`, filter: "url(#soft)" }, g);
  el("rect", { x: -15, y: -13, width: 13, height: 5, rx: 1.5, fill: tab }, f);
  el("rect", { x: -15, y: -10, width: 30, height: 21, rx: 2, fill: C.manila }, f);
  el("path", { d: "M-15 -4H15", stroke: "#b8964f", "stroke-width": 1 }, f);
  text(f, 0, 7, code, { "font-family": "Geist Mono, monospace", "font-size": 9, "font-weight": 600, fill: "#3a2a12", "text-anchor": "middle" });
}
function shelf(g, x, y, w, h, vertical = true) {
  el("rect", { x, y, width: w, height: h, fill: "#2a1f17", stroke: C.deskEdge }, g);
  const cols = ["#8a4b3c", "#3f6b8a", "#c9a24b", "#5a7d4f", "#7a5a8f", "#b46b3c", "#4a5a7a"];
  const len = vertical ? h : w;
  for (let i = 0, p = 3; p < len - 6; i++) {
    const s = 4 + ((i * 7) % 4);
    if (vertical) el("rect", { x: x + 3, y: y + p, width: w - 6, height: s, fill: cols[i % cols.length] }, g);
    else el("rect", { x: x + p, y: y + 3, width: s, height: h - 6, fill: cols[i % cols.length] }, g);
    p += s + 1;
  }
}
function plant(g, x, y, r = 11) {
  el("circle", { cx: x, cy: y, r: r * 0.7, fill: "#5b3b2a" }, g);
  for (let i = 0; i < 6; i++) el("ellipse", { cx: x + Math.cos(i) * r * 0.5, cy: y + Math.sin(i) * r * 0.5, rx: r * 0.55, ry: r * 0.3, fill: i % 2 ? "#3f7a4f" : "#4f9161", transform: `rotate(${i * 60} ${x + Math.cos(i) * r * 0.5} ${y + Math.sin(i) * r * 0.5})` }, g);
}
function glow(g, x, y, r, id = "lamp") { el("circle", { cx: x, cy: y, r, fill: `url(#${id})`, style: "mix-blend-mode:screen" }, g); }
function bubble(g, x, y, str, kind = "say") {
  const b = el("g", {}, g);
  const t = text(b, 0, 0, str, { "font-size": 11, "font-weight": 600, fill: kind === "alarm" ? "#fff" : "#16191f" });
  const w = str.length * 6.4 + 14;
  t.setAttribute("x", x - w / 2 + 7); t.setAttribute("y", y + 4);
  const r = el("rect", { x: x - w / 2, y: y - 10, width: w, height: 20, rx: 10, fill: kind === "alarm" ? "#f2555a" : kind === "wait" ? "#f2b53a" : "#e8eaed", filter: "url(#soft)" }, b);
  el("path", { d: `M${x - 4} ${y + 9} l4 7 l4 -7Z`, fill: r.getAttribute("fill") }, b);
  b.appendChild(t);
}
function zzz(g, x, y) {
  text(g, x, y, "z", { "font-size": 10, fill: "#a3a9b4", "font-weight": 600 });
  text(g, x + 7, y - 8, "z", { "font-size": 13, fill: "#a3a9b4", "font-weight": 600 });
  text(g, x + 16, y - 19, "Z", { "font-size": 16, fill: "#a3a9b4", "font-weight": 600 });
}

// Room plate + status, as a door sign. Width measured after render.
function doorSign(g, x, y, office, state, status) {
  const s = el("g", { class: "door-sign" }, g);
  const r = el("rect", { x, y, height: 24, rx: 3, fill: "#1a1e26", stroke: "#343a47" }, s);
  let cx = x + 9;
  if (office.n) {
    text(s, cx, y + 16, String(office.n), { "font-family": "Geist Mono, monospace", "font-size": 11, fill: "#7d8491" });
    cx += 14;
  }
  const t = text(s, cx, y + 16, office.name.toUpperCase(), { "font-size": 11, "font-weight": 600, "letter-spacing": "2.2" });
  s._fit = () => r.setAttribute("width", t.getBBox().x + t.getBBox().width - x + 8);
  const color = { live: "#f2555a", cued: "#f2b53a", ready: "#3dd68c", off: "#7d8491", fail: "#f2555a", timed: "#5bbcf5" }[state];
  const l = el("g", { transform: `translate(${x + 1} ${y + 33})`, color }, s);
  l.innerHTML = `<svg width="10" height="10" viewBox="0 0 10 10">${lamp(state).replace(/<\/?svg[^>]*>/g, "")}</svg>`;
  text(s, x + 17, y + 42, status.toUpperCase(), { "font-size": 10, "font-weight": 500, "letter-spacing": "1.5", fill: color });
  return s;
}

// ---------- rooms ----------
function room(svg, layer, box, floorId, { lit: litIn = false, door = "bottom", doorAt = 0.5, glass = false } = {}) {
  const { x, y, w, h } = box;
  let lit = litIn || FORCE_LIT;
  el("rect", { x, y, width: w, height: h, fill: `url(#${floorId})` }, layer.floor);
  const g = el("g", {}, layer.props);
  if (!lit) el("rect", { x, y, width: w, height: h, fill: "#05070a", opacity: .5 }, layer.dark);
  el("rect", { x, y, width: w, height: h, fill: "none", stroke: glass ? "#5f7a92" : C.wall, "stroke-width": glass ? 3 : 6 }, layer.walls);
  if (glass) el("rect", { x: x + 3, y: y + 3, width: w - 6, height: h - 6, fill: "none", stroke: "#8fb2cf", "stroke-opacity": .25, "stroke-width": 1 }, layer.walls);
  const doors = Array.isArray(door) ? door : [[door, doorAt]];
  for (const [side, at] of doors) {
    const dw = 34;
    if (side === "bottom") el("rect", { x: x + w * at - dw / 2, y: y + h - 4, width: dw, height: 8, fill: C.corridor }, layer.walls);
    if (side === "top") el("rect", { x: x + w * at - dw / 2, y: y - 4, width: dw, height: 8, fill: C.corridor }, layer.walls);
    if (side === "left") el("rect", { x: x - 4, y: y + h * at - dw / 2, width: 8, height: dw, fill: C.corridor }, layer.walls);
    if (side === "right") el("rect", { x: x + w - 4, y: y + h * at - dw / 2, width: 8, height: dw, fill: C.corridor }, layer.walls);
  }
  return g;
}

const V = Object.fromEntries(STUDIO.videos.map((v) => [v.office, v]));
const O = Object.fromEntries(STUDIO.offices.map((o) => [o.id, o]));

const DRAW = {
  research(L, b, phone) {
    const g = room(null, L, b, "wood", { door: "bottom", doorAt: .5 });
    shelf(g, b.x + b.w - 26, b.y + 12, 16, b.h - 24);
    const dx = b.x + b.w * 0.46, dy = b.y + b.h * 0.64;
    const s = station(g, dx, dy);
    desk(s, dx, dy, 72, 32); papers(s, dx - 26, dy - 4, 2);
    el("circle", { cx: dx + 26, cy: dy - 4, r: 7, fill: "#3f6b8a", stroke: "#c9a24b", "stroke-width": 1.5 }, s);
    chair(s, dx, dy + 26); person(s, dx, dy + 24, { shirt: "#6d5a8f", skin: 0, hair: 1, sleep: true });
    zzz(s, dx + 16, dy + 18);
    doorSign(L.signs, b.x + 12, b.y + 12, O.research, "off", phone ? "Libre" : "Libre · 0 en cola");
  },
  sources(L, b, phone) {
    const g = room(null, L, b, "carpet", { door: "bottom", doorAt: .5 });
    for (let i = 0; i < 3; i++) {
      const cx = b.x + b.w - 30, cy = b.y + 22 + i * 30;
      el("rect", { x: cx - 14, y: cy - 12, width: 28, height: 26, rx: 2, fill: C.metal, stroke: "#3a414e" }, g);
      el("rect", { x: cx - 5, y: cy + 8, width: 10, height: 2.4, rx: 1, fill: C.metalHi }, g);
    }
    const dx = b.x + b.w * 0.42, dy = b.y + b.h * 0.64;
    const s = station(g, dx, dy);
    desk(s, dx, dy, 66, 30); papers(s, dx + 8, dy - 2, 3);
    robot(s, dx, dy + 26, 0);
    doorSign(L.signs, b.x + 12, b.y + 12, O.sources, "off", phone ? "Libre" : "Libre · código");
  },
  images(L, b, phone) {
    const g = room(null, L, b, "tile", { lit: true, door: "bottom", doorAt: .5 });
    glow(g, b.x + b.w * 0.45, b.y + b.h * 0.6, 120, "alarm");
    // pinboard of candidate photos
    const px = b.x + b.w - 90, py = b.y + 10;
    el("rect", { x: px, y: py, width: 78, height: 50, rx: 2, fill: "#5a4632" }, g);
    const ph = ["#6d7f8f", "#b9a27f", "#4d5a66", "#8f7b5c", "#a3a9b4", "#5c4c3e"];
    ph.forEach((c, i) => el("rect", { x: px + 5 + (i % 3) * 25, y: py + 5 + Math.floor(i / 3) * 22, width: 20, height: 17, fill: c, stroke: "#eee", "stroke-width": 1.5, transform: `rotate(${(i % 2 ? 4 : -5)} ${px + 15 + (i % 3) * 25} ${py + 14})` }, g));
    const dx = b.x + b.w * 0.42, dy = b.y + b.h * 0.66;
    const s = station(g, dx, dy);
    desk(s, dx, dy, 72, 32, { screen: "alarm" });
    folder(s, dx + 22, dy + 2, V.images.tab, V.images.code, 10, .9);
    person(s, dx - 30, dy + 30, { rot: -30, shirt: "#8f4f4f", skin: 2, hair: 2 });
    bubble(s, dx - 30, dy + 4, "¡429!", "alarm");
    doorSign(L.signs, b.x + 12, b.y + 12, O.images, "fail", phone ? "Falla" : "Falla · reintentar");
  },
  script(L, b, phone) {
    const g = room(null, L, b, "wood2", { lit: true, door: "bottom", doorAt: .5 });
    const dx = b.x + b.w * 0.46, dy = b.y + b.h * 0.64;
    const s = station(g, dx, dy);
    glow(g, dx, dy, 120);
    desk(s, dx, dy, 74, 34, { screen: "on", laptop: true });
    folder(s, dx - 26, dy - 2, V.script.tab, V.script.code, -12, .9);
    chair(s, dx, dy + 27); person(s, dx, dy + 25, { shirt: "#3f7a6a", skin: 3, hair: 0 });
    // the rejected first attempt, crumpled on the floor
    el("circle", { cx: b.x + b.w - 34, cy: b.y + b.h - 30, r: 10, fill: "#2a2f38", stroke: "#4a5161" }, g);
    el("circle", { cx: b.x + b.w - 52, cy: b.y + b.h - 22, r: 5, fill: C.paper }, g);
    bubble(s, dx + 30, dy - 30, phone ? "2/3" : "intento 2/3", "say");
    doorSign(L.signs, b.x + 12, b.y + 12, O.script, "live", phone ? "1:12" : "Escribiendo · 1:12");
  },
  facts(L, b, phone) {
    const g = room(null, L, b, "carpet", { door: phone ? "bottom" : "bottom", doorAt: .5 });
    el("rect", { x: b.x + b.w - 70, y: b.y + 12, width: 56, height: 36, rx: 2, fill: "#e8e2d4", opacity: .85 }, g);
    for (let i = 0; i < 4; i++) el("path", { d: `M${b.x + b.w - 64} ${b.y + 20 + i * 7}h6l2 2 4-4M${b.x + b.w - 50} ${b.y + 20 + i * 7}h28`, stroke: "#3f7a4f", "stroke-width": 1.6, fill: "none" }, g);
    const dx = b.x + b.w * 0.44, dy = b.y + b.h * 0.64;
    const s = station(g, dx, dy);
    desk(s, dx, dy, 66, 30); papers(s, dx - 20, dy - 3, 2);
    el("circle", { cx: dx + 18, cy: dy, r: 6, fill: "none", stroke: "#c9cdd4", "stroke-width": 2 }, s);
    el("line", { x1: dx + 22, y1: dy + 4, x2: dx + 28, y2: dy + 10, stroke: "#c9cdd4", "stroke-width": 2.4 }, s);
    chair(s, dx, dy + 24); person(s, dx, dy + 22, { shirt: "#4f6d8f", skin: 1, hair: 3 });
    doorSign(L.signs, b.x + 12, b.y + 12, O.facts, "off", "Libre");
  },
  desk(L, b, phone) {
    const g = room(null, L, b, "concrete", { lit: true, glass: true, door: phone ? [["top", .5], ["bottom", .5]] : [["top", .87], ["bottom", .1], ["bottom", .87], ["right", .5]] });
    // rug + furniture
    const cx = b.x + b.w / 2, cy = b.y + b.h * 0.56;
    const rw = Math.min(b.w - 80, 400), rh = b.h - 56;
    el("rect", { x: cx - rw / 2, y: cy - rh / 2, width: rw, height: rh, rx: 4, fill: C.rug, stroke: C.rugEdge, "stroke-width": 3 }, g);
    glow(g, cx, cy, 150, "wait");
    const s = station(g, cx, cy);
    el("rect", { x: cx - 70, y: cy - 22, width: 140, height: 40, rx: 4, fill: "#6e4a35", stroke: C.deskEdge, "stroke-width": 2, filter: "url(#soft)" }, s);
    el("rect", { x: cx - 22, y: cy - 19, width: 44, height: 7, rx: 1.5, fill: "#11151b" }, s);
    el("rect", { x: cx - 20, y: cy - 13, width: 40, height: 2, fill: "#a8d4ff" }, s);
    // in-trays: script and video
    el("rect", { x: cx - 64, y: cy - 14, width: 30, height: 26, rx: 2, fill: "#2b313c", stroke: "#4a5161" }, s);
    el("rect", { x: cx + 34, y: cy - 14, width: 30, height: 26, rx: 2, fill: "#2b313c", stroke: "#4a5161" }, s);
    folder(s, cx + 49, cy - 1, V.desk.tab, V.desk.code, 6, .85);
    chair(s, cx, cy + 34, true);
    text(s, cx, cy + 38, "VOS", { "font-size": 8, "font-weight": 600, "letter-spacing": "1.5", "text-anchor": "middle", fill: "#a3a9b4" });
    if (!phone) {
      text(s, cx - 49, cy + 24, "GUION", { "font-size": 8, "letter-spacing": "1.2", "text-anchor": "middle", fill: "#a3a9b4" });
      text(s, cx + 49, cy + 24, "VIDEO", { "font-size": 8, "letter-spacing": "1.2", "text-anchor": "middle", fill: "#a3a9b4" });
      plant(g, b.x + 30, b.y + b.h - 28, 14); plant(g, b.x + b.w - 30, b.y + 30, 14);
      // sofa
      el("rect", { x: b.x + b.w - 120, y: b.y + b.h - 40, width: 84, height: 26, rx: 6, fill: "#3a4556" }, g);
      el("rect", { x: b.x + b.w - 116, y: b.y + b.h - 36, width: 36, height: 18, rx: 4, fill: "#465368" }, g);
      el("rect", { x: b.x + b.w - 76, y: b.y + b.h - 36, width: 36, height: 18, rx: 4, fill: "#465368" }, g);
    }
    bubble(s, cx + 49, cy - 40, "¡te espera!", "wait");
    doorSign(L.signs, b.x + 12, b.y + 12, O.desk, "cued", phone ? "1 te espera" : "1 te espera · aprobar video");
  },
  voice(L, b, phone) {
    const g = room(null, L, b, "foam", { door: phone ? "top" : "top", doorAt: phone ? .5 : .5 });
    const cx = b.x + b.w * 0.5, cy = b.y + b.h * 0.6;
    const s = station(g, cx, cy);
    el("rect", { x: cx - 50, y: cy - 34, width: 100, height: 68, rx: 6, fill: "#1b1626", stroke: "#3d3354" }, s);
    el("line", { x1: cx, y1: cy - 6, x2: cx + 26, y2: cy - 22, stroke: "#9aa3b2", "stroke-width": 2.4 }, s);
    el("circle", { cx: cx + 28, cy: cy - 23, r: 5, fill: "#c9cdd4" }, s);
    el("circle", { cx, cy: cy - 6, r: 4, fill: "#5d6676" }, g);
    chair(s, cx, cy + 18); person(s, cx, cy + 16, { shirt: "#8f7a4f", skin: 1, hair: 0 });
    el("path", { d: `M${cx - 8} ${cy + 12}a8 8 0 0 1 16 0`, stroke: "#141414", "stroke-width": 2.6, fill: "none" }, g);
    if (!phone) { el("rect", { x: b.x + b.w - 74, y: b.y + 14, width: 58, height: 20, rx: 3, fill: "#1a0f12", stroke: "#4a2a30" }, g); text(g, b.x + b.w - 45, b.y + 28, "ON AIR", { "font-size": 10, "font-weight": 700, "letter-spacing": "1.4", fill: "#5a3138", "text-anchor": "middle" }); }
    doorSign(L.signs, b.x + 12, b.y + 12, O.voice, "off", "Libre");
  },
  render(L, b, phone) {
    const g = room(null, L, b, "tile", { lit: true, door: "top", doorAt: .5 });
    const racks = phone ? 2 : 4;
    for (let i = 0; i < racks; i++) {
      const rx = b.x + 18 + i * 34, ry = b.y + (phone ? 58 : 60);
      el("rect", { x: rx, y: ry, width: 24, height: b.h - (phone ? 72 : 68), rx: 2, fill: "#1a1e26", stroke: "#3a414e" }, g);
      for (let j = 0; j < 8; j++) el("circle", { cx: rx + 6 + (j % 2) * 12, cy: ry + 10 + Math.floor(j / 2) * 16, r: 1.8, fill: j % 3 ? "#3dd68c" : "#7fb4e8" }, g);
    }
    const sx = phone ? b.x + b.w - 92 : b.x + b.w - 200, sy = phone ? b.y + 56 : b.y + 14;
    const sw = phone ? 80 : 180;
    el("rect", { x: sx, y: sy, width: sw, height: 40, rx: 3, fill: "#0b0e13", stroke: "#3a414e" }, g);
    text(g, sx + 8, sy + 16, phone ? "16:9" : "RENDER 16:9", { "font-family": "Geist Mono, monospace", "font-size": 10, fill: "#7fb4e8" });
    text(g, sx + sw - 8, sy + 16, "41 %", { "font-family": "Geist Mono, monospace", "font-size": 10, fill: "#e8eaed", "text-anchor": "end" });
    el("rect", { x: sx + 8, y: sy + 24, width: sw - 16, height: 6, rx: 3, fill: "#1e232b" }, g);
    el("rect", { x: sx + 8, y: sy + 24, width: (sw - 16) * 0.41, height: 6, rx: 3, fill: "#7fb4e8" }, g);
    const dx = phone ? b.x + b.w * 0.72 : b.x + b.w * 0.66, dy = b.y + b.h * 0.66;
    const s = station(g, dx, dy);
    glow(g, dx, dy - 10, 130, "cool");
    desk(s, dx, dy, 70, 30, { screen: "on" });
    folder(s, dx + 24, dy + 2, V.render.tab, V.render.code, 8, .85);
    robot(s, dx, dy + 26, 0);
    doorSign(L.signs, b.x + 12, b.y + 12, O.render, "live", phone ? "41 %" : "16:9 al 41 % · 6:40");
  },
  package(L, b, phone) {
    const g = room(null, L, b, "wood", { door: phone ? "top" : [["top", .5]] });
    const px = b.x + b.w - (phone ? 70 : 120), py = b.y + 14;
    el("rect", { x: px, y: py, width: phone ? 58 : 104, height: 40, rx: 2, fill: "#5a4632" }, g);
    el("rect", { x: px + 6, y: py + 6, width: 36, height: 22, fill: "#3f6b8a", stroke: "#eee", "stroke-width": 1.5 }, g);
    if (!phone) { el("rect", { x: px + 50, y: py + 5, width: 16, height: 30, fill: "#8a4b3c", stroke: "#eee", "stroke-width": 1.5 }, g); el("rect", { x: px + 74, y: py + 6, width: 24, height: 16, fill: "#c9a24b", stroke: "#eee", "stroke-width": 1.5 }, g); }
    const dx = b.x + b.w * 0.45, dy = b.y + b.h * 0.64;
    const s = station(g, dx, dy);
    desk(s, dx, dy, 70, 30); papers(s, dx - 22, dy - 3, 2);
    el("rect", { x: dx + 14, y: dy - 6, width: 10, height: 14, rx: 2, fill: "#8a4b3c" }, s);
    chair(s, dx, dy + 25); person(s, dx, dy + 23, { shirt: "#5a7d4f", skin: 2, hair: 1 });
    doorSign(L.signs, b.x + 12, b.y + 12, O.package, "off", "Libre");
  },
  archive(L, b, phone) {
    const g = room(null, L, b, "carpet", { lit: true, door: phone ? "top" : "left", doorAt: .5 });
    const rows = phone ? 2 : 3;
    for (let i = 0; i < rows; i++) {
      const sy = b.y + 56 + i * 34;
      el("rect", { x: b.x + b.w - 74, y: sy, width: 60, height: 22, fill: "#2a1f17", stroke: C.deskEdge }, g);
      ["var(--v4)", "#c9a24b", "#7fb4e8", "#5a7d4f"].forEach((c, k) => el("rect", { x: b.x + b.w - 70 + k * 14, y: sy + 3, width: 11, height: 16, fill: C.manila, stroke: "#b8964f" }, g) && el("rect", { x: b.x + b.w - 70 + k * 14, y: sy + 3, width: 11, height: 4, fill: c }, g));
    }
    const cx = b.x + (phone ? b.w * 0.36 : b.w * 0.34), cy = b.y + b.h * 0.66;
    const s = station(g, cx, cy);
    glow(g, cx, cy, 80, "lamp");
    el("rect", { x: cx - 30, y: cy - 20, width: 60, height: 40, rx: 3, fill: "#6b5140", stroke: C.deskEdge, "stroke-width": 2, filter: "url(#soft)" }, s);
    el("path", { d: `M${cx - 30} ${cy - 6}H${cx + 30}`, stroke: C.deskEdge }, s);
    folder(s, cx, cy + 2, V.archive.tab, V.archive.code, -4, .95);
    doorSign(L.signs, b.x + 12, b.y + 12, O.archive, "ready", phone ? "1 listo" : "1 paquete listo");
  },
  lobby(L, b) {
    const g = room(null, L, b, "wood2", { door: [["left", .5], ["top", .5]] });
    const cx = b.x + b.w * 0.55, cy = b.y + b.h * 0.6;
    const s = station(g, cx, cy);
    el("path", { d: `M${cx - 40} ${cy - 22}h80v44h-16v-28h-48v28h-16Z`, fill: "#6b5140", stroke: C.deskEdge, "stroke-width": 1.5 }, s);
    el("circle", { cx: cx + 22, cy: cy - 14, r: 4, fill: "#c9a24b" }, s);
    if (FORCE_LIT) {
      glow(g, cx, cy, 130);
      person(s, cx, cy - 36, { rot: 180, shirt: "#7a5a8f", skin: 1, hair: 3 });
      folder(s, cx - 18, cy - 10, "#c9cdd4", "06", -6, .9);
      bubble(s, cx + 52, cy - 46, "¡nuevo!", "say");
    }
    plant(g, b.x + b.w - 24, b.y + b.h - 24, 12);
    text(g, b.x + 14, b.y + b.h - 14, "ENTRADA ←", { "font-size": 9, "letter-spacing": "1.4", fill: "#7d8491" });
    doorSign(L.signs, b.x + 12, b.y + 12, { name: "Recepción" }, "off", "0 temas");
  },
};

function chevrons(g, pts, dir = "right") {
  for (const [x, y] of pts) {
    const d = { right: `M${x - 4} ${y - 6}l7 6-7 6`, down: `M${x - 6} ${y - 4}l6 7 6-7`, up: `M${x - 6} ${y + 4}l6-7 6 7` }[dir];
    el("path", { d, stroke: "#4a5161", "stroke-width": 2, fill: "none", "stroke-linecap": "round", "stroke-linejoin": "round" }, g);
  }
}

window.drawFloor = (host, phone) => {
  const W = phone ? 358 : 1336;
  const H = phone ? 1148 : 752;
  K = phone ? 1 : 1.45;
  const svg = el("svg", { viewBox: `0 0 ${W} ${H}`, width: "100%", role: "img", "aria-label": "Plano del estudio" });
  host.appendChild(svg);
  defs(svg);
  el("rect", { x: 0, y: 0, width: W, height: H, rx: 10, fill: "url(#concrete)" }, svg);
  const L = { floor: el("g", {}, svg), props: el("g", {}, svg), dark: el("g", {}, svg), walls: el("g", {}, svg), arrows: el("g", {}, svg), signs: el("g", {}, svg) };
  // the dark overlay must sit over furniture but the folder/bubbles of lit rooms stay readable: lit rooms add none
  const boxes = {};
  if (!phone) {
    const tw = (W - 16) / 5;
    ["research", "sources", "images", "script", "facts"].forEach((id, i) => (boxes[id] = { x: 8 + i * tw, y: 8, w: tw, h: 232 }));
    boxes.lobby = { x: 8, y: 284, w: 220, h: 188 };
    boxes.desk = { x: 286, y: 284, w: 764, h: 188 };
    boxes.archive = { x: 1108, y: 284, w: 220, h: 188 };
    const bw = (W - 16) / 3;
    ["voice", "render", "package"].forEach((id, i) => (boxes[id] = { x: 8 + i * bw, y: 516, w: bw, h: 228 }));
    chevrons(L.arrows, [[160, 262], [430, 262], [700, 262], [968, 262], [1180, 262]]);
    chevrons(L.arrows, [[1194, 272]], "down");
    chevrons(L.arrows, [[256, 494], [700, 494], [1150, 494]]);
    chevrons(L.arrows, [[118, 270]], "up");
  } else {
    const cw = (W - 24) / 2;
    const row = (y, h, a, b2) => { boxes[a] = { x: 8, y, w: cw, h }; if (b2) boxes[b2] = { x: 16 + cw, y, w: cw, h }; };
    row(8, 176, "research", "sources");
    row(216, 176, "images", "script");
    boxes.facts = { x: 8, y: 424, w: W - 16, h: 150 };
    boxes.desk = { x: 8, y: 606, w: W - 16, h: 180 };
    row(818, 150, "voice", "render");
    row(990, 150, "package", "archive");
    chevrons(L.arrows, [[W / 2, 200], [W / 2, 408], [W / 2, 590], [W / 2, 802]], "down");
  }
  for (const [id, b] of Object.entries(boxes)) DRAW[id](L, b, phone);
  el("rect", { x: 3, y: 3, width: W - 6, height: H - 6, rx: 9, fill: "none", stroke: C.wallHi, "stroke-width": 6 }, L.walls);
  if (!phone) el("rect", { x: 0, y: 358, width: 8, height: 40, fill: C.corridor }, L.walls);
  svg.querySelectorAll(".door-sign").forEach((s) => s._fit && s._fit());
};

// One office of the plan, drawn large: the header of an office page or of your desk.
window.drawRoom = (host, id, W, H, scale = 1.5) => {
  const svg = el("svg", { viewBox: `0 0 ${W} ${H}`, width: "100%", role: "img", "aria-label": O[id]?.name ?? id });
  host.appendChild(svg);
  defs(svg);
  el("rect", { x: 0, y: 0, width: W, height: H, rx: 8, fill: "url(#concrete)" }, svg);
  const L = { floor: el("g", {}, svg), props: el("g", {}, svg), dark: el("g", {}, svg), walls: el("g", {}, svg), arrows: el("g", {}, svg), signs: el("g", {}, svg) };
  K = scale;
  DRAW[id](L, { x: 6, y: 6, w: W - 12, h: H - 12 }, false);
  L.signs.remove();
  svg.querySelectorAll(".door-sign").forEach((s) => s._fit && s._fit());
};
