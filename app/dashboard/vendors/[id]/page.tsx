"use client"

import type React from "react"
import { useParams, useRouter } from "next/navigation"
import { useVendor } from "@/contexts/vendor-context"
import { useProduct } from "@/contexts/product-context"
import { ArrowLeft, Package, DollarSign, CreditCard, Wallet } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import Image from "next/image"
import { useState } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export default function VendorDetailsPage() {
    const params = useParams()
    const router = useRouter()
    const vendorId = params.id as string
    const { getVendorById, updateVendor } = useVendor()
    const { getProductsByVendor } = useProduct()

    const vendor = getVendorById(vendorId)
    const vendorProducts = getProductsByVendor(vendorId)

    const [isEditingPaid, setIsEditingPaid] = useState(false)
    const [paidAmount, setPaidAmount] = useState(vendor?.totalPaid || 0)

    if (!vendor) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px]">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">Vendor Not Found</h2>
                <Button onClick={() => router.push("/dashboard/vendors")}>Back to Vendors</Button>
            </div>
        )
    }

    // Calculate financial stats
    const totalProducts = vendorProducts.length
    const inventoryValue = vendorProducts.reduce((sum, product) => sum + product.salePrice * product.stock, 0)
    const totalPaid = vendor.totalPaid
    const balance = inventoryValue - totalPaid

    const handleUpdatePaid = () => {
        updateVendor({
            ...vendor,
            totalPaid: paidAmount,
        })
        setIsEditingPaid(false)
    }

    const getStatusColor = (status: string) => {
        switch (status) {
            case "Active":
                return "bg-emerald-100 text-emerald-700"
            case "Inactive":
                return "bg-gray-100 text-gray-700"
            case "Blocked":
                return "bg-red-100 text-red-700"
            default:
                return "bg-gray-100 text-gray-700"
        }
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Button variant="outline" size="sm" onClick={() => router.push("/dashboard/vendors")}>
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back
                </Button>
                <h1 className="text-2xl font-bold text-gray-900">Vendor Details</h1>
            </div>

            {/* Vendor Profile Card */}
            <Card className="p-6">
                <div className="flex items-start gap-6">
                    <Image
                        src={vendor.logo || "/placeholder.svg"}
                        alt={vendor.name}
                        width={80}
                        height={80}
                        className="rounded-full"
                    />
                    <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                            <h2 className="text-2xl font-bold text-gray-900">{vendor.name}</h2>
                            <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(vendor.status)}`}>
                                {vendor.status}
                            </span>
                        </div>
                        <div className="space-y-1 text-sm text-gray-600">
                            <p>
                                <span className="font-medium">Email:</span> {vendor.email}
                            </p>
                            <p>
                                <span className="font-medium">Phone:</span> {vendor.phone}
                            </p>
                            <p>
                                <span className="font-medium">Address:</span> {vendor.address}
                            </p>
                            {vendor.description && (
                                <p className="mt-2">
                                    <span className="font-medium">Description:</span> {vendor.description}
                                </p>
                            )}
                        </div>
                    </div>
                </div>
            </Card>

            {/* Financial Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="p-6">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-blue-100 rounded-lg">
                            <Package className="w-6 h-6 text-blue-600" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-600">Total Products</p>
                            <p className="text-2xl font-bold text-gray-900">{totalProducts}</p>
                        </div>
                    </div>
                </Card>

                <Card className="p-6">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-purple-100 rounded-lg">
                            <DollarSign className="w-6 h-6 text-purple-600" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-600">Inventory Value</p>
                            <p className="text-2xl font-bold text-gray-900">${inventoryValue.toFixed(2)}</p>
                        </div>
                    </div>
                </Card>

                <Card className="p-6">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-emerald-100 rounded-lg">
                            <CreditCard className="w-6 h-6 text-emerald-600" />
                        </div>
                        <div className="flex-1">
                            <p className="text-sm text-gray-600">Total Paid</p>
                            {isEditingPaid ? (
                                <div className="flex items-center gap-2 mt-1">
                                    <Input
                                        type="number"
                                        value={paidAmount}
                                        onChange={(e) => setPaidAmount(parseFloat(e.target.value) || 0)}
                                        className="h-8 text-sm"
                                        step="0.01"
                                    />
                                    <Button size="sm" onClick={handleUpdatePaid} className="h-8">
                                        Save
                                    </Button>
                                    <Button size="sm" variant="outline" onClick={() => setIsEditingPaid(false)} className="h-8">
                                        Cancel
                                    </Button>
                                </div>
                            ) : (
                                <div className="flex items-center gap-2">
                                    <p className="text-2xl font-bold text-gray-900">${totalPaid.toFixed(2)}</p>
                                    <Button size="sm" variant="ghost" onClick={() => setIsEditingPaid(true)} className="h-6 text-xs">
                                        Edit
                                    </Button>
                                </div>
                            )}
                        </div>
                    </div>
                </Card>

                <Card className="p-6">
                    <div className="flex items-center gap-4">
                        <div className={`p-3 rounded-lg ${balance >= 0 ? "bg-orange-100" : "bg-red-100"}`}>
                            <Wallet className={`w-6 h-6 ${balance >= 0 ? "text-orange-600" : "text-red-600"}`} />
                        </div>
                        <div>
                            <p className="text-sm text-gray-600">Balance Due</p>
                            <p className={`text-2xl font-bold ${balance >= 0 ? "text-orange-600" : "text-red-600"}`}>
                                ${balance.toFixed(2)}
                            </p>
                        </div>
                    </div>
                </Card>
            </div>

            {/* Products Table */}
            <Card className="p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4">Products from this Vendor</h3>
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50 border-b">
                            <tr>
                                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-700 uppercase tracking-wider">
                                    Product
                                </th>
                                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-700 uppercase tracking-wider">
                                    Category
                                </th>
                                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-700 uppercase tracking-wider">
                                    Price
                                </th>
                                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-700 uppercase tracking-wider">
                                    Stock
                                </th>
                                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-700 uppercase tracking-wider">
                                    Total Value
                                </th>
                                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-700 uppercase tracking-wider">
                                    Status
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {vendorProducts.map((product) => (
                                <tr key={product.id} className="hover:bg-gray-50">
                                    <td className="py-3 px-4">
                                        <div className="flex items-center gap-3">
                                            <Image
                                                src={product.image || "/placeholder.svg"}
                                                alt={product.name}
                                                width={40}
                                                height={40}
                                                className="rounded object-cover"
                                            />
                                            <span className="font-medium text-gray-900">{product.name}</span>
                                        </div>
                                    </td>
                                    <td className="py-3 px-4 text-sm text-gray-600">{product.category}</td>
                                    <td className="py-3 px-4 text-sm font-semibold text-gray-900">${product.salePrice.toFixed(2)}</td>
                                    <td className="py-3 px-4 text-sm text-gray-600">{product.stock}</td>
                                    <td className="py-3 px-4 text-sm font-semibold text-gray-900">
                                        ${(product.salePrice * product.stock).toFixed(2)}
                                    </td>
                                    <td className="py-3 px-4">
                                        <span
                                            className={`px-3 py-1 rounded-full text-xs font-medium ${product.status === "Selling"
                                                    ? "bg-emerald-100 text-emerald-700"
                                                    : product.status === "Out of Stock"
                                                        ? "bg-red-100 text-red-700"
                                                        : "bg-gray-100 text-gray-700"
                                                }`}
                                        >
                                            {product.status}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                            {vendorProducts.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="py-8 text-center text-gray-500">
                                        No products found for this vendor
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>
        </div>
    )
}
