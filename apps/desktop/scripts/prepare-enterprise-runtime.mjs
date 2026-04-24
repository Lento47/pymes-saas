import { cpSync, copyFileSync, existsSync, lstatSync, mkdirSync, readdirSync, realpathSync, rmSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { randomBytes } from "node:crypto";

const desktopRoot = process.cwd();
const repoRoot = path.resolve(desktopRoot, "..", "..");
const outputRoot = path.join(repoRoot, ".enterprise-runtime-release");
const apiOutput = path.join(outputRoot, "a");
const webOutput = path.join(outputRoot, "w");
const nodeOutput = path.join(outputRoot, "n");
const installWorkspaceRoot = path.join(tmpdir(), "pymeshub-enterprise-runtime");
const apiInstallOutput = path.join(installWorkspaceRoot, "api");
const webInstallOutput = path.join(installWorkspaceRoot, "web");
const apiSourceRoot = path.join(repoRoot, "apps", "api");
const webSourceRoot = path.join(repoRoot, "apps", "web");
const envTemplateSource = path.join(repoRoot, "apps", "api", ".env.enterprise.example");
const apiDistSource = path.join(repoRoot, "apps", "api", "dist");
const webDistSource = path.join(repoRoot, "apps", "web", "dist");
const enterpriseSchemaSqlSource = path.join(repoRoot, "apps", "api", "prisma", "schema.enterprise.sqlite.sql");

mkdirSync(outputRoot, { recursive: true });
for (const entry of readdirSync(outputRoot)) {
  safeRemove(path.join(outputRoot, entry));
}

runPnpm(["--dir", repoRoot, "--filter", "saas-api", "db:generate:enterprise"]);
ensureBuildArtifacts("saas-api", apiDistSource, ["--dir", repoRoot, "--filter", "saas-api", "build"]);
ensureBuildArtifacts("rest-express", webDistSource, ["--dir", repoRoot, "--filter", "rest-express", "build"]);
prepareIsolatedProductionInstall(apiSourceRoot, apiInstallOutput);
prepareIsolatedProductionInstall(webSourceRoot, webInstallOutput);
copyRuntimeSkeleton(apiInstallOutput, apiOutput, ["node_modules", "package.json"]);
copyRuntimeSkeleton(apiSourceRoot, apiOutput, [".env.enterprise.example", "prisma"]);
copyRuntimeSkeleton(webInstallOutput, webOutput, ["node_modules", "package.json"]);
copyWorkspaceRuntimePackage("@prisma/client", apiOutput);
copyPrismaCliPackage(apiSourceRoot, apiOutput);
copyGeneratedPrismaClient(repoRoot, apiOutput);
copyWorkspaceRuntimePackage("bcrypt", apiOutput);
ensurePrismaCliDependencies(apiSourceRoot, apiOutput);
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
  generateProductionEnv(envTemplateSource, apiOutput);
}

if (existsSync(enterpriseSchemaSqlSource)) {
  copyFileSync(enterpriseSchemaSqlSource, path.join(apiOutput, "schema.sql"));
}

const prismaSource = path.join(repoRoot, "apps", "api", "prisma");
const prismaTarget = path.join(apiOutput, "prisma");
if (existsSync(prismaSource) && !existsSync(prismaTarget)) {
  cpSync(prismaSource, prismaTarget, { recursive: true });
}

safeRemove(installWorkspaceRoot);

