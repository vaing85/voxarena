import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import yaml from "js-yaml";

const SHARED = path.resolve(process.cwd(), "..", "..", "shared");

describe("OpenAPI contract (shared/contracts/openapi.yaml)", () => {
  const spec = yaml.load(
    readFileSync(path.join(SHARED, "contracts", "openapi.yaml"), "utf8")
  ) as any;

  it("is a valid OpenAPI 3 document", () => {
    expect(spec.openapi).toMatch(/^3\./);
    expect(spec.info?.title).toBe("VoxArena API");
  });

  it("documents every implemented route", () => {
    const expected = [
      "/health",
      "/songs",
      "/songs/{id}",
      "/players",
      "/players/{id}",
      "/players/{id}/performances",
      "/players/{id}/matches",
      "/performances",
      "/performances/audio",
      "/leaderboard",
      "/matchmaking/ranked/join",
      "/matchmaking/ranked/leave",
      "/matchmaking/ranked/pending/{playerId}",
      "/bot/presets",
      "/bot/solo-vs-bot",
      "/store/packs",
      "/store/checkout",
      "/store/webhook",
      "/cosmetics",
      "/cosmetics/checkout",
      "/cosmetics/equip",
      "/cosmetics/unequip",
      "/admin/flags",
      "/admin/flags/{id}/resolve",
      "/tournaments",
      "/tournaments/{id}",
      "/tournaments/{id}/join",
      "/tournaments/{id}/start",
      "/tournaments/{id}/report",
    ];
    for (const p of expected) {
      expect(spec.paths, `missing path ${p}`).toHaveProperty([p]);
    }
  });

  it("declares the two security schemes used for auth", () => {
    expect(spec.components?.securitySchemes).toHaveProperty("bearerAuth");
    expect(spec.components?.securitySchemes).toHaveProperty("devPlayerId");
  });

  it("only references security schemes that are defined", () => {
    const defined = new Set(Object.keys(spec.components?.securitySchemes ?? {}));
    const serialized = JSON.stringify(spec);
    // Collect every security requirement object across the doc.
    const used = new Set<string>();
    JSON.parse(serialized, (key, value) => {
      if (key === "security" && Array.isArray(value)) {
        for (const req of value) {
          for (const name of Object.keys(req)) used.add(name);
        }
      }
      return value;
    });
    for (const name of used) {
      expect(defined.has(name), `undefined security scheme: ${name}`).toBe(true);
    }
  });
});

describe("Event schemas (shared/events/*.json)", () => {
  const dir = path.join(SHARED, "events");
  const files = readdirSync(dir).filter((f) => f.endsWith(".json"));

  it("has at least the core domain events", () => {
    expect(files).toEqual(
      expect.arrayContaining([
        "performance.recorded.json",
        "match.completed.json",
        "entitlement.granted.json",
      ])
    );
  });

  it.each(files.length ? files : ["__none__"])(
    "%s is a JSON Schema whose event const matches its filename",
    (file) => {
      if (file === "__none__") return;
      const schema = JSON.parse(readFileSync(path.join(dir, file), "utf8"));
      expect(schema.$schema).toMatch(/json-schema\.org/);
      expect(schema.type).toBe("object");
      const name = file.replace(/\.json$/, "");
      expect(schema.title).toBe(name);
      expect(schema.properties?.event?.const).toBe(name);
      // Every event carries an envelope.
      expect(schema.required).toEqual(
        expect.arrayContaining(["event", "version", "occurredAt"])
      );
    }
  );
});
