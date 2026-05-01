import { initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'
import { logger } from 'firebase-functions'
import { auth as authV1 } from 'firebase-functions/v1'
import { onDocumentWritten } from 'firebase-functions/v2/firestore'

initializeApp()

interface MemberDoc {
  email?: string
  role?: 'admin' | 'member'
  active?: boolean
  auth_uid?: string
}

function claimsFor(member: MemberDoc | undefined): Record<string, boolean> {
  if (!member || member.active === false) return {}
  const out: Record<string, boolean> = { member: true }
  if (member.role === 'admin') out.admin = true
  return out
}

// ──────────────────────────────────────────────────────────────────────────
// onUserCreate (v1 auth trigger)
// Fires once per user, on the first email-link sign-in. Looks up the
// matching members/{id} doc by email, sets custom claims, writes auth_uid
// + last_sign_in_at back so subsequent lookups can hit by uid.
// ──────────────────────────────────────────────────────────────────────────

export const onUserCreate = authV1.user().onCreate(async (user) => {
  const email = user.email?.toLowerCase().trim()
  if (!email) {
    logger.warn('user created without email; skipping claim assignment', { uid: user.uid })
    return
  }

  const db = getFirestore()
  const snap = await db
    .collection('members')
    .where('email', '==', email)
    .limit(1)
    .get()

  if (snap.empty) {
    logger.info('no members record matched email; user has no claim and will land on the off-roster screen', {
      uid: user.uid,
      email,
    })
    return
  }

  const memberDoc = snap.docs[0]
  if (!memberDoc) return
  const memberData = memberDoc.data() as MemberDoc
  const claims = claimsFor(memberData)

  await getAuth().setCustomUserClaims(user.uid, claims)
  await memberDoc.ref.update({
    auth_uid: user.uid,
    last_sign_in_at: FieldValue.serverTimestamp(),
    updated_at: FieldValue.serverTimestamp(),
  })

  logger.info('member claims set on first signin', {
    uid: user.uid,
    email,
    member_id: memberDoc.id,
    role: memberData.role || 'member',
  })
})

// ──────────────────────────────────────────────────────────────────────────
// onMemberWrite (v2 firestore trigger)
// Fires on any write to members/{id}. Two cases worth claim updates:
//   - role changed (admin ↔ member): re-set claims to match
//   - active toggled to false: revoke claims
// We only act if the doc has an auth_uid (i.e., the user has signed in at
// least once). For brand-new docs without auth_uid, claims are set when
// onUserCreate fires after their first signin.
// ──────────────────────────────────────────────────────────────────────────

export const onMemberWrite = onDocumentWritten('members/{memberId}', async (event) => {
  const before = event.data?.before.data() as MemberDoc | undefined
  const after = event.data?.after.data() as MemberDoc | undefined

  const beforeRole = before?.role || 'member'
  const afterRole = after?.role || 'member'
  const beforeActive = before?.active !== false
  const afterActive = after?.active !== false
  const docCreated = !before && !!after
  const docDeleted = !!before && !after

  // Skip noop writes. Specifically, the auth_uid backfill below triggers a
  // re-fire — that re-fire has same role / active and is neither create nor
  // delete, so it short-circuits here.
  if (!docCreated && !docDeleted && beforeRole === afterRole && beforeActive === afterActive) {
    return
  }

  let uid = after?.auth_uid || before?.auth_uid

  // Fallback: if the doc has no auth_uid yet (e.g., admin manually created
  // the record for someone who has already signed in once), look the auth
  // user up by email. Without this, that user would never get claims.
  if (!uid && after?.email) {
    try {
      const authUser = await getAuth().getUserByEmail(after.email)
      uid = authUser.uid
    } catch (err) {
      const code = (err as { code?: string })?.code
      if (code === 'auth/user-not-found') {
        // Auth user doesn't exist yet — claims will be set when they sign in
        // for the first time and onUserCreate fires.
        return
      }
      throw err
    }
  }

  if (!uid) return

  const claims = after ? claimsFor(after) : {}
  await getAuth().setCustomUserClaims(uid, claims)

  // Cache auth_uid back to the doc so subsequent writes don't need the lookup.
  if (after && uid !== after.auth_uid && event.data?.after.exists) {
    await event.data.after.ref.update({
      auth_uid: uid,
      updated_at: FieldValue.serverTimestamp(),
    })
  }

  logger.info('claims re-set after members write', {
    uid,
    member_id: event.params.memberId,
    role: afterRole,
    active: afterActive,
    claims,
  })
})

// Phase 0 ping kept for sanity-check and emulator smoke tests.
export const ping = (() => {
  const { onRequest } = require('firebase-functions/v2/https')
  return onRequest((req: unknown, res: { json: (b: unknown) => void }) => {
    logger.info('ping')
    res.json({ ok: true, app: 'acai-kilns', phase: '3a' })
  })
})()
