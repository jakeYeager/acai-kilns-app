import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
  type Unsubscribe,
} from 'firebase/firestore'

export interface RefillDoc {
  kiln_id: string
  refilled_at: Timestamp
  gallons: number
  cost?: number
  burns_since_last: number
  total_minutes_since_last: number
  notes?: string
  deleted_at?: Timestamp
  created_at: Timestamp
  updated_at: Timestamp
  created_by: string
  updated_by: string
}

export interface RefillEntry extends RefillDoc {
  id: string
}

export interface NewRefillInput {
  kiln_id: string
  refilled_at: Date
  gallons: number
  cost?: number
  notes?: string
}

export const useRefills = () => {
  // Most recent refill per kiln_id — drives the in-card tank status display.
  const latestState = useState<{
    byKiln: Record<string, RefillEntry>
    loading: boolean
  }>('kilns:refills:latest', () => ({ byKiln: {}, loading: true }))

  if (import.meta.client && !(window as { __kilns_refills_wired__?: boolean }).__kilns_refills_wired__) {
    ;(window as { __kilns_refills_wired__?: boolean }).__kilns_refills_wired__ = true
    const { firestore } = useFirebase()
    const sub: Unsubscribe = onSnapshot(
      query(collection(firestore, 'tank_refills'), orderBy('refilled_at', 'desc')),
      (snap) => {
        const byKiln: Record<string, RefillEntry> = {}
        for (const d of snap.docs) {
          const data = d.data() as RefillDoc
          if (data.deleted_at) continue
          if (byKiln[data.kiln_id]) continue
          byKiln[data.kiln_id] = { id: d.id, ...data }
        }
        latestState.value = { byKiln, loading: false }
      },
      (err) => {
        console.warn('[refills] subscription error', err)
        latestState.value = { ...latestState.value, loading: false }
      }
    )
    if (import.meta.hot) import.meta.hot.dispose(() => sub())
  }

  const requireUid = () => {
    const { auth } = useFirebase()
    const uid = auth.currentUser?.uid
    if (!uid) throw new Error('not authenticated')
    return uid
  }

  // Counters are computed at write time — count burns for kilnId between
  // the previous refill (or beginning of time) and this new refill. Admins
  // can override via overrideCounters() if a late-discovered burn shifts
  // the window. Phase 7 will add a Cloud Function that auto-recomputes
  // affected refills when a burn is edited or soft-deleted.
  async function computeCountersFor(
    kilnId: string,
    refilledAt: Date
  ): Promise<{ burns_since_last: number; total_minutes_since_last: number }> {
    const { firestore } = useFirebase()
    const priorSnap = await getDocs(
      query(
        collection(firestore, 'tank_refills'),
        where('kiln_id', '==', kilnId),
        orderBy('refilled_at', 'desc'),
        limit(1)
      )
    )
    const prior = priorSnap.empty
      ? null
      : (priorSnap.docs[0]!.data() as RefillDoc).refilled_at.toDate()

    const burnsSnap = await getDocs(
      query(collection(firestore, 'burns'), where('kiln_id', '==', kilnId))
    )
    let count = 0
    let totalMinutes = 0
    for (const d of burnsSnap.docs) {
      const b = d.data() as {
        start_datetime: Timestamp
        firing_minutes?: number
        deleted_at?: Timestamp
      }
      if (b.deleted_at) continue
      const t = b.start_datetime.toDate()
      if (prior && t <= prior) continue
      if (t > refilledAt) continue
      count++
      totalMinutes += b.firing_minutes ?? 0
    }
    return { burns_since_last: count, total_minutes_since_last: totalMinutes }
  }

  async function logRefill(input: NewRefillInput): Promise<string> {
    const { firestore } = useFirebase()
    const uid = requireUid()
    const counters = await computeCountersFor(input.kiln_id, input.refilled_at)
    const docRef = await addDoc(collection(firestore, 'tank_refills'), {
      kiln_id: input.kiln_id,
      refilled_at: Timestamp.fromDate(input.refilled_at),
      gallons: input.gallons,
      ...(input.cost != null ? { cost: input.cost } : {}),
      burns_since_last: counters.burns_since_last,
      total_minutes_since_last: counters.total_minutes_since_last,
      ...(input.notes ? { notes: input.notes } : {}),
      created_at: serverTimestamp(),
      updated_at: serverTimestamp(),
      created_by: uid,
      updated_by: uid,
    })
    return docRef.id
  }

  async function getRefill(id: string): Promise<RefillEntry | null> {
    const { firestore } = useFirebase()
    const ref = doc(firestore, 'tank_refills', id)
    const snap = await getDoc(ref)
    return snap.exists() ? ({ id: snap.id, ...(snap.data() as RefillDoc) }) : null
  }

  function watchRefill(id: string, cb: (refill: RefillEntry | null) => void): Unsubscribe {
    const { firestore } = useFirebase()
    return onSnapshot(doc(firestore, 'tank_refills', id), (snap) => {
      cb(snap.exists() ? ({ id: snap.id, ...(snap.data() as RefillDoc) }) : null)
    })
  }

  async function overrideCounters(
    id: string,
    counters: { burns_since_last: number; total_minutes_since_last: number }
  ): Promise<void> {
    const { firestore } = useFirebase()
    const uid = requireUid()
    await updateDoc(doc(firestore, 'tank_refills', id), {
      burns_since_last: counters.burns_since_last,
      total_minutes_since_last: counters.total_minutes_since_last,
      updated_at: serverTimestamp(),
      updated_by: uid,
    })
  }

  return {
    latestByKiln: computed(() => latestState.value.byKiln),
    latestLoading: computed(() => latestState.value.loading),
    logRefill,
    getRefill,
    watchRefill,
    overrideCounters,
  }
}
