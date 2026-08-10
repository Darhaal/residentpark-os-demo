// Title: Skeleton
// Path: src/components/ui/skeleton.tsx
// Functionality: Loading placeholder block. Use to reserve layout space while data loads
// (tables, cards, dashboards) instead of a bare spinner — keeps the UI calm and "light".

import * as React from "react"

import { cn } from "@/lib/utils"

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("animate-pulse rounded-md bg-muted", className)}
      {...props}
    />
  )
}

export { Skeleton }
