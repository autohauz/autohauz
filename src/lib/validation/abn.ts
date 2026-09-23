import { z } from "zod";

/**
 * Validates an Australian Business Number (ABN) with the ATO checksum:
 * subtract 1 from the first digit, multiply each digit by its weight,
 * and the sum must be divisible by 89.
 * Weights: [10, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19]
 */
export function isValidABN(abn: string): boolean {
  const digitsOnly = abn.replace(/\s+/g, "");
  if (!/^\d{11}$/.test(digitsOnly)) return false;

  const weights = [10, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19];
  const digits = digitsOnly.split("").map((d) => parseInt(d, 10));
  digits[0] -= 1;

  let sum = 0;
  for (let i = 0; i < 11; i++) sum += digits[i] * weights[i];
  return sum % 89 === 0;
}

/** Formats an 11-digit ABN in the conventional `NN NNN NNN NNN` grouping. */
export function formatABN(abn: string): string {
  const d = abn.replace(/\s+/g, "");
  if (!/^\d{11}$/.test(d)) return abn;
  return `${d.slice(0, 2)} ${d.slice(2, 5)} ${d.slice(5, 8)} ${d.slice(8, 11)}`;
}

/** Zod schema: 11 digits (spaces tolerated) with a valid checksum. Stored without spaces. */
export const abnSchema = z
  .string()
  .trim()
  .transform((v) => v.replace(/\s+/g, ""))
  .pipe(
    z
      .string()
      .regex(/^\d{11}$/, "ABN must be 11 digits")
      .refine(isValidABN, "Invalid ABN checksum — please enter a valid Australian Business Number"),
  );

/** Optional ABN for settings forms: empty string → undefined, otherwise validated. */
export const optionalAbnSchema = z.preprocess(
  (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
  abnSchema.optional(),
);
