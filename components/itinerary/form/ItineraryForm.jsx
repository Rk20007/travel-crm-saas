'use client'

import { useEffect, useMemo } from 'react'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { createItinerarySchema } from '@/lib/validators/itinerary'
import { DEFAULT_ITINERARY_FORM, ITINERARY_STATUSES } from '@/modules/itinerary/constants'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Plus, Trash2 } from 'lucide-react'
import DayPlanner from '@/components/itinerary/day-planner/DayPlanner'

export default function ItineraryForm({ initialData, members = [], onSubmit, saving }) {
  const defaultValues = useMemo(() => {
    if (!initialData?.itinerary) return DEFAULT_ITINERARY_FORM
    const it = initialData.itinerary
    return {
      tripName: it.tripName || it.title || '',
      customerName: it.customerName || '',
      customerEmail: it.customerEmail || '',
      phone: it.phone || '',
      destination: it.destination || '',
      country: it.country || '',
      bannerImage: it.bannerImage || '',
      startDate: it.startDate ? new Date(it.startDate).toISOString().slice(0, 10) : '',
      endDate: it.endDate ? new Date(it.endDate).toISOString().slice(0, 10) : '',
      numberOfAdults: it.numberOfAdults ?? 2,
      numberOfChildren: it.numberOfChildren ?? 0,
      pricePerPerson: it.pricePerPerson ?? it.perPersonCost ?? 0,
      totalPrice: it.totalPrice ?? it.totalCost ?? 0,
      currency: it.currency || 'USD',
      status: it.status || 'draft',
      notes: it.notes || '',
      assignedTo: it.assignedTo?._id || it.assignedTo || 'unassigned',
      hotels: it.hotels?.length ? it.hotels : [],
      flights: it.flights?.length ? it.flights : [],
      transfers: it.transfers?.length ? it.transfers : [],
      visa: it.visa || DEFAULT_ITINERARY_FORM.visa,
      inclusions: it.inclusions?.length ? it.inclusions : [''],
      exclusions: it.exclusions?.length ? it.exclusions : [''],
      termsAndConditions: it.termsAndConditions || '',
      days: initialData.days?.length ? initialData.days : [],
    }
  }, [initialData])

  const form = useForm({
    resolver: zodResolver(createItinerarySchema),
    defaultValues,
  })

  useEffect(() => {
    form.reset(defaultValues)
  }, [defaultValues, form])

  const adults = form.watch('numberOfAdults') || 0
  const children = form.watch('numberOfChildren') || 0
  const pricePerPerson = form.watch('pricePerPerson') || 0

  useEffect(() => {
    const total = (adults + children || 1) * pricePerPerson
    form.setValue('totalPrice', total)
  }, [adults, children, pricePerPerson, form])

  const inclusionsField = useFieldArray({ control: form.control, name: 'inclusions' })
  const exclusionsField = useFieldArray({ control: form.control, name: 'exclusions' })

  const handleSubmit = form.handleSubmit((data) => {
    const payload = {
      ...data,
      inclusions: (data.inclusions || []).filter(Boolean),
      exclusions: (data.exclusions || []).filter(Boolean),
      assignedTo:
        data.assignedTo && data.assignedTo !== 'unassigned' ? data.assignedTo : undefined,
    }
    onSubmit(payload)
  })

  return (
    <Form {...form}>
      <form onSubmit={handleSubmit} className="space-y-8">
        <Card className="border-border/60 shadow-sm">
          <CardHeader>
            <CardTitle>Trip details</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <FormField
              control={form.control}
              name="tripName"
              render={({ field }) => (
                <FormItem className="md:col-span-2">
                  <FormLabel>Trip name *</FormLabel>
                  <FormControl>
                    <Input placeholder="Bali Golden Dream" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="customerName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Customer name</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="customerEmail"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Customer email</FormLabel>
                  <FormControl>
                    <Input type="email" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="destination"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Destination *</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="country"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Country</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="startDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Start date *</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="endDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>End date *</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="numberOfAdults"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Adults</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={0}
                      {...field}
                      onChange={(e) => field.onChange(Number(e.target.value))}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="numberOfChildren"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Children</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={0}
                      {...field}
                      onChange={(e) => field.onChange(Number(e.target.value))}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="pricePerPerson"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Price per person</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={0}
                      {...field}
                      onChange={(e) => field.onChange(Number(e.target.value))}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="totalPrice"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Total price</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={0}
                      {...field}
                      onChange={(e) => field.onChange(Number(e.target.value))}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="currency"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Currency</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {ITINERARY_STATUSES.map((s) => (
                        <SelectItem key={s.value} value={s.value}>
                          {s.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="assignedTo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Assigned sales person</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value || ''}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select team member" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="unassigned">Unassigned</SelectItem>
                      {members.map((m) => (
                        <SelectItem key={m._id} value={m._id}>
                          {m.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="bannerImage"
              render={({ field }) => (
                <FormItem className="md:col-span-2">
                  <FormLabel>Banner image URL</FormLabel>
                  <FormControl>
                    <Input placeholder="https://..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem className="md:col-span-2">
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea rows={3} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-sm">
          <CardHeader>
            <CardTitle>Inclusions & exclusions</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <FormLabel>Inclusions</FormLabel>
              {inclusionsField.fields.map((field, index) => (
                <div key={field.id} className="flex gap-2">
                  <Input {...form.register(`inclusions.${index}`)} placeholder="Included item" />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => inclusionsField.remove(index)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => inclusionsField.append('')}
              >
                <Plus className="mr-1 h-3 w-3" /> Add
              </Button>
            </div>
            <div className="space-y-2">
              <FormLabel>Exclusions</FormLabel>
              {exclusionsField.fields.map((field, index) => (
                <div key={field.id} className="flex gap-2">
                  <Input {...form.register(`exclusions.${index}`)} placeholder="Excluded item" />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => exclusionsField.remove(index)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => exclusionsField.append('')}
              >
                <Plus className="mr-1 h-3 w-3" /> Add
              </Button>
            </div>
            <FormField
              control={form.control}
              name="termsAndConditions"
              render={({ field }) => (
                <FormItem className="md:col-span-2">
                  <FormLabel>Terms & conditions</FormLabel>
                  <FormControl>
                    <Textarea rows={4} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-sm">
          <CardContent className="pt-6">
            <FormField
              control={form.control}
              name="days"
              render={({ field }) => (
                <FormItem>
                  <DayPlanner days={field.value || []} onChange={field.onChange} />
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3">
          <Button type="submit" disabled={saving} className="min-w-[140px]">
            {saving ? 'Saving...' : 'Save itinerary'}
          </Button>
        </div>
      </form>
    </Form>
  )
}
