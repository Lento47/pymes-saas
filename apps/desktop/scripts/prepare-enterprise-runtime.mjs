import { cpSync, copyFileSync, existsSync, lstatSync, mkdirSync, readdirSync, realpathSync, rmSync } from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const desktopRoot = process.cwd();
const repoRoot = path.resolve(desktopRoot, "..", "..");
const outputRoot = path.join(repoRoot, ".enterprise-runtime-release");
const apiOutput = path.join(outputRoot, "a");
const webOutput = path.join(outputRoot, "w");
const nodeOutput = path.join(outputRoot, "n");
const apiSourceRoot = path.join(repoRoot, "apps", "api");
const webSourceRoot = path.join(repoRoot, "apps", "web");
const envTemplateSource = path.join(repoRoot, "apps", "api", ".env.enterprise.example");
const apiDistSource = path.join(repoRoot, "apps", "api", "dist");
const webDistSource = path.join(repoRoot, "apps", "web", "dist");

mkdirSync(outputRoot, { recursive: true });
for (const entry of readdirSync(outputRoot)) {
  safeRemove(path.join(outputRoot, entry));
}

ensureBuildArtifacts("saas-api", apiDistSource, ["--dir", repoRoot, "--filter", "saas-api", "build"]);
ensureBuildArtifacts("rest-express", webDistSource, ["--dir", repoRoot, "--filter", "rest-express", "build"]);
copyRuntimeSkeleton(apiSourceRoot, apiOutput, [".env.enterprise.example", "node_modules", "package.json", "prisma"]);
copyRuntimeSkeleton(webSourceRoot, webOutput, ["node_modules", "package.json"]);
materializeNodeModules(path.join(apiOutput, "node_modules"));
materializeNodeModules(path.join(webOutput, "node_modules"));
stripPackagingNoise(apiOutput);
stripPackagingNoise(webOutput);
copyRuntimeBuildArtifacts(apiDistSource, path.join(apiOutput, "dist"));
copyRuntimeBuildArtifacts(webDistSource, path.join(webOutput, "dist"));
pruneRuntimePackage(apiOutput, new Set(["dist", "node_modules", "package.json", "prisma", ".env.enterprise.example"]));
pruneRuntimePackage(webOutput, new Set(["dist", "node_modules", "package.json"]));

mkdirSync(nodeOutput, { recursive: true });
copyBundledNodeRuntime();

if (existsSync(envTemplateSource)) {
  copyFileSync(envTemplateSource, path.join(outputRoot, ".env.enterprise.example"));
}

const prismaSource = path.join(repoRoot, "apps", "api", "prisma");
const prismaTarget = path.join(apiOutput, "prisma");
if (existsSync(prismaSource) && !existsSync(prismaTarget)) {
  cpSync(prismaSource, prismaTarget, { recursive: true });
}

function ensureBuildArtifacts(label, distPath, args) {
  try {
    runPnpm(args);
  } catch (error) {
    if (!canReuseExistingBuild(error, distPath)) {
      throw error;
    }

    console.warn(`[enterprise-runtime] Reusing existing ${label} build artifacts from ${distPath}.`);
  }
}

function copyRuntimeSkeleton(sourceRoot, destinationRoot, entries) {
  mkdirSync(destinationRoot, { recursive: true });

  for (const entry of entries) {
    const sourcePath = path.join(sourceRoot, entry);
    if (!existsSync(sourcePath)) {
      continue;
    }

    cpSync(sourcePath, path.join(destinationRoot, entry), { recursive: true });
  }
}

function runPnpm(args) {
  const pnpmExecutable = process.env.npm_execpath;
  const isPnpmExecPath = pnpmExecutable
    ? path.basename(pnpmExecutable).toLowerCase().includes("pnpm")
    : false;
  const command = isPnpmExecPath
    ? process.execPath
    : process.platform === "win32"
      ? process.env.ComSpec || "cmd.exe"
      : "pnpm";
  const commandArgs = isPnpmExecPath
    ? [pnpmExecutable, ...args]
    : process.platform === "win32"
      ? ["/d", "/s", "/c", ["pnpm", ...args].map(quoteForCmd).join(" ")]
      : args;

  execFileSync(command, commandArgs, {
    cwd: repoRoot,
    stdio: "inherit",
  });
}

