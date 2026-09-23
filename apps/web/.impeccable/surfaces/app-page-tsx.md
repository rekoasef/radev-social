---
version: 1
slug: "app-page-tsx"
primary_target: "app/page.tsx"
related_targets: []
---

# Surface brief: panel home (brands)

Scope: home of the RAdev Social panel; lists the managed brands. Mode: Operate.
Audience/job: the single operator checks which brands exist and their identity at a glance, on desktop and phone. Full layout (nav, brand selector, auth) arrives in T7/T8 and inherits this world.
Constraints: data from Postgres (brands table); Spanish rioplatense; no future-phase features, but zones for them may be labeled as off-air.

## Direction contract

THESIS: Every brand is a broadcast channel and every post a block in the rundown; refuses the generic sidebar + card-grid admin.
OWN-WORLD: graphite console #0C0E12/#161A21, hairline bezels, Geist Sans labels in tracked caps plates, Geist Mono timecode and codes, tally lamps red/green/amber each with shape and text; brand color appears only inside its own channel strip.
STORY: operator sees channels on the wall, knows each brand's identity and state, understands later phases will fill the rundown.
FIRST VIEWPORT: top console bar (product slate, UTC/Buenos Aires clock, system tally); "CANALES" plate; channel monitors side by side (stacked on phone) each with call sign (RA/LU), name in its own display font, color bars from tokens, preset, tally; below, empty "EN COLA" rundown.
FORM: broadcast control room, position 3 of 7, seed c51bce6b. Signature: live clock and color-bar test pattern per channel.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
