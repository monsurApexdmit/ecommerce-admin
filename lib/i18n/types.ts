/**
 * Same keys as the English namespace, any string values. Bangla files use it so a missing
 * or misspelt key fails the type check:
 *   import type en from "../en/pos"; const bn: Messages<typeof en> = { ... }
 */
export type Messages<T> = { [K in keyof T]: T[K] extends string ? string : Messages<T[K]> }
