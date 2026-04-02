import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { homedir } from "os";

const HOOK_COMMAND = "npx buddy-reroll --apply-hook";

export function getSettingsPath() {
  return join(process.env.CLAUDE_CONFIG_DIR ?? join(homedir(), ".claude"), "settings.json");
}

export function readSettings(settingsPath) {
  if (!existsSync(settingsPath)) {
    return {};
  }
  try {
    return JSON.parse(readFileSync(settingsPath, "utf-8"));
  } catch {
    return {};
  }
}

export function writeSettings(settingsPath, obj) {
  const dir = dirname(settingsPath);
  mkdirSync(dir, { recursive: true });
  writeFileSync(settingsPath, JSON.stringify(obj, null, 2) + "\n");
}

export function installHook(settingsPath = getSettingsPath()) {
  const settings = readSettings(settingsPath);
  
  if (!settings.hooks) {
    settings.hooks = {};
  }
  if (!settings.hooks.SessionStart) {
    settings.hooks.SessionStart = [];
  }
  
  if (settings.hooks.SessionStart.includes(HOOK_COMMAND)) {
    return { installed: false, reason: "already installed" };
  }
  
  settings.hooks.SessionStart.push(HOOK_COMMAND);
  writeSettings(settingsPath, settings);
  
  return { installed: true, path: settingsPath };
}

export function removeHook(settingsPath = getSettingsPath()) {
  const settings = readSettings(settingsPath);
  
  if (!settings.hooks || !settings.hooks.SessionStart) {
    return { removed: false, reason: "not installed" };
  }
  
  settings.hooks.SessionStart = settings.hooks.SessionStart.filter(cmd => cmd !== HOOK_COMMAND);
  
  if (settings.hooks.SessionStart.length === 0) {
    delete settings.hooks.SessionStart;
  }
  
  if (Object.keys(settings.hooks).length === 0) {
    delete settings.hooks;
  }
  
  writeSettings(settingsPath, settings);
  
  return { removed: true, path: settingsPath };
}

export function isHookInstalled(settingsPath = getSettingsPath()) {
  const settings = readSettings(settingsPath);
  return settings.hooks?.SessionStart?.includes(HOOK_COMMAND) ?? false;
}

export function getSaltStorePath() {
  return join(process.env.CLAUDE_CONFIG_DIR ?? join(homedir(), ".claude"), ".buddy-reroll.json");
}

export function storeSalt(salt) {
  const path = getSaltStorePath();
  const dir = dirname(path);
  mkdirSync(dir, { recursive: true });
  writeFileSync(path, JSON.stringify({ salt, timestamp: Date.now() }, null, 2) + "\n");
}

export function readStoredSalt() {
  const path = getSaltStorePath();
  if (!existsSync(path)) {
    return null;
  }
  try {
    return JSON.parse(readFileSync(path, "utf-8"));
  } catch {
    return null;
  }
}
