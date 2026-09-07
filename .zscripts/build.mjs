import { execSync } from "child_process";
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from "fs";
import { relative, resolve } from "path";

const root = resolve(import.meta.dirname, "..");
const tauriDir = resolve(root, "src-tauri");
const frontendDist = resolve(tauriDir, "frontend-dist");
const standaloneServerDir = resolve(root, ".tauri-cache/standalone-server");
const standalone = resolve(root, ".next/standalone");

const EXCLUDE_DIRS = new Set([
  "rother02-archive",
  "examples",
  "imagetest",
  "tool-results",
  "rotherv0.3.2_screenshot_ui",
  "upload",
  "phase-reports",
  "src-tauri",
  "gbp-monitor",
  "docs",
  "prisma",
  "node_modules",
]);

const EXCLUDE_FILES = new Set([
  "server.js",
  "package.json",
  "package-lock.json",
  ".env",
  "components.json",
  "opencode.json",
  "tsconfig.json",
  "_audit_reviews_output.json",
]);

function shouldExclude(src) {
  const rel = relative(standalone, src);
  const top = rel.split(/[/\\]/)[0];
  if (!top) return false;
  if (EXCLUDE_DIRS.has(top)) return true;
  if (rel.indexOf("/") === -1 && rel.indexOf("\\") === -1 && EXCLUDE_FILES.has(top)) return true;
  return false;
}

console.log("Building Next.js...");
execSync("npx next build", { cwd: root, stdio: "inherit" });

if (existsSync(resolve(standalone, "server.js"))) {
  const dotNext = resolve(standalone, ".next");
  mkdirSync(dotNext, { recursive: true });

  cpSync(resolve(root, ".next/static"), resolve(dotNext, "static"), {
    recursive: true,
    force: true,
  });

  const pub = resolve(root, "public");
  if (existsSync(pub)) {
    cpSync(pub, resolve(standalone, "public"), { recursive: true, force: true });
  }

  // Copy standalone output to Tauri frontend-dist (web assets only)
  // Windows EBUSY workaround: rmSync can fail if a file is still locked by the OS.
  function removeDir(dir) {
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch (e) {
      if (e.code === "EBUSY") {
        for (let i = 0; i < 3; i++) {
          try {
            execSync("timeout /t 1 /nobreak >nul 2>nul", { stdio: "ignore" });
            rmSync(dir, { recursive: true, force: true });
            return;
          } catch (e2) {
            if (e2.code !== "EBUSY") throw e2;
          }
        }
        execSync("cmd /c \"rmdir /s /q \\\"" + dir + "\\\"\"", { stdio: "ignore" });
      } else {
        throw e;
      }
    }
  }
  removeDir(frontendDist);
  removeDir(standaloneServerDir);

  // Web assets (everything except node_modules and excluded dirs) go to frontend-dist
  cpSync(standalone, frontendDist, {
    recursive: true,
    force: true,
    filter: (src, _dest) => !shouldExclude(src),
  });

  // Server bundle (server.js + node_modules + .next + public) goes to standalone-server/
  // This is bundled as a Tauri resource and runs via the Node.js sidecar
  // server.js needs .next/ (SSR chunks, manifest) and public/ (static assets)
  // to be in the same directory structure
  cpSync(resolve(standalone, "server.js"), resolve(standaloneServerDir, "server.js"));
  cpSync(resolve(standalone, "node_modules"), resolve(standaloneServerDir, "node_modules"), {
    recursive: true,
    force: true,
  });
  if (existsSync(resolve(standalone, "package.json"))) {
    cpSync(resolve(standalone, "package.json"), resolve(standaloneServerDir, "package.json"));
  }
  if (existsSync(resolve(standalone, ".next"))) {
    cpSync(resolve(standalone, ".next"), resolve(standaloneServerDir, ".next"), {
      recursive: true,
      force: true,
    });
  }
  if (existsSync(resolve(standalone, "public"))) {
    cpSync(resolve(standalone, "public"), resolve(standaloneServerDir, "public"), {
      recursive: true,
      force: true,
    });
  }

  // Create a minimal index.html loading screen in frontend-dist.
  // Tauri webview requires index.html to exist at startup. The Node.js
  // sidecar (main.rs) takes over after ~1s by navigating to
  // http://127.0.0.1:PORT/. This prevents "asset not found: index.html"
  // errors on app launch.
  const loadingHtml =
    '<!DOCTYPE html>' +
    '<html lang="en">' +
    '<head>' +
    '<meta charset="UTF-8" />' +
    '<meta name="viewport" content="width=device-width,initial-scale=1" />' +
    '<title>Rother</title>' +
    '<style>' +
    '*{margin:0;padding:0}body{font-family:-apple-system,sans-serif;' +
    'background:#0a0a0a;color:#fafafa;display:flex;align-items:center;' +
    'justify-content:center;height:100vh}' +
    '.c{text-align:center}.s{width:36px;height:36px;border:2px solid #333;' +
    'border-top-color:#fff;border-radius:50%;animation:spin .8s linear infinite;' +
    'margin:0 auto 12px}@keyframes spin{to{transform:rotate(360deg)}}' +
    'p{font-size:13px;color:#888}' +
    '</style>' +
    '</head>' +
    '<body>' +
    '<div class="c"><div class="s"></div><p>Starting Rother...</p></div>' +
    '</body>' +
    '</html>';
  writeFileSync(resolve(frontendDist, "index.html"), loadingHtml);
  console.log("Loading screen index.html written to", frontendDist);

  console.log("Build complete — standalone output ready at", standalone);
  console.log("Web assets copied to", frontendDist);
  console.log("Server bundle copied to", standaloneServerDir);
} else {
  console.error("Standalone server.js not generated. Build may have failed.");
  process.exit(1);
}
