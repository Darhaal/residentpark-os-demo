// Title: EmptyState
// Path: src/components/ui/empty-state.tsx
// Functionality: Consistent "nothing here yet" panel (icon + title + description + action).
// Replaces the various hand-rolled empty blocks so every empty list reads the same way.

import * as React from "react"
import type { LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"

interface EmptyStateProps extends React.ComponentProps<"div"> {
  icon?: LucideIcon
  title: string
  description?: string
  action?: React.ReactNode
}

function EmptyState({ icon: Icon, title, description, action, className, ...props }: EmptyStateProps) {
  return (
    <div
      data-slot="empty-state"
      className={cn(
        "flex flex-col items-center justify-center rounded-md border border-dashed border-border bg-muted/30 px-6 py-12 text-center",
        className
      )}
      {...props}
    >
      {Icon && (
        <div className="mb-4 flex size-12 items-center justify-center rounded-md border border-border bg-card shadow-sm">
          <Icon className="size-5 text-muted-foreground" aria-hidden="true" />
        </div>
      )}
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

export { EmptyState }
