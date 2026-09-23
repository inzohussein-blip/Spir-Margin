// The Windows installer is run by Windows PowerShell 5.1 and Windows Script
// Host, on machines nobody here can test on before a customer does. What
// breaks it silently is encoding and syntax, not logic — so those are checked.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const WIN = "scripts/windows";

test("the PowerShell installer is UTF-8 with a BOM and CRLF line endings", () => {
  // Without the BOM, PowerShell 5.1 reads the file as the machine's ANSI code
  // page and every Arabic message turns to mojibake.
  const raw = readFileSync(join(WIN, "install.ps1"));
  assert.deepEqual([...raw.subarray(0, 3)], [0xef, 0xbb, 0xbf], "missing UTF-8 BOM");
  const text = raw.toString("utf8");
  assert.ok(!/[^\r]\n/.test(text), "a line ends in LF alone");
});

test("the installer uses nothing PowerShell 5.1 lacks", () => {
  const code = readFileSync(join(WIN, "install.ps1"), "utf8")
    .split(/\r?\n/)
    .filter((l) => !l.trimStart().startsWith("#"))
    .join("\n")
    // Text inside quotes may say anything.
    .replace(/"(?:[^"`]|`.)*"/g, '""')
    .replace(/'[^']*'/g, "''");
  const pwsh7 = [
    [/\?\?/, "the ?? operator"],
    [/\?\./, "the ?. operator"],
    [/\s&&\s|\s\|\|\s/, "&& / || pipeline chains"],
    [/\S\s\?\s[^:]+\s:\s/, "the ternary ?: operator"],
    [/-Parallel\b/, "ForEach-Object -Parallel"],
  ];
  for (const [re, what] of pwsh7) assert.ok(!re.test(code), `uses ${what}`);
});

test("the VBScript files that show Arabic are UTF-16", () => {
  // Windows Script Host reads UTF-16 or the ANSI code page, nothing else.
  for (const f of readdirSync(WIN).filter((f) => f.endsWith(".vbs"))) {
    const raw = readFileSync(join(WIN, f));
    const utf16 = raw[0] === 0xff && raw[1] === 0xfe;
    const ascii = !utf16 && [...raw].every((b) => b < 0x80);
    assert.ok(utf16 || ascii, `${f} has non-ASCII text but is not UTF-16`);
  }
});

test("the command files are CRLF, which cmd.exe needs for labels and goto", () => {
  for (const f of ["install-windows.cmd", join(WIN, "run-server.cmd")]) {
    const text = readFileSync(f, "utf8");
    assert.ok(!/[^\r]\n/.test(text), `${f} has a line ending in LF alone`);
  }
});
