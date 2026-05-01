import { onAuthStateChanged, signOut as fbSignOut, type User } from 'firebase/auth'
import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  query,
  where,
  limit,
  type Unsubscribe,
} from 'firebase/firestore'

export interface MemberDoc {
  email: string
  display_name: string
  role: 'admin' | 'member'
  active: boolean
  training: {
    electric?: { loader?: boolean; unloader?: boolean }
    gas_propane?: { operator?: boolean }
  }
  auth_uid?: string
}

interface CurrentMemberState {
  user: User | null
  member: (MemberDoc & { id: string }) | null
  role: 'admin' | 'member' | null
  loading: boolean
  // True when we've finished probing the members collection and are sure the
  // authed user has no roster entry. Differs from `member: null` during load.
  rosterChecked: boolean
}

function emptyState(): CurrentMemberState {
  return { user: null, member: null, role: null, loading: true, rosterChecked: false }
}

export const useCurrentMember = () => {
  const state = useState<CurrentMemberState>('kilns:currentMember', () => emptyState())

  if (import.meta.client && !(window as any).__kilns_auth_wired__) {
    ;(window as any).__kilns_auth_wired__ = true

    const { auth, firestore } = useFirebase()

    let memberUnsub: Unsubscribe | null = null

    const clearMember = () => {
      if (memberUnsub) {
        memberUnsub()
        memberUnsub = null
      }
    }

    onAuthStateChanged(auth, async (user) => {
      clearMember()

      if (!user) {
        state.value = { ...emptyState(), loading: false }
        return
      }

      // Refresh ID token so any newly-set custom claims (member/admin) land
      // on this session without requiring a sign-out.
      try {
        await user.getIdToken(true)
      } catch (err) {
        console.warn('[auth] failed to refresh id token', err)
      }

      // Find the matching members doc by auth_uid first, falling back to email.
      // The auth_uid is written by onUserCreate after first signin.
      const email = user.email?.toLowerCase().trim()
      const membersCol = collection(firestore, 'members')

      const byUid = await getDocs(query(membersCol, where('auth_uid', '==', user.uid), limit(1)))
      const matchedSnap = !byUid.empty
        ? byUid.docs[0]
        : email
        ? (await getDocs(query(membersCol, where('email', '==', email), limit(1)))).docs[0]
        : undefined

      if (!matchedSnap) {
        state.value = {
          user,
          member: null,
          role: null,
          loading: false,
          rosterChecked: true,
        }
        return
      }

      // Live-subscribe so role / training changes reflect without reload.
      memberUnsub = onSnapshot(doc(firestore, 'members', matchedSnap.id), (snap) => {
        if (!snap.exists()) {
          state.value = {
            user,
            member: null,
            role: null,
            loading: false,
            rosterChecked: true,
          }
          return
        }
        const data = snap.data() as MemberDoc
        state.value = {
          user,
          member: { id: snap.id, ...data },
          role: data.role ?? 'member',
          loading: false,
          rosterChecked: true,
        }
      })
    })
  }

  const signOut = async () => {
    const { auth } = useFirebase()
    await fbSignOut(auth)
  }

  const isAuthed = computed(() => Boolean(state.value.user))
  const isAdmin = computed(() => state.value.role === 'admin')
  const isMember = computed(() => Boolean(state.value.member))
  const isOnRoster = computed(() => state.value.rosterChecked && Boolean(state.value.member))
  const isOffRoster = computed(
    () => Boolean(state.value.user) && state.value.rosterChecked && !state.value.member
  )

  return {
    state: readonly(state),
    isAuthed,
    isAdmin,
    isMember,
    isOnRoster,
    isOffRoster,
    signOut,
  }
}
