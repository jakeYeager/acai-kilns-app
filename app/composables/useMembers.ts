import {
  collection,
  onSnapshot,
  type Unsubscribe,
} from 'firebase/firestore'
import type { MemberDoc } from './useCurrentMember'

export interface MemberSummary {
  id: string
  display_name: string
  email: string
  role: 'admin' | 'member'
  training: MemberDoc['training']
  active: boolean
}

interface MembersState {
  members: MemberSummary[]
  loading: boolean
}

export const useMembers = () => {
  const state = useState<MembersState>('kilns:members', () => ({
    members: [],
    loading: true,
  }))

  if (import.meta.client && !(window as { __kilns_members_wired__?: boolean }).__kilns_members_wired__) {
    ;(window as { __kilns_members_wired__?: boolean }).__kilns_members_wired__ = true

    const { firestore } = useFirebase()
    // Small roster (<~50). Fetch the whole collection and filter/sort
    // client-side to avoid the composite-index requirement.
    const sub: Unsubscribe = onSnapshot(
      collection(firestore, 'members'),
      (snap) => {
        state.value = {
          members: snap.docs
            .map((d) => {
              const data = d.data() as MemberDoc
              return {
                id: d.id,
                display_name: data.display_name,
                email: data.email,
                role: data.role || 'member',
                training: data.training || {},
                active: data.active !== false,
              }
            })
            .filter((m) => m.active)
            .sort((a, b) => a.display_name.localeCompare(b.display_name)),
          loading: false,
        }
      },
      (err) => {
        console.warn('[members] subscription error', err)
        state.value = { ...state.value, loading: false }
      }
    )
    if (import.meta.hot) {
      import.meta.hot.dispose(() => sub())
    }
  }

  const electricLoaders = computed(() =>
    state.value.members.filter((m) => m.training?.electric?.loader === true)
  )
  const electricUnloaders = computed(() =>
    state.value.members.filter((m) => m.training?.electric?.unloader === true)
  )
  const gasPropaneOperators = computed(() =>
    state.value.members.filter((m) => m.training?.gas_propane?.operator === true)
  )

  const byId = (id: string) => state.value.members.find((m) => m.id === id)

  return {
    state: readonly(state),
    electricLoaders,
    electricUnloaders,
    gasPropaneOperators,
    byId,
  }
}
