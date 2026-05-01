# ACAI Kilns App

Mobile-first kiln firing logger for **ACAI Studios & Gallery** (a ceramics studio nonprofit). Hosted at `kilns.acaistudios.com` (Firebase Hosting).

Stack: Nuxt 3 SPA + Nuxt UI + Firebase (Auth + Firestore + Functions + Hosting). Auth is email-link (passwordless) against an admin-curated members roster; admins use Google Sign-In.

This is a public repo — all secrets live in `.env` (gitignored) or Firebase Secret Manager. See `docs/setup.md` (internal) for environment provisioning.

## Prerequisites

- **Node 22** — pinned via `.nvmrc`. With nvm: `nvm install` (reads `.nvmrc`).
- **Java 11+** — required for the Firestore emulator. Skip if you only need Auth + Functions emulators.

  Download the Temurin (Eclipse Adoptium) `.pkg` installer for macOS from
  https://adoptium.net/temurin/releases/?version=17&os=mac&package=jdk — pick **JDK 17 LTS, .pkg**, double-click to install. No brew required.

- **A `.env` file** at the repo root. Start by copying `env.example`:

  ```sh
  cp env.example .env
  ```

  For local emulator development, `.env` can use placeholder values for the Firebase keys — see `env.example`. Real keys are only needed when pointing at a real Firebase project.

## Development

```sh
nvm use            # switch to Node 22
npm install
npm run dev        # nuxt dev on http://localhost:3000
```

In a second terminal, start the Firebase Local Emulator Suite:

```sh
npm run emulators       # auth + firestore + functions + hosting + UI
# or, without Java:
npx firebase emulators:start --only auth,functions
```

Emulator UI: http://localhost:4000

## Seeding lookups

The `kilns`, `firing_types`, and `programs` collections are admin-extensible at runtime, but the app expects them to exist. To seed the emulator:

```sh
# (in another terminal, with emulator already running)
npm run seed:emulator
```

Idempotent — re-running updates fields without duplicating docs. To seed a real Firebase project:

```sh
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json \
GCLOUD_PROJECT=acai-kilns-dev \
  node scripts/seed.mjs
```

## Tests

```sh
npm run test:rules    # spawns its own Firestore emulator and runs vitest
```

## Build

```sh
npm run generate   # static SPA build into .output/public/
```

This is what the GitHub Actions deploy workflow runs. Output is what Firebase Hosting serves.

## Deployment

- **Dev** — push to `main`. GitHub Actions builds and deploys to the `acai-kilns-dev` Firebase project.
- **Prod** — push a tag matching `v*` (e.g. `v1.0.0`). Deploys to `acai-kilns-prod` and serves from `kilns.acaistudios.com`.

CI is configured in `.github/workflows/`. See `docs/setup.md` for the secrets and variables it needs.

## Project layout

```
app/                   Nuxt 4 source layout
  app.vue              Root component
  pages/               File-based routes
  layouts/             Layouts
  components/          Auto-imported components (added in later phases)
  composables/         Auto-imported composables (incl. useFirebase)
  plugins/             Nuxt plugins (incl. firebase.client.ts)
functions/             Firebase Cloud Functions (TypeScript)
firebase.json          Hosting + Firestore + Functions + emulator config
firestore.rules        Security rules (committed — security boundary, not secret)
firestore.indexes.json Composite indexes
.firebaserc            Project alias map (acai-kilns-dev / acai-kilns-prod)
.github/workflows/     CI (build + deploy)
```

The `docs/` directory holds internal planning/tracking documents. It is **gitignored** — the architectural source of truth for any contributor is this README plus the code itself.

## Help

Issues with Claude Code? `/help` from the CLI. Project-specific feedback: open an issue.
