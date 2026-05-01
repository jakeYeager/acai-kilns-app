// Seeds the lookup collections (kilns, firing_types, programs).
// Idempotent: re-running updates fields without duplicating docs.
//
// Emulator:
//   npm run seed:emulator        # requires the emulator running on :8080
//
// Real project (admin):
//   GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json \
//   GCLOUD_PROJECT=acai-kilns-dev \
//     node scripts/seed.mjs

import { initializeApp, applicationDefault } from 'firebase-admin/app'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'

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

const db = getFirestore()

const kilns = [
  { id: 'LG1', display_name: 'LG1', type: 'electric',    active: true },
  { id: 'LG2', display_name: 'LG2', type: 'electric',    active: true },
  { id: 'LG3', display_name: 'LG3', type: 'electric',    active: true },
  { id: 'RK1', display_name: 'RK1', type: 'gas_propane', active: true },
]

// Per docs/answers-raku.md: Raku, Saggar, Other in v1; admin-extensible.
const firingTypes = [
  { id: 'raku',   name: 'Raku',   label: 'Raku',   kiln_type: 'gas_propane', active: true },
  { id: 'saggar', name: 'Saggar', label: 'Saggar', kiln_type: 'gas_propane', active: true },
  { id: 'other',  name: 'Other',  label: 'Other',  kiln_type: 'gas_propane', active: true },
]

// Distinct (cone, program) pairs derived from docs/reference-data/Kiln_Logs_All.csv.
// Admins can extend via the /admin lookups page (phase 10).
const programs = [
  { id: '05-sb', cone: '05', program: 'SB', label: '05 SB', kiln_type: 'electric', active: true },
  { id: '5-fg',  cone: '5',  program: 'FG', label: '5 FG',  kiln_type: 'electric', active: true },
]

async function seedCollection(name, docs) {
  const batch = db.batch()
  for (const { id, ...data } of docs) {
    batch.set(
      db.collection(name).doc(id),
      { ...data, updated_at: FieldValue.serverTimestamp() },
      { merge: true }
    )
  }
  await batch.commit()
  console.log(`  ✓ ${docs.length} → ${name}`)
}

async function main() {
  const target = usingEmulator
    ? `emulator (${process.env.FIRESTORE_EMULATOR_HOST})`
    : `project ${projectId}`
  console.log(`[seed] target: ${target}`)
  console.log(`[seed] project id: ${projectId}`)
  await seedCollection('kilns', kilns)
  await seedCollection('firing_types', firingTypes)
  await seedCollection('programs', programs)
  console.log('[seed] done')
  process.exit(0)
}

main().catch((err) => {
  console.error('[seed] failed:', err)
  process.exit(1)
})
