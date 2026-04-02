import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import {
  readSettings,
  writeSettings,
  installHook,
  removeHook,
  isHookInstalled,
  storeSalt,
  readStoredSalt,
} from "./hooks.js";

let tempDir;

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), "buddy-reroll-test-"));
  process.env.CLAUDE_CONFIG_DIR = tempDir;
});

afterEach(() => {
  delete process.env.CLAUDE_CONFIG_DIR;
  rmSync(tempDir, { recursive: true, force: true });
});

describe("readSettings", () => {
  it("returns empty object when file doesn't exist", () => {
    const settingsPath = join(tempDir, "settings.json");
    expect(readSettings(settingsPath)).toEqual({});
  });

  it("parses valid JSON file", () => {
    const settingsPath = join(tempDir, "settings.json");
    writeSettings(settingsPath, { permissions: { allow: [] } });
    expect(readSettings(settingsPath)).toEqual({ permissions: { allow: [] } });
  });

  it("returns empty object for corrupted JSON", () => {
    const settingsPath = join(tempDir, "settings.json");
    writeFileSync(settingsPath, "{ invalid json");
    expect(readSettings(settingsPath)).toEqual({});
  });
});

describe("writeSettings", () => {
  it("creates parent directories if needed", () => {
    const settingsPath = join(tempDir, "nested", "dir", "settings.json");
    writeSettings(settingsPath, { test: true });
    expect(readSettings(settingsPath)).toEqual({ test: true });
  });

  it("writes JSON with 2-space indent and newline", () => {
    const settingsPath = join(tempDir, "settings.json");
    writeSettings(settingsPath, { a: 1, b: 2 });
    const content = readFileSync(settingsPath, "utf-8");
    expect(content).toContain("  ");
    expect(content.endsWith("\n")).toBe(true);
  });
});

describe("installHook", () => {
  it("creates settings.json if missing", () => {
    const settingsPath = join(tempDir, "settings.json");
    const result = installHook(settingsPath);
    expect(result.installed).toBe(true);
    const settings = readSettings(settingsPath);
    expect(settings.hooks.SessionStart).toContain("npx buddy-reroll --apply-hook");
  });

  it("adds hook to existing settings", () => {
    const settingsPath = join(tempDir, "settings.json");
    writeSettings(settingsPath, { permissions: { allow: [] } });
    installHook(settingsPath);
    const settings = readSettings(settingsPath);
    expect(settings.permissions).toEqual({ allow: [] });
    expect(settings.hooks.SessionStart).toContain("npx buddy-reroll --apply-hook");
  });

  it("is idempotent - doesn't duplicate hook", () => {
    const settingsPath = join(tempDir, "settings.json");
    installHook(settingsPath);
    const result = installHook(settingsPath);
    expect(result.installed).toBe(false);
    expect(result.reason).toBe("already installed");
    const settings = readSettings(settingsPath);
    const count = settings.hooks.SessionStart.filter(cmd => cmd === "npx buddy-reroll --apply-hook").length;
    expect(count).toBe(1);
  });

  it("preserves existing hooks in SessionStart array", () => {
    const settingsPath = join(tempDir, "settings.json");
    writeSettings(settingsPath, {
      hooks: { SessionStart: ["existing-hook"] },
    });
    installHook(settingsPath);
    const settings = readSettings(settingsPath);
    expect(settings.hooks.SessionStart).toContain("existing-hook");
    expect(settings.hooks.SessionStart).toContain("npx buddy-reroll --apply-hook");
  });
});

