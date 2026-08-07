import connectDB from '@/lib/mongodb'
import { authenticate } from '@/lib/middleware'
import { getOptions } from '@/lib/masters'
import { MASTER_CATEGORIES } from '@/lib/masterCategories'

/**
 * Read-only dropdown options for any authenticated user in the workspace.
 * GET /api/settings/options?category=lead_status
 * GET /api/settings/options?categories=lead_status,lead_source  (batch)
 */
export async function GET(request) {
  try {
    const authResult = await authenticate(request)
    if (authResult.error) {
      return Response.json({ error: authResult.error }, { status: authResult.status })
    }

    await connectDB()
    const teamId = authResult.user.teamId
    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')
    const categoriesParam = searchParams.get('categories')

    if (categoriesParam) {
      const keys = categoriesParam.split(',').map((k) => k.trim()).filter(Boolean)
      const result = {}
      await Promise.all(
        keys.map(async (key) => {
          result[key] = await getOptions(teamId, key)
        })
      )
      return Response.json({ options: result })
    }

    if (category) {
      const options = await getOptions(teamId, category)
      return Response.json({ options })
    }

    // No category → return the catalog of available categories.
    return Response.json({
      categories: MASTER_CATEGORIES.map((c) => ({
        key: c.key,
        label: c.label,
        group: c.group,
      })),
    })
  } catch (error) {
    console.error('Get options error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
