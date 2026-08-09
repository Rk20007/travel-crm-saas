import { cn } from '@/lib/utils'

/** Horizontal scroll wrapper for data tables on small screens. */
export function TableShell({ children, className, minWidth = '36rem' }) {
  return (
    <div
      className={cn(
        '-mx-4 overflow-x-auto overscroll-x-contain px-4 touch-pan-x sm:mx-0 sm:px-0',
        className
      )}
    >
      <div style={{ minWidth }}>{children}</div>
    </div>
  )
}
