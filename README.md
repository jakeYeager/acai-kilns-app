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

First-time setup (in this order — each step depends on the previous):

```sh
nvm use                                                          # 1. Node 22
npm install                                                      # 2. deps
npm run emulators                                                # 3. emulators (terminal A)
npm run seed:emulator                                            # 4. lookups (terminal B, one-shot)
npm run bootstrap-admin:emulator -- --email you@example.com --name "Your Name"  # 5. your admin row
npm run dev                                                      # 6. app on http://localhost:3000 (terminal B)
```

Order matters: the emulator must be running before `seed`/`bootstrap-admin` can write to it, and your admin row must exist before sign-in lands you anywhere except the off-roster screen.

`npm run emulators` runs the full suite (auth + firestore + functions + hosting + UI) and imports/exports state from `./.emulator-data` so seeded lookups and your admin row survive restarts. UI: http://localhost:4000.

Sign-in flow against the emulator: enter your email on the landing page, then check the **emulator UI's Auth tab** for the magic link (no email is actually sent in emulator mode) and paste it into the browser.

### Local dev troubleshooting

- **"Port 5000 is not open" on macOS** — macOS Control Center / AirPlay Receiver squats on port 5000. The Hosting emulator is mapped to **5050** in `firebase.json` to avoid this. If you still see a port collision, either change the port again or disable AirPlay Receiver in System Settings → General → AirDrop & Handoff.
- **"You're not on the roster" after signing in** — means the app reached Firestore but found no `members` doc matching your auth user. Either you skipped `bootstrap-admin:emulator`, the Firestore emulator isn't running (rerun `npm run emulators` and confirm port 8080 in `lsof -i:8080`), or you signed in with a different email than you bootstrapped.
- **Java not found** — `java -version` should report 11+. Install Temurin JDK 17 from https://adoptium.net/temurin/releases/?version=17&os=mac&package=jdk. If you only need a partial setup, `npx firebase emulators:start --only auth,functions` runs without Java — but skipping Firestore guarantees the off-roster screen.

## Seeding lookups

`npm run seed:emulator` is idempotent — re-running updates fields without duplicating docs. To seed a real Firebase project:

```sh
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json \
GCLOUD_PROJECT=acai-kilns-dev \
  node scripts/seed.mjs
```

## Tests

```sh
npm run test:rules    # spawns its own Firestore emulator and runs vitest
```

## Bootstrapping the first admin

After phase 3a is deployed, the app needs at least one `members` record with `role: 'admin'` before anyone can sign in (otherwise `onUserCreate` finds no match and the user lands on the off-roster screen). One-time:

```sh
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json \
GCLOUD_PROJECT=acai-kilns-dev \
  node scripts/bootstrap-admin.mjs --email you@example.com --name "Your Name"
```

Idempotent. Adds another admin by re-running with their email + name. Members (non-admins) get added the same way with `--role member`, but typically that goes through the `/admin` UI once phase 10 ships.

For local emulator testing:

```sh
npm run bootstrap-admin:emulator -- --email you@example.com --name "Your Name"
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
