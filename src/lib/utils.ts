// Title: General Utilities
// Path: src/lib/utils.ts
// Functionality: Shared utility helpers for class names and small framework integrations.

import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
