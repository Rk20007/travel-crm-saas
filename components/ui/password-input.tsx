'use client'

import * as React from 'react'
import { Eye, EyeOff } from 'lucide-react'

import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

/** A password `<Input>` with a show/hide eye toggle — drop-in replacement for
 * every `<Input type="password" />` in the app. */
function PasswordInput({ className, ...props }: React.ComponentProps<typeof Input>) {
  const [visible, setVisible] = React.useState(false)

  return (
    <div className="relative">
      <Input
        type={visible ? 'text' : 'password'}
        className={cn('pr-10', className)}
        {...props}
      />
      <button
        type="button"
        tabIndex={-1}
        onClick={() => setVisible((v) => !v)}
        // Fixed mid-gray, no color swap on hover: some password fields (the
        // auth pages) sit on a light input background, others (in-app
        // dialogs) on a dark one. A foreground-color hover swap disappeared
        // against whichever background it wasn't tuned for; #6b7280 reads
        // fine on both, so hover feedback comes from a background tint only.
        className="absolute inset-y-0 right-0 flex w-9 items-center justify-center rounded-r-md text-[#6b7280] transition-colors hover:bg-foreground/10"
        aria-label={visible ? 'Hide password' : 'Show password'}
      >
        {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  )
}

export { PasswordInput }
