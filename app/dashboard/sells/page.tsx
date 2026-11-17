"use client"

import { useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { useTranslation } from "react-i18next"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Printer, Eye, Download, Mail, ShoppingBag } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { usePagination } from "@/hooks/use-pagination"
import { PaginationControl } from "@/components/ui/pagination-control"
import { StatusBadge } from "@/components/common/StatusBadge"
import { PageHeader } from "@/components/common/PageHeader"
import { FormField } from "@/components/common/FormField"
import { EmptyState } from "@/components/common/EmptyState"
import { SectionTitle } from "@/components/common/SectionTitle"
import { UserAvatar } from "@/components/common/UserAvatar"
import { WithTooltip } from "@/components/common/WithTooltip"
import { useCompanySettings } from "@/contexts/company-settings-context"
import { useSaasAuth } from "@/contexts/saas-auth-context"
import { AccessDenied } from "@/components/ui/access-denied"
import { useModuleGuard } from "@/hooks/use-module-guard"
import { ORDERS_NS, methodLabel, orderStatusLabel } from "@/components/sales/i18n"

/** Status / method filter values of the demo data; labels translated at render. */
const SELL_STATUSES: Sell["status"][] = ["Delivered", "Processing", "Pending"]
const SELL_METHODS = ["Cash", "Card", "Online"]

interface Sell {
    invoiceNo: string
    orderTime: string
    customerName: string
    method: string
    amount: number
    status: "Delivered" | "Processing" | "Pending"
}

const initialSells: Sell[] = [
    {
        invoiceNo: "12301",
        orderTime: "31 Dec, 2025 5:01 PM",
        customerName: "sdfg Ram",
        method: "Cash",
        amount: 159.91,
        status: "Delivered",
    },
    {
        invoiceNo: "12309",
        orderTime: "31 Dec, 2025 4:52 AM",
        customerName: "Mydeen Bhatsha",
        method: "Cash",
        amount: 371.1,
        status: "Processing",
    },
    {
        invoiceNo: "12332",
        orderTime: "30 Dec, 2025 3:55 PM",
        customerName: "Justin Luis",
        method: "Cash",
        amount: 110.0,
        status: "Delivered",
    },
    {
        invoiceNo: "12342",
        orderTime: "30 Dec, 2025 3:55 PM",
        customerName: "Justin Luis",
        method: "Cash",
        amount: 677.91,
        status: "Delivered",
    },
    {
        invoiceNo: "12336",
        orderTime: "29 Dec, 2025 2:31 PM",
        customerName: "Justinn Luish",
        method: "Cash",
        amount: 265.01,
        status: "Delivered",
    },
    {
        invoiceNo: "12338",
        orderTime: "28 Dec, 2025 4:38 PM",
        customerName: "TEJPAL SONI",
        method: "Cash",
        amount: 166.49,
        status: "Delivered",
    },
    {
        invoiceNo: "12341",
        orderTime: "26 Dec, 2025 9:17 AM",
        customerName: "Justin Luis",
        method: "Cash",
        amount: 2810.13,
        status: "Pending",
    },
    {
        invoiceNo: "12340",
        orderTime: "26 Dec, 2025 8:29 AM",
        customerName: "Nevil Nevil",
        method: "Cash",
        amount: 253.26,
        status: "Pending",
    },
    {
        invoiceNo: "12339",
        orderTime: "26 Dec, 2025 7:57 AM",
        customerName: "Nevil Nevil",
        method: "Cash",
        amount: 121.56,
        status: "Pending",
    },
    {
        invoiceNo: "12321",
        orderTime: "26 Dec, 2025 2:49 AM",
        customerName: "Kazi Hasan",
        method: "Cash",
        amount: 68.12,
        status: "Pending",
    },
    {
        invoiceNo: "12337",
        orderTime: "26 Dec, 2025 2:49 AM",
        customerName: "Nevil Nevil",
        method: "Cash",
        amount: 660.0,
        status: "Pending",
    },
    {
        invoiceNo: "12335",
        orderTime: "23 Dec, 2025 4:28 PM",
        customerName: "Vikas WHITE",
        method: "Cash",
        amount: 825.74,
        status: "Pending",
    },
    {
        invoiceNo: "11140",
        orderTime: "23 Dec, 2025 12:55 PM",
        customerName: "fhg jk scsd",
        method: "Cash",
        amount: 108.12,
        status: "Processing",
    },
]

