// Title: Spinner
// Path: src/components/ui/spinner.tsx
// Functionality: Single consistent loading spinner (wraps lucide Loader2) so every
// loading affordance looks identical. Accessible by default (role=status + aria-label).

import * as React from "react"
import { Loader2 } from "lucide-react"

import { cn } from "@/lib/utils"

function Spinner({ className, ...props }: React.ComponentProps<typeof Loader2>) {
  return (
    <Loader2
      role="status"
      aria-label="Loading"
      className={cn("size-4 animate-spin text-muted-foreground", className)}
      {...props}
    />
  )
}

export { Spinner }
