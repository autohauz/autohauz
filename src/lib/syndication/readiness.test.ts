import { describe, it, expect } from "vitest";
import { evaluateReadiness, findDuplicateVins, MIN_PUBLISH_IMAGES } from "./readiness";
import type { CanonicalVehicle } from "./types";

/**
 * Golden fixture: one fully valid vehicle, plus one case per documented
 * rejection code (docs/syndication/failure-modes.md testing requirements).
 *
 * These gates decide whether a car is advertised, so every rejection must be
 * proven to reject — a gate that silently passes is how a non-compliant
 * listing reaches a channel.
 */
const VALID: CanonicalVehicle = {
  vehicleId: "11111111-1111-4111-8111-111111111111",
  dealerId: "22222222-2222-4222-8222-222222222222",
  locationId: "33333333-3333-4333-8333-333333333333",
  stockNumber: "STK-A1042",
  vin: "WVWZZZ1JZ3W386752",
  rego: "CRQ30E",
  regoState: "NSW",
  make: "Toyota",
  model: "Hilux",
  makeSlug: "toyota",
  modelSlug: "hilux",
  vehicleSlug: "2021-toyota-hilux-sr5-a1042",
  variant: "SR5",
  badge: null,
  bodyType: "ute",
  year: 2020,
  odometerKm: 84_500,
  transmission: "automatic",
  fuelType: "diesel",
  drivetrain: "four_wd",
  doors: 4,
  seats: 5,
  engineCc: 2800,
  engineText: "2.8L 4-cyl turbo diesel",
  colourExterior: "Silver",
  colourInterior: "Black cloth",
  condition: "used",
  priceAmount: 42_999,
  priceType: "drive_away",
  currency: "AUD",
  status: "available",
  descriptionRaw: "One owner, full service history, roadworthy included.",
  descriptionGenerated: null,
  descriptionApprovedAt: null,
  buildDate: "2020-03-01",
  complianceDate: "2020-05-01",
  wovrFlag: false,
  tiktokUrl: null,
  tiktokEmbedHtml: null,
  imageCount: 12,
  updatedAt: "2026-08-01T00:00:00Z",
  soldAt: null,
  version: 1,
};

const codes = (v: CanonicalVehicle, opts?: Parameters<typeof evaluateReadiness>[1]) =>
  evaluateReadiness(v, opts).rejections.map((r) => r.code);

describe("evaluateReadiness — the valid fixture", () => {
  it("passes every base gate", () => {
    const result = evaluateReadiness(VALID);
    expect(result.rejections).toEqual([]);
    expect(result.ready).toBe(true);
  });

  it("is pure — repeated calls on the same input agree", () => {
    expect(evaluateReadiness(VALID)).toEqual(evaluateReadiness(VALID));
  });
});

describe("VIN gates", () => {
  it("MISSING_VIN when absent — the state 100% of live inventory was in", () => {
    expect(codes({ ...VALID, vin: null })).toContain("MISSING_VIN");
  });

  it("INVALID_VIN on the wrong length", () => {
    expect(codes({ ...VALID, vin: "TOOSHORT" })).toContain("INVALID_VIN");
  });

  it("INVALID_VIN on I, O or Q — excluded from the standard as 1/0 lookalikes", () => {
    expect(codes({ ...VALID, vin: "WVWZZZ1JZ3W38675I" })).toContain("INVALID_VIN");
    expect(codes({ ...VALID, vin: "WVWZZZ1JZ3W38675O" })).toContain("INVALID_VIN");
    expect(codes({ ...VALID, vin: "WVWZZZ1JZ3W38675Q" })).toContain("INVALID_VIN");
  });

  it("accepts a lowercase VIN — staff typing is not a data error", () => {
    expect(codes({ ...VALID, vin: "wvwzzz1jz3w386752" })).toEqual([]);
  });

  it("DUPLICATE_VIN rejects rather than silently picking one row", () => {
    const dupes = new Set([VALID.vin!.toUpperCase()]);
    expect(codes(VALID, { vinDuplicates: dupes })).toContain("DUPLICATE_VIN");
  });

  it("does not report a duplicate when the VIN is unique", () => {
    expect(codes(VALID, { vinDuplicates: new Set(["OTHERVIN123456789"]) })).toEqual([]);
  });
});

