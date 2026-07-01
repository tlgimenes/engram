// Build per-platform npm packages from downloaded release binaries.
// Usage: node generate-packages.mjs <version> <binaries-dir> <out-dir>
// <binaries-dir> contains: recall-<target>(.exe). Mapping below.
import { mkdirSync, writeFileSync, copyFileSync, readFileSync } from "node:fs";
import { join } from "node:path";

const [version, binDir, outDir] = process.argv.slice(2);
if (!version || !binDir || !outDir) {
  console.error("usage: generate-packages.mjs <version> <bin-dir> <out-dir>");
  process.exit(1);
}

// npm key -> { rustTarget, os, cpu, exe }
const TARGETS = {
  "darwin-arm64": { t: "aarch64-apple-darwin", os: "darwin", cpu: "arm64", exe: "recall" },
  "darwin-x64": { t: "x86_64-apple-darwin", os: "darwin", cpu: "x64", exe: "recall" },
  "linux-x64": { t: "x86_64-unknown-linux-gnu", os: "linux", cpu: "x64", exe: "recall" },
  "linux-arm64": { t: "aarch64-unknown-linux-gnu", os: "linux", cpu: "arm64", exe: "recall" },
  "win32-x64": { t: "x86_64-pc-windows-msvc", os: "win32", cpu: "x64", exe: "recall.exe" },
};

for (const [key, m] of Object.entries(TARGETS)) {
  const pkgDir = join(outDir, `recall-${key}`);
  mkdirSync(join(pkgDir, "bin"), { recursive: true });
  copyFileSync(join(binDir, `recall-${m.t}${m.exe.endsWith(".exe") ? ".exe" : ""}`),
               join(pkgDir, "bin", m.exe));
  writeFileSync(join(pkgDir, "package.json"), JSON.stringify({
    name: `@tlgimenes/recall-${key}`,
    version,
    os: [m.os],
    cpu: [m.cpu],
    files: ["bin"],
    license: "MIT",
  }, null, 2));
}

// Stamp the launcher version + optionalDependencies versions.
const launcherPath = join(outDir, "recall", "package.json");
const launcher = JSON.parse(readFileSync(launcherPath, "utf8"));
launcher.version = version;
for (const dep of Object.keys(launcher.optionalDependencies)) {
  launcher.optionalDependencies[dep] = version;
}
writeFileSync(launcherPath, JSON.stringify(launcher, null, 2));
console.log(`stamped ${version} across launcher + ${Object.keys(TARGETS).length} platform packages`);
