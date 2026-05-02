# Implementation Plan — ACAI Kilns App

Tracking doc for the kiln logger build. Updated as phases complete.

`docs/plan-initial.md` is the **architectural** SoR (decisions, schema, flows). This file is the **execution** SoR (what's done, what's next, in what order).

> Posture: nights-and-weekends. Land each phase in a state that is durable across multi-week gaps — committed, deployable, with the next phase's first task sketched.

---

## Phase status legend

- ⬜ Not started
- 🟡 In progress
- ✅ Done
- ⏸ Paused / parked

---

## Phase 0 — Repo + scaffold ✅ (pending commit)

Goal: `npm run dev` boots a Nuxt 3 SPA against the Firebase emulator suite. Code committed.

- ✅ Decide tracking docs posture (initially `/docs/*` gitignored 2026-04-30; narrowed to `/docs/reference-data/` only on 2026-05-01 — `setup.md` and `implementation-plan.md` now tracked, planning snapshots moved into the ignored reference-data folder)
- ✅ Write `docs/implementation-plan.md` (this file)
- ✅ Write `docs/setup.md` (Jake's outbound checklist)
- ✅ Scaffold Nuxt 3 SPA in `app/` (Nuxt 4 layout, `compatibilityVersion: 4`): `package.json`, `nuxt.config.ts`, `app/app.vue`, `app/layouts/default.vue`, `app/pages/index.vue`, `tsconfig.json`
- ✅ Wire modules: `@nuxt/ui`, `@nuxtjs/turnstile`, `@vite-pwa/nuxt`
- ✅ `runtimeConfig` plumbed to `NUXT_PUBLIC_*` env vars per `env.example`
- ✅ Hand-rolled Firebase Nuxt plugin (`app/plugins/firebase.client.ts`) + `useFirebase`/`useFirebaseAuth`/`useFirestore`/`useFirebaseFunctions` composables. **Why not `nuxt-vuefire`:** 1.0.4 and 1.1.2 both have a Nuxt 3.13+ duplicate-middleware regression that hangs requests in dev. The custom plugin is ~30 lines and gives us full control of emulator wiring.
- ✅ Firebase project files: `firebase.json`, `firestore.rules` (default-deny stub — hardened in phase 2), `firestore.indexes.json` (empty), `functions/` TypeScript skeleton with `ping` stub
- ✅ Local emulator suite config (auth + firestore + functions + hosting + UI)
- ✅ `npm install` clean; `npm run dev` boots (Nitro: 0 errors, 0 warnings); HTTP 200 + 16ms; entry chunk serves
- ✅ Production static build (`npm run generate` → `.output/public/`) produces `index.html`, `200.html`, `_nuxt/*`, `manifest.webmanifest`, `sw.js`. 495 KB gzip total.
- ✅ Auth emulator boots cleanly (Java-free)
- ✅ Update `README.md` with dev quickstart
- ✅ Commit phase 0 (`24ef839` on 2026-04-30)

**Stack lock-ins (from this phase):**
- **Node 22** (pinned via `.nvmrc`). Node 24 is not officially supported by Nuxt; hits a `vite-node` IPC bug at Nuxt 3.21.
- **Nuxt 3.19** (`~3.19.0`). 3.13 had a `manifest-route-rule` middleware loop. 3.14 had an `@unhead/vue` `CapoPlugin` Rollup error. 3.21 has the `vite-node` IPC bug. 3.16 was the first version that didn't infinite-loop, but 3.19 is the latest pre-3.21 stable.
- **Nuxt 4 layout** (`app/`-rooted). Using `compatibilityVersion: 4` because 3.16+ defaults to it; migrating now avoids a future move.
- **Static-only build** (`nitro.preset: 'static'`). Firebase Hosting wants `index.html` + chunked assets, not a Nitro server bundle.
- **Java 11+** required for the Firestore emulator (added to `setup.md`). Auth + Functions emulators are Java-free.

**Exit criteria (met locally; awaits real Firebase project to verify end-to-end):** clean checkout → `nvm use && npm install` → `npm run dev` → page serves at localhost:3000 with no errors. Phase 1 (CI deploy) confirms the same on the real dev project.

---

## Phase 1 — Deploy pipeline + hosting verification ✅

Goal: pushing to `main` deploys to a real Firebase Hosting URL on the dev project. Custom domain pointed at the prod project later.

- ✅ `.github/workflows/deploy.yml` — build + deploy to dev on push to `main`; PR builds artifact only
- ✅ `.github/workflows/release.yml` — tagged release → prod (stub; verified live at phase 9)
- ✅ `scripts/setup-github-secrets.sh` helper — bulk-sets the 8 secrets + 3 variables from `.env`. Saves the eight-secret bootstrap from the GitHub UI.
- ✅ Dev project created (`acai-kilns-dev`); service account secret + 7 NUXT_PUBLIC_* secrets + 3 variables provisioned via the helper script.
- ✅ Push to `main` (commit `d84264a`) triggered run `25198230818`: build 37s, deploy 38s, both green.
- ✅ Live URL `https://acai-kilns-dev.web.app/` returns HTTP 200 in ~365ms with title `ACAI Kilns`.
- ⬜ Annotation cleanup (low priority): GitHub flagged `actions/checkout@v4`/`setup-node@v4`/`upload-artifact@v4` as Node 20-deprecated. Bump to v5 once available; no breakage before June 2026.
- ✅ Health-check routine `trig_01U5LsAQg8yvbgvshaYFeBap` scheduled for 2026-05-08 to verify the dev URL is still serving.

**Exit criteria met:** `git push` to `main` produces a deploy that loads cleanly on `https://acai-kilns-dev.web.app/`.

---

## Phase 2 — Firestore schema + rules + indexes ✅

Goal: rules enforce the auth model from plan §5; composite indexes deployed; seed script populates lookups.

- ✅ `firestore.rules` per plan §5 — member/admin custom claims, 24h collective edit window for firings + tank_refills, admin-only soft-delete via `deleted_at`, lookup writes admin-only, problems status transitions admin-only, hard-delete forbidden everywhere, default-deny fallback.
- ✅ `firestore.indexes.json` — six composite indexes (firings × 5 + tank_refills × 1) per plan §3.
- ✅ `scripts/seed.mjs` (firebase-admin, idempotent merge writes). Seeds 4 kilns, 3 firing_types, 2 programs. `npm run seed:emulator` for local; env-driven for real projects.
- ✅ `tests/rules.test.ts` — 23 vitest cases covering happy + denied paths per role across all collections. Run via `npm run test:rules` (wraps `firebase emulators:exec --only firestore`).
- ✅ Seed command documented in `README.md` (Seeding lookups section) + `docs/setup.md` §4c.
- ✅ Deploy workflow wires firestore: after the hosting deploy, runs `npx firebase deploy --only firestore` with the same service account.
- ✅ First deploy of rules + indexes succeeded on run `25201091733` (after granting `Firebase Admin` IAM role to the SA — documented in `setup.md` §1).
- ✅ Seed run against `acai-kilns-dev`: 4 kilns + 3 firing_types + 2 programs visible in Firebase Console.
- ✅ Post-deploy verification: `firebase firestore:indexes` matches local file; deployed ruleset (fetched via firebaserules.googleapis.com REST API with SA token) byte-matches local `firestore.rules`.

**Implementation notes worth keeping:**
- Rules are a **security** boundary, not a schema boundary. Schema validation happens in composables (phase 4+). The plan calls this trade explicitly; matching that.
- Edit window enforcement uses `request.time < resource.data.created_at + duration.value(24, 'h')` per plan §5. Soft-delete is detected via `request.resource.data.diff(resource.data).affectedKeys().hasAny(['deleted_at'])` and gated to admin only.
- Seed uses `set({ merge: true })` so re-running updates fields without duplicating; safe to wire into CI later if desired.
- The deploy job now runs `npm ci --ignore-scripts` (skips Nuxt's postinstall `prepare` step — saves ~5s; firebase-tools doesn't need a built `.nuxt`).

**Exit criteria met:** rules tests 23/23 pass; seed writes 9 docs into the emulator; build still produces valid `.output/public`. End-to-end against dev verified after next push.

---

## Phase 3 — Auth ⬜

**Revised 2026-05-01 (vs plan §5):** dropped Google Sign-In for admins; admins use the same email-link flow as members. `members.role: 'admin' | 'member'` field gates claim assignment. Reasons: every admin operation is undoable, supporting two auth paths costs more than the marginal recovery upside, and the Workspace-account-mismatch logic that rejected Google for members applies to admins too.

Phase split for nights-and-weekends:

### Phase 3a — auth backbone ✅

- ✅ `members.role: 'admin' | 'member'` schema (defaults to `'member'`). Rules unchanged (claim-based).
- ✅ `app/composables/useCurrentMember.ts` with live `onSnapshot` so role changes reflect without reload.
- ✅ `app/pages/index.vue` four-state UI: loading / authed-on-roster / authed-off-roster / unauthed-landing.
- ✅ `app/pages/verify.vue` completes the email link, falls back to manual email entry if localStorage was wiped.
- ✅ `onUserCreate` (v1 auth trigger) sets claims + writes `auth_uid` back on first signin.
- ✅ `onMemberWrite` (v2 firestore trigger) re-sets claims on role/active changes; falls back to email-lookup when admin manually creates a record for a previously-attempted-signin user.
- ✅ `scripts/bootstrap-admin.mjs` — one-shot bootstrap (creates auth user, members doc, claims).
- ✅ Deploy workflow now ships hosting + firestore + functions in one push.
- ✅ Bootstrapped Jake (`members/5ykp3VFeBixng35yShAU`, claims `{admin:true, member:true}`).
- ✅ Smoke-tested live: requested link, clicked from email (spam folder), landed on home with `admin` badge.

**Exit criteria 3a met.**

**IAM gotchas captured in `setup.md` §1** (would have repeated for prod): Firebase Admin role on adminsdk SA, Cloud Build Service Account role on Compute SA, Service Account User role on adminsdk SA, Cloud Billing API enable.

### Phase 3b — auto-invite + email sender (deferred)

Two problems share one fix: auto-invite (admin creates members doc → email goes out automatically) AND **the spam-folder problem** (Firebase's default `noreply@acai-kilns-dev.firebaseapp.com` sender has zero domain reputation, observed on Jake's 2026-05-01 first signin). Both are solved by the same Resend (or equivalent) integration with a verified `acaistudios.com` domain.

- ⬜ Pick email service (Resend recommended — 3K/mo free, modern API)
- ⬜ Verify `acaistudios.com` (or a subdomain like `mail.acaistudios.com`) for the email service
- ⬜ Cloud Function `onCreateMember` — generates link via `auth.generateSignInWithEmailLink()`, dispatches via Resend with `from: kilns@acaistudios.com`. Sets `invite_sent_at`.
- ⬜ Replace user-initiated `sendSignInLinkToEmail` (client-side, Firebase emailer) with a callable function that does the same Resend dispatch — fixes the spam-folder issue for the "send me a link" recovery path too.
- ⬜ Add email service API key to `setup.md` (new §6)

**Exit criteria 3b:** admin creates a `members/{id}` doc → new member receives a non-spam-flagged magic link from a kilns@acaistudios.com address. Existing members on link expiry get the same.

---

## Phase 4 — Electric flows A + B ✅ (deployed; pending live smoke test)

Goal: open and close electric firings end-to-end with the right pickers, validation, and edit window.

- ✅ `KilnPicker`, `ProgramPicker`, `MemberPicker` (covers loader/unloader via role prop), `DateTimePicker`, `NotesInput`, `InProgressList`
- ✅ `app/pages/firing/new.vue` — Flow A
- ✅ `app/pages/firing/[id]/close.vue` — Flow B (problem affordance hook deferred to phase 6)
- ✅ `app/pages/firing/[id]/index.vue` — read-only detail with "Close this firing" CTA
- ✅ `useFirings`, `useLookups`, `useMembers` composables (live via `onSnapshot`)
- ✅ Auto-add authed member as first loader / unloader only if they have the corresponding training flag
- ✅ Home screen: "Start a firing" button + InProgressList; off-roster + admin badge + diagnostics drawer carried over from phase 3a
- ✅ `app/middleware/auth.ts` — waits for auth state to settle before redirecting; applied to all `/firing/*` routes
- ⬜ **Live smoke test** (Jake): open → see in InProgressList → close → see in detail page
- ⬜ Edit-within-24h UI (deferred — covered in spirit by close path; admin can fix typos via Firestore Console for now)
- ⬜ `/firings` paginated list (deferred to phase 8 reporting)

**Exit criteria status:** code lives in `8fc2cb1`, deployed to `acai-kilns-dev`. End-to-end smoke happens next.

---

## Phase 5 — Raku flow D + tank refill flow E ⬜

- ⬜ `FiringTypePicker`, `OperatorsInput`, `DurationInput`
- ⬜ `pages/firing/new.vue` branches on kiln type → Flow D for raku
- ⬜ `pages/refill/new.vue` — Flow E with auto-computed `firings_since_last` + `total_minutes_since_last` (admin override)
- ⬜ `pages/refill/[id].vue` — detail + admin override
- ⬜ Cloud Function `recomputeRefillCounters` — on `firings` write/delete, recompute affected refills
- ⬜ `TankStatusTile` on `/` and `/dashboard`

**Exit criteria:** raku firing logged; refill logged; tile shows correct rolling counts.

---

## Phase 6 — Problems flow C + Slack stub ⬜

- ⬜ `ProblemForm` component
- ⬜ Flow C entry points: inline in Flow B, `/firing/[id]/problem`, out-of-band from home
- ⬜ Cloud Function `onCreateProblem` — formats the message, posts to `#kiln-repair` webhook (stub if `SLACK_WEBHOOK_KILN_REPAIR` unset; logs payload to console)
- ⬜ `has_problem` flag updated on parent firing
- ⬜ `/admin/problems` triage view (open / acknowledged / resolved)

**Exit criteria:** filing a problem on a firing flips its badge and (when webhook set) posts to `#kiln-repair`.

---

## Phase 7 — Cloud Functions hardening ⬜

- ⬜ Replace Slack stubs with real webhook calls (gated on `SLACK_WEBHOOK_*` secrets)
- ⬜ Health alert emitter (`#webapp-alerts` with `[kilns]` prefix) on uncaught function errors
- ⬜ Scheduled CSV export: `firings_YYYY-MM-DD.csv` matching existing column shape; posts link to `#kiln-reports`
- ⬜ Soft-delete cleanup helper (admin-only callable)

---

## Phase 8 — Reporting dashboard ⬜

- ⬜ `/dashboard` electric tiles: per-kiln totals, current month, longest gap
- ⬜ `/dashboard` raku tile: trailing 5-refill avg, $/firing, $/hour, gallons-per-firing
- ⬜ `/firings` paginated + filterable list

---

## Phase 9 — PWA polish + prod cutover ⬜

- ⬜ PWA manifest, icons, service worker review
- ⬜ Mobile QA pass on real phone (golden path + edge cases)
- ⬜ Custom domain `kilns.acaistudios.com` → prod project
- ⬜ One-shot historical CSV import script
- ⬜ **Cloudflare Turnstile prod site** — currently dev site is in "test mode" (always-passes widget); phase 9 cutover needs a separate Turnstile site in "managed" mode with `kilns.acaistudios.com` as the only allowed hostname.
- ⬜ Tag v1.0.0; deploy to prod

---

## Phase 10 — Admin tooling ⬜

- ⬜ `/admin` members list with training-flag toggles + invite resend
- ⬜ `/admin` lookup management (kilns, programs, firing_types)
- ⬜ Soft-delete recovery UI

---

## Deferred (v1.5 / v2 / "if requested")

Per plan §11:
- Photos in problems + L&L error-code lookup with diagnosis (v1.5)
- Long-open firing alert (v1.5; needs real timing data first)
- Daily/weekly firing summary post (v1.5)
- Tank refills CSV companion (v1.5)
- **"Mark QI" button on the running burn stopwatch** (v1.5) — while the stopwatch is running on `/burn/new`, surface a one-tap button that captures the current elapsed minute mark into the `time_to_qi` field without interrupting the timer. Removes the friction of typing while observing the kiln, and locks the data to the actual observation moment instead of a post-hoc estimate. Pairs with the page-stickiness rationale captured in the `project_burn_stopwatch_qi` memory.
- Stand-alone raku report (future)
- Tank refill Slack post (if requested)
- Email-change member-merge admin tool (v2)
- BigQuery export (revisit when repair-logs track expands)

---

## Cross-cutting reminders

- `/docs/reference-data/` is gitignored (bulky source artifacts + planning snapshots that drift). This file and `setup.md` are tracked — they're the living operational docs.
- Plan §3 `kiln_type` discriminator + `training` map are the only future-proofing that's load-bearing. Don't add more.
- 24h edit window is **collective** — any authed member, not just creator.
- Auto-add authed member as first loader/unloader/operator **only if** training flag is true. Resolved 2026-04-30.
- Slack webhooks landed for dev (2026-05-01) — `SLACK_WEBHOOK_KILN_REPORTS`, `SLACK_WEBHOOK_WEBAPP_ALERTS`, `SLACK_WEBHOOK_KILN_REPAIR` all set. Cloud Functions in phases 6-7 should still degrade to console.log when a `SLACK_WEBHOOK_*` is unset, so emulator runs and future envs without webhooks don't crash.
- Tests: Vitest for helpers + `@firebase/rules-unit-testing` for rules. No Playwright in v1.
