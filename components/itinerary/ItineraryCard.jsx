'use client'

import { format } from 'date-fns'
import {
  Copy,
  Download,
  Edit,
  Eye,
  Loader2,
  MapPin,
  MoreHorizontal,
  Share2,
  Trash2,
  Users,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { getDefaultBanner, getDurationDays } from '@/utils/itinerary'

export default function ItineraryCard({
  itinerary,
  onEdit,
  onPreview,
  onDuplicate,
  onDelete,
  onExportPdf,
  onShare,
  previewLoading = false,
  downloadLoading = false,
}) {
  const tripName = itinerary.customerName || itinerary.tripName || itinerary.title
  const banner = itinerary.bannerImage || getDefaultBanner(itinerary.destination)
  const duration = getDurationDays(itinerary.startDate, itinerary.endDate)
  const travelers = itinerary.numberOfTravelers ?? (itinerary.numberOfAdults || 0) + (itinerary.numberOfChildren || 0)
  const dayCount = itinerary.dayCount ?? itinerary.days?.length ?? duration

  return (
    <article className="group overflow-hidden rounded-2xl border border-accent-secondary/40 bg-card shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-accent-secondary/70 hover:shadow-xl">
      <div className="relative h-44 overflow-hidden">
        <img
          src={banner}
          alt={tripName}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
        <div className="absolute bottom-3 left-4 right-4">
          <h3 className="text-lg font-semibold text-white line-clamp-1">{tripName}</h3>
          <p className="flex items-center gap-1 text-sm text-white/90">
            <MapPin className="h-3.5 w-3.5" />
            {itinerary.destination}
            {itinerary.country ? `, ${itinerary.country}` : ''}
          </p>
        </div>
      </div>

      <div className="space-y-4 p-5">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-muted-foreground">Duration</p>
            <p className="font-medium">{dayCount} days</p>
          </div>
          <div>
            <p className="text-muted-foreground">Travelers</p>
            <p className="flex items-center gap-1 font-medium">
              <Users className="h-3.5 w-3.5 text-muted-foreground" />
              {travelers || 1}
            </p>
          </div>
        </div>

        <div className="space-y-1 border-t border-border/60 pt-3 text-xs text-muted-foreground">
          <p className="flex flex-wrap items-center gap-x-2">
            <span>Created {itinerary.createdAt ? format(new Date(itinerary.createdAt), 'MMM d, yyyy') : '—'}</span>
            <span className="text-muted-foreground/50">·</span>
            <span>Updated {itinerary.updatedAt ? format(new Date(itinerary.updatedAt), 'MMM d, yyyy') : '—'}</span>
          </p>
          {itinerary.assignedTo && (
            <p className="text-foreground/80">
              Sales: {itinerary.assignedTo.name || itinerary.assignedTo.email}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="min-h-10 flex-1" onClick={() => onEdit?.(itinerary)}>
            <Edit className="mr-1.5 h-3.5 w-3.5" />
            Edit
          </Button>
          <Button
            variant="secondary"
            size="sm"
            className="min-h-10 flex-1"
            disabled={previewLoading}
            onClick={() => onPreview?.(itinerary)}
          >
            {previewLoading ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Eye className="mr-1.5 h-3.5 w-3.5" />
            )}
            {previewLoading ? 'Opening…' : 'Preview'}
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-10 w-10 shrink-0"
            title="Download PDF"
            disabled={downloadLoading}
            onClick={() => onExportPdf?.(itinerary)}
          >
            {downloadLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-10 w-10 shrink-0">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={() => onDuplicate?.(itinerary)}>
                <Copy className="mr-2 h-4 w-4" /> Duplicate
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onShare?.(itinerary)}>
                <Share2 className="mr-2 h-4 w-4" /> Share
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive" onClick={() => onDelete?.(itinerary)}>
                <Trash2 className="mr-2 h-4 w-4" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </article>
  )
}
