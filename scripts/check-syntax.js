import { readdirSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
function check(dir) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) check(p);
    else if (p.endsWith(".js")) {
      const r = spawnSync(process.execPath, ["--check", p], {
        stdio: "inherit",
      });
      if (r.status) process.exit(r.status);
    }
  }
}
check("src");
check("scripts");
console.log("All JavaScript syntax checks passed");
