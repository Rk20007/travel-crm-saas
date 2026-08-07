'use client'

import { Check } from 'lucide-react'
import { STUDIO_STEPS } from '@/modules/itinerary/studio'
import { cn } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/card'

export default function WizardStepper({ currentStep }) {
  return (
    <Card className="border-border/60 bg-linear-to-b from-primary/10 to-card py-3 shadow-sm">
      <CardContent className="px-3 sm:px-4">
        <nav className="flex items-center gap-1 overflow-x-auto overscroll-x-contain pb-1 touch-pan-x">
          {STUDIO_STEPS.map((step, i) => {
            const done = currentStep > step.id
            const active = currentStep === step.id
            return (
              <div key={step.id} className="flex min-w-[3.25rem] shrink-0 items-center sm:min-w-0 sm:flex-1">
                <div className="flex w-full flex-col items-center gap-1">
                  <div
                    className={cn(
                      'flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold shadow-sm sm:text-sm',
                      done && 'bg-accent-secondary text-accent-secondary-foreground',
                      active && !done && 'bg-linear-to-br from-[#3b1769] to-primary text-white ring-4 ring-primary/15',
                      !done && !active && 'bg-muted text-muted-foreground shadow-none'
                    )}
                  >
                    {done ? <Check className="h-4 w-4" /> : step.id}
                  </div>
                  <span
                    className={cn(
                      'hidden max-w-[4.5rem] truncate text-center text-[10px] font-medium sm:block sm:max-w-none sm:text-xs',
                      active ? 'text-white' : done ? 'text-foreground' : 'text-muted-foreground'
                    )}
                  >
                    {step.label}
                  </span>
                </div>
                {i < STUDIO_STEPS.length - 1 && (
                  <div
                    className={cn(
                      'mx-0.5 h-0.5 w-3 shrink-0 rounded-full sm:mx-1 sm:min-w-4 sm:flex-1',
                      done ? 'bg-[#b6ff3b]' : 'bg-border'
                    )}
                  />
                )}
              </div>
            )
          })}
        </nav>
      </CardContent>
    </Card>
  )
}
