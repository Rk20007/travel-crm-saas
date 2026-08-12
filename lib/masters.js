import SettingOption from '@/models/SettingOption'
import { MASTER_CATEGORIES, getCategory } from '@/lib/masterCategories'

/**
 * Seed default master options for a workspace if none exist yet for a category.
 * Idempotent — only inserts missing (teamId, category, key) rows.
 */
export async function ensureSeeded(teamId, categoryKey = null, actorId = null) {
  const cats = categoryKey
    ? MASTER_CATEGORIES.filter((c) => c.key === categoryKey)
    : MASTER_CATEGORIES

  const ops = []
  for (const cat of cats) {
    const existing = await SettingOption.find({ teamId, category: cat.key })
      .select('key')
      .lean()
    const existingKeys = new Set(existing.map((e) => e.key))
    cat.defaults.forEach((def, idx) => {
      if (existingKeys.has(def.key)) return
      ops.push({
        insertOne: {
          document: {
            teamId,
            category: cat.key,
            key: def.key,
            label: def.label,
            color: def.color || '#64748b',
            icon: def.icon,
            order: idx,
            isActive: true,
            isSystem: true,
            metadata: def.metadata || {},
            createdBy: actorId,
          },
        },
      })
    })
  }

  if (ops.length) {
    try {
      await SettingOption.bulkWrite(ops, { ordered: false })
    } catch (err) {
      // Ignore duplicate-key races from concurrent seeds.
      if (err?.code !== 11000) throw err
    }
  }
  return ops.length
}

/**
 * Fetch active options for one category (seeding on demand).
 */
export async function getOptions(teamId, categoryKey, { includeInactive = false } = {}) {
  if (!getCategory(categoryKey)) return []
  await ensureSeeded(teamId, categoryKey)
  const query = { teamId, category: categoryKey, isArchived: false }
  if (!includeInactive) query.isActive = true
  return SettingOption.find(query).sort({ order: 1, label: 1 }).lean()
}
