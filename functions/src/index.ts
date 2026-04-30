import { initializeApp } from 'firebase-admin/app'
import { logger } from 'firebase-functions'

initializeApp()

// Phase 0 stub. Real exports land in later phases:
//
//   phase 3: onCreateMember (auto-send invite link)
//            onFirstSignIn  (set member custom claim, write auth_uid)
//   phase 5: recomputeRefillCounters (on firings write/delete)
//   phase 6: onCreateProblem (post to #kiln-tech)
//   phase 7: scheduledCsvExport (post link to #kiln-reports)
//            onFunctionError  (post to #webapp-alerts with [kilns] prefix)

export const ping = (() => {
  const { onRequest } = require('firebase-functions/v2/https')
  return onRequest((req: unknown, res: { json: (b: unknown) => void }) => {
    logger.info('ping')
    res.json({ ok: true, app: 'acai-kilns', phase: 0 })
  })
})()
