'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import WizardHeader from './WizardHeader'
import WizardStepper from './WizardStepper'
import WizardFooter from './WizardFooter'
import PdfTemplateModal from './PdfTemplateModal'
import StepDetails from './steps/StepDetails'
import StepVisuals from './steps/StepVisuals'
import StepPlan from './steps/StepPlan'
import StepHotels from './steps/StepHotels'
import StepCosting from './steps/StepCosting'
import StepInclusions from './steps/StepInclusions'
import StepTerms from './steps/StepTerms'
import {
  DEFAULT_STUDIO_FORM,
  STUDIO_STEPS,
  itineraryToStudioForm,
  studioFormToPayload,
} from '@/modules/itinerary/studio'
import { useItinerary } from '@/hooks/useItineraries'
import { DURATION_PRESETS } from '@/lib/data/masterRepository'
import { DEFAULT_DAY } from '@/modules/itinerary/constants'

const STEP_COMPONENTS = {
  1: StepDetails,
  2: StepVisuals,
  3: StepPlan,
  4: StepHotels,
  5: StepCosting,
  6: StepInclusions,
  7: StepTerms,
}

export default function ItineraryStudio({ itineraryId = null, initialData = null, leadPrefill = null }) {
  const router = useRouter()
  const { saveItinerary } = useItinerary(itineraryId)
  const [step, setStep] = useState(1)
  const [form, setForm] = useState(DEFAULT_STUDIO_FORM)
  const [savedId, setSavedId] = useState(itineraryId)
  const [saving, setSaving] = useState(false)
  const [templateModalOpen, setTemplateModalOpen] = useState(false)

  useEffect(() => {
    if (initialData?.itinerary) {
      setForm(itineraryToStudioForm(initialData))
    } else if (leadPrefill) {
      setForm((prev) => ({ ...prev, ...leadPrefill }))
    }
  }, [initialData, leadPrefill])

  const update = useCallback((patch) => {
    setForm((prev) => ({ ...prev, ...patch }))
  }, [])

  // Keep the day-wise plan in exact sync with the selected trip duration —
  // pick "4 Nights / 5 Days" and there should be exactly 5 day cards, no
  // more, no less.
  useEffect(() => {
    const preset = DURATION_PRESETS.find((p) => p.value === form.duration)
    const targetCount = preset?.days
    if (!targetCount) return
    setForm((prev) => {
      const current = prev.days || []
      if (current.length === targetCount) return prev
      if (current.length > targetCount) {
        return { ...prev, days: current.slice(0, targetCount) }
      }
      const additions = []
      for (let i = current.length; i < targetCount; i++) {
        additions.push({
          ...DEFAULT_DAY,
          dayNumber: i + 1,
          sortOrder: i,
          title: i === 0 ? 'ARRIVAL' : `Day ${i + 1}`,
        })
      }
      return { ...prev, days: [...current, ...additions] }
    })
  }, [form.duration])

  const validateStep = () => {
    if (step === 1) {
      if (!form.leadId) {
        toast.error('Select a client from the dropdown list')
        return false
      }
      if (!form.destination?.trim()) {
        toast.error('Destination is required')
        return false
      }
      if (!form.packageCategory?.trim()) {
        toast.error('Package category is required')
        return false
      }
      if (!form.duration?.trim()) {
        toast.error('Duration is required')
        return false
      }
      if (form.duration === 'custom' && !form.customDuration?.trim()) {
        toast.error('Enter the custom duration')
        return false
      }
      // The destination doubles as the package name — there's no separate
      // "package name" field in the UI, so keep tripName in sync with it.
      if (form.tripName !== form.destination) {
        setForm((prev) => ({ ...prev, tripName: prev.destination }))
      }
    }
    return true
  }

  const persist = async (theme = null) => {
    setSaving(true)
    try {
      const payload = studioFormToPayload(form)
      if (theme) payload.pdfTheme = theme
      const result = await saveItinerary(payload, savedId)
      const id = result.itinerary._id
      setSavedId(id)
      if (!itineraryId) {
        window.history.replaceState(null, '', `/dashboard/itinerary-builder?id=${id}`)
      }
      if (theme) {
        const token = localStorage.getItem('token')
        const res = await fetch(`/api/itineraries/${id}/pdf?theme=${encodeURIComponent(theme)}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!res.ok) throw new Error('PDF generation failed')
        const blob = await res.blob()
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${payload.customerName || payload.tripName || 'itinerary'}.pdf`
        a.click()
        URL.revokeObjectURL(url)
        toast.success('Itinerary saved and PDF downloaded')
        setTemplateModalOpen(false)
        router.push('/dashboard/itineraries')
      } else {
        toast.success('Progress saved')
      }
      return id
    } catch (e) {
      toast.error(e.message || 'Save failed')
      return null
    } finally {
      setSaving(false)
    }
  }

  const handleNext = async () => {
    if (!validateStep()) return
    if (step >= STUDIO_STEPS.length) {
      setTemplateModalOpen(true)
      return
    }
    setStep((s) => s + 1)
  }

  const handleCommit = () => {
    if (!validateStep()) return
    setTemplateModalOpen(true)
  }

  const StepComponent = STEP_COMPONENTS[step]

  return (
    <div className="space-y-6 pb-24 sm:pb-0">
      <WizardHeader
        tripName={form.customerName || form.tripName || 'Unnamed trip'}
        step={step}
        totalSteps={STUDIO_STEPS.length}
        onCancel={() => router.push('/dashboard/itineraries')}
        onCommit={handleCommit}
        saving={saving}
      />
      <WizardStepper currentStep={step} />
      <div>
        {StepComponent && <StepComponent form={form} update={update} />}
      </div>
      <WizardFooter
        step={step}
        totalSteps={STUDIO_STEPS.length}
        onBack={() => setStep((s) => Math.max(1, s - 1))}
        onNext={handleNext}
        nextLabel={step >= STUDIO_STEPS.length ? 'Finalize & export' : 'Continue'}
        saving={saving}
      />
      <PdfTemplateModal
        open={templateModalOpen}
        onOpenChange={setTemplateModalOpen}
        onConfirm={(theme) => persist(theme)}
        generating={saving}
      />
    </div>
  )
}
