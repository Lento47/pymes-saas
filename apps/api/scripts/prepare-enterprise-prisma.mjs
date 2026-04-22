import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const apiRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const prismaRoot = path.join(apiRoot, "prisma");
const baseSchemaPath = path.join(prismaRoot, "schema.prisma");
const enterpriseSchemaPath = path.join(prismaRoot, "schema.enterprise.sqlite.prisma");
const enterpriseSqlPath = path.join(prismaRoot, "schema.enterprise.sqlite.sql");

const baseSchema = readFileSync(baseSchemaPath, "utf8");
const enumMap = collectEnums(baseSchema);
const enterpriseSchema = buildEnterpriseSchema(baseSchema, enumMap);

mkdirSync(prismaRoot, { recursive: true });
writeFileSync(enterpriseSchemaPath, enterpriseSchema, "utf8");

runPrisma(["generate", "--schema", enterpriseSchemaPath]);
patchGeneratedClient(enumMap);

const sqliteSchemaSql = runPrisma(
  ["migrate", "diff", "--from-empty", "--to-schema-datamodel", enterpriseSchemaPath, "--script"],
  { captureOutput: true }
);
writeFileSync(enterpriseSqlPath, sqliteSchemaSql, "utf8");

function collectEnums(schema) {
  const enums = new Map();
  const enumRegex = /^enum\s+(\w+)\s*\{([\s\S]*?)^\}/gmu;
  let match;

  while ((match = enumRegex.exec(schema)) !== null) {
    const [, enumName, enumBody] = match;
    const values = enumBody
      .split(/\r?\n/u)
      .map((line) => line.replace(/\/\/.*$/u, "").trim())
      .filter(Boolean);
    enums.set(enumName, values);
  }

  return enums;
}

function buildEnterpriseSchema(schema, enums) {
  let nextSchema = schema
    .replace(/^enum\s+\w+\s*\{[\s\S]*?^\}\r?\n*/gmu, "")
    .replace(/provider\s*=\s*"sqlite"/u, 'provider = "sqlite"');

  const lines = nextSchema.split(/\r?\n/u).map((line) => transformLine(line, enums));
  nextSchema = lines.join("\n");

  if (!nextSchema.includes("  invitations         Invitation[]")) {
    nextSchema = nextSchema.replace(
      "  billing_events        BillingEvent[]\n",
      "  billing_events        BillingEvent[]\n  invitations           Invitation[]\n"
    );
  }

  if (!nextSchema.includes('  sent_invitations        Invitation[]')) {
    nextSchema = nextSchema.replace(
      "  billing_events         BillingEvent[]\n",
      '  billing_events         BillingEvent[]\n  sent_invitations      Invitation[]    @relation("InvitationInviter")\n'
    );
  }

  return nextSchema;
}

function transformLine(line, enums) {
  if (line.includes('provider = "postgresql"')) {
    return line.replace('provider = "postgresql"', 'provider = "sqlite"');
  }

  const fieldMatch = line.match(/^(\s*)([A-Za-z_][\w]*)\s+([A-Za-z_][\w]*)(\?|\[\])?(\s+.*)?$/u);
  if (!fieldMatch) {
    return line;
  }

  const [, indent, fieldName, fieldType, suffix = "", rawRest = ""] = fieldMatch;

  if (fieldName.startsWith("@@") || fieldName.startsWith("@")) {
    return line;
  }

  const isJsonField = fieldType === "Json";
  const isStringArrayField = fieldType === "String" && suffix === "[]";
  const enumValues = enums.get(fieldType);
  const isEnumField = Boolean(enumValues);

  if (!isJsonField && !isStringArrayField && !isEnumField) {
    return line;
  }

  let nextType = "String";
  let nextSuffix = suffix === "?" ? "?" : "";
  let nextRest = rawRest.replace(/\s+@db\.JsonB\b/gu, "");

  if (isStringArrayField) {
    nextSuffix = "";
    nextRest = nextRest.replace(/@default\(\[\]\)/gu, '@default("[]")');
  }

  if (isEnumField) {
    nextRest = nextRest.replace(/@default\(([^)]+)\)/u, (match, value) => {
      const normalizedValue = value.trim();
      return enumValues.includes(normalizedValue) ? `@default("${normalizedValue}")` : match;
    });
  }

  return `${indent}${fieldName} ${nextType}${nextSuffix}${nextRest}`;
}

