'use client'

import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

function FieldWrapper({ label, error, children, className }) {
  return (
    <div className={cn('space-y-2', className)}>
      {label && <Label className="text-sm font-medium text-foreground">{label}</Label>}
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}

export function FormInput({ label, error, className, ...props }) {
  return (
    <FieldWrapper label={label} error={error} className={className}>
      <Input {...props} />
    </FieldWrapper>
  )
}

export function FormTextarea({ label, error, className, ...props }) {
  return (
    <FieldWrapper label={label} error={error} className={className}>
      <Textarea {...props} />
    </FieldWrapper>
  )
}

export function FormSelect({ label, error, options = [], placeholder, value, onValueChange, className }) {
  return (
    <FieldWrapper label={label} error={error} className={className}>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </FieldWrapper>
  )
}
