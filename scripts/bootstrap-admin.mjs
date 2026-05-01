// Seeds the first admin members record + sets the admin custom claim so the
// new admin can sign in via email link without waiting for the cloud trigger
// to populate claims.
//
// Idempotent: re-running upserts the members doc, recreates auth user if
// missing, and re-applies the claims.
//
// Usage:
//   GOOGLE_APPLICATION_CREDENTIALS=/path/to/sa.json \
//   GCLOUD_PROJECT=acai-kilns-dev \
//     node scripts/bootstrap-admin.mjs --email you@example.com --name "Your Name"
//
// Or against the emulator:
//   FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 \
//   FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 \
//   GCLOUD_PROJECT=acai-kilns-dev \
//     node scripts/bootstrap-admin.mjs --email you@example.com --name "Your Name"

import { initializeApp, applicationDefault } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'
import { parseArgs } from 'node:util'

const { values } = parseArgs({
  options: {
    email: { type: 'string' },
    name: { type: 'string' },
    role: { type: 'string', default: 'admin' },
  },
})

if (!values.email || !values.name) {
  console.error('Usage: node scripts/bootstrap-admin.mjs --email you@example.com --name "Your Name"')
  process.exit(64)
}

if (values.role !== 'admin' && values.role !== 'member') {
  console.error(`Invalid --role ${values.role}; must be admin or member.`)
  process.exit(64)
}

const email = values.email.toLowerCase().trim()
const displayName = values.name.trim()
const role = values.role

const projectId =
  process.env.GCLOUD_PROJECT ||
  process.env.FIREBASE_PROJECT_ID ||
  'acai-kilns-dev'

const usingEmulator = Boolean(process.env.FIRESTORE_EMULATOR_HOST)

initializeApp(
  usingEmulator
    ? { projectId }
    : { credential: applicationDefault(), projectId }
)

const auth = getAuth()
const db = getFirestore()

const trainingFull = {
  electric: { loader: true, unloader: true },
  gas_propane: { operator: true },
}
const trainingDefault = {
  electric: { loader: false, unloader: false },
  gas_propane: { operator: false },
}

async function getOrCreateAuthUser() {
  try {
    return await auth.getUserByEmail(email)
  } catch (err) {
    if (err.code === 'auth/user-not-found') {
      console.log(`  · creating Firebase Auth user for ${email}`)
      return await auth.createUser({ email, displayName, emailVerified: false })
    }
    throw err
  }
}

async function getOrCreateMembersDoc(authUid) {
  const existing = await db.collection('members').where('email', '==', email).limit(1).get()
  if (!existing.empty) {
    const doc = existing.docs[0]
    console.log(`  · upserting existing members/${doc.id}`)
    await doc.ref.set(
      {
        email,
        display_name: displayName,
        role,
        active: true,
        auth_uid: authUid,
        training: role === 'admin' ? trainingFull : trainingDefault,
        updated_at: FieldValue.serverTimestamp(),
      },
      { merge: true }
    )
    return doc.id
  }

  const ref = db.collection('members').doc()
  console.log(`  · creating members/${ref.id}`)
  await ref.set({
    email,
    display_name: displayName,
    role,
    active: true,
    auth_uid: authUid,
    training: role === 'admin' ? trainingFull : trainingDefault,
    created_at: FieldValue.serverTimestamp(),
    updated_at: FieldValue.serverTimestamp(),
  })
  return ref.id
}

async function main() {
  console.log(`[bootstrap-admin] target: ${usingEmulator ? `emulator (${process.env.FIRESTORE_EMULATOR_HOST})` : `project ${projectId}`}`)
  console.log(`[bootstrap-admin] email: ${email}`)
  console.log(`[bootstrap-admin] role:  ${role}`)
  console.log()

  const user = await getOrCreateAuthUser()
  console.log(`  · auth uid: ${user.uid}`)

  const memberId = await getOrCreateMembersDoc(user.uid)

  const claims = role === 'admin' ? { admin: true, member: true } : { member: true }
  await auth.setCustomUserClaims(user.uid, claims)
  console.log(`  · claims set: ${JSON.stringify(claims)}`)

  console.log()
  console.log('[bootstrap-admin] done')
  console.log(`  members/${memberId}  ←  ${email}  (role=${role})`)
  console.log()
  console.log('Next: visit the app and request a sign-in link with this email.')
  process.exit(0)
}

main().catch((err) => {
  console.error('[bootstrap-admin] failed:', err)
  process.exit(1)
})
