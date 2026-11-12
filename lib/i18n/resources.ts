// Every namespace, both languages. Add a namespace: create en/<ns>.ts + bn/<ns>.ts and list it here.
import en_common from "./locales/en/common"
import en_nav from "./locales/en/nav"
import en_dashboard from "./locales/en/dashboard"
import en_pos from "./locales/en/pos"
import en_orders from "./locales/en/orders"
import en_products from "./locales/en/products"
import en_ui from "./locales/en/ui"
import en_print from "./locales/en/print"
import en_tailor from "./locales/en/tailor"
import en_finance from "./locales/en/finance"
import en_inventory from "./locales/en/inventory"
import en_store from "./locales/en/store"
import en_account from "./locales/en/account"
import en_catalog from "./locales/en/catalog"
import en_commerce from "./locales/en/commerce"
import en_customers from "./locales/en/customers"
import en_auth from "./locales/en/auth"
import bn_common from "./locales/bn/common"
import bn_nav from "./locales/bn/nav"
import bn_dashboard from "./locales/bn/dashboard"
import bn_pos from "./locales/bn/pos"
import bn_orders from "./locales/bn/orders"
import bn_products from "./locales/bn/products"
import bn_ui from "./locales/bn/ui"
import bn_print from "./locales/bn/print"
import bn_tailor from "./locales/bn/tailor"
import bn_finance from "./locales/bn/finance"
import bn_inventory from "./locales/bn/inventory"
import bn_store from "./locales/bn/store"
import bn_account from "./locales/bn/account"
import bn_catalog from "./locales/bn/catalog"
import bn_commerce from "./locales/bn/commerce"
import bn_customers from "./locales/bn/customers"
import bn_auth from "./locales/bn/auth"

export const resources = {
  en: {
    common: en_common,
    nav: en_nav,
    dashboard: en_dashboard,
    pos: en_pos,
    orders: en_orders,
    products: en_products,
    ui: en_ui,
    print: en_print,
    tailor: en_tailor,
    finance: en_finance,
    inventory: en_inventory,
    store: en_store,
    account: en_account,
    catalog: en_catalog,
    commerce: en_commerce,
    customers: en_customers,
    auth: en_auth,
  },
  bn: {
    common: bn_common,
    nav: bn_nav,
    dashboard: bn_dashboard,
    pos: bn_pos,
    orders: bn_orders,
    products: bn_products,
    ui: bn_ui,
    print: bn_print,
    tailor: bn_tailor,
    finance: bn_finance,
    inventory: bn_inventory,
    store: bn_store,
    account: bn_account,
    catalog: bn_catalog,
    commerce: bn_commerce,
    customers: bn_customers,
    auth: bn_auth,
  },
} as const

export const NAMESPACES = Object.keys(resources.en) as (keyof typeof resources.en)[]
