import React from "react"
import { cn } from "@/lib/utils"

interface StatusBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
    status: string
}

export const StatusBadge = ({ status, className, ...props }: StatusBadgeProps) => {
    let badgeClass = "bg-gray-500 text-white" // Default

    // Normalize status for easier matching
    const lowerStatus = status.toLowerCase()

    if (["selling", "active", "delivered", "published"].includes(lowerStatus)) {
        badgeClass = "bg-emerald-500 text-white"
    } else if (["pending", "processing"].includes(lowerStatus)) {
        badgeClass = "bg-[#f59e0b] text-white" // Amber/Orange for pending states
    } else if (["out of stock", "expired", "discontinued", "unpublished"].includes(lowerStatus)) {
        badgeClass = "bg-red-500 text-white"
    } else if (lowerStatus === "processing") {
        badgeClass = "bg-blue-500 text-white"
    }

    return (
        <span
            className={cn(
                "inline-flex px-3 py-1 rounded text-xs font-medium",
                badgeClass,
                className
            )}
            {...props}
        >
            {status}
        </span>
    )
}
