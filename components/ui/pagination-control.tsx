import type React from "react"
import {
    Pagination,
    PaginationContent,
    PaginationItem,
    PaginationLink,
    PaginationNext,
    PaginationPrevious,
    PaginationEllipsis,
} from "@/components/ui/pagination"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"

interface PaginationControlProps {
    currentPage: number
    totalPages: number
    onPageChange: (page: number) => void
    itemsPerPage: number
    onItemsPerPageChange?: (itemsPerPage: number) => void
    totalItems: number
}

export function PaginationControl({
    currentPage,
    totalPages,
    onPageChange,
    itemsPerPage,
    onItemsPerPageChange,
    totalItems
}: PaginationControlProps) {
    if (totalPages <= 0) return null

    const getPageNumbers = () => {
        const pageNumbers = []
        const maxVisiblePages = 5

        if (totalPages <= maxVisiblePages) {
            for (let i = 1; i <= totalPages; i++) {
                pageNumbers.push(i)
            }
        } else {
            if (currentPage <= 3) {
                for (let i = 1; i <= 4; i++) {
                    pageNumbers.push(i)
                }
                pageNumbers.push(null)
                pageNumbers.push(totalPages)
            } else if (currentPage >= totalPages - 2) {
                pageNumbers.push(1)
                pageNumbers.push(null)
                for (let i = totalPages - 3; i <= totalPages; i++) {
                    pageNumbers.push(i)
                }
            } else {
                pageNumbers.push(1)
                pageNumbers.push(null)
                pageNumbers.push(currentPage - 1)
                pageNumbers.push(currentPage)
                pageNumbers.push(currentPage + 1)
                pageNumbers.push(null)
                pageNumbers.push(totalPages)
            }
        }
        return pageNumbers
    }

    return (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 py-4 mt-4 border-t border-gray-100 bg-white rounded-b-lg px-6">
            <div className="text-xs text-gray-500 font-medium">
                SHOWING {Math.min((currentPage - 1) * itemsPerPage + 1, totalItems)}-
                {Math.min(currentPage * itemsPerPage, totalItems)} OF {totalItems}
            </div>

            <div className="flex items-center gap-4">
                {onItemsPerPageChange && (
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-gray-500 uppercase">Records per page</span>
                        <select
                            value={itemsPerPage}
                            onChange={(e) => onItemsPerPageChange(Number(e.target.value))}
                            className="h-8 w-16 rounded border-gray-200 bg-gray-50 text-xs font-medium focus:border-emerald-500 focus:ring-emerald-500"
                        >
                            <option value={5}>5</option>
                            <option value={10}>10</option>
                            <option value={15}>15</option>
                            <option value={20}>20</option>
                        </select>
                    </div>
                )}

                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        className="h-8 px-3 rounded text-xs font-medium border-gray-200 text-gray-500 hover:bg-gray-50 hover:text-gray-700"
                        onClick={(e) => {
                            e.preventDefault()
                            onPageChange(currentPage - 1)
                        }}
                        disabled={currentPage === 1}
                    >
                        <ChevronLeft className="h-3 w-3 mr-1" />
                        Previous
                    </Button>

                    <div className="flex items-center gap-1">
                        {getPageNumbers().map((page, index) => (
                            <div key={index}>
                                {page === null ? (
                                    <span className="px-2 text-gray-400 text-xs">...</span>
                                ) : (
                                    <Button
                                        variant={page === currentPage ? "default" : "ghost"}
                                        size="sm"
                                        className={`h-8 w-8 p-0 rounded text-xs font-medium ${page === currentPage
                                            ? "bg-emerald-500 hover:bg-emerald-600 text-white"
                                            : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                                            }`}
                                        onClick={(e) => {
                                            e.preventDefault()
                                            onPageChange(page)
                                        }}
                                    >
                                        {page}
                                    </Button>
                                )}
                            </div>
                        ))}
                    </div>

                    <Button
                        variant="outline"
                        size="sm"
                        className="h-8 px-3 rounded text-xs font-medium border-gray-200 text-gray-500 hover:bg-gray-50 hover:text-gray-700"
                        onClick={(e) => {
                            e.preventDefault()
                            onPageChange(currentPage + 1)
                        }}
                        disabled={currentPage === totalPages}
                    >
                        Next
                        <ChevronRight className="h-3 w-3 ml-1" />
                    </Button>
                </div>
            </div>
        </div>
    )
}
