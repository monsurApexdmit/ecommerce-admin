"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useTranslation } from "react-i18next"
import { useOrder } from "@/contexts/order-context"
import { useShippingAddress } from "@/contexts/shipping-address-context"
import { useCustomer } from "@/contexts/customer-context"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { ChoiceCard, ChoiceCardGroup } from "@/components/common/ChoiceCard"
import { EmptyState } from "@/components/common/EmptyState"
import { FormField } from "@/components/common/FormField"
import { PageHeader } from "@/components/common/PageHeader"
import { WithTooltip } from "@/components/common/WithTooltip"
import { Separator } from "@/components/ui/separator"
import { toast } from "sonner"
import { ArrowLeft, MapPin, Trash2, Plus, Check } from "lucide-react"
import Link from "next/link"
import { useCompanySettings } from "@/contexts/company-settings-context"
import { useSaasAuth } from "@/contexts/saas-auth-context"
import { AccessDenied } from "@/components/ui/access-denied"
import { useModuleGuard } from "@/hooks/use-module-guard"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

export default function CheckoutPage() {
  const { t } = useTranslation(["commerce", "common"])
  const { canRead } = useSaasAuth()
  const router = useRouter()
  const { cart, getCartTotal, removeFromCart, clearCart, createOrder } = useOrder()
  const { addresses, getAddressesByCustomer, getDefaultAddress } = useShippingAddress()
  const { customers } = useCustomer()
  const { formatCurrency } = useCompanySettings()

  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("")
  const [customerName, setCustomerName] = useState("")
  const [paymentMethod, setPaymentMethod] = useState<"Cash" | "Card" | "Online">("Cash")
  const [shippingCost, setShippingCost] = useState(0)
  const [discount, setDiscount] = useState(0)
  const [notes, setNotes] = useState("")
  const [selectedAddressId, setSelectedAddressId] = useState<string>("")
  const [useDefaultAddress, setUseDefaultAddress] = useState(true)
  const [isProcessing, setIsProcessing] = useState(false)
  const [showAddressDialog, setShowAddressDialog] = useState(false)

  const [customerAddresses, setCustomerAddresses] = useState<any[]>([])

  // Load customer addresses when customer is selected
  useEffect(() => {
    if (selectedCustomerId) {
      const custId = parseInt(selectedCustomerId)
      const custAddresses = getAddressesByCustomer(custId.toString())
      setCustomerAddresses(custAddresses)

      // Auto-select default address if available
      const defaultAddr = getDefaultAddress(custId.toString())
      if (defaultAddr && useDefaultAddress) {
        setSelectedAddressId(defaultAddr.id)
      }

      // Set customer name
      const customer = customers.find(c => String(c.id) === String(custId))
      if (customer) {
        setCustomerName(customer.name)
      }
    } else {
      setCustomerAddresses([])
      setSelectedAddressId("")
    }
  }, [selectedCustomerId, useDefaultAddress, customers, getAddressesByCustomer, getDefaultAddress])

  const blocked = useModuleGuard('Checkout')
  if (blocked) return blocked

  const subtotal = getCartTotal()
  const total = subtotal + shippingCost - discount

  const handlePlaceOrder = async () => {
    // Validation
    if (cart.length === 0) {
      toast.error(t("commerce:checkout.toast.cartEmpty"))
      return
    }

    if (!customerName.trim()) {
      toast.error(t("commerce:checkout.toast.nameRequired"))
      return
    }

    if (total <= 0) {
      toast.error(t("commerce:checkout.toast.totalPositive"))
      return
    }

    setIsProcessing(true)

    try {
      const orderData: any = {
        customerName: customerName.trim(),
        method: paymentMethod,
        amount: total,
        items: cart.map(item => ({
          productId: item.productId,
          productName: item.productName,
          quantity: item.quantity,
          price: item.price,
        })),
      }

      // Add optional fields
      if (selectedCustomerId) {
        orderData.customerId = parseInt(selectedCustomerId)
      }

      if (shippingCost > 0) {
        orderData.shippingCost = shippingCost
      }

      if (discount > 0) {
        orderData.discount = discount
      }

      if (notes.trim()) {
        orderData.notes = notes.trim()
      }

      // Add shipping address if selected and not using default
      if (selectedAddressId && !useDefaultAddress) {
        orderData.shippingAddressId = parseInt(selectedAddressId)
      }
      // If using default address, don't send shippingAddressId (backend will auto-select)

      const result = await createOrder(orderData)

      if (result.success) {
        toast.success(t("commerce:checkout.toast.placed"), {
          description: t("commerce:checkout.toast.invoice", { invoice: result.data?.invoiceNo || "—" }),
        })
        router.push("/dashboard/orders")
      } else {
        toast.error(t("commerce:checkout.toast.failed"), {
          description: result.error || t("common:extra.tryAgain"),
        })
      }
    } catch (error) {
      console.error("Order error:", error)
      toast.error(t("commerce:checkout.toast.error"))
    } finally {
      setIsProcessing(false)
    }
  }

  if (cart.length === 0) {
    return (
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>{t("commerce:checkout.emptyTitle")}</CardTitle>
            <CardDescription>{t("commerce:checkout.emptyDesc")}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/dashboard/products">{t("commerce:checkout.browse")}</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <WithTooltip content={t("commerce:checkout.backToOrders")}>
          <Button asChild variant="ghost" size="icon">
            <Link href="/dashboard/orders" aria-label={t("commerce:checkout.backToOrders")}>
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
        </WithTooltip>
        <PageHeader title={t("commerce:checkout.title")} description={t("commerce:checkout.description")} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Order Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Customer Information */}
          <Card>
            <CardHeader>
              <CardTitle>{t("commerce:checkout.customerInfo")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField label={t("commerce:checkout.selectCustomer")} htmlFor="customer">
                  <Select value={selectedCustomerId} onValueChange={setSelectedCustomerId}>
                    <SelectTrigger id="customer" className="w-full">
                      <SelectValue placeholder={t("commerce:checkout.guest")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="guest">{t("commerce:checkout.guestCheckout")}</SelectItem>
                      {customers.map((customer) => (
                        <SelectItem key={customer.id} value={customer.id.toString()}>
                          {customer.name} - {customer.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormField>

                <FormField label={t("commerce:checkout.customerName")} htmlFor="customerName">
                  <Input
                    id="customerName"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder={t("commerce:checkout.customerPlaceholder")}
                    required
                  />
                </FormField>
              </div>
            </CardContent>
          </Card>

          {/* Shipping Address */}
          {selectedCustomerId && selectedCustomerId !== "guest" && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>{t("commerce:checkout.shippingAddress")}</CardTitle>
                    <CardDescription>
                      {customerAddresses.length === 0 ? t("commerce:checkout.noAddresses") : t("commerce:checkout.selectAddress")}
                    </CardDescription>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowAddressDialog(true)}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    {t("commerce:checkout.addNew")}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {customerAddresses.length > 0 ? (
                  <>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="useDefault"
                        checked={useDefaultAddress}
                        onCheckedChange={(v) => setUseDefaultAddress(v === true)}
                      />
                      <Label htmlFor="useDefault" className="cursor-pointer">
                        {t("commerce:checkout.useDefault")}
                      </Label>
                    </div>

                    {!useDefaultAddress && (
                      <ChoiceCardGroup
                        value={selectedAddressId}
                        onValueChange={setSelectedAddressId}
                        className="gap-3"
                        aria-label={t("commerce:checkout.shippingAddress")}
                      >
                        {customerAddresses.map((address) => (
                          <ChoiceCard key={address.id} value={address.id} className="font-normal">
                            <div className="flex w-full items-start justify-between gap-2">
                              <div>
                                <p className="font-semibold">{address.fullName}</p>
                                <p className="text-sm text-muted-foreground">{address.phone}</p>
                                <p className="text-sm text-muted-foreground mt-1">
                                  {address.addressLine1}
                                  {address.addressLine2 && `, ${address.addressLine2}`}
                                </p>
                                <p className="text-sm text-muted-foreground">
                                  {address.city}, {address.state} {address.postalCode}
                                </p>
                                <p className="text-sm text-muted-foreground">{address.country}</p>
                              </div>
                              {address.isDefault && (
                                <Badge variant="secondary">
                                  <Check />
                                  {t("commerce:checkout.defaultBadge")}
                                </Badge>
                              )}
                            </div>
                          </ChoiceCard>
                        ))}
                      </ChoiceCardGroup>
                    )}
                  </>
                ) : (
                  <EmptyState icon={MapPin} title={t("commerce:checkout.noAddressTitle")} description={t("commerce:checkout.noAddressDesc")} />
                )}
              </CardContent>
            </Card>
          )}

          {/* Payment Method */}
          <Card>
            <CardHeader>
              <CardTitle>{t("common:payment.method")}</CardTitle>
            </CardHeader>
            <CardContent>
              <ChoiceCardGroup
                value={paymentMethod}
                onValueChange={(value) => setPaymentMethod(value as "Cash" | "Card" | "Online")}
                aria-label={t("common:payment.method")}
              >
                <ChoiceCard value="Cash" title={t("common:payment.cash")} className="p-3" />
                <ChoiceCard value="Card" title={t("common:payment.card")} className="p-3" />
                <ChoiceCard value="Online" title={t("common:extra.online")} className="p-3" />
              </ChoiceCardGroup>
            </CardContent>
          </Card>

          {/* Order Notes */}
          <Card>
            <CardHeader>
              <CardTitle>{t("commerce:checkout.notesTitle")}</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                placeholder={t("commerce:checkout.notesPlaceholder")}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
              />
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Order Summary */}
        <div className="space-y-6">
          {/* Cart Items */}
          <Card>
            <CardHeader>
              <CardTitle>{t("commerce:checkout.summary", { items: t("common:count.items", { count: cart.length }) })}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {cart.map((item) => (
                  <div key={item.productId} className="flex items-start justify-between gap-2 pb-3 border-b">
                    <div className="flex-1">
                      <p className="font-medium text-sm">{item.productName}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatCurrency(item.price)} × {item.quantity}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-sm">{formatCurrency(item.price * item.quantity)}</p>
                      <WithTooltip content={t("commerce:checkout.removeItem", { name: item.productName })}><Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        aria-label={t("commerce:checkout.removeItem", { name: item.productName })}
                        onClick={() => removeFromCart(item.productId)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button></WithTooltip>
                    </div>
                  </div>
                ))}
              </div>

              <Separator />

              {/* Additional Charges */}
              <div className="space-y-3">
                <FormField label={t("commerce:checkout.shippingCost")} htmlFor="shipping">
                  <Input
                    id="shipping"
                    type="number"
                    min="0"
                    step="0.01"
                    value={shippingCost}
                    onChange={(e) => setShippingCost(parseFloat(e.target.value) || 0)}
                    placeholder="0.00"
                  />
                </FormField>

                <FormField label={t("common:money.discount")} htmlFor="discount">
                  <Input
                    id="discount"
                    type="number"
                    min="0"
                    step="0.01"
                    value={discount}
                    onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                    placeholder="0.00"
                  />
                </FormField>
              </div>

              <Separator />

              {/* Total */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>{t("commerce:checkout.lineLabel", { label: t("common:money.subtotal") })}</span>
                  <span>{formatCurrency(subtotal)}</span>
                </div>
                {shippingCost > 0 && (
                  <div className="flex justify-between text-sm">
                    <span>{t("commerce:checkout.lineLabel", { label: t("common:money.shipping") })}</span>
                    <span>{formatCurrency(shippingCost)}</span>
                  </div>
                )}
                {discount > 0 && (
                  <div className="flex justify-between text-sm text-emerald-600">
                    <span>{t("commerce:checkout.lineLabel", { label: t("common:money.discount") })}</span>
                    <span>-{formatCurrency(discount)}</span>
                  </div>
                )}
                <Separator />
                <div className="flex justify-between text-lg font-bold">
                  <span>{t("commerce:checkout.lineLabel", { label: t("common:money.total") })}</span>
                  <span>{formatCurrency(total)}</span>
                </div>
              </div>

              <Button
                className="w-full"
                size="lg"
                onClick={handlePlaceOrder}
                disabled={isProcessing || cart.length === 0}
              >
                {isProcessing ? t("commerce:checkout.processing") : t("commerce:checkout.placeOrder")}
              </Button>

              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  if (confirm(t("commerce:checkout.confirmClear"))) {
                    clearCart()
                    toast.success(t("commerce:checkout.toast.cleared"))
                  }
                }}
              >
                {t("commerce:checkout.clearCart")}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Add Address Dialog */}
      <Dialog open={showAddressDialog} onOpenChange={setShowAddressDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("commerce:checkout.addAddressTitle")}</DialogTitle>
            <DialogDescription>
              {t("commerce:checkout.addAddressDesc")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {t("commerce:checkout.addAddressNote")}
            </p>
            <Button asChild className="w-full">
              <Link href="/dashboard/store/shipping-addresses" target="_blank">
                <MapPin className="h-4 w-4" />
                {t("commerce:checkout.manageAddresses")}
              </Link>
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