describe("price gates", () => {
  it("MISSING_PRICE on a zero or absent price", () => {
    expect(codes({ ...VALID, priceAmount: 0 })).toContain("MISSING_PRICE");
  });

  it("MISSING_PRICE_TYPE — drive-away vs ex-gov is never inferred (F8)", () => {
    expect(codes({ ...VALID, priceType: null })).toContain("MISSING_PRICE_TYPE");
  });

  it("accepts both Australian price semantics", () => {
    expect(codes({ ...VALID, priceType: "drive_away" })).toEqual([]);
    expect(codes({ ...VALID, priceType: "ex_gov" })).toEqual([]);
  });
});

describe("media gates (F25)", () => {
  it("MEDIA_NOT_READY with no photos", () => {
    expect(codes({ ...VALID, imageCount: 0 })).toContain("MEDIA_NOT_READY");
  });

  it("warns but does not block below the recommended photo count", () => {
    const result = evaluateReadiness({ ...VALID, imageCount: MIN_PUBLISH_IMAGES - 1 });
    expect(result.ready).toBe(true);
    expect(result.warnings.map((w) => w.code)).toContain("FEW_IMAGES");
  });
});

describe("WOVR disclosure (F27)", () => {
  it("blocks a written-off vehicle whose description omits the disclosure", () => {
    expect(codes({ ...VALID, wovrFlag: true })).toContain("WOVR_NOT_DISCLOSED");
  });

  it("passes once the description discloses it", () => {
    const disclosed = {
      ...VALID,
      wovrFlag: true,
      descriptionRaw: "Listed on the WOVR as a repairable write-off. Fully repaired and re-registered.",
    };
    expect(codes(disclosed)).toEqual([]);
  });

  it("accepts the disclosure in generated copy that has been approved", () => {
    const v = {
      ...VALID,
      wovrFlag: true,
      descriptionRaw: null,
      descriptionGenerated: "This vehicle is a repairable write-off.",
      descriptionApprovedAt: "2026-08-01T00:00:00Z",
    };
    expect(codes(v)).toEqual([]);
  });

  it("blocks a WOVR vehicle with no description at all", () => {
    expect(codes({ ...VALID, wovrFlag: true, descriptionRaw: null })).toContain("WOVR_NOT_DISCLOSED");
  });
});

describe("generated description approval (Hard Rule 4 / F5)", () => {
  it("blocks unapproved AI copy", () => {
    const v = { ...VALID, descriptionGenerated: "Heated seats and full service history.", descriptionApprovedAt: null };
    expect(codes(v)).toContain("DESCRIPTION_NOT_APPROVED");
  });

  it("allows it once a human has approved", () => {
    const v = {
      ...VALID,
      descriptionGenerated: "Heated seats and full service history.",
      descriptionApprovedAt: "2026-08-01T00:00:00Z",
    };
    expect(codes(v)).toEqual([]);
  });

  it("does not block a vehicle that has no generated copy at all", () => {
    expect(codes({ ...VALID, descriptionGenerated: null, descriptionApprovedAt: null })).toEqual([]);
  });
});

describe("multiple failures", () => {
  it("reports every reason at once, so staff fix the car in one pass", () => {
    const broken = { ...VALID, vin: null, priceType: null, imageCount: 0 };
    expect(codes(broken).sort()).toEqual(["MEDIA_NOT_READY", "MISSING_PRICE_TYPE", "MISSING_VIN"]);
  });

  it("gives every rejection a plain-English message and a fix hint (F19)", () => {
    for (const r of evaluateReadiness({ ...VALID, vin: null, priceType: null }).rejections) {
      expect(r.message.length).toBeGreaterThan(20);
      expect(r.fixHint.length).toBeGreaterThan(10);
      // Staff-facing copy must not leak internal codes.
      expect(r.message).not.toMatch(/[A-Z]{4,}_[A-Z]{2,}/);
    }
  });
});

describe("findDuplicateVins", () => {
  it("finds VINs shared by more than one vehicle, case-insensitively", () => {
    const dupes = findDuplicateVins([
      { vin: "WVWZZZ1JZ3W386752" },
      { vin: "wvwzzz1jz3w386752" },
      { vin: "JTDBR32E320012345" },
    ]);
    expect([...dupes]).toEqual(["WVWZZZ1JZ3W386752"]);
  });

  it("ignores null VINs rather than treating them as duplicates of each other", () => {
    expect(findDuplicateVins([{ vin: null }, { vin: null }]).size).toBe(0);
  });
});
