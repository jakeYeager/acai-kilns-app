import { describe, beforeAll, afterAll, beforeEach, test } from 'vitest'
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import { readFileSync } from 'node:fs'
import {
  setDoc,
  getDoc,
  doc,
  updateDoc,
  deleteDoc,
  Timestamp,
} from 'firebase/firestore'

let testEnv: RulesTestEnvironment

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'demo-acai-kilns',
    firestore: {
      rules: readFileSync('./firestore.rules', 'utf8'),
      host: '127.0.0.1',
      port: 8080,
    },
  })
})

afterAll(async () => {
  await testEnv.cleanup()
})

beforeEach(async () => {
  await testEnv.clearFirestore()
})

const member = (uid = 'm1') =>
  testEnv.authenticatedContext(uid, { member: true }).firestore()
const admin = (uid = 'a1') =>
  testEnv.authenticatedContext(uid, { admin: true }).firestore()
const stranger = () =>
  testEnv.authenticatedContext('stranger', {}).firestore()
const unauth = () =>
  testEnv.unauthenticatedContext().firestore()

async function seed(path: string, data: Record<string, unknown>) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), path), data)
  })
}

const hoursAgo = (h: number) =>
  Timestamp.fromDate(new Date(Date.now() - h * 60 * 60 * 1000))

// ─── Lookups ─────────────────────────────────────────────────────────────

describe('lookups (kilns/programs/firing_types)', () => {
  test('member reads kilns', async () => {
    await seed('kilns/LG1', { id: 'LG1', type: 'electric', active: true })
    await assertSucceeds(getDoc(doc(member(), 'kilns/LG1')))
  })
  test('unauthed read denied', async () => {
    await seed('kilns/LG1', { id: 'LG1' })
    await assertFails(getDoc(doc(unauth(), 'kilns/LG1')))
  })
  test('authed user without member/admin claim denied', async () => {
    await seed('kilns/LG1', { id: 'LG1' })
    await assertFails(getDoc(doc(stranger(), 'kilns/LG1')))
  })
  test('member write denied', async () => {
    await assertFails(
      setDoc(doc(member(), 'kilns/LG1'), { id: 'LG1', type: 'electric' })
    )
  })
  test('admin write allowed (kilns / programs / firing_types)', async () => {
    await assertSucceeds(
      setDoc(doc(admin(), 'kilns/LG1'), { id: 'LG1', type: 'electric' })
    )
    await assertSucceeds(
      setDoc(doc(admin(), 'programs/05-sb'), { label: '05 SB' })
    )
    await assertSucceeds(
      setDoc(doc(admin(), 'firing_types/raku'), { name: 'Raku' })
    )
  })
})

// ─── Members ─────────────────────────────────────────────────────────────

describe('members', () => {
  test('member reads roster', async () => {
    await seed('members/m1', { display_name: 'Janet' })
    await assertSucceeds(getDoc(doc(member('m1'), 'members/m1')))
  })
  test('member cannot edit own record (training flags admin-only)', async () => {
    await seed('members/m1', {
      display_name: 'Janet',
      training: { electric: { loader: false } },
    })
    await assertFails(
      updateDoc(doc(member('m1'), 'members/m1'), {
        'training.electric.loader': true,
      })
    )
  })
  test('admin creates and deactivates members', async () => {
    await assertSucceeds(
      setDoc(doc(admin(), 'members/m2'), { display_name: 'Bill', active: true })
    )
    await assertSucceeds(
      updateDoc(doc(admin(), 'members/m2'), { active: false })
    )
  })
})

// ─── Firings — create ────────────────────────────────────────────────────

describe('firings — create', () => {
  test('member creates firing with created_by = self', async () => {
    await assertSucceeds(
      setDoc(doc(member('m1'), 'firings/f1'), {
        kiln_id: 'LG1',
        kiln_type: 'electric',
        created_by: 'm1',
        created_at: Timestamp.now(),
        status: 'open',
      })
    )
  })
  test('member cannot impersonate', async () => {
    await assertFails(
      setDoc(doc(member('m1'), 'firings/f1'), {
        kiln_id: 'LG1',
        created_by: 'someone-else',
      })
    )
  })
  test('unauthed denied', async () => {
    await assertFails(
      setDoc(doc(unauth(), 'firings/f1'), { created_by: 'm1' })
    )
  })
  test('authed-but-no-claim denied', async () => {
    await assertFails(
      setDoc(doc(stranger(), 'firings/f1'), { created_by: 'stranger' })
    )
  })
})

