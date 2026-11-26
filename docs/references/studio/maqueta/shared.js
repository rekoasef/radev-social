// Shared sketch pieces: panel chrome, synthetic studio state, sign, rundown and ledger.
// Synthetic data (labelled as such): Thursday 2026-11-26, 14:32 in Buenos Aires.

window.STUDIO = {
  offices: [
    { id: "research", n: 1, name: "Investigación", who: "Claude + búsqueda web" },
    { id: "sources", n: 2, name: "Fuentes", who: "Código" },
    { id: "images", n: 3, name: "Imágenes", who: "Claude + Commons" },
    { id: "script", n: 4, name: "Guion", who: "Claude mirando imágenes" },
    { id: "facts", n: 5, name: "Verificación", who: "Claude contra el dossier" },
    { id: "desk", n: null, name: "Tu escritorio", who: "Vos" },
    { id: "voice", n: 6, name: "Locución", who: "ElevenLabs · Alberto" },
    { id: "render", n: 7, name: "Render", who: "Remotion · 9:16 y 16:9" },
    { id: "package", n: 8, name: "Publicación", who: "Claude + código" },
    { id: "archive", n: null, name: "Archivo", who: "Paquetes listos" },
  ],
  videos: [
    { code: "02", tab: "var(--v2)", title: "El día que robaron la Mona Lisa", topic: "Louvre, 1911", office: "desk", state: "cued", status: "Te espera · aprobar video", time: "hace 15 h" },
    { code: "04", tab: "var(--v4)", title: "La explosión que nadie vio", topic: "Tunguska, 1908", office: "script", state: "live", status: "Escribiendo · intento 2 de 3", time: "1:12" },
    { code: "03", tab: "var(--v3)", title: "El barco que hundió una ballena", topic: "El ballenero Essex, 1820", office: "render", state: "live", status: "16:9 al 41 % · 9:16 listo", time: "6:40" },
    { code: "05", tab: "var(--v5)", title: "La noche que se apagó Nueva York", topic: "Apagón de 1977", office: "images", state: "fail", status: "Falla · Commons respondió 429", time: "hace 22 min" },
    { code: "01", tab: "var(--v1)", title: "El mapa que no debía existir", topic: "Betty y Barney Hill, 1961", office: "archive", state: "ready", status: "Aprobado · paquete listo", time: "ayer 22:45" },
  ],
};

const LAMPS = {
  live: '<circle cx="5" cy="5" r="4" fill="currentColor"/>',
  cued: '<path d="M5 1 9.2 8.8H.8Z" fill="currentColor"/>',
  ready: '<rect x="1.2" y="1.2" width="7.6" height="7.6" fill="currentColor"/>',
  timed: '<path d="M5 .6 9.4 5 5 9.4.6 5Z" fill="currentColor"/>',
  off: '<rect x="1" y="4.2" width="8" height="1.6" fill="currentColor"/>',
  fail: '<path d="M1.6 1.6 8.4 8.4M8.4 1.6 1.6 8.4" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>',
};
window.lamp = (state) => `<svg viewBox="0 0 10 10" aria-hidden="true">${LAMPS[state]}</svg>`;
window.tally = (state, text) => `<span class="tally t-${state}">${lamp(state)}<span>${text}</span></span>`;
window.officeName = (id) => STUDIO.offices.find((o) => o.id === id).name;

const NAV = [
  ["house", "Inicio"], ["clipboard-check", "Revisar"], ["layers", "Posts"], ["lightbulb", "Ideas"],
  ["calendar-days", "Calendario", "Agenda"], ["chart-column", "Métricas"], ["clapperboard", "Videos"],
  ["palette", "Marcas"], ["settings", "Ajustes"],
];

window.chrome = () => {
  const keys = NAV.map(([icon, label]) =>
    `<span class="key${label === "Videos" ? " on" : ""}"><i data-lucide="${icon}"></i>${label}${label === "Videos" ? '<span class="badge">1</span>' : ""}</span>`).join("");
  const dock = NAV.map(([icon, label, short]) =>
    `<span class="${label === "Videos" ? "on" : ""}"><i data-lucide="${icon}"></i>${short ?? label}${label === "Videos" ? '<i class="badge">1</i>' : ""}</span>`).join("");
  document.body.insertAdjacentHTML("afterbegin", `
    <header class="bar">
      <div class="bar-in">
        <div class="idn">
          <div class="mark"><img src="app-mark.png" alt=""><div><b>RAdev Social</b>${tally("ready", "Base en línea")}</div></div>
          <div class="switch"><span class="callsign">RA</span><span class="name">RAdev</span><i data-lucide="chevrons-up-down" style="width:14px;color:var(--ink-faint)"></i></div>
        </div>
        <div class="right">
          <div class="clock"><div><div class="t mono">14:32:07</div><div class="z">Buenos Aires</div></div><div><div class="t dim mono">17:32:07</div><div class="z">UTC</div></div></div>
          <div class="avatar">RA</div>
        </div>
      </div>
      <nav class="keys">${keys}</nav>
    </header>`);
  document.body.insertAdjacentHTML("beforeend", `<nav class="dock">${dock}</nav>`);
};

window.sign = () => {
  const v = STUDIO.videos[0];
  return `<section class="sign">
    ${tally("cued", "Te espera")}
    <div class="what"><b>${v.title}</b> <span>· aprobar el video · los dos formatos están listos · ${v.time}</span></div>
    <span class="btn primary">Ir a tu escritorio <i data-lucide="arrow-right"></i></span>
  </section>`;
};

window.rundown = () => `<section style="display:flex;flex-direction:column;gap:16px">
  <div class="zone"><h2 class="plate">En el estudio</h2><span class="rule"></span><span class="count mono">5 videos</span></div>
  <div class="rundown"><table>
    <thead><tr><th>Carpeta</th><th>Video</th><th class="desk-only">Oficina</th><th class="st">Estado</th><th class="desk-only" style="text-align:right">Tiempo</th></tr></thead>
    <tbody>${STUDIO.videos.map((v) => `<tr>
      <td><span class="tab" style="background:${v.tab}">${v.code}</span></td>
      <td><div class="title">${v.title}</div><div class="sub">${v.topic}</div><div class="phone-only" style="margin-top:6px">${tally(v.state, v.status)}</div></td>
      <td class="desk-only">${officeName(v.office)}</td>
      <td class="st">${tally(v.state, v.status)}</td>
      <td class="desk-only mono" style="text-align:right;color:var(--ink-dim)">${v.time}</td></tr>`).join("")}
    </tbody></table></div>
</section>`;

window.ledger = () => `<section class="ledger mono" style="font-size:13px">
  <span>HOY · Claude <b>186.204</b> entrada / <b>31.580</b> salida</span>
  <span>Voz del mes <b>3.834</b> de 38.439 créditos</span>
  <span>Render hoy <b>8 min 30 s</b></span>
</section>`;

window.crumbs = (...parts) => `<nav class="crumbs">${parts.map((p, i) => i < parts.length - 1 ? `<span>${p}</span><i data-lucide="chevron-right"></i>` : `<b>${p}</b>`).join("")}</nav>`;

window.finish = () => {
  lucide.createIcons();
  document.fonts.ready.then(() => { window.__ready = true; });
};
