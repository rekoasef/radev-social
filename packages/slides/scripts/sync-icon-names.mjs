// Writes src/content/icon-names.json from the installed lucide-react. Run after upgrading it:
//   pnpm --filter @radev/slides icons:sync
// The list lives in a JSON file because lucide-react/dynamic is a "use client" module: in a
// server bundle its `iconNames` export becomes a client reference, not an array.
import { writeFileSync } from "node:fs";
// With extension: lucide-react has no "exports" map, so Node resolves files literally.
import dynamicIconImports from "lucide-react/dynamicIconImports.mjs";

const names = Object.keys(dynamicIconImports).sort();
const file = new URL("../src/content/icon-names.json", import.meta.url);
writeFileSync(file, `${JSON.stringify(names)}\n`);
console.log(`icon-names.json: ${names.length} íconos`);
