import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format } from 'date-fns'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number): string {
  return `RM ${amount.toLocaleString('en-MY', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

export function formatDate(date: string | Date): string {
  return format(new Date(date), 'dd MMM yyyy')
}

export function formatDateShort(date: string | Date): string {
  return format(new Date(date), 'dd/MM/yyyy')
}