function runPrisma(args, options = {}) {
  const localPrismaBin = path.join(
    apiRoot,
    "node_modules",
    ".bin",
    process.platform === "win32" ? "prisma.cmd" : "prisma"
  );
  const workspacePrismaBin = path.join(
    apiRoot,
    "..",
    "..",
    "node_modules",
    ".bin",
    process.platform === "win32" ? "prisma.cmd" : "prisma"
  );
  const prismaBin = existsSync(localPrismaBin) ? localPrismaBin : workspacePrismaBin;
  const execOptions = {
    cwd: apiRoot,
    encoding: options.captureOutput ? "utf8" : undefined,
    stdio: options.captureOutput ? ["ignore", "pipe", "inherit"] : "inherit",
  };

  if (process.platform === "win32") {
    const command = [prismaBin, ...args].map(quoteForCmd).join(" ");
    return execFileSync(process.env.ComSpec || "cmd.exe", ["/d", "/s", "/c", command], execOptions);
  }

  return execFileSync(prismaBin, args, execOptions);
}

function patchGeneratedClient(enums) {
  const prismaPackageJsonPath = require.resolve("@prisma/client/package.json", { paths: [apiRoot] });
  const prismaClientDir = path.dirname(prismaPackageJsonPath);
  const runtimePatch = buildRuntimeEnumPatch(enums);
  const typesPatch = buildTypesEnumPatch(enums);

  for (const relativePath of ["index.js", "default.js"]) {
    const targetPath = path.join(prismaClientDir, relativePath);
    if (!existsSync(targetPath)) {
      continue;
    }
    applyPatchBlock(targetPath, runtimePatch, "// enterprise-enum-compat:start", "// enterprise-enum-compat:end");
  }

  for (const relativePath of ["index.d.ts", "default.d.ts"]) {
    const targetPath = path.join(prismaClientDir, relativePath);
    if (!existsSync(targetPath)) {
      continue;
    }
    applyPatchBlock(targetPath, typesPatch, "// enterprise-enum-types:start", "// enterprise-enum-types:end");
  }
}

function buildRuntimeEnumPatch(enums) {
  const lines = ["// enterprise-enum-compat:start"];

  for (const [enumName, enumValues] of enums) {
    lines.push(`module.exports.${enumName} = {`);
    for (const enumValue of enumValues) {
      lines.push(`  ${enumValue}: "${enumValue}",`);
    }
    lines.push("};");
  }

  lines.push("// enterprise-enum-compat:end");
  return `${lines.join("\n")}\n`;
}

function buildTypesEnumPatch(enums) {
  const lines = ["// enterprise-enum-types:start"];

  for (const [enumName, enumValues] of enums) {
    const valueUnion = enumValues.map((value) => `"${value}"`).join(" | ");
    lines.push(`export const ${enumName}: {`);
    for (const enumValue of enumValues) {
      lines.push(`  ${enumValue}: "${enumValue}";`);
    }
    lines.push("};");
    lines.push(`export type ${enumName} = ${valueUnion};`);
  }

  lines.push("// enterprise-enum-types:end");
  return `\n${lines.join("\n")}\n`;
}

function applyPatchBlock(targetPath, patchContent, startMarker, endMarker) {
  let content = readFileSync(targetPath, "utf8");
  const blockRegex = new RegExp(`${escapeRegExp(startMarker)}[\\s\\S]*?${escapeRegExp(endMarker)}\\n?`, "u");
  content = content.replace(blockRegex, "");

  if (!content.endsWith("\n")) {
    content += "\n";
  }

  writeFileSync(targetPath, `${content}${patchContent}`, "utf8");
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

function quoteForCmd(value) {
  return /[\s"]/u.test(value) ? `"${value.replace(/"/gu, '\\"')}"` : value;
}
