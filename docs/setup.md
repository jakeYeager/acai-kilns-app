# Setup Tasks — Outbound Checklist

Things only Jake (or a Workspace admin) can do. The code can't progress past certain phases until these land. Updated as items resolve.

`docs/implementation-plan.md` cross-references the phase that depends on each item.

---

## 1. Firebase projects

### Dev project — needed for phase 1 (deploy pipeline)

- [x] Create `acai-kilns-dev` Firebase project (Jake's personal Google account for now; transfer to `acaistudios.com` later — see plan §8)
- [x] Enable: **Authentication** (Email link + Google providers), **Firestore** (Native mode, region `us-central1`), **Cloud Functions**, **Hosting** {*I SET FIRESTORE UP IN PRODUCTION MODE*}
- [x] Project Settings → Your apps → register a Web app → copy the SDK config into `.env.local`:
  - `NUXT_PUBLIC_FIREBASE_API_KEY`
  - `NUXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
  - `NUXT_PUBLIC_FIREBASE_PROJECT_ID`
  - `NUXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
  - `NUXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
  - `NUXT_PUBLIC_FIREBASE_APP_ID`
- [x] Authentication → Sign-in method → enable **Email link (passwordless)**. *(Google is no longer required as of 2026-05-01 — admins use the same email-link flow now. Leaving Google enabled is harmless if it's already on.)*
- [x] Authentication → Settings → Authorized domains → add `localhost`, the default `*.web.app` URL, and (later) `kilns-dev.acaistudios.com` if used
- [x] Service account for GitHub Actions: Project Settings → Service accounts → Generate new private key → save the JSON locally (DO NOT commit). Add it as repo secret `FIREBASE_SERVICE_ACCOUNT_DEV`.
- [x] **Grant `Firebase Admin` IAM role to that service account.** The default `firebase-adminsdk` role only allows Admin SDK calls (auth, firestore data) — NOT deploys to `firebaserules.googleapis.com` or index management. Without this role, `firebase deploy --only firestore` returns 403. Steps:
  1. https://console.cloud.google.com/iam-admin/iam?project=acai-kilns-dev
  2. Find the `firebase-adminsdk-…@acai-kilns-dev.iam.gserviceaccount.com` row → pencil/Edit
  3. Add another role → search "Firebase Admin" → save
  4. Takes effect within seconds; rerun the failing workflow with `gh run rerun <id> --failed`
- [x] **Grant `Cloud Build Service Account` role to the Compute Engine default SA.** For projects created after April 2024, Google uses `[PROJECT_NUMBER]-compute@developer.gserviceaccount.com` as the Cloud Build service account but doesn't auto-grant it the build role. Without this, `firebase deploy --only functions` fails with "missing permission on the build service account" and the function build hangs in Cloud Build. Steps:
  1. Same IAM page as above
  2. Find the `[PROJECT_NUMBER]-compute@developer.gserviceaccount.com` row (visible in the principals list)
  3. Add another role → search "Cloud Build Service Account" → save
  4. Wait ~2 minutes for Eventarc propagation if this is the first 2nd-gen function deploy
- [x] **Grant `Service Account User` role to the firebase-adminsdk SA.** Required so CI can "act as" the function runtime SAs during a `firebase deploy --only functions`. Without it, CI deploy fails with `iam.serviceAccounts.ActAs` denied. Steps:
  1. Same IAM page
  2. Find the `firebase-adminsdk-…@acai-kilns-dev.iam.gserviceaccount.com` row → Edit
  3. Add another role → search "Service Account User" → save
- [x] **Enable the Cloud Billing API.** The functions deploy verifies the project's Blaze billing status; that check uses `cloudbilling.googleapis.com`, which is *not* auto-enabled when you upgrade to Blaze. CI deploy fails with `Cloud Billing API has not been used in project … before or it is disabled` until it's on. One click:
  1. Visit `https://console.developers.google.com/apis/api/cloudbilling.googleapis.com/overview?project=acai-kilns-dev`
  2. Click **Enable**
  3. Wait ~30s for propagation, then retry the deploy

### Prod project — needed for phase 9 (cutover)

- [ ] Create `acai-kilns-prod` Firebase project
- [ ] Repeat the dev steps above; capture config in a separate `.env.production` (only used at build time by CI)
- [ ] Repo secret `FIREBASE_SERVICE_ACCOUNT_PROD`
- [ ] Hosting → Custom domain → add `kilns.acaistudios.com`; follow Firebase's DNS verification (TXT record on `acaistudios.com`); add the A records they provide. Cert via Let's Encrypt is automatic.

---

## 2. Slack — needed for phase 6 (problems) and phase 7 (alerts/reports)

Webhooks are deferred-stubbed in the code; Slack-posting functions log payloads until these are set.

- [ ] Create channels (Jake is sole workspace admin per plan):
  - `#kiln-reports` (kiln-specific, scheduled report links)
  - `#webapp-alerts` (shared with volunteer logger; messages prefixed `[kilns]`)
  - `#kiln-tech` (problem reports + future long-open-firing alerts)
- [ ] Slack app → Incoming Webhooks → enable → create one webhook URL per channel
- [ ] Set as Cloud Function secrets:
  ```
  npx firebase-tools functions:secrets:set SLACK_WEBHOOK_KILN_REPORTS --project acai-kilns-dev
  npx firebase-tools functions:secrets:set SLACK_WEBHOOK_WEBAPP_ALERTS --project acai-kilns-dev
  npx firebase-tools functions:secrets:set SLACK_WEBHOOK_KILN_TECH    --project acai-kilns-dev
  ```
- [ ] Repeat for `--project acai-kilns-prod` once prod exists

**Bus-factor note:** Jake is the only workspace admin. If a webhook is leaked and Jake is unreachable, no rotation can happen until then. Acceptable v1; add a board backup later if it bites.

---

## 3. Cloudflare Turnstile — needed for phase 3 (auth)

- [x] Cloudflare → Turnstile → Add site → managed mode
- [x] Allowed hostnames: `localhost`, `kilns-dev.acaistudios.com` (or the dev `*.web.app`), `kilns.acaistudios.com`
- [x] Capture site key → `.env.local` as `NUXT_PUBLIC_TURNSTILE_SITE_KEY`
- [x] Capture secret key → server-only `.env.local` as `TURNSTILE_SECRET_KEY` (and as a Cloud Function secret for the verification endpoint)

---

## 4. GitHub repo settings — needed for phase 1

- [ ] **Repo secrets** (Settings → Secrets and variables → Actions → New repository secret):
  - `FIREBASE_SERVICE_ACCOUNT_DEV` — full JSON of the service account from Firebase Console (paste the entire JSON file contents)
  - `NUXT_PUBLIC_FIREBASE_API_KEY` — from Firebase Console → Web app config
  - `NUXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
  - `NUXT_PUBLIC_FIREBASE_PROJECT_ID`
  - `NUXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
  - `NUXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
  - `NUXT_PUBLIC_FIREBASE_APP_ID`
  - `NUXT_PUBLIC_TURNSTILE_SITE_KEY`
- [ ] **Repo variables** (Settings → Secrets and variables → Actions → Variables tab):
  - `FIREBASE_PROJECT_DEV=acai-kilns-dev` (workflow defaults to this if unset)
  - `NUXT_PUBLIC_APP_URL` (e.g. `https://acai-kilns-dev.web.app`)
- [ ] **For prod** (later, phase 9): same set of secrets prefixed `PROD_` plus `FIREBASE_SERVICE_ACCOUNT_PROD`, plus repo variable `FIREBASE_PROJECT_PROD=acai-kilns-prod`
- [ ] (Optional) Branch protection on `main`: require PR + green checks before merge. Defer until a second contributor exists.

## 4a. Local dev tooling — Java for Firestore emulator

The Firestore emulator requires Java 11+. Auth and Functions emulators do not.

**Without brew** — download the Temurin (Eclipse Adoptium) `.pkg` installer:

1. Visit https://adoptium.net/temurin/releases/?version=17&os=mac&package=jdk
2. Pick **JDK 17 LTS · macOS · aarch64 · .pkg** (or `x64` if Intel)
3. Double-click the downloaded file to install. It registers Java on `PATH` automatically.
4. Verify in a new terminal:

   ```sh
   java -version   # should print "openjdk version 17.x" or similar
   ```

Auth-only emulator can run without Java (`npx firebase emulators:start --only auth`), useful for the email-link flow before Firestore work begins (phase 3).

## 4b. Firebase CLI

Already installed locally as a project dev dependency. Use it via:

```sh
npx firebase <command>     # e.g. npx firebase login
npm run emulators          # convenience wrapper that imports/exports emulator state
```

No global install needed. If you do want it globally for convenience and don't want to use `npm install -g`, there's a standalone macOS binary at https://firebase.tools/bin/macos/latest.

## 4c. Seeding lookups against the dev project (one-time)

After phase 2 deploys rules + indexes, the `kilns`, `firing_types`, and `programs` collections are empty. Seed once:

```sh
GOOGLE_APPLICATION_CREDENTIALS=../googlie-mooglie/acai-kilns-dev-firebase-adminsdk-fbsvc-2a56e5b0d8.json \
GCLOUD_PROJECT=acai-kilns-dev \
  node scripts/seed.mjs
```

Idempotent — safe to re-run. Subsequent edits to lookups happen via `/admin` (phase 10) without redeployment.

---

## 5. Nonprofit credits — verify before billing turns on

- [ ] With the ED / Workspace admin: confirm Google for Nonprofits is active for `acaistudios.com`
- [ ] Confirm Cloud nonprofit credits ($10K/year typical) — apply to the Firebase billing account
- [ ] Note: at expected volumes the app costs effectively $0 anyway, but apply the credit if available

---

## 6. Future ownership transfer (parked)

Initial dev runs under Jake's personal Google account. Once the app has soaked, transfer the Firebase projects to an `acaistudios.com`-owned GCP organization. Non-trivial: recreating IAM, re-issuing the service account, re-pointing custom domain. Plan to do it once, deliberately, after v1 is stable. Not blocking anything in the build.

---

## Status snapshot (update as completed)

| Item | Status |
|---|---|
| Dev Firebase project | 🟡 Outstanding |
| Prod Firebase project | 🟡 Outstanding |
| Slack channels + webhooks | 🟡 Outstanding |
| Turnstile site | 🟡 Outstanding |
| GitHub secrets | 🟡 Outstanding |
| Nonprofit credits verification | 🟡 Outstanding |
| Custom domain DNS for prod | 🟡 Outstanding (defer to phase 9) |
| Kiln Fire roadmap confirmation | ✅ Done 2026-04-30 |
