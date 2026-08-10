// Title: UI Textarea Component
// Path: src/components/ui/textarea.tsx
// Functionality: Reusable, accessible textarea component for form inputs.
// Uses standard system utility classes for consistent styling.

import * as React from "react"

import { cn } from "@/lib/utils"

// type alias instead of an empty interface (lint: no-empty-object-type)
export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          // Uses design tokens (border-input / ring-ring) to match Input for a consistent field look.
          "flex min-h-[80px] w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Textarea.displayName = "Textarea"

export { Textarea }