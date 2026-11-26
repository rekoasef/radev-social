---
version: 1
slug: "app-panel-videos-page-tsx"
primary_target: "app/(panel)/videos/page.tsx"
related_targets: ["app/(panel)/videos","components/videos"]
---

# Surface brief: video studio (RAdev Studio, V1)

Scope: `/videos` and its pages: the studio, an office inside, new video, approve script, approve video and the package download. Mode: Operate. Designed for desktop first (operator's answer, 2026-11-26: "más en la compu"); the phone is for approving when the sign calls.
Audience/job: the single operator follows the production line of documentary videos (8 offices + 2 approval desks, ADR 0029) and acts only where a video waits for them: approve or reject the script, approve or reject the video, download the package, retry a failure.
Constraints: data from `videos`, `video_documents`, `generation_runs`, `usage_events` and pg-boss (REVISION §7.3); the web never runs AI or render (rule 5); state carried by tally shape + text, never color alone; Spanish rioplatense; brand color never in the chrome.
Tone: "bien de juego" (operator's answer, 2026-11-26): illustrated, characters at work, motion, inside the panel's control-room chrome.
Approved screens (T10, 2026-11-26): `docs/references/studio/` (studio, office inside, new video, approve script, approve video + package); mockup sources in `docs/references/studio/maqueta/`.
Unresolved: the «tu aporte» field (YouTube inauthentic-content plan) has a reserved, optional place on approve-script, marked "próximamente"; the phone dock grows to 9 sections and needs a fix in T12.

## Direction contract

THESIS: The studio is a building seen from above at night where each video is a manila folder walking from desk to desk; refuses the kanban board and the admin table as the first thing you see.
OWN-WORLD: inside the panel's graphite chrome (plates, tally lamps, Geist / Geist Mono), one scene drawn as code-generated SVG: top-down rooms with wood, carpet, tile and acoustic-foam floors, hairline walls, warm lamp pools on working desks, cool glow in Render, red alarm glow on a failure; people for Claude's offices, robots for code offices, an empty chair marked VOS in the glass office at the centre; folders in manila #d9b66f with one pastel tab per video (never a state color) and its two-digit code in mono.
STORY: at a glance the operator sees which offices work (light on), which are free (dark), what failed (red) and that something waits for them (amber sign + bubble); taps an office to enter it or the sign to reach their desk; below, the rundown lists every video with office, state and time.
FIRST VIEWPORT: ESTUDIO plate with count and "Nuevo video" at the margin; the amber "Te espera" sign full width with the single primary action "Ir a tu escritorio"; the floor plan full width under it (offices 1–5 across the top, reception left, your glass office centre, archive right, 6–8 across the bottom) with door signs carrying number, name and tally status.
FORM: floor plan of a management game, sketch A of three (A plano del piso, B línea de montaje, C pared de cámaras). seed: none (pinned) — operator: "si vamos con la A". Phone: the same plan stacked in two columns (offices 1–4 in pairs, Verificación and your office full width, 6–8 + archive in pairs), as approved in the captures (2026-11-26, `docs/references/studio/`).
Motion grammar: folders walk the corridor between offices on stage change; the writer types; render LEDs blink; the amber bubble breathes; nothing else moves; all of it off under prefers-reduced-motion.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
