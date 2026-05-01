import {
  addDoc,
  collection,
  serverTimestamp,
  Timestamp,
  type Timestamp as TimestampType,
} from 'firebase/firestore'

export type ProblemType = 'error_code' | 'general'

export interface ProblemDoc {
  reported_by: string
  reporter_name: string
  kiln_id: string
  kiln_type: 'electric' | 'gas_propane'
  type: ProblemType
  error_code?: string
  body: string
  status: 'open' | 'acknowledged' | 'resolved'
  reported_at: TimestampType
}

export interface NewProblemInput {
  kiln_id: string
  kiln_type: 'electric' | 'gas_propane'
  type: ProblemType
  error_code?: string
  body: string
}

export const useProblems = () => {
  const requireMember = () => {
    const { state } = useCurrentMember()
    const { auth } = useFirebase()
    const uid = auth.currentUser?.uid
    const me = state.value.member
    if (!uid || !me) throw new Error('not authenticated')
    return { uid, displayName: me.display_name }
  }

  async function reportProblem(input: NewProblemInput): Promise<string> {
    const { firestore } = useFirebase()
    const { uid, displayName } = requireMember()
    const docRef = await addDoc(collection(firestore, 'problems'), {
      reported_by: uid,
      reporter_name: displayName,
      kiln_id: input.kiln_id,
      kiln_type: input.kiln_type,
      type: input.type,
      ...(input.error_code ? { error_code: input.error_code.trim() } : {}),
      body: input.body.trim(),
      status: 'open' as const,
      reported_at: serverTimestamp(),
    })
    return docRef.id
  }

  return { reportProblem }
}
