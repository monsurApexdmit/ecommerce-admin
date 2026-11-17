import "i18next"
import type { resources } from "./resources"

// Typed keys: t("pos:cart.title") fails `tsc` when the key is missing from English.
declare module "i18next" {
  interface CustomTypeOptions {
    defaultNS: "common"
    resources: (typeof resources)["en"]
  }
}
