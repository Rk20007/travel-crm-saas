/**
 * Create (or promote) the platform super admin.
 *
 * Usage:
 *   node scripts/create-superadmin.js --email you@example.com --password "..." --name "Your Name"
 *   SUPERADMIN_EMAIL=... SUPERADMIN_PASSWORD=... node scripts/create-superadmin.js
 *
 * Promotes the account if the email already exists, otherwise creates it.
 * Talks to the collections directly rather than importing the ESM model files,
 * which this CommonJS script cannot require.
 */
const path = require('path')

require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') })

const mongoose = require('mongoose')
const bcryptjs = require('bcryptjs')

const argv = process.argv.slice(2)

function arg(flag) {
  const exact = argv.indexOf(`--${flag}`)
  if (exact !== -1 && argv[exact + 1] && !argv[exact + 1].startsWith('--')) {
    return argv[exact + 1]
  }
  const inline = argv.find((a) => a.startsWith(`--${flag}=`))
  return inline ? inline.slice(flag.length + 3) : undefined
}

/**
 * `npm run create:superadmin -- --email x` swallows the flag *names* and
 * forwards only their values, so the script also accepts bare positional
 * arguments in email / password / name order.
 */
function positional(index) {
  const bare = argv.filter((a) => !a.startsWith('--'))
  return bare[index]
}

async function main() {
  const email = (arg('email') || positional(0) || process.env.SUPERADMIN_EMAIL || '')
    .trim()
    .toLowerCase()
  const password = arg('password') || positional(1) || process.env.SUPERADMIN_PASSWORD || ''
  const name = arg('name') || positional(2) || process.env.SUPERADMIN_NAME || 'Platform Admin'

  if (!email || !password) {
    console.error('Missing credentials.\n')
    console.error('  node scripts/create-superadmin.js --email you@example.com --password "secret123" --name "Your Name"')
    console.error('  npm run create:superadmin -- you@example.com "secret123" "Your Name"')
    process.exit(1)
  }
  if (password.length < 8) {
    console.error('Password must be at least 8 characters.')
    process.exit(1)
  }

  const uri = process.env.MONGODB_URI
  if (!uri) {
    console.error('MONGODB_URI is not set in .env.local')
    process.exit(1)
  }

  await mongoose.connect(uri)
  const db = mongoose.connection.db
  const users = db.collection('users')
  const teams = db.collection('teams')

  const existing = await users.findOne({ email })
  const hashed = await bcryptjs.hash(password, await bcryptjs.genSalt(10))
  const now = new Date()

  if (existing) {
    await users.updateOne(
      { _id: existing._id },
      {
        $set: {
          role: 'superadmin',
          password: hashed,
          isActive: true,
          isBlocked: false,
          lastPasswordChange: now,
          updatedAt: now,
        },
      }
    )
    console.log(`✓ Promoted existing account ${email} to superadmin and reset its password.`)
  } else {
    // The super admin still needs a home workspace: several shared routes scope
    // their queries by teamId and would otherwise fail for this account.
    let platform = await teams.findOne({ name: 'AAP Platform' })
    const result = await users.insertOne({
      name,
      email,
      password: hashed,
      role: 'superadmin',
      isActive: true,
      isBlocked: false,
      isEmailVerified: true,
      twoFactorEnabled: false,
      leadAssignmentWeight: 0,
      teamId: platform?._id,
      permissions: [],
      createdAt: now,
      updatedAt: now,
    })

    if (!platform) {
      const teamInsert = await teams.insertOne({
        name: 'AAP Platform',
        owner: result.insertedId,
        plan: 'premium',
        subscriptionStatus: 'active',
        isActive: true,
        walletCredits: 0,
        members: [],
        createdAt: now,
        updatedAt: now,
      })
      platform = { _id: teamInsert.insertedId }
      await users.updateOne({ _id: result.insertedId }, { $set: { teamId: platform._id } })
    }

    console.log(`✓ Created superadmin ${email}`)
  }

  console.log('\n  Sign in at /login, then open /dashboard/platform')
  await mongoose.disconnect()
}

main().catch(async (err) => {
  console.error('Failed:', err.message)
  await mongoose.disconnect().catch(() => {})
  process.exit(1)
})
