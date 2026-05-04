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
  updateDoc,
  where,
  type Unsubscribe,
} from 'firebase/firestore'

export interface FiringMember {
  member_id: string
  display_name: string
}

// Electric only — gas / raku events live in `useBurns` (different lifecycle:
// closed-on-create, no loaders/unloaders split, target_cone instead of program).
export interface FiringDoc {
  kiln_id: string
  cone?: string
  program?: string
  program_label?: string
  loaders?: FiringMember[]
  unloaders?: FiringMember[]
  start_datetime: Timestamp
  candle_hrs?: number
  unload_datetime?: Timestamp
  unload_temp?: number
  duration_minutes?: number
  notes?: string
  status: 'open' | 'closed'
  has_problem: boolean
  deleted_at?: Timestamp
  created_at: Timestamp
  updated_at: Timestamp
  created_by: string
  updated_by: string
}

export interface FiringEntry extends FiringDoc {
  id: string
}

export interface OpenElectricInput {
  kiln_id: string
  cone: string
  program: string
  loaders: FiringMember[]
  start_datetime: Date
  candle_hrs?: number
  notes?: string
}

export interface CloseElectricInput {
  unloaders: FiringMember[]
  unload_datetime: Date
  unload_temp?: number
  duration_minutes: number  // Required: from the kiln controller display, not page-derived.
  notes?: string
}

export const useFirings = () => {
  const inProgressState = useState<{ list: FiringEntry[]; loading: boolean }>(
    'kilns:firings:inProgress',
    () => ({ list: [], loading: true })
  )

  if (import.meta.client && !(window as { __kilns_firings_wired__?: boolean }).__kilns_firings_wired__) {
    ;(window as { __kilns_firings_wired__?: boolean }).__kilns_firings_wired__ = true
    const { firestore } = useFirebase()
    const sub: Unsubscribe = onSnapshot(
      query(
        collection(firestore, 'firings'),
        where('status', '==', 'open'),
        orderBy('start_datetime', 'desc')
      ),
      (snap) => {
        inProgressState.value = {
          list: snap.docs.map((d) => ({ id: d.id, ...(d.data() as FiringDoc) })),
          loading: false,
        }
      },
      (err) => {
        console.warn('[firings] in-progress subscription error', err)
        inProgressState.value = { ...inProgressState.value, loading: false }
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

  async function openElectricFiring(input: OpenElectricInput): Promise<string> {
    const { firestore } = useFirebase()
    const uid = requireUid()
    const program_label = `${input.cone} ${input.program}`
    const docRef = await addDoc(collection(firestore, 'firings'), {
      kiln_id: input.kiln_id,
      cone: input.cone,
      program: input.program,
      program_label,
      loaders: input.loaders,
      start_datetime: Timestamp.fromDate(input.start_datetime),
      ...(input.candle_hrs != null ? { candle_hrs: input.candle_hrs } : {}),
      ...(input.notes ? { notes: input.notes } : {}),
      status: 'open',
      has_problem: false,
      created_at: serverTimestamp(),
      updated_at: serverTimestamp(),
      created_by: uid,
      updated_by: uid,
    })
    return docRef.id
  }

  async function closeElectricFiring(id: string, input: CloseElectricInput): Promise<void> {
    const { firestore } = useFirebase()
    const uid = requireUid()

    const ref = doc(firestore, 'firings', id)
    const snap = await getDoc(ref)
    if (!snap.exists()) throw new Error(`firing ${id} not found`)
    const existing = snap.data() as FiringDoc
    if (existing.status !== 'open') throw new Error('firing is not open')

    // duration_minutes is the user-entered controller reading, not the
    // wall-clock delta between start_datetime and unload_datetime. The
    // wall-clock approach over-counted candle time and didn't match what
    // the controller showed.
    await updateDoc(ref, {
      unloaders: input.unloaders,
      unload_datetime: Timestamp.fromDate(input.unload_datetime),
      ...(input.unload_temp != null ? { unload_temp: input.unload_temp } : {}),
      duration_minutes: input.duration_minutes,
      ...(input.notes ? { notes: input.notes } : {}),
      status: 'closed',
      updated_at: serverTimestamp(),
      updated_by: uid,
    })
  }

  async function getFiring(id: string): Promise<FiringEntry | null> {
    const { firestore } = useFirebase()
    const ref = doc(firestore, 'firings', id)
    const snap = await getDoc(ref)
    return snap.exists() ? ({ id: snap.id, ...(snap.data() as FiringDoc) }) : null
  }

  function watchFiring(id: string, cb: (firing: FiringEntry | null) => void): Unsubscribe {
    const { firestore } = useFirebase()
    return onSnapshot(doc(firestore, 'firings', id), (snap) => {
      cb(snap.exists() ? ({ id: snap.id, ...(snap.data() as FiringDoc) }) : null)
    })
  }

  return {
    inProgress: computed(() => inProgressState.value.list),
    inProgressLoading: computed(() => inProgressState.value.loading),
    openElectricFiring,
    closeElectricFiring,
    getFiring,
    watchFiring,
  }
}
