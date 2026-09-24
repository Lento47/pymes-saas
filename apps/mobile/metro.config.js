const path = require("node:path");
const { getDefaultConfig } = require("expo/metro-config");

const projectRoot = process.cwd();
const workspaceRoot = path.resolve(projectRoot, "../..");
const config = getDefaultConfig(projectRoot);

config.resolver.extraNodeModules = {
	...(config.resolver.extraNodeModules ?? {}),
	"@pymeshub/auth": path.resolve(workspaceRoot, "packages/auth"),
	"@pymeshub/env": path.resolve(workspaceRoot, "packages/env"),
	"@pymeshub/i18n": path.resolve(workspaceRoot, "packages/i18n"),
	"@pymeshub/shared": path.resolve(workspaceRoot, "packages/shared"),
	api: path.resolve(workspaceRoot, "apps/api"),
};

module.exports = config;
