import { initializeApp, getApps, type FirebaseApp } from 'firebase/app'
import { getAuth, connectAuthEmulator, type Auth } from 'firebase/auth'
import { getFirestore, connectFirestoreEmulator, type Firestore } from 'firebase/firestore'
import { getFunctions, connectFunctionsEmulator, type Functions } from 'firebase/functions'

export default defineNuxtPlugin(() => {
  const config = useRuntimeConfig()
  const fb = config.public.firebase as Record<string, string>

  const app: FirebaseApp = getApps()[0] ?? initializeApp({
    apiKey: fb.apiKey,
    authDomain: fb.authDomain,
    projectId: fb.projectId,
    storageBucket: fb.storageBucket,
    messagingSenderId: fb.messagingSenderId,
    appId: fb.appId,
  })

  const auth: Auth = getAuth(app)
  const firestore: Firestore = getFirestore(app)
  const functions: Functions = getFunctions(app)

  if (config.public.useEmulators) {
    connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
    connectFirestoreEmulator(firestore, '127.0.0.1', 8080)
    connectFunctionsEmulator(functions, '127.0.0.1', 5001)
  }

  return {
    provide: {
      firebase: { app, auth, firestore, functions },
    },
  }
})
