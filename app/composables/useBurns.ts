import {
  addDoc,
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  type Unsubscribe,
} from 'firebase/firestore'
import type { FiringMember } from './useFirings'

// Gas / raku firings — single-stage. No status field: closed-on-create.
// Different shape from electric `firings`: no cone/program (controller
// program is replaced by operator-observed target_cone), no loaders/unloaders
// split (operators[] runs the whole event), and time_to_qi captures the
// minutes-to-quartz-inversion observation that's specific to gas firings.
export interface BurnDoc {
  kiln_id: string
  firing_type: string
  target_cone: string
  operators: FiringMember[]
  start_datetime: Timestamp
  duration_minutes: number
  time_to_qi?: number
  notes?: string
  has_problem: boolean
  deleted_at?: Timestamp
  created_at: Timestamp
  updated_at: Timestamp
  created_by: string
  updated_by: string
}

export interface BurnEntry extends BurnDoc {
  id: string
}

export interface NewBurnInput {
  kiln_id: string
  firing_type: string
  firing_type_label: string
  target_cone: string
  operators: FiringMember[]
  start_datetime: Date
  duration_minutes: number
  time_to_qi?: number
  notes?: string
}

export const useBurns = () => {
  const recentState = useState<{ list: BurnEntry[]; loading: boolean }>(
    'kilns:burns:recent',
    () => ({ list: [], loading: true })
  )

  if (import.meta.client && !(window as { __kilns_burns_wired__?: boolean }).__kilns_burns_wired__) {
    ;(window as { __kilns_burns_wired__?: boolean }).__kilns_burns_wired__ = true
    const { firestore } = useFirebase()
    // Filter deleted_at client-side — Firestore's null-equals only matches
    // docs that explicitly set the field, and we conditionally omit it on
    // create.
    const sub: Unsubscribe = onSnapshot(
      query(collection(firestore, 'burns'), orderBy('start_datetime', 'desc')),
      (snap) => {
        recentState.value = {
          list: snap.docs
            .map((d) => ({ id: d.id, ...(d.data() as BurnDoc) }))
            .filter((b) => !b.deleted_at),
          loading: false,
        }
      },
      (err) => {
        console.warn('[burns] subscription error', err)
        recentState.value = { ...recentState.value, loading: false }
      }
    )
    if (import.meta.hot) {
      import.meta.hot.dispose(() => sub())
    }
  }

  const requireUid = () => {
    const { auth } = useFirebase()
    const uid = auth.currentUser?.uid
    if (!uid) throw new Error('not authenticated')
    return uid
  }

  async function logBurn(input: NewBurnInput): Promise<string> {
    const { firestore } = useFirebase()
    const uid = requireUid()
    const docRef = await addDoc(collection(firestore, 'burns'), {
      kiln_id: input.kiln_id,
      firing_type: input.firing_type_label,
      target_cone: input.target_cone.trim(),
      operators: input.operators,
      start_datetime: Timestamp.fromDate(input.start_datetime),
      duration_minutes: input.duration_minutes,
      ...(input.time_to_qi != null ? { time_to_qi: input.time_to_qi } : {}),
      ...(input.notes ? { notes: input.notes } : {}),
      has_problem: false,
      created_at: serverTimestamp(),
      updated_at: serverTimestamp(),
      created_by: uid,
      updated_by: uid,
    })
    return docRef.id
  }

  async function getBurn(id: string): Promise<BurnEntry | null> {
    const { firestore } = useFirebase()
    const ref = doc(firestore, 'burns', id)
    const snap = await getDoc(ref)
    return snap.exists() ? ({ id: snap.id, ...(snap.data() as BurnDoc) }) : null
  }

  function watchBurn(id: string, cb: (burn: BurnEntry | null) => void): Unsubscribe {
    const { firestore } = useFirebase()
    return onSnapshot(doc(firestore, 'burns', id), (snap) => {
      cb(snap.exists() ? ({ id: snap.id, ...(snap.data() as BurnDoc) }) : null)
    })
  }

  return {
    recent: computed(() => recentState.value.list),
    recentLoading: computed(() => recentState.value.loading),
    logBurn,
    getBurn,
    watchBurn,
  }
}
