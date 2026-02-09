"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useOrder } from "@/contexts/order-context"
import { useShippingAddress } from "@/contexts/shipping-address-context"
import { useCustomer } from "@/contexts/customer-context"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Separator } from "@/components/ui/separator"
import { toast } from "sonner"
import { ArrowLeft, MapPin, Trash2, Plus, Check } from "lucide-react"
import Link from "next/link"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

export default function CheckoutPage() {
  const router = useRouter()
  const { cart, getCartTotal, removeFromCart, clearCart, createOrder } = useOrder()
  const { addresses, getAddressesByCustomer, getDefaultAddress } = useShippingAddress()
  const { customers } = useCustomer()

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
      const customer = customers.find(c => c.id === custId)
      if (customer) {
        setCustomerName(customer.name)
      }
    } else {
      setCustomerAddresses([])
      setSelectedAddressId("")
    }
  }, [selectedCustomerId, useDefaultAddress, customers, getAddressesByCustomer, getDefaultAddress])

  const subtotal = getCartTotal()
  const total = subtotal + shippingCost - discount

  const handlePlaceOrder = async () => {
    // Validation
    if (cart.length === 0) {
      toast.error("Your cart is empty")
      return
    }

    if (!customerName.trim()) {
      toast.error("Please enter customer name")
      return
    }

    if (total <= 0) {
      toast.error("Order total must be greater than 0")
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
        toast.success("Order placed successfully!", {
          description: `Invoice: ${result.data?.invoiceNo || 'N/A'}`,
        })
        router.push("/dashboard/orders")
      } else {
        toast.error("Failed to place order", {
          description: result.error || "Please try again",
        })
      }
    } catch (error) {
      console.error("Order error:", error)
      toast.error("An error occurred while placing the order")
    } finally {
      setIsProcessing(false)
    }
  }

  if (cart.length === 0) {
    return (
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>Your Cart is Empty</CardTitle>
            <CardDescription>Add some products to your cart to checkout</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/dashboard/products">
              <Button>Browse Products</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/dashboard/orders">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold">Checkout</h1>
          <p className="text-gray-500">Complete your order</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Order Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Customer Information */}
          <Card>
            <CardHeader>
              <CardTitle>Customer Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="customer">Select Customer (Optional)</Label>
                  <Select value={selectedCustomerId} onValueChange={setSelectedCustomerId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Guest checkout" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="guest">Guest Checkout</SelectItem>
                      {customers.map((customer) => (
                        <SelectItem key={customer.id} value={customer.id.toString()}>
                          {customer.name} - {customer.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="customerName">Customer Name *</Label>
                  <Input
                    id="customerName"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Enter customer name"
                    required
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Shipping Address */}
          {selectedCustomerId && selectedCustomerId !== "guest" && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Shipping Address</CardTitle>
                    <CardDescription>
                      {customerAddresses.length === 0 ? "No addresses found" : "Select delivery address"}
                    </CardDescription>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowAddressDialog(true)}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add New
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {customerAddresses.length > 0 ? (
                  <>
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="useDefault"
                        checked={useDefaultAddress}
                        onChange={(e) => setUseDefaultAddress(e.target.checked)}
                        className="h-4 w-4 rounded border-gray-300"
                      />
                      <Label htmlFor="useDefault" className="cursor-pointer">
                        Use my default address (auto-selected)
                      </Label>
                    </div>

                    {!useDefaultAddress && (
                      <RadioGroup
                        value={selectedAddressId}
                        onValueChange={setSelectedAddressId}
                        className="space-y-3"
                      >
                        {customerAddresses.map((address) => (
                          <div
                            key={address.id}
                            className={`flex items-start space-x-3 p-4 rounded-lg border-2 transition-colors ${
                              selectedAddressId === address.id
                                ? "border-emerald-500 bg-emerald-50"
                                : "border-gray-200 hover:border-gray-300"
                            }`}
                          >
                            <RadioGroupItem value={address.id} id={address.id} />
                            <Label htmlFor={address.id} className="flex-1 cursor-pointer">
                              <div className="flex items-start justify-between">
                                <div>
                                  <p className="font-semibold">{address.fullName}</p>
                                  <p className="text-sm text-gray-600">{address.phone}</p>
                                  <p className="text-sm text-gray-600 mt-1">
                                    {address.addressLine1}
                                    {address.addressLine2 && `, ${address.addressLine2}`}
                                  </p>
                                  <p className="text-sm text-gray-600">
                                    {address.city}, {address.state} {address.postalCode}
                                  </p>
                                  <p className="text-sm text-gray-600">{address.country}</p>
                                </div>
                                {address.isDefault && (
                                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
                                    <Check className="h-3 w-3 mr-1" />
                                    Default
                                  </span>
                                )}
                              </div>
                            </Label>
                          </div>
                        ))}
                      </RadioGroup>
                    )}
                  </>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <MapPin className="h-12 w-12 mx-auto mb-2 text-gray-400" />
                    <p>No shipping addresses found</p>
                    <p className="text-sm">Add an address to enable shipping</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Payment Method */}
          <Card>
            <CardHeader>
              <CardTitle>Payment Method</CardTitle>
            </CardHeader>
            <CardContent>
              <RadioGroup value={paymentMethod} onValueChange={(value: any) => setPaymentMethod(value)}>
                <div className="flex items-center space-x-2 p-3 border rounded-lg">
                  <RadioGroupItem value="Cash" id="cash" />
                  <Label htmlFor="cash" className="flex-1 cursor-pointer">Cash</Label>
                </div>
                <div className="flex items-center space-x-2 p-3 border rounded-lg">
                  <RadioGroupItem value="Card" id="card" />
                  <Label htmlFor="card" className="flex-1 cursor-pointer">Card</Label>
                </div>
                <div className="flex items-center space-x-2 p-3 border rounded-lg">
                  <RadioGroupItem value="Online" id="online" />
                  <Label htmlFor="online" className="flex-1 cursor-pointer">Online</Label>
                </div>
              </RadioGroup>
            </CardContent>
          </Card>

          {/* Order Notes */}
          <Card>
            <CardHeader>
              <CardTitle>Order Notes (Optional)</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                placeholder="Add any special instructions..."
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
              <CardTitle>Order Summary ({cart.length} items)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {cart.map((item) => (
                  <div key={item.productId} className="flex items-start justify-between gap-2 pb-3 border-b">
                    <div className="flex-1">
                      <p className="font-medium text-sm">{item.productName}</p>
                      <p className="text-xs text-gray-500">
                        ${item.price.toFixed(2)} × {item.quantity}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-sm">${(item.price * item.quantity).toFixed(2)}</p>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => removeFromCart(item.productId)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              <Separator />

              {/* Additional Charges */}
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="shipping">Shipping Cost</Label>
                  <Input
                    id="shipping"
                    type="number"
                    min="0"
                    step="0.01"
                    value={shippingCost}
                    onChange={(e) => setShippingCost(parseFloat(e.target.value) || 0)}
                    placeholder="0.00"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="discount">Discount</Label>
                  <Input
                    id="discount"
                    type="number"
                    min="0"
                    step="0.01"
                    value={discount}
                    onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                    placeholder="0.00"
                  />
                </div>
              </div>

              <Separator />

              {/* Total */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Subtotal:</span>
                  <span>${subtotal.toFixed(2)}</span>
                </div>
                {shippingCost > 0 && (
                  <div className="flex justify-between text-sm">
                    <span>Shipping:</span>
                    <span>${shippingCost.toFixed(2)}</span>
                  </div>
                )}
                {discount > 0 && (
                  <div className="flex justify-between text-sm text-emerald-600">
                    <span>Discount:</span>
                    <span>-${discount.toFixed(2)}</span>
                  </div>
                )}
                <Separator />
                <div className="flex justify-between text-lg font-bold">
                  <span>Total:</span>
                  <span>${total.toFixed(2)}</span>
                </div>
              </div>

              <Button
                className="w-full"
                size="lg"
                onClick={handlePlaceOrder}
                disabled={isProcessing || cart.length === 0}
              >
                {isProcessing ? "Processing..." : "Place Order"}
              </Button>

              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  if (confirm("Are you sure you want to clear the cart?")) {
                    clearCart()
                    toast.success("Cart cleared")
                  }
                }}
              >
                Clear Cart
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Add Address Dialog */}
      <Dialog open={showAddressDialog} onOpenChange={setShowAddressDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Shipping Address</DialogTitle>
            <DialogDescription>
              Go to Shipping Addresses page to add a new address
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              You can manage customer shipping addresses from the Store menu.
            </p>
            <Link href="/dashboard/store/shipping-addresses" target="_blank">
              <Button className="w-full">
                <MapPin className="h-4 w-4 mr-2" />
                Manage Shipping Addresses
              </Button>
            </Link>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
