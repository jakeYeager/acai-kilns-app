import {
  collection,
  onSnapshot,
  query,
  where,
  orderBy,
  type Unsubscribe,
} from 'firebase/firestore'

export interface KilnDoc {
  id: string
  display_name: string
  type: 'electric' | 'gas_propane'
  active: boolean
}

export interface ProgramDoc {
  id: string
  cone: string
  program: string
  label: string
  kiln_type: 'electric' | 'gas_propane'
  active: boolean
}

export interface FiringTypeDoc {
  id: string
  name: string
  label: string
  kiln_type: 'electric' | 'gas_propane'
  active: boolean
}

interface LookupsState {
  kilns: KilnDoc[]
  programs: ProgramDoc[]
  firingTypes: FiringTypeDoc[]
  loading: boolean
}

export const useLookups = () => {
  const state = useState<LookupsState>('kilns:lookups', () => ({
    kilns: [],
    programs: [],
    firingTypes: [],
    loading: true,
  }))

  if (import.meta.client && !(window as { __kilns_lookups_wired__?: boolean }).__kilns_lookups_wired__) {
    ;(window as { __kilns_lookups_wired__?: boolean }).__kilns_lookups_wired__ = true

    const { firestore } = useFirebase()
    const subs: Unsubscribe[] = []
    const flags = { kilns: false, programs: false, firingTypes: false }

    const markLoaded = (key: keyof typeof flags) => {
      flags[key] = true
      if (flags.kilns && flags.programs && flags.firingTypes) {
        state.value = { ...state.value, loading: false }
      }
    }

    subs.push(
      onSnapshot(
        query(collection(firestore, 'kilns'), where('active', '==', true), orderBy('display_name')),
        (snap) => {
          state.value = {
            ...state.value,
            kilns: snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<KilnDoc, 'id'>) })),
          }
          markLoaded('kilns')
        },
        (err) => {
          console.warn('[lookups] kilns subscription error', err)
          markLoaded('kilns')
        }
      )
    )

    subs.push(
      onSnapshot(
        query(collection(firestore, 'programs'), where('active', '==', true), orderBy('label')),
        (snap) => {
          state.value = {
            ...state.value,
            programs: snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ProgramDoc, 'id'>) })),
          }
          markLoaded('programs')
        },
        (err) => {
          console.warn('[lookups] programs subscription error', err)
          markLoaded('programs')
        }
      )
    )

    subs.push(
      onSnapshot(
        query(collection(firestore, 'firing_types'), where('active', '==', true), orderBy('label')),
        (snap) => {
          state.value = {
            ...state.value,
            firingTypes: snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<FiringTypeDoc, 'id'>) })),
          }
          markLoaded('firingTypes')
        },
        (err) => {
          console.warn('[lookups] firing_types subscription error', err)
          markLoaded('firingTypes')
        }
      )
    )
  }

  const electricKilns = computed(() => state.value.kilns.filter((k) => k.type === 'electric'))
  const gasPropaneKilns = computed(() => state.value.kilns.filter((k) => k.type === 'gas_propane'))
  const electricPrograms = computed(() => state.value.programs.filter((p) => p.kiln_type === 'electric'))
  const rakuFiringTypes = computed(() => state.value.firingTypes.filter((t) => t.kiln_type === 'gas_propane'))

  return {
    state: readonly(state),
    electricKilns,
    gasPropaneKilns,
    electricPrograms,
    rakuFiringTypes,
  }
}
