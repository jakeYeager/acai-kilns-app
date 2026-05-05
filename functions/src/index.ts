import { initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'
import { logger } from 'firebase-functions'
import { auth as authV1 } from 'firebase-functions/v1'
import { onDocumentCreated, onDocumentWritten } from 'firebase-functions/v2/firestore'

initializeApp()

// Slack webhook + app URL come from process.env at runtime. Phase 7 will
// wire SLACK_WEBHOOK_KILN_REPAIR back through Secret Manager once the
// deploy SA's secrets.get IAM binding is sorted (granted but still 403'd
// against acai-kilns-dev on 2026-05-04 — see setup.md §2). For now the
// webhook is unset in deployed envs; the function falls through to
// logger.info, which is acceptable for Phase 6 smoke testing.

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

// ──────────────────────────────────────────────────────────────────────────
// onCreateProblem (v2 firestore trigger)
// On problems/{id} create:
//   - posts a structured message to #kiln-repair via Slack webhook
//     (degrades to console.log when SLACK_WEBHOOK_KILN_REPAIR is unset, so
//     emulator runs and webhook-less envs don't crash)
//   - flips has_problem=true on the parent firing if firing_id is set
//   - stamps slack_posted_at on the problem so we know the side-effect ran
// ──────────────────────────────────────────────────────────────────────────

interface ProblemPayload {
  reporter_name?: string
  kiln_id?: string
  firing_id?: string
  program_label?: string
  severity?: 'blocking' | 'non_blocking'
  error_code?: string
  description?: string
}

function buildSlackPayload(p: ProblemPayload, problemId: string, appUrl: string): { text: string } {
  const icon = p.severity === 'blocking' ? ':rotating_light:' : ':warning:'
  const sev = p.severity === 'blocking' ? 'Blocking' : 'Observation'
  const headline = [p.kiln_id, p.program_label].filter(Boolean).join(' · ')
  const lines = [`${icon} *${sev}* — ${headline || 'unknown kiln'}`]
  if (p.error_code) lines.push(`*Error code:* ${p.error_code}`)
  if (p.description) lines.push(`*Description:* ${p.description}`)
  if (p.reporter_name) lines.push(`*Reported by:* ${p.reporter_name}`)
  if (appUrl) {
    const link = p.firing_id
      ? `${appUrl.replace(/\/$/, '')}/firing/${p.firing_id}`
      : `${appUrl.replace(/\/$/, '')}/admin/problems`
    lines.push(`<${link}|View>`)
  }
  return { text: lines.join('\n') }
}

export const onCreateProblem = onDocumentCreated(
  'problems/{problemId}',
  async (event) => {
    const snap = event.data
    if (!snap) return
    const problem = snap.data() as ProblemPayload
    const problemId = event.params.problemId

    const webhook = process.env.SLACK_WEBHOOK_KILN_REPAIR || ''
    const appUrl = process.env.APP_URL || ''
    const payload = buildSlackPayload(problem, problemId, appUrl)

    let slackPostedAt: FirebaseFirestore.FieldValue | null = null
    if (!webhook) {
      logger.info('[problems] SLACK_WEBHOOK_KILN_REPAIR unset — skipping Slack post', {
        problemId,
        payload,
      })
    } else {
      try {
        const res = await fetch(webhook, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (!res.ok) {
          const body = await res.text()
          logger.error('[problems] Slack post failed', { problemId, status: res.status, body })
        } else {
          slackPostedAt = FieldValue.serverTimestamp()
        }
      } catch (err) {
        logger.error('[problems] Slack post threw', { problemId, err: String(err) })
      }
    }

    const db = getFirestore()
    const updates: Record<string, unknown> = {}
    if (slackPostedAt) updates.slack_posted_at = slackPostedAt
    if (Object.keys(updates).length) {
      await snap.ref.update(updates)
    }

    if (problem.firing_id) {
      try {
        await db.collection('firings').doc(problem.firing_id).update({
          has_problem: true,
          updated_at: FieldValue.serverTimestamp(),
        })
      } catch (err) {
        logger.warn('[problems] could not flip has_problem on firing', {
          problemId,
          firing_id: problem.firing_id,
          err: String(err),
        })
      }
    }
  }
)

// Phase 0 ping kept for sanity-check and emulator smoke tests.
export const ping = (() => {
  const { onRequest } = require('firebase-functions/v2/https')
  return onRequest((req: unknown, res: { json: (b: unknown) => void }) => {
    logger.info('ping')
    res.json({ ok: true, app: 'acai-kilns', phase: '6' })
  })
})()
