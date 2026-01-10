"use client"

import { useState } from "react"
import { useStaff, type SalaryPayment } from "@/contexts/staff-context"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { DollarSign, CreditCard, Clock, CheckCircle2 } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import Link from "next/link"

export default function SalaryManagementPage() {
    const { staff, salaryPayments, addSalaryPayment, updateSalaryPayment } = useStaff()
    const [selectedMonth, setSelectedMonth] = useState(() => {
        const now = new Date()
        return `${now.toLocaleString('en-US', { month: 'short' })} ${now.getFullYear()}`
    })
    const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false)
    const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null)
    const [paymentAmount, setPaymentAmount] = useState("")
    const [paymentNotes, setPaymentNotes] = useState("")

    // Generate month options (last 12 months)
    const monthOptions = Array.from({ length: 12 }, (_, i) => {
        const date = new Date()
        date.setMonth(date.getMonth() - i)
        return `${date.toLocaleString('en-US', { month: 'short' })} ${date.getFullYear()}`
    })

    // Get payments for selected month
    const monthPayments = salaryPayments.filter(p => p.month === selectedMonth)

    // Calculate totals
    const totalBudget = staff.reduce((sum, s) => sum + s.salary, 0)
    const totalPaid = monthPayments
        .filter(p => p.status === "Paid")
        .reduce((sum, p) => sum + p.paidAmount, 0)
    const totalPending = staff
        .filter(s => !monthPayments.find(p => p.staffId === s.id && p.status === "Paid"))
        .reduce((sum, s) => sum + s.salary, 0)

    const handleMarkAsPaid = (staffId: string, staffSalary: number) => {
        setSelectedStaffId(staffId)
        setPaymentAmount(staffSalary.toString())
        setIsPaymentDialogOpen(true)
    }

    const handleSubmitPayment = () => {
        if (!selectedStaffId) return

        const staffMember = staff.find(s => s.id === selectedStaffId)
        if (!staffMember) return

        const existingPayment = monthPayments.find(p => p.staffId === selectedStaffId)
        const amount = parseFloat(paymentAmount) || 0

        if (existingPayment) {
            updateSalaryPayment({
                ...existingPayment,
                paidAmount: amount,
                status: amount >= staffMember.salary ? "Paid" : "Partial",
                paymentDate: new Date().toISOString(),
                paymentMethod: staffMember.paymentMethod,
                notes: paymentNotes,
            })
        } else {
            addSalaryPayment({
                id: Date.now().toString(),
                staffId: selectedStaffId,
                month: selectedMonth,
                amount: staffMember.salary,
                paidAmount: amount,
                status: amount >= staffMember.salary ? "Paid" : "Partial",
                paymentDate: new Date().toISOString(),
                paymentMethod: staffMember.paymentMethod,
                notes: paymentNotes,
            })
        }

        setIsPaymentDialogOpen(false)
        setSelectedStaffId(null)
        setPaymentAmount("")
        setPaymentNotes("")
    }

    const getPaymentStatus = (staffId: string) => {
        const payment = monthPayments.find(p => p.staffId === staffId)
        return payment?.status || "Pending"
    }

    const getStatusColor = (status: string) => {
        switch (status) {
            case "Paid":
                return "bg-emerald-100 text-emerald-700"
            case "Partial":
                return "bg-orange-100 text-orange-700"
            default:
                return "bg-gray-100 text-gray-700"
        }
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-gray-900">Salary Management</h1>
                <p className="text-gray-600 mt-1">Process and track staff salary payments</p>
            </div>

            {/* Month Selector */}
            <Card className="p-4">
                <div className="flex items-center gap-4">
                    <Label className="font-semibold">Select Month:</Label>
                    <select
                        value={selectedMonth}
                        onChange={(e) => setSelectedMonth(e.target.value)}
                        className="px-4 py-2 border rounded-lg bg-white"
                    >
                        {monthOptions.map((month) => (
                            <option key={month} value={month}>
                                {month}
                            </option>
                        ))}
                    </select>
                </div>
            </Card>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="p-6">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-blue-100 rounded-lg">
                            <DollarSign className="w-6 h-6 text-blue-600" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-600">Total Monthly Budget</p>
                            <p className="text-2xl font-bold text-gray-900">${totalBudget.toLocaleString()}</p>
                        </div>
                    </div>
                </Card>

                <Card className="p-6">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-emerald-100 rounded-lg">
                            <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-600">Total Paid</p>
                            <p className="text-2xl font-bold text-emerald-600">${totalPaid.toLocaleString()}</p>
                        </div>
                    </div>
                </Card>

                <Card className="p-6">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-orange-100 rounded-lg">
                            <Clock className="w-6 h-6 text-orange-600" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-600">Total Pending</p>
                            <p className="text-2xl font-bold text-orange-600">${totalPending.toLocaleString()}</p>
                        </div>
                    </div>
                </Card>
            </div>

            {/* Staff Salary List */}
            <Card className="p-6">
                <h2 className="text-lg font-semibold mb-4">Staff Salaries for {selectedMonth}</h2>
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50 border-b">
                            <tr>
                                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-700 uppercase tracking-wider">
                                    Staff Name
                                </th>
                                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-700 uppercase tracking-wider">
                                    Role
                                </th>
                                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-700 uppercase tracking-wider">
                                    Monthly Salary
                                </th>
                                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-700 uppercase tracking-wider">
                                    Payment Method
                                </th>
                                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-700 uppercase tracking-wider">
                                    Status
                                </th>
                                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-700 uppercase tracking-wider">
                                    Actions
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {staff.map((member) => {
                                const status = getPaymentStatus(member.id)
                                return (
                                    <tr key={member.id} className="hover:bg-gray-50">
                                        <td className="py-3 px-4">
                                            <Link
                                                href={`/dashboard/staff/salary/${member.id}`}
                                                className="font-medium text-gray-900 hover:text-emerald-600"
                                            >
                                                {member.name}
                                            </Link>
                                        </td>
                                        <td className="py-3 px-4 text-sm text-gray-600">{member.role}</td>
                                        <td className="py-3 px-4 text-sm font-semibold text-gray-900">
                                            ${member.salary.toLocaleString()}
                                        </td>
                                        <td className="py-3 px-4 text-sm text-gray-600">{member.paymentMethod}</td>
                                        <td className="py-3 px-4">
                                            <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(status)}`}>
                                                {status}
                                            </span>
                                        </td>
                                        <td className="py-3 px-4">
                                            {status !== "Paid" && (
                                                <Button
                                                    size="sm"
                                                    onClick={() => handleMarkAsPaid(member.id, member.salary)}
                                                    className="bg-emerald-600 hover:bg-emerald-700"
                                                >
                                                    <CreditCard className="w-4 h-4 mr-2" />
                                                    Mark as Paid
                                                </Button>
                                            )}
                                            {status === "Paid" && (
                                                <span className="text-sm text-emerald-600 font-medium">✓ Paid</span>
                                            )}
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            </Card>

            {/* Payment Dialog */}
            <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Record Salary Payment</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div>
                            <Label>Payment Amount</Label>
                            <Input
                                type="number"
                                step="0.01"
                                value={paymentAmount}
                                onChange={(e) => setPaymentAmount(e.target.value)}
                                placeholder="0.00"
                                className="mt-1"
                            />
                        </div>
                        <div>
                            <Label>Notes (Optional)</Label>
                            <Textarea
                                value={paymentNotes}
                                onChange={(e) => setPaymentNotes(e.target.value)}
                                placeholder="Add any notes about this payment..."
                                className="mt-1"
                                rows={3}
                            />
                        </div>
                        <div className="flex justify-end gap-2 pt-4 border-t">
                            <Button variant="outline" onClick={() => setIsPaymentDialogOpen(false)}>
                                Cancel
                            </Button>
                            <Button onClick={handleSubmitPayment} className="bg-emerald-600 hover:bg-emerald-700">
                                Record Payment
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    )
}
