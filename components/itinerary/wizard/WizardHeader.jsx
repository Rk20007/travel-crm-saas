'use client'

import { FileDown, Compass } from 'lucide-react'
import { Button } from '@/components/ui/button'

// Wizard chrome uses the app's purple/lime theme colors — separate from the
// PDF's own design themes (Classic Red / Ocean Blue / Emerald), which stay
// exactly as the user picks them in the template modal.
export default function WizardHeader({ tripName, step, totalSteps, onCancel, onCommit, saving }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="relative overflow-hidden rounded-2xl bg-linear-to-r from-[#3b1769] via-[#12101c] to-primary px-6 py-2.5 shadow-xl shadow-primary/25 sm:px-9 sm:py-3">
        {/* Soft glow blobs for depth — blurred, not hard-edged shapes, so they read as light rather than clutter. */}
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-[#b6ff3b]/20 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-28 left-1/3 h-64 w-64 rounded-full bg-white/10 blur-3xl"
        />

        <div className="relative flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0 space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent-secondary text-accent-secondary-foreground shadow-sm">
                <Compass className="h-3.5 w-3.5" />
              </span>
              <span className="text-xs font-bold uppercase tracking-[0.2em] text-accent-secondary">
                Itinerary Builder
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-xl font-bold tracking-tight text-white sm:text-2xl">
                {tripName || 'Unnamed trip'}
              </h1>
              <span className="shrink-0 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-white ring-1 ring-white/20">
                Step {step} of {totalSteps}
              </span>
            </div>
            <span className="hidden text-sm text-white/70 sm:inline">
              Build a complete travel package with PDF export
            </span>
          </div>

          <div className="flex w-full flex-row gap-2 sm:gap-2.5 lg:w-auto">
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              className="h-9 flex-1 px-3 border-white/25 bg-white/10 text-white backdrop-blur-sm hover:bg-white/20 hover:text-white sm:flex-none sm:px-4"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={onCommit}
              disabled={saving}
              className="h-9 flex-1 gap-1.5 px-3 bg-accent-secondary font-semibold text-accent-secondary-foreground shadow-lg shadow-accent-secondary/30 hover:bg-accent-secondary/85 sm:flex-none sm:px-4"
            >
              <FileDown className="h-4 w-4 shrink-0" />
              <span className="truncate">
                <span className="sm:hidden">{saving ? 'Saving…' : 'Save & export'}</span>
                <span className="hidden sm:inline">{saving ? 'Saving…' : 'Save & export PDF'}</span>
              </span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
