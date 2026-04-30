# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Mobile-first kiln firing logger for **ACAI Studios & Gallery** (a ceramics studio nonprofit). Replaces and enhances paper-base logging workflow.

Members open and close electric firings (LG1 / LG2 / LG3) and log raku firings + propane tank refills on a gas kiln (RK1). Members also file structured **problem reports** (controller error codes, broken bricks, lid misalignment) which post to a private Slack channel for the kiln techs to triage.

Admins manage a small curated `members` roster (with per-kiln-type training flags), the constrained vocabularies (kilns, programs, firing types), and problem triage.

**Hosted at:** `kilns.acaistudios.com` (Firebase Hosting).

## The plan is the SOR

`docs/plan-initial.md` is the canonical source of truth for architecture — twelve sections covering goals, user flows, data model, frontend, auth, reporting, Slack, deployment, Sheets-vs-Firebase trades, future tracks (repair logs, parts inventory), and a complete decision log.

If a question is answered in the plan, follow the plan. If a question isn't:
- Check `docs/answers.md` and `docs/answers-raku.md` — those record decisions made during planning, with reasoning. They are the *why* behind the plan.
- Still unanswered? Ask the user. Don't invent.

The plan was iterated through several rounds of board input. Don't re-relitigate decisions recorded as resolved.

## Stack lock-ins

These are decided.

- **Frontend:** Nuxt 3 + Nuxt UI. SPA mode (`ssr: false`). File-based routing under `pages/`. TypeScript throughout.
- **Modules:** `nuxt-vuefire` (Firebase SDK + Auth), `@nuxtjs/turnstile` (Cloudflare Turnstile), `@vite-pwa/nuxt` (PWA + offline).
- **Backend:** Firebase — Hosting + Firestore + Cloud Functions + Auth.
- **Auth:** **Email-link (passwordless) + Turnstile + long-lived session, against an admin-curated `members` roster.** No self-onboarding — only members the admins have provisioned can sign in. Admins use Google Sign-In with `admin: true` custom claim.
- **State:** Pinia or composables. No Vuex.
- **Public GitHub repo.** ACAI is a nonprofit. All org-specific values live in `.env`. Firestore rules are committed (security boundary, not secret). Service-account JSONs and Slack webhook URLs are *never* committed.

## Data model — at a glance

Four primary collections (`firings`, `members`, `problems`, `tank_refills`) and three lookups (`kilns`, `programs`, `firing_types`). Full schema in plan Section 3. Two things to internalize before writing schema code:

1. **`kiln_type` discriminator on `kilns`** — one of `electric` or `gas_propane`. Drives form behavior (electric uses two-stage Flow A→B; raku uses single-stage Flow D) and is denormalized into `firings.kiln_type` so reporting filters don't require a join.
2. **`training` map on `members`** — shape `{ electric: { loader: bool, unloader: bool }, gas_propane: { operator: bool } }`. Picker filters key off this. New kiln types add a new top-level key with their own role(s) without a schema migration. (Earlier drafts used flat booleans; we deliberately moved to the map for future-proofing — see `docs/answers-raku.md`.)

Also load-bearing:
- **Soft-delete via `deleted_at`** Timestamp. Never hard-delete.
- **Edit window:** any authed member can edit any firing within 24h of creation; admin-only after. Firestore rule sketched in plan Section 5. Deliberately collective (small studio, high trust) — `updated_by` is the only forensic trail in-window.
- **Denormalize aggressively for read efficiency** — `kiln_type` on `firings`, `display_name` snapshots in `firings.loaders[]`, `firings_since_last` and `total_minutes_since_last` on `tank_refills`. Cloud Functions recompute these on source-of-truth writes (plan Section 3 "Recompute on edit/delete").

## Conventions

- **File layout follows the component sketch in plan Section 4.** Don't reorganize without good reason.
- **No comments** unless the WHY is non-obvious. The component names and the plan together carry the *what*.
- **Default to no error handling for impossible cases.** Trust internal code and framework guarantees. Validate at system boundaries (form input, webhook payloads).
- **Don't add features the plan doesn't call for.** Don't introduce abstractions for hypothetical future kiln types — `training` map + `kiln_type` discriminator are the only future-proofing that's load-bearing.

