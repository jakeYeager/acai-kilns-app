import type { FirebaseApp } from 'firebase/app'
import type { Auth } from 'firebase/auth'
import type { Firestore } from 'firebase/firestore'
import type { Functions } from 'firebase/functions'

interface FirebaseBundle {
  app: FirebaseApp
  auth: Auth
  firestore: Firestore
  functions: Functions
}

export const useFirebase = (): FirebaseBundle => {
  const { $firebase } = useNuxtApp()
  return $firebase as FirebaseBundle
}

export const useFirebaseAuth = (): Auth => useFirebase().auth
export const useFirestore = (): Firestore => useFirebase().firestore
export const useFirebaseFunctions = (): Functions => useFirebase().functions