describe("removeHook", () => {
  it("removes hook from SessionStart", () => {
    const settingsPath = join(tempDir, "settings.json");
    installHook(settingsPath);
    const result = removeHook(settingsPath);
    expect(result.removed).toBe(true);
    const settings = readSettings(settingsPath);
    expect(settings.hooks?.SessionStart?.includes("npx buddy-reroll --apply-hook") ?? false).toBe(false);
  });

  it("deletes empty SessionStart array", () => {
    const settingsPath = join(tempDir, "settings.json");
    installHook(settingsPath);
    removeHook(settingsPath);
    const settings = readSettings(settingsPath);
    expect(settings.hooks?.SessionStart).toBeUndefined();
  });

  it("deletes empty hooks object", () => {
    const settingsPath = join(tempDir, "settings.json");
    installHook(settingsPath);
    removeHook(settingsPath);
    const settings = readSettings(settingsPath);
    expect(settings.hooks).toBeUndefined();
  });

  it("returns false when hook not installed", () => {
    const settingsPath = join(tempDir, "settings.json");
    const result = removeHook(settingsPath);
    expect(result.removed).toBe(false);
    expect(result.reason).toBe("not installed");
  });

  it("preserves other hooks in SessionStart", () => {
    const settingsPath = join(tempDir, "settings.json");
    writeSettings(settingsPath, {
      hooks: { SessionStart: ["other-hook", "npx buddy-reroll --apply-hook"] },
    });
    removeHook(settingsPath);
    const settings = readSettings(settingsPath);
    expect(settings.hooks.SessionStart).toContain("other-hook");
    expect(settings.hooks.SessionStart).not.toContain("npx buddy-reroll --apply-hook");
  });

  it("preserves other hook types", () => {
    const settingsPath = join(tempDir, "settings.json");
    writeSettings(settingsPath, {
      hooks: {
        SessionStart: ["npx buddy-reroll --apply-hook"],
        OnExit: ["some-command"],
      },
    });
    removeHook(settingsPath);
    const settings = readSettings(settingsPath);
    expect(settings.hooks.OnExit).toContain("some-command");
  });
});

describe("isHookInstalled", () => {
  it("returns true after install", () => {
    const settingsPath = join(tempDir, "settings.json");
    installHook(settingsPath);
    expect(isHookInstalled(settingsPath)).toBe(true);
  });

  it("returns false after remove", () => {
    const settingsPath = join(tempDir, "settings.json");
    installHook(settingsPath);
    removeHook(settingsPath);
    expect(isHookInstalled(settingsPath)).toBe(false);
  });

  it("returns false when settings don't exist", () => {
    const settingsPath = join(tempDir, "settings.json");
    expect(isHookInstalled(settingsPath)).toBe(false);
  });

  it("returns false when hooks don't exist", () => {
    const settingsPath = join(tempDir, "settings.json");
    writeSettings(settingsPath, { permissions: { allow: [] } });
    expect(isHookInstalled(settingsPath)).toBe(false);
  });
});

describe("storeSalt and readStoredSalt", () => {
  it("roundtrips salt with timestamp", () => {
    const salt = "test-salt-value";
    storeSalt(salt);
    const stored = readStoredSalt();
    expect(stored.salt).toBe(salt);
    expect(typeof stored.timestamp).toBe("number");
    expect(stored.timestamp).toBeGreaterThan(0);
  });

  it("returns null when file doesn't exist", () => {
    expect(readStoredSalt()).toBeNull();
  });

  it("returns null for corrupted salt file", () => {
    const saltPath = join(tempDir, ".buddy-reroll.json");
    writeFileSync(saltPath, "{ invalid json");
    expect(readStoredSalt()).toBeNull();
  });

  it("creates parent directories for salt file", () => {
    const salt = "another-test-salt";
    storeSalt(salt);
    const stored = readStoredSalt();
    expect(stored.salt).toBe(salt);
  });
});

describe("integration", () => {
  it("preserves existing settings when installing hook", () => {
    const settingsPath = join(tempDir, "settings.json");
    writeSettings(settingsPath, {
      permissions: { allow: ["some-permission"] },
      other: { nested: { value: 42 } },
    });
    installHook(settingsPath);
    const settings = readSettings(settingsPath);
    expect(settings.permissions).toEqual({ allow: ["some-permission"] });
    expect(settings.other).toEqual({ nested: { value: 42 } });
    expect(settings.hooks.SessionStart).toContain("npx buddy-reroll --apply-hook");
  });

  it("preserves existing settings when removing hook", () => {
    const settingsPath = join(tempDir, "settings.json");
    writeSettings(settingsPath, {
      permissions: { allow: ["some-permission"] },
      hooks: { SessionStart: ["npx buddy-reroll --apply-hook"] },
    });
    removeHook(settingsPath);
    const settings = readSettings(settingsPath);
    expect(settings.permissions).toEqual({ allow: ["some-permission"] });
    expect(settings.hooks).toBeUndefined();
  });
});