function generateProductionEnv(templatePath, apiOutputPath) {
  const template = readFileSync(templatePath, "utf8");
  let envContent = template;

  // Generate a random JWT secret
  const jwtSecret = randomBytes(32).toString("hex");
  envContent = envContent.replace("JWT_SECRET=replace-with-a-long-random-secret", `JWT_SECRET=${jwtSecret}`);

  // Ensure DATABASE_URL uses a relative path for portability
  envContent = envContent.replace(
    /DATABASE_URL=file:.*/,
    "DATABASE_URL=file:./pymeshub.db"
  );

  // Set production mode
  envContent = envContent.replace("NODE_ENV=production", "NODE_ENV=production");

  // Write the actual .env file
  const envPath = path.join(apiOutputPath, ".env");
  writeFileSync(envPath, envContent, "utf8");
  console.log(`[enterprise-runtime] Generated production .env at ${envPath}`);
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

function runPnpm(args, options = {}) {
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
    cwd: options.cwd ?? repoRoot,
    env: options.env ?? process.env,
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
    let entries;
    try {
      entries = readdirSync(currentPath, { withFileTypes: true });
    } catch (error) {
      if (isIgnorableMissingPathError(error)) {
        return;
      }
      throw error;
    }

    for (const entry of entries) {
      const fullPath = path.join(currentPath, entry.name);
      let stats;
      try {
        stats = lstatSync(fullPath);
      } catch (error) {
        if (isIgnorableMissingPathError(error)) {
          continue;
        }
        throw error;
      }

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

function prepareIsolatedProductionInstall(sourceRoot, destinationRoot) {
  safeRemove(destinationRoot);
  mkdirSync(destinationRoot, { recursive: true });
  copyFileSync(path.join(sourceRoot, "package.json"), path.join(destinationRoot, "package.json"));
  copyFileSync(path.join(repoRoot, "pnpm-lock.yaml"), path.join(destinationRoot, "pnpm-lock.yaml"));
  runPnpm(
    [
      "install",
      "--prod",
      "--dir",
      destinationRoot,
      "--node-linker=hoisted",
      "--config.confirmModulesPurge=false",
      "--no-frozen-lockfile",
    ],
    {
      env: {
        ...process.env,
        CI: "true",
      },
    }
  );
}

function ensurePrismaCliDependencies(sourceRoot, destinationRoot) {
  const sourcePnpmRoot = path.join(sourceRoot, "node_modules", ".pnpm");
  const destinationPrismaNodeModules = path.join(
    destinationRoot,
    "node_modules",
    "prisma",
    "node_modules"
  );

  if (!existsSync(sourcePnpmRoot) || !existsSync(destinationPrismaNodeModules)) {
    return;
  }

  const destinationScopedRoot = path.join(destinationPrismaNodeModules, "@prisma");
  mkdirSync(destinationScopedRoot, { recursive: true });

  for (const storeEntry of readdirSync(sourcePnpmRoot, { withFileTypes: true })) {
    if (!storeEntry.isDirectory() || !storeEntry.name.startsWith("@prisma+")) {
      continue;
    }

    const prismaScopedDeps = path.join(
      sourcePnpmRoot,
      storeEntry.name,
      "node_modules",
      "@prisma"
    );

    if (!existsSync(prismaScopedDeps)) {
      continue;
    }

    for (const entry of readdirSync(prismaScopedDeps, { withFileTypes: true })) {
      const sourcePath = path.join(prismaScopedDeps, entry.name);
      const destinationPath = path.join(destinationScopedRoot, entry.name);
      safeRemove(destinationPath);
      cpSync(sourcePath, destinationPath, { recursive: true, dereference: true });
    }
  }
}

function copyPrismaCliPackage(sourceRoot, destinationRoot) {
  const sourcePrismaCli = path.join(sourceRoot, "node_modules", "prisma");
  const destinationPrismaCli = path.join(destinationRoot, "node_modules", "prisma");

  if (!existsSync(sourcePrismaCli)) {
    return;
  }

  const resolvedSource = realpathSync(sourcePrismaCli);
  safeRemove(destinationPrismaCli);
  cpSync(resolvedSource, destinationPrismaCli, { recursive: true, dereference: true });
}

function copyGeneratedPrismaClient(sourceRoot, destinationRoot) {
  const sourceGeneratedClient = path.join(sourceRoot, "node_modules", ".prisma");
  const destinationGeneratedClient = path.join(destinationRoot, "node_modules", ".prisma");

  if (!existsSync(sourceGeneratedClient)) {
    return;
  }

  safeRemove(destinationGeneratedClient);
  cpSync(sourceGeneratedClient, destinationGeneratedClient, { recursive: true, dereference: true });
}

function copyWorkspaceRuntimePackage(packageName, destinationRoot) {
  const sourcePackage = path.join(repoRoot, "node_modules", packageName);
  const destinationPackage = path.join(destinationRoot, "node_modules", packageName);

  if (!existsSync(sourcePackage)) {
    return;
  }

  const resolvedSource = realpathSync(sourcePackage);
  safeRemove(destinationPackage);
  cpSync(resolvedSource, destinationPackage, { recursive: true, dereference: true });
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

function isIgnorableMissingPathError(error) {
  return Boolean(
    error &&
      typeof error === "object" &&
      ("code" in error) &&
      (error.code === "ENOENT" || error.code === "ENOTDIR")
  );
}
