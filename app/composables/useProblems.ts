import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  type Timestamp as TimestampType,
  type Unsubscribe,
} from 'firebase/firestore'

export type ProblemSeverity = 'blocking' | 'non_blocking'
export type ProblemStatus = 'open' | 'acknowledged' | 'resolved'

export interface ProblemDoc {
  reported_by: string
  reporter_name: string
  kiln_id: string
  kiln_type: 'electric' | 'gas_propane'
  firing_id?: string
  program_label?: string
  severity: ProblemSeverity
  error_code?: string
  description: string
  status: ProblemStatus
  reported_at: TimestampType
  slack_posted_at?: TimestampType
  resolved_by?: string
  resolved_at?: TimestampType
  resolution_notes?: string
}

export interface ProblemEntry extends ProblemDoc {
  id: string
}

export interface NewProblemInput {
  kiln_id: string
  kiln_type: 'electric' | 'gas_propane'
  firing_id?: string
  program_label?: string
  severity: ProblemSeverity
  error_code?: string
  description: string
}

export interface ResolveProblemInput {
  resolution_notes?: string
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
      ...(input.firing_id ? { firing_id: input.firing_id } : {}),
      ...(input.program_label ? { program_label: input.program_label } : {}),
      severity: input.severity,
      ...(input.error_code ? { error_code: input.error_code.trim() } : {}),
      description: input.description.trim(),
      status: 'open' as const,
      reported_at: serverTimestamp(),
    })
    return docRef.id
  }

  async function acknowledgeProblem(id: string): Promise<void> {
    const { firestore } = useFirebase()
    await updateDoc(doc(firestore, 'problems', id), {
      status: 'acknowledged',
    })
  }

  async function resolveProblem(id: string, input: ResolveProblemInput = {}): Promise<void> {
    const { firestore } = useFirebase()
    const { uid } = requireMember()
    await updateDoc(doc(firestore, 'problems', id), {
      status: 'resolved',
      resolved_by: uid,
      resolved_at: serverTimestamp(),
      ...(input.resolution_notes ? { resolution_notes: input.resolution_notes.trim() } : {}),
    })
  }

  async function reopenProblem(id: string): Promise<void> {
    const { firestore } = useFirebase()
    await updateDoc(doc(firestore, 'problems', id), {
      status: 'open',
    })
  }

  function watchProblems(cb: (list: ProblemEntry[]) => void): Unsubscribe {
    const { firestore } = useFirebase()
    return onSnapshot(
      query(collection(firestore, 'problems'), orderBy('reported_at', 'desc')),
      (snap) => {
        cb(snap.docs.map((d) => ({ id: d.id, ...(d.data() as ProblemDoc) })))
      }
    )
  }

  function watchProblemsForFiring(firingId: string, cb: (list: ProblemEntry[]) => void): Unsubscribe {
    const { firestore } = useFirebase()
    return onSnapshot(
      query(
        collection(firestore, 'problems'),
        where('firing_id', '==', firingId),
        orderBy('reported_at', 'desc')
      ),
      (snap) => {
        cb(snap.docs.map((d) => ({ id: d.id, ...(d.data() as ProblemDoc) })))
      }
    )
  }

  return {
    reportProblem,
    acknowledgeProblem,
    resolveProblem,
    reopenProblem,
    watchProblems,
    watchProblemsForFiring,
  }
}
