import {
  collection,
  onSnapshot,
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

    // Lookups are small (~4-10 docs each) so we fetch the whole collection
    // and filter/sort client-side. Avoids needing a composite index for the
    // active-filter + display-name-order combination.

    subs.push(
      onSnapshot(
        collection(firestore, 'kilns'),
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
        collection(firestore, 'programs'),
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
        collection(firestore, 'firing_types'),
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

  const byDisplay = (a: { display_name: string }, b: { display_name: string }) =>
    a.display_name.localeCompare(b.display_name)
  const byLabel = (a: { label: string }, b: { label: string }) => a.label.localeCompare(b.label)

  const electricKilns = computed(() =>
    state.value.kilns.filter((k) => k.active && k.type === 'electric').sort(byDisplay)
  )
  const gasPropaneKilns = computed(() =>
    state.value.kilns.filter((k) => k.active && k.type === 'gas_propane').sort(byDisplay)
  )
  const electricPrograms = computed(() =>
    state.value.programs.filter((p) => p.active && p.kiln_type === 'electric').sort(byLabel)
  )
  const rakuFiringTypes = computed(() =>
    state.value.firingTypes.filter((t) => t.active && t.kiln_type === 'gas_propane').sort(byLabel)
  )

  return {
    state: readonly(state),
    electricKilns,
    gasPropaneKilns,
    electricPrograms,
    rakuFiringTypes,
  }
}