## Kiln Fire posture (important)

Kiln Fire is the studio's customer-management SaaS (membership billing, Stripe-via-their-connector). **It is not taking on kiln operations** — confirmed 2026-04-30 via email.

Implications for this app:

- The kiln logger has **open-ended lifespan**. It is not bounded by any future Kiln Fire feature.
- Kiln Fire's published ~1-year roadmap (no committed dates): read-only APIs (Users, Memberships, Pieces, Transactions, etc.) and Zapier triggers. **No writeable APIs are promised.**
- The read-only Users API once shipped *could* complement the admin-curated `members` roster (pull a "currently subscribed?" flag). Not a v1 dependency.

**Don't propose closed-loop Kiln Fire integrations.** Don't suggest the Kiln Fire "Notes" field on their Kiln Firing feature as a substitute for this app's structured schema — Jesse mentioned it only as the extent of overlap with what some studios use today, not as a recommendation.

## Slack outputs

Three private channels (Incoming Webhooks; URLs live in Secret Manager / Functions config, never in this repo):

- `#kiln-reports` — scheduled report-link posts (when the CSV export Cloud Function finishes).
- `#webapp-alerts` — health alerts: function errors, scheduled-job failures, Firestore rule denials, deploy notifications. **Shared with the volunteer logger** — messages prefixed `[kilns]` for disambiguation.
- `#kiln-tech` — Cloud Function on `problems` document create posts a structured message here. Replaces the legacy "post a kiln photo to a generalized channel" workflow.

Webhook-only — no full Slack bot in v1. Outbound posts only, no interactive responses.

## Deployment & environments

- **Dev:** `acai-kilns-dev` Firebase project. Deploys on push to `main` via GitHub Actions.
- **Prod:** `acai-kilns-prod`. Deploys on tagged release. Custom domain `kilns.acaistudios.com` (Firebase Hosting handles SSL via Let's Encrypt).
- **Initial ownership:** Jake's personal Google account.
- **Future task:** transfer to an `acaistudios.com`-owned Firebase project + GCP organization. Non-trivial — recreating IAM, re-issuing service accounts, re-pointing the custom domain. Deliberate one-time migration after the app has soaked.

## Outstanding pre-build tasks (Jake owes these before v1 can ship)

- 🟡 Create Slack channels (`#kiln-reports`, `#webapp-alerts`, `#kiln-tech`) and Incoming Webhooks
- 🟡 Verify Google for Nonprofits + Cloud nonprofit credits with the ED / Workspace admin
- ✅ Contact Kiln Fire re: roadmap (done 2026-04-30)

## Reference data

`docs/reference-data/` contains the source artifacts that drove the schema:

- `Kiln_Logs_All.csv` — existing electric firings (~350/year). The `firings` collection mirrors its column shape so the post-launch CSV export plugs into the existing analytical pipeline without changes.
- `Kiln_Logs_Report.md` — house-style analytical report the system that is the ideal but not strict final reporting. Electric-only by construction.
- `Raku Kiln Log Example.xlsx` — input schema for raku firings + tank refills.

## Working style

When uncertain whether to build something v1 or defer it, default to defer. The plan's v1.5 / v2 / "if requested" buckets exist for exactly this reason. v1 ships when v1's surface area works — not when every nice-to-have is in.

For UI work: start the dev server and use the feature in a browser. Mobile viewport. Big tap targets. Numeric keyboards on numeric fields. The phone-with-clay-on-hands considerations in plan Section 2 are real.

## People

- **Jake** — primary owner, board member at ACAI, sole Slack workspace admin. Bus-factor risk noted — option to add a board backup later if it becomes operationally painful.
- **Kiln techs (~2)** — admin-tier; primary audience for `#kiln-tech` posts and `/admin/problems` triage.
- **Board backup (1)** — admin-tier as a bus-factor mitigation.
- **ED** — *not* in the day-to-day loop for this app. Don't propose ED-coordination tasks.
