import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync, statSync, appendFileSync } from "fs";
import { join, dirname } from "path";
import { homedir } from "os";
import { fileURLToPath } from "url";

const LEGACY_HOOK_COMMAND = "npx buddy-reroll --apply-hook";

// ── Hook command resolution ─────────────────────────────────────────────
// Use `node <absolute-path>` instead of `npx buddy-reroll` for reliability.
// npx is fragile on Windows: package may not be globally installed,
// cmd.exe may not have it in PATH, and resolution can timeout.

let _resolvedHookCommand = null;

export function resolveHookCommand(callerMetaUrl) {
  if (_resolvedHookCommand) return _resolvedHookCommand;

  if (callerMetaUrl) {
    try {
      const indexPath = fileURLToPath(callerMetaUrl);
      if (existsSync(indexPath)) {
        _resolvedHookCommand = `node "${indexPath}" --apply-hook`;
        return _resolvedHookCommand;
      }
    } catch {}
  }

  try {
    const thisFile = fileURLToPath(import.meta.url);
    const indexPath = join(dirname(thisFile), "..", "index.js");
    if (existsSync(indexPath)) {
      _resolvedHookCommand = `node "${indexPath}" --apply-hook`;
      return _resolvedHookCommand;
    }
  } catch {}

  _resolvedHookCommand = LEGACY_HOOK_COMMAND;
  return _resolvedHookCommand;
}

function buildHookEntry(command) {
  return {
    matcher: "",
    hooks: [{ type: "command", command, timeout: 10000 }],
  };
}

// ── Hook detection ──────────────────────────────────────────────────────
// Match both old-format (npx) and new-format (node <path>) entries

function isOurHook(entry) {
  if (typeof entry === "string") return entry.includes("buddy-reroll --apply-hook");
  if (entry?.hooks) return entry.hooks.some((h) => h.command && h.command.includes("buddy-reroll --apply-hook"));
  return false;
}

function needsUpgrade(entry) {
  if (!entry || typeof entry !== "object") return true;
  if (!("matcher" in entry)) return true;
  if (!entry.hooks?.[0]?.timeout) return true;
  if (entry.hooks?.[0]?.command === LEGACY_HOOK_COMMAND) return true;
  return false;
}

// ── Settings I/O ────────────────────────────────────────────────────────

export function getSettingsPath() {
  return join(process.env.CLAUDE_CONFIG_DIR ?? join(homedir(), ".claude"), "settings.json");
}

export function readSettings(settingsPath) {
  if (!existsSync(settingsPath)) return {};
  try {
    return JSON.parse(readFileSync(settingsPath, "utf-8"));
  } catch {
    return null;
  }
}

function writeSettingsAtomic(settingsPath, obj) {
  const dir = dirname(settingsPath);
  mkdirSync(dir, { recursive: true });
  const tmpPath = settingsPath + ".tmp";
  const content = JSON.stringify(obj, null, 2) + "\n";
  let mode;
  try { mode = statSync(settingsPath).mode; } catch {}
  writeFileSync(tmpPath, content, mode ? { mode } : undefined);
  renameSync(tmpPath, settingsPath);
}

export function writeSettings(settingsPath, obj) {
  writeSettingsAtomic(settingsPath, obj);
}

// ── Hook install/remove ─────────────────────────────────────────────────

export function installHook(settingsPath = getSettingsPath(), callerMetaUrl) {
  const settings = readSettings(settingsPath);
  if (!settings) return { installed: false, reason: "settings file is corrupted, not modifying" };

  if (!settings.hooks) settings.hooks = {};
  if (!Array.isArray(settings.hooks.SessionStart)) settings.hooks.SessionStart = [];

  const hookCommand = resolveHookCommand(callerMetaUrl);
  const hookEntry = buildHookEntry(hookCommand);

  const existing = settings.hooks.SessionStart.find(isOurHook);
  if (existing && typeof existing === "object" && !needsUpgrade(existing)) {
    return { installed: false, reason: "already installed" };
  }

  // Remove old-format or broken entries, then add the corrected one
  settings.hooks.SessionStart = settings.hooks.SessionStart.filter((e) => !isOurHook(e));
  settings.hooks.SessionStart.push(hookEntry);
  writeSettingsAtomic(settingsPath, settings);

  return { installed: true, path: settingsPath, command: hookCommand };
}

export function removeHook(settingsPath = getSettingsPath()) {
  const settings = readSettings(settingsPath);
  if (!settings) return { removed: false, reason: "settings file is corrupted, not modifying" };

  if (!settings.hooks || !Array.isArray(settings.hooks.SessionStart)) {
    return { removed: false, reason: "not installed" };
  }

  const before = settings.hooks.SessionStart.length;
  settings.hooks.SessionStart = settings.hooks.SessionStart.filter((e) => !isOurHook(e));

  if (settings.hooks.SessionStart.length === before) {
    return { removed: false, reason: "not installed" };
  }

  if (settings.hooks.SessionStart.length === 0) delete settings.hooks.SessionStart;
  if (Object.keys(settings.hooks).length === 0) delete settings.hooks;

  writeSettingsAtomic(settingsPath, settings);
  return { removed: true, path: settingsPath };
}

export function isHookInstalled(settingsPath = getSettingsPath()) {
  const settings = readSettings(settingsPath);
  if (!settings) return false;
  return Array.isArray(settings.hooks?.SessionStart) && settings.hooks.SessionStart.some(isOurHook);
}

// ── Salt storage ────────────────────────────────────────────────────────

export function getSaltStorePath() {
  return join(process.env.CLAUDE_CONFIG_DIR ?? join(homedir(), ".claude"), ".buddy-reroll.json");
}

export function storeSalt(salt) {
  const path = getSaltStorePath();
  const dir = dirname(path);
  mkdirSync(dir, { recursive: true });
  const tmpPath = path + ".tmp";
  writeFileSync(tmpPath, JSON.stringify({ salt, timestamp: Date.now() }, null, 2) + "\n");
  renameSync(tmpPath, path);
}

export function readStoredSalt() {
  const path = getSaltStorePath();
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf-8"));
  } catch {
    return null;
  }
}

// ── Diagnostics ─────────────────────────────────────────────────────────

export function getLogPath() {
  return join(process.env.CLAUDE_CONFIG_DIR ?? join(homedir(), ".claude"), ".buddy-reroll.log");
}

export function hookLog(message) {
  try {
    const timestamp = new Date().toISOString();
    const logPath = getLogPath();
    mkdirSync(dirname(logPath), { recursive: true });
    appendFileSync(logPath, `[${timestamp}] ${message}\n`);
  } catch {}
}