function canReuseExistingBuild(error, distPath) {
  return process.platform === "win32" && existsSync(distPath);
}

function quoteForCmd(value) {
  return /[\s"]/u.test(value) ? `"${value.replace(/"/gu, '\\"')}"` : value;
}

function stripPackagingNoise(root) {
  const removableExtensions = new Set([
    ".d.ts",
    ".md",
    ".markdown",
    ".map",
    ".ts",
    ".tsx",
  ]);
  const removableDirectories = new Set([
    ".bin",
    "__tests__",
    "__mocks__",
    "coverage",
    "docs",
    "example",
    "examples",
    "test",
    "tests",
  ]);

  walk(root);

  function walk(currentPath) {
    for (const entry of readdirSync(currentPath, { withFileTypes: true })) {
      const fullPath = path.join(currentPath, entry.name);

      if (entry.isDirectory()) {
        if (removableDirectories.has(entry.name.toLowerCase())) {
          safeRemove(fullPath);
          continue;
        }

        walk(fullPath);
        continue;
      }

      const lowerName = entry.name.toLowerCase();
      const extension = path.extname(lowerName);
      if (removableExtensions.has(extension) || lowerName.endsWith(".tsbuildinfo")) {
        safeRemove(fullPath);
      }
    }
  }
}

function copyRuntimeBuildArtifacts(source, destination) {
  if (!existsSync(source)) {
    throw new Error(`Missing runtime build artifacts at ${source}`);
  }

  cpSync(source, destination, { recursive: true });
}

function materializeNodeModules(root) {
  if (!existsSync(root)) {
    return;
  }

  walk(root);

  function walk(currentPath) {
    for (const entry of readdirSync(currentPath, { withFileTypes: true })) {
      const fullPath = path.join(currentPath, entry.name);
      const stats = lstatSync(fullPath);

      if (stats.isSymbolicLink()) {
        const realTarget = realpathSync(fullPath);
        safeRemove(fullPath);
        cpSync(realTarget, fullPath, { recursive: true, dereference: true });
        walk(fullPath);
        continue;
      }

      if (entry.isDirectory()) {
        walk(fullPath);
      }
    }
  }
}

function pruneRuntimePackage(root, allowedEntries) {
  if (!existsSync(root)) {
    return;
  }

  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (allowedEntries.has(entry.name)) {
      continue;
    }

    safeRemove(path.join(root, entry.name));
  }
}

function copyBundledNodeRuntime() {
  const nodeExecutable = process.execPath;
  const targetName = process.platform === "win32" ? "node.exe" : path.basename(nodeExecutable);
  const targetPath = path.join(nodeOutput, targetName);

  if (!existsSync(nodeExecutable)) {
    throw new Error(`Missing Node.js executable at ${nodeExecutable}`);
  }

  copyFileSync(nodeExecutable, targetPath);

  if (!existsSync(targetPath)) {
    throw new Error(`Failed to bundle Node.js runtime into ${targetPath}`);
  }
}

function safeRemove(targetPath) {
  try {
    rmSync(targetPath, {
      force: true,
      recursive: true,
      maxRetries: 5,
      retryDelay: 250,
    });
  } catch (error) {
    if (!shouldUseWindowsRemoveFallback(error)) {
      throw error;
    }

    execFileSync("cmd.exe", ["/d", "/s", "/c", `rmdir /s /q ${quoteForCmd(targetPath)}`], {
      stdio: "inherit",
    });
  }
}

function shouldUseWindowsRemoveFallback(error) {
  return process.platform === "win32" && error && typeof error === "object" && error.code === "EPERM";
}
