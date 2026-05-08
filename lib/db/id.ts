import { customAlphabet } from "nanoid";

// URL-safe alphabet, no ambiguous chars stripped — 14-char nanoid is ~83 bits.
const nano = customAlphabet(
  "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ",
  14,
);

/** Generate a prefixed text id, e.g. newId("share") -> "share_aB3kQ9..." */
export function newId(prefix: string): string {
  if (!prefix || !/^[a-z][a-z0-9_]*$/.test(prefix)) {
    throw new Error(`newId: invalid prefix "${prefix}"`);
  }
  return `${prefix}_${nano()}`;
}