// ─── Firings — 24h collective edit window ────────────────────────────────

describe('firings — 24h collective edit window', () => {
  test('any member can edit any firing within 24h', async () => {
    await seed('firings/f1', {
      created_by: 'm1',
      created_at: hoursAgo(2),
      status: 'open',
    })
    // m2 edits m1's firing
    await assertSucceeds(
      updateDoc(doc(member('m2'), 'firings/f1'), { unload_temp: 149 })
    )
  })
  test('member denied past 24h', async () => {
    await seed('firings/f1', {
      created_by: 'm1',
      created_at: hoursAgo(25),
      status: 'closed',
    })
    await assertFails(
      updateDoc(doc(member('m2'), 'firings/f1'), { unload_temp: 149 })
    )
  })
  test('admin can edit past 24h', async () => {
    await seed('firings/f1', {
      created_by: 'm1',
      created_at: hoursAgo(72),
      status: 'closed',
    })
    await assertSucceeds(
      updateDoc(doc(admin(), 'firings/f1'), { unload_temp: 149 })
    )
  })
})

// ─── Firings — soft-delete ───────────────────────────────────────────────

describe('firings — soft-delete & hard-delete', () => {
  test('member cannot write deleted_at (admin-only)', async () => {
    await seed('firings/f1', {
      created_by: 'm1',
      created_at: hoursAgo(1),
    })
    await assertFails(
      updateDoc(doc(member('m1'), 'firings/f1'), {
        deleted_at: Timestamp.now(),
      })
    )
  })
  test('admin can soft-delete', async () => {
    await seed('firings/f1', {
      created_by: 'm1',
      created_at: hoursAgo(1),
    })
    await assertSucceeds(
      updateDoc(doc(admin(), 'firings/f1'), {
        deleted_at: Timestamp.now(),
      })
    )
  })
  test('hard-delete forbidden for everyone (incl. admin)', async () => {
    await seed('firings/f1', {
      created_by: 'm1',
      created_at: hoursAgo(1),
    })
    await assertFails(deleteDoc(doc(admin(), 'firings/f1')))
  })
})

// ─── Tank refills ────────────────────────────────────────────────────────

describe('tank_refills', () => {
  test('member creates refill as self', async () => {
    await assertSucceeds(
      setDoc(doc(member('m1'), 'tank_refills/r1'), {
        kiln_id: 'RK1',
        kiln_type: 'gas_propane',
        created_by: 'm1',
        created_at: Timestamp.now(),
        gallons: 4.6,
        firings_since_last: 4,
        total_minutes_since_last: 160,
      })
    )
  })
  test('member edit allowed within 24h', async () => {
    await seed('tank_refills/r1', {
      created_by: 'm1',
      created_at: hoursAgo(3),
      gallons: 4.6,
    })
    await assertSucceeds(
      updateDoc(doc(member('m2'), 'tank_refills/r1'), { gallons: 4.7 })
    )
  })
})

// ─── Problems ────────────────────────────────────────────────────────────

describe('problems', () => {
  test('member files report as self', async () => {
    await assertSucceeds(
      setDoc(doc(member('m1'), 'problems/p1'), {
        reported_by: 'm1',
        kiln_id: 'LG1',
        severity: 'blocking',
        status: 'open',
        reported_at: Timestamp.now(),
      })
    )
  })
  test('member cannot impersonate reporter', async () => {
    await assertFails(
      setDoc(doc(member('m1'), 'problems/p1'), {
        reported_by: 'someone-else',
        kiln_id: 'LG1',
      })
    )
  })
  test('only admin transitions problem status', async () => {
    await seed('problems/p1', {
      reported_by: 'm1',
      kiln_id: 'LG1',
      status: 'open',
    })
    await assertFails(
      updateDoc(doc(member('m1'), 'problems/p1'), { status: 'resolved' })
    )
    await assertSucceeds(
      updateDoc(doc(admin(), 'problems/p1'), {
        status: 'resolved',
        resolved_by: 'a1',
        resolved_at: Timestamp.now(),
      })
    )
  })
})
