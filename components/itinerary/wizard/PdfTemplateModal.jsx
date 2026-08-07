'use client'

import { useState } from 'react'
import { Check, Lock } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { PDF_THEME_OPTIONS } from '@/modules/itinerary/pdfThemes'

export default function PdfTemplateModal({ open, onOpenChange, onConfirm, generating }) {
  const [selected, setSelected] = useState('classic')

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] max-w-3xl flex-col sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Choose a PDF design</DialogTitle>
          <DialogDescription>
            Pick the look for this itinerary&apos;s PDF. You can export with a different design any time.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3 overflow-y-auto pr-1 sm:grid-cols-4">
          {PDF_THEME_OPTIONS.map((t) => {
            const active = selected === t.id
            return (
              <button
                key={t.id}
                type="button"
                disabled={!t.available}
                onClick={() => setSelected(t.id)}
                className={cn(
                  'relative flex flex-col overflow-hidden rounded-xl border text-left transition-all',
                  active ? 'border-transparent ring-2 ring-offset-2 ring-offset-background' : 'border-border/60 hover:border-border',
                  !t.available && 'cursor-not-allowed opacity-50'
                )}
                style={active ? { '--tw-ring-color': t.primary } : undefined}
              >
                <div
                  className="h-16 w-full"
                  style={{ background: `linear-gradient(135deg, ${t.primary}, ${t.secondary})` }}
                />
                <div className="space-y-0.5 p-2.5">
                  <p className="text-xs font-semibold">{t.label}</p>
                  <p className="truncate text-[10px] text-muted-foreground">{t.description}</p>
                </div>
                {active && t.available && (
                  <span
                    className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full text-white shadow-sm"
                    style={{ backgroundColor: t.primary }}
                  >
                    <Check className="h-3 w-3" />
                  </span>
                )}
                {!t.available && (
                  <span className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-muted text-muted-foreground">
                    <Lock className="h-3 w-3" />
                  </span>
                )}
              </button>
            )
          })}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={generating}>
            Cancel
          </Button>
          <Button type="button" onClick={() => onConfirm(selected)} disabled={generating}>
            {generating ? 'Generating…' : 'Generate PDF'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