export default function SellsPage() {
    const { t } = useTranslation(ORDERS_NS)
    const { canRead } = useSaasAuth()
    const searchParams = useSearchParams()
    const { formatCurrency } = useCompanySettings()
    const [sells, setSells] = useState<Sell[]>(initialSells)
    const [searchQuery, setSearchQuery] = useState("")
    const [statusFilter, setStatusFilter] = useState<string>("all")
    const [limitFilter, setLimitFilter] = useState<string>("all")
    const [methodFilter, setMethodFilter] = useState<string>("all")
    const [startDate, setStartDate] = useState("")
    const [endDate, setEndDate] = useState("")

    const [selectedSell, setSelectedSell] = useState<Sell | null>(null)
    const [isDetailsOpen, setIsDetailsOpen] = useState(false)
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        const customerParam = searchParams.get("customer")
        if (customerParam) {
            setSearchQuery(customerParam)
        }
        
        const timer = setTimeout(() => {
            setIsLoading(false)
        }, 2000)
        return () => clearTimeout(timer)
    }, [searchParams])

    const filteredSells = sells.filter((sell) => {
        const matchesSearch = sell.customerName.toLowerCase().includes(searchQuery.toLowerCase())
        const matchesStatus = statusFilter === "all" || sell.status === statusFilter
        const matchesMethod = methodFilter === "all" || sell.method === methodFilter

        let matchesDateRange = true
        if (startDate && endDate) {
            const sellDate = new Date(sell.orderTime)
            const start = new Date(startDate)
            const end = new Date(endDate)
            matchesDateRange = sellDate >= start && sellDate <= end
        }

        return matchesSearch && matchesStatus && matchesMethod && matchesDateRange
    })

    const {
        currentItems: currentSells,
        currentPage,
        totalPages,
        itemsPerPage,
        goToPage,
        setCurrentPage,
        handleItemsPerPageChange,
    } = usePagination(filteredSells, 10)

    const blocked = useModuleGuard('Sells')
  if (blocked) return blocked

    const handleFilterChange = () => {
        setCurrentPage(1)
    }

    const handleStatusChange = (invoiceNo: string, newStatus: Sell["status"]) => {
        setSells(sells.map((sell) => (sell.invoiceNo === invoiceNo ? { ...sell, status: newStatus } : sell)))
    }

    const handleDownloadAllSells = () => {
        const csvContent = [
            [t("orders:sells.invoiceNo"), t("orders:sells.sellTime"), t("orders:sells.customerName"), t("orders:sells.method"), t("common:money.amount"), t("common:fields.status")],
            ...filteredSells.map((sell) => [
                sell.invoiceNo,
                sell.orderTime,
                sell.customerName,
                methodLabel(t, sell.method),
                sell.amount.toString(),
                orderStatusLabel(t, sell.status),
            ]),
        ]
            .map((row) => row.join(","))
            .join("\n")

        const blob = new Blob([csvContent], { type: "text/csv" })
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = "sells.csv"
        a.click()
        window.URL.revokeObjectURL(url)
    }

    const handlePrintInvoice = (sell: Sell) => {
        const printWindow = window.open("", "_blank")
        if (printWindow) {
            printWindow.document.write(`
        <html>
          <head>
            <title>${t("orders:invoice.docTitle", { invoice: sell.invoiceNo })}</title>
            <style>
              * { margin: 0; padding: 0; box-sizing: border-box; }
              body { 
                font-family: Arial, sans-serif; 
                padding: 40px; 
                color: #374151;
                line-height: 1.6;
              }
              .invoice-container {
                max-width: 900px;
                margin: 0 auto;
                background: white;
              }
              .header {
                display: flex;
                justify-content: space-between;
                align-items: start;
                margin-bottom: 40px;
              }
              .company-info {
                text-align: right;
              }
              .logo {
                display: flex;
                align-items: center;
                gap: 8px;
                font-size: 24px;
                font-weight: bold;
                color: #10b981;
              }
              .logo-icon {
                width: 32px;
                height: 32px;
                background: #10b981;
                border-radius: 8px;
                display: flex;
                align-items: center;
                justify-content: center;
                color: white;
              }
              .company-info p {
                font-size: 14px;
                color: #6b7280;
                margin-top: 4px;
              }
              .invoice-title {
                font-size: 32px;
                font-weight: bold;
                margin-bottom: 12px;
              }
              .status-badge {
                display: inline-block;
                padding: 6px 16px;
                background: #10b981;
                color: white;
                border-radius: 4px;
                font-size: 14px;
                font-weight: 600;
                text-transform: capitalize;
              }
              .invoice-meta {
                display: grid;
                grid-template-columns: repeat(3, 1fr);
                gap: 40px;
                margin: 40px 0;
              }
              .meta-item h3 {
                font-size: 12px;
                color: #6b7280;
                text-transform: uppercase;
                margin-bottom: 8px;
                font-weight: 600;
              }
              .meta-item p {
                font-size: 14px;
                color: #374151;
              }
              .invoice-to {
                text-align: right;
              }
              table {
                width: 100%;
                border-collapse: collapse;
                margin: 40px 0;
              }
              thead {
                background: #f9fafb;
              }
              th {
                padding: 16px;
                text-align: left;
                font-size: 12px;
                font-weight: 600;
                text-transform: uppercase;
                color: #374151;
                border-bottom: 2px solid #e5e7eb;
              }
              th:last-child {
                text-align: right;
              }
              td {
                padding: 20px 16px;
                border-bottom: 1px solid #f3f4f6;
                font-size: 14px;
              }
              td:last-child {
                text-align: right;
                font-weight: 600;
              }
              .amount-red {
                color: #ef4444;
              }
              .summary {
                background: #f9fafb;
                padding: 32px;
                display: grid;
                grid-template-columns: repeat(4, 1fr);
                gap: 32px;
                margin: 40px 0;
              }
              .summary-item h3 {
                font-size: 12px;
                color: #6b7280;
                text-transform: uppercase;
                margin-bottom: 8px;
                font-weight: 600;
              }
              .summary-item p {
                font-size: 16px;
                color: #374151;
                font-weight: 600;
              }
              .total-amount {
                font-size: 24px !important;
                color: #ef4444 !important;
                font-weight: bold !important;
              }
              @media print {
                body { padding: 20px; }
                .no-print { display: none; }
              }
            </style>
          </head>
          <body>
            <div class="invoice-container">
              <div class="header">
                <div>
                  <h1 class="invoice-title">${t("orders:invoice.heading")}</h1>
                  <div>
                    <span style="font-weight: 600; margin-right: 8px;">${t("orders:invoice.status")}</span>
                    <span class="status-badge">${orderStatusLabel(t, sell.status)}</span>
                  </div>
                </div>
                <div class="company-info">
                  <div class="logo">
                    <div class="logo-icon">🛒</div>
                    <span>Admin</span>
                  </div>
                  <p>59 Station Rd, Purls Bridge, United Kingdom</p>
                  <p>019579034</p>
                  <p>kachabazar@gmail.com</p>
                  <p>kachabazar-admin.vercel.app</p>
                </div>
              </div>

              <div class="invoice-meta">
                <div class="meta-item">
                  <h3>${t("orders:invoice.date")}</h3>
                  <p>${sell.orderTime.split(" ")[0]} ${sell.orderTime.split(" ")[1]} ${sell.orderTime.split(" ")[2]}</p>
                </div>
                <div class="meta-item">
                  <h3>${t("orders:invoice.invoiceNo")}</h3>
                  <p>#${sell.invoiceNo}</p>
                </div>
                <div class="meta-item invoice-to">
                  <h3>${t("orders:invoice.invoiceTo")}</h3>
                  <p style="font-weight: 600;">${sell.customerName}</p>
                  <p style="font-size: 13px; color: #6b7280;">hram8251@gmail.com</p>
                  <p style="font-size: 13px; color: #6b7280;">123456789</p>
                  <p style="font-size: 13px; color: #6b7280;">state, cuntyre, 1235</p>
                </div>
              </div>

              <table>
                <thead>
                  <tr>
                    <th style="width: 80px;">${t("orders:invoice.sr")}</th>
                    <th>${t("orders:invoice.productTitle")}</th>
                    <th style="text-align: center; width: 120px;">${t("orders:invoice.quantity")}</th>
                    <th style="text-align: right; width: 120px;">${t("orders:invoice.itemPrice")}</th>
                    <th style="width: 120px;">${t("orders:invoice.amount")}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>1</td>
                    <td>Fresh Mustard Oil</td>
                    <td style="text-align: center;">1</td>
                    <td style="text-align: right;">${formatCurrency(sell.amount - 60)}</td>
                    <td class="amount-red">${formatCurrency(sell.amount - 60)}</td>
                  </tr>
                </tbody>
              </table>

              <div class="summary">
                <div class="summary-item">
                  <h3>${t("orders:invoice.paymentMethod")}</h3>
                  <p>${methodLabel(t, sell.method)}</p>
                </div>
                <div class="summary-item">
                  <h3>${t("orders:invoice.shippingCost")}</h3>
                  <p style="color: #6b7280;">${formatCurrency(60)}</p>
                </div>
                <div class="summary-item">
                  <h3>${t("orders:invoice.discount")}</h3>
                  <p style="color: #6b7280;">${formatCurrency(0)}</p>
                </div>
                <div class="summary-item">
                  <h3>${t("orders:invoice.totalAmount")}</h3>
                  <p class="total-amount">${formatCurrency(sell.amount)}</p>
                </div>
              </div>
            </div>
          </body>
        </html>
      `)
            printWindow.document.close()
            printWindow.print()
        }
    }

    const handleDownloadInvoice = (sell: Sell) => {
        handlePrintInvoice(sell)
    }

    const handleEmailInvoice = (sell: Sell) => {
        alert(t("orders:sells.emailTodo", { invoice: sell.invoiceNo }))
    }

    const handleReset = () => {
        setSearchQuery("")
        setStatusFilter("all")
        setLimitFilter("all")
        setMethodFilter("all")
        setStartDate("")
        setEndDate("")
        handleFilterChange()
    }

    const handleViewDetails = (sell: Sell) => {
        setSelectedSell(sell)
        setIsDetailsOpen(true)
    }

    return (
        <div className="space-y-6">
            <PageHeader title={t("orders:sells.title")} />

            <Card className="p-6">
                <div className="space-y-4 mb-6">
                    <div className="flex flex-col lg:flex-row gap-4">
                        <div className="relative flex-1">
                            <Input
                                type="text"
                                placeholder={t("orders:sells.searchPlaceholder")}
                                value={searchQuery}
                                onChange={(e) => {
                                    setSearchQuery(e.target.value)
                                    handleFilterChange()
                                }}
                            />
                        </div>

                        <Select
                            value={statusFilter}
                            onValueChange={(value) => {
                                setStatusFilter(value)
                                handleFilterChange()
                            }}
                        >
                            <SelectTrigger className="w-full lg:w-48">
                                <SelectValue placeholder={t("common:fields.status")} />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">{t("orders:sells.allStatus")}</SelectItem>
                                {SELL_STATUSES.map((st) => <SelectItem key={st} value={st}>{orderStatusLabel(t, st)}</SelectItem>)}
                            </SelectContent>
                        </Select>

                        <Select value={limitFilter} onValueChange={setLimitFilter}>
                            <SelectTrigger className="w-full lg:w-48">
                                <SelectValue placeholder={t("orders:sells.orderLimits")} />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">{t("orders:sells.allLimits")}</SelectItem>
                                {[5, 10, 20].map((n) => <SelectItem key={n} value={String(n)}>{t("orders:sells.lastN", { count: n })}</SelectItem>)}
                            </SelectContent>
                        </Select>

                        <Select
                            value={methodFilter}
                            onValueChange={(value) => {
                                setMethodFilter(value)
                                handleFilterChange()
                            }}
                        >
                            <SelectTrigger className="w-full lg:w-48">
                                <SelectValue placeholder={t("orders:sells.method")} />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">{t("orders:sells.allMethods")}</SelectItem>
                                {SELL_METHODS.map((m) => <SelectItem key={m} value={m}>{methodLabel(t, m)}</SelectItem>)}
                            </SelectContent>
                        </Select>

                        <Button onClick={handleDownloadAllSells} className="whitespace-nowrap">
                            <Download className="size-4" />
                            {t("orders:sells.downloadAll")}
                        </Button>
                    </div>

                    <div className="flex flex-col lg:flex-row gap-4">
                        <FormField label={t("orders:sells.startDate")} htmlFor="sells-start-date" className="flex-1">
                            <Input
                                id="sells-start-date"
                                type="date"
                                value={startDate}
                                onChange={(e) => {
                                    setStartDate(e.target.value)
                                    handleFilterChange()
                                }}
                            />
                        </FormField>

                        <FormField label={t("orders:sells.endDate")} htmlFor="sells-end-date" className="flex-1">
                            <Input
                                id="sells-end-date"
                                type="date"
                                value={endDate}
                                onChange={(e) => {
                                    setEndDate(e.target.value)
                                    handleFilterChange()
                                }}
                            />
                        </FormField>

                        <div className="flex items-end gap-2">
                            <Button onClick={() => { }}>
                                {t("common:actions.filter")}
                            </Button>
                            <Button onClick={handleReset} variant="outline">
                                {t("common:actions.reset")}
                            </Button>
                        </div>
                    </div>
                </div>

                <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>{t("orders:sells.invoiceNo")}</TableHead>
                                <TableHead>{t("orders:sells.sellTime")}</TableHead>
                                <TableHead>{t("orders:sells.customerName")}</TableHead>
                                <TableHead>{t("orders:sells.method")}</TableHead>
                                <TableHead>{t("common:money.amount")}</TableHead>
                                <TableHead>{t("common:fields.status")}</TableHead>
                                <TableHead>{t("orders:sells.action")}</TableHead>
                                <TableHead>{t("orders:sells.invoice")}</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading
                                ? Array.from({ length: 3 }).map((_, index) => (
                                    <TableRow key={index}>
                                        <TableCell>
                                            <Skeleton className="h-4 w-12" />
                                        </TableCell>
                                        <TableCell>
                                            <Skeleton className="h-4 w-32" />
                                        </TableCell>
                                        <TableCell>
                                            <Skeleton className="h-4 w-24" />
                                        </TableCell>
                                        <TableCell>
                                            <Skeleton className="h-4 w-16" />
                                        </TableCell>
                                        <TableCell>
                                            <Skeleton className="h-4 w-16" />
                                        </TableCell>
                                        <TableCell>
                                            <Skeleton className="h-6 w-16" />
                                        </TableCell>
                                        <TableCell>
                                            <Skeleton className="h-8 w-32" />
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <Skeleton className="size-8" />
                                                <Skeleton className="size-8" />
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                                : currentSells.map((sell) => (
                                    <TableRow key={sell.invoiceNo}>
                                        <TableCell>
                                            <span className="font-semibold">{sell.invoiceNo}</span>
                                        </TableCell>
                                        <TableCell>{sell.orderTime}</TableCell>
                                        <TableCell>{sell.customerName}</TableCell>
                                        <TableCell>{methodLabel(t, sell.method)}</TableCell>
                                        <TableCell>{formatCurrency(sell.amount)}</TableCell>
                                        <TableCell>
                                            <StatusBadge status={sell.status} label={orderStatusLabel(t, sell.status)} />
                                        </TableCell>
                                        <TableCell>
                                            <Select
                                                value={sell.status}
                                                onValueChange={(value) => handleStatusChange(sell.invoiceNo, value as Sell["status"])}
                                            >
                                                <SelectTrigger className="w-32 h-8 text-xs">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {SELL_STATUSES.map((st) => <SelectItem key={st} value={st}>{orderStatusLabel(t, st)}</SelectItem>)}
                                                </SelectContent>
                                            </Select>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <WithTooltip content={t("orders:sells.printInvoice")}>
                                                    <Button variant="ghost" size="icon" aria-label={t("orders:sells.printInvoiceFor", { invoice: sell.invoiceNo })} onClick={() => handlePrintInvoice(sell)}>
                                                        <Printer className="size-4" />
                                                    </Button>
                                                </WithTooltip>
                                                <WithTooltip content={t("orders:sells.viewDetails")}>
                                                    <Button variant="ghost" size="icon" aria-label={t("orders:sells.viewFor", { invoice: sell.invoiceNo })} onClick={() => handleViewDetails(sell)}>
                                                        <Eye className="size-4" />
                                                    </Button>
                                                </WithTooltip>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                        </TableBody>
                    </Table>

                {filteredSells.length === 0 && (
                    <EmptyState title={t("orders:sells.empty")} className="p-4 md:p-6" />
                )}
            </Card>

            <PaginationControl
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
                itemsPerPage={itemsPerPage}
                onItemsPerPageChange={handleItemsPerPageChange}
                totalItems={filteredSells.length}
            />

            <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
                <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{t("orders:sells.invoice")}</DialogTitle>
                    </DialogHeader>

                    {selectedSell && (
                        <div className="space-y-8 py-4">
                            {/* Header Section */}
                            <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                                <div>
                                    <h1 className="text-4xl font-bold mb-3">{t("orders:invoice.heading")}</h1>
                                    <div className="flex items-center gap-3">
                                        <span className="font-semibold text-muted-foreground">{t("orders:invoice.status")}</span>
                                        <StatusBadge status={selectedSell.status} label={orderStatusLabel(t, selectedSell.status)} />
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="flex items-center gap-2 justify-end mb-2">
                                        <UserAvatar shape="square" name="Admin" className="size-8" fallback={<ShoppingBag className="size-5" />} />
                                        <span className="text-2xl font-bold">Admin</span>
                                    </div>
                                    <p className="text-sm text-muted-foreground">59 Station Rd, Purls Bridge, United Kingdom</p>
                                    <p className="text-sm text-muted-foreground">019579034</p>
                                    <p className="text-sm text-muted-foreground">kachabazar@gmail.com</p>
                                    <p className="text-sm text-muted-foreground">kachabazar-admin.vercel.app</p>
                                </div>
                            </div>

                            {/* Invoice Meta */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
                                <div>
                                    <SectionTitle className="mb-2">{t("orders:invoice.date")}</SectionTitle>
                                    <p className="text-sm text-foreground">
                                        {selectedSell.orderTime.split(" ")[0]} {selectedSell.orderTime.split(" ")[1]}{" "}
                                        {selectedSell.orderTime.split(" ")[2]}
                                    </p>
                                </div>
                                <div>
                                    <SectionTitle className="mb-2">{t("orders:invoice.invoiceNo")}</SectionTitle>
                                    <p className="text-sm text-foreground">#{selectedSell.invoiceNo}</p>
                                </div>
                                <div className="sm:text-right">
                                    <SectionTitle className="mb-2">{t("orders:invoice.invoiceTo")}</SectionTitle>
                                    <p className="text-sm font-semibold text-foreground">{selectedSell.customerName}</p>
                                    <p className="text-xs text-muted-foreground">hram8251@gmail.com</p>
                                    <p className="text-xs text-muted-foreground">123456789</p>
                                    <p className="text-xs text-muted-foreground">state, cuntyre, 1235</p>
                                </div>
                            </div>

                            {/* Products Table */}
                            <Card className="gap-0 overflow-x-auto py-0">
                                <Table className="min-w-[600px]">
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>{t("orders:invoice.sr")}</TableHead>
                                            <TableHead>
                                                {t("orders:invoice.productTitle")}
                                            </TableHead>
                                            <TableHead className="text-center">{t("orders:invoice.quantity")}</TableHead>
                                            <TableHead className="text-right">{t("orders:invoice.itemPrice")}</TableHead>
                                            <TableHead className="text-right">{t("orders:invoice.amount")}</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        <TableRow>
                                            <TableCell>1</TableCell>
                                            <TableCell>Fresh Mustard Oil</TableCell>
                                            <TableCell className="text-center">1</TableCell>
                                            <TableCell className="text-right">
                                                {formatCurrency(selectedSell.amount - 60)}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                {formatCurrency(selectedSell.amount - 60)}
                                            </TableCell>
                                        </TableRow>
                                    </TableBody>
                                </Table>
                            </Card>

                            {/* Summary Section */}
                            <Card className="p-6">
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8">
                                    <div>
                                        <SectionTitle className="mb-2">{t("orders:invoice.paymentMethod")}</SectionTitle>
                                        <p className="text-base font-semibold text-foreground">{methodLabel(t, selectedSell.method)}</p>
                                    </div>
                                    <div>
                                        <SectionTitle className="mb-2">{t("orders:invoice.shippingCost")}</SectionTitle>
                                        <p className="text-base font-semibold text-muted-foreground">{formatCurrency(60)}</p>
                                    </div>
                                    <div>
                                        <SectionTitle className="mb-2">{t("orders:invoice.discount")}</SectionTitle>
                                        <p className="text-base font-semibold text-muted-foreground">{formatCurrency(0)}</p>
                                    </div>
                                    <div>
                                        <SectionTitle className="mb-2">{t("orders:invoice.totalAmount")}</SectionTitle>
                                        <p className="text-2xl font-bold">{formatCurrency(selectedSell.amount)}</p>
                                    </div>
                                </div>
                            </Card>

                            {/* Action Buttons */}
                            <div className="flex flex-col sm:flex-row gap-3 pt-4">
                                <Button
                                    onClick={() => handleDownloadInvoice(selectedSell)}
                                    variant="outline"
                                    className="flex-1"
                                >
                                    <Download className="size-4" />
                                    {t("orders:invoice.download")}
                                </Button>
                                <Button
                                    onClick={() => handleEmailInvoice(selectedSell)}
                                    variant="outline"
                                    className="flex-1"
                                >
                                    <Mail className="size-4" />
                                    {t("orders:invoice.email")}
                                </Button>
                                <Button
                                    onClick={() => handlePrintInvoice(selectedSell)}
                                    className="flex-1"
                                >
                                    <Printer className="size-4" />
                                    {t("orders:invoice.print")}
                                </Button>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    )
}
