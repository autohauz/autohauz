import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Static guards for bug classes that the type checker and ESLint cannot see.
 * Each one shipped to production at least once.
 */
const SRC = join(__dirname, "..");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return /\.(ts|tsx)$/.test(name) && !name.endsWith(".test.ts") ? [full] : [];
  });
}

const files = sourceFiles(SRC).map((path) => ({
  path: relative(SRC, path).replaceAll("\\", "/"),
  text: readFileSync(path, "utf8"),
}));

describe("source guards", () => {
  it("has no escaped interpolation (`\\${`) inside template literals", () => {
    // `\${x}` renders the literal text "${x}" — it broke blog URLs, admin
    // links and the unsubscribe link in every marketing email.
    const offenders = files.filter((f) => f.text.includes("\\${")).map((f) => f.path);
    expect(offenders).toEqual([]);
  });

  it("never renders JSON-LD with raw JSON.stringify", () => {
    // JSON.stringify does not escape `</script>`; use <JsonLd> / serializeJsonLd.
    const offenders = files
      .filter((f) => /dangerouslySetInnerHTML=\{\{\s*__html:\s*JSON\.stringify/.test(f.text))
      .map((f) => f.path);
    expect(offenders).toEqual([]);
  });
});
