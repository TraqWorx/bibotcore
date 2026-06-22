# Handoff — GHL Dash production-hardening (DONE)

Status as of this session: security/isolation pass **complete**. Tests 55/55, `tsc --noEmit` clean, `npm run build` green. Not committed/pushed yet.

## Core requirement delivered
**An account connected to a specific design only sees that design.**
- New shared owner gate `lib/auth/designOwner.ts` (`isBibotDesignOwner`): the bespoke Bibot client designs (Apulia Power, Farmacia) are now restricted to super_admin or Bibot-agency members. The previous bare `role === 'admin'` clause (which let ANY agency's admin read another client's customers/payments) is removed from: `lib/apulia/auth.ts`, `lib/farmacia/auth.ts`, `farmacia/settings/_actions.ts`, `farmacia/clienti/_actions.ts`.
- `getOrderItems` (was fully unauthenticated) now requires `isBibotDesignOwner`.
- Generic designs: `simfonia/layout.tsx` now filters locations to its own design slug (matches apulia-tourism). Location resolution (`getActiveLocation`) already verifies per-location ownership, and layouts validate the active-location cookie against the user's own locations — so no cross-tenant data path remains.

## Other fixes applied
- **Account takeover / cross-tenant write:** `admin/locations/[locationId]/_actions.ts` — `generateLoginLink` now uses `requireUserInAgency` (target must be in caller's agency, non-admin); `saveModuleOverrides` now uses `requireLocationOwner`.
- **Cron/drip fail-open:** new `lib/auth/cronAuth.ts` (`isCronAuthorized`, fails closed, no NODE_ENV bypass) wired into `refresh-ghl-tokens`, `sync-ghl-locations`, `sync-ghl-plans`, `messages/drip-process`.
- **GHL webhook** (`webhooks/ghl/route.ts`): now fails closed when `WEBHOOK_SECRET` unset (no env bypass).
- **Paywall bypass:** `subscription/activate` now restricted to super_admin / Bibot (free price_cents:0 grant).
- **Cross-agency disclosure:** `admin/locations/[locationId]/page.tsx` adds agency-ownership check; `addLocation` does a global ownership check before the PK upsert (prevents location hijack); `/agency/layout.tsx` adds a role guard; `/api/admin/roles` GET restricted to admin/super_admin; platform `activate/deactivateLocation` server actions now call `requireSuperAdmin` (new `lib/auth/requireSuperAdmin.ts`).
- **XSS/CSS injection:** new `lib/theme/sanitizeColor.ts` (`safeHexColor`) applied to embed + simfonia + apulia-tourism `<style>` color interpolation.
- **Farmacia (this session's commit):** `tier-sync.ts` clears the retag flag only after the work succeeds; `farmacia/sync/drain/route.ts` wraps the retag so it can't block the queue.
- **Stripe:** `syncSubscriptions.ts` uses the GHL Stripe key for GHL-account subs; `webhooks/stripe` refund handler stores `refunded_cents` absolutely (idempotent) and only acts on tracked subs.
- **Apulia money:** `markPodsPaid` validates `customAmounts` (non-negative integer cents) and dedups the POD list; `recompute.ts` rounds commission to whole cents before persist/sync.
- AI routes confirmed already adequately scoped (active-subscription join enforces ownership) — no change needed.

## Follow-up status
1. **Mark-Paid idempotency — DONE.** `markPodsPaid` now skips any POD this admin already paid in the last 15s (kills accidental double-click/retry double-pays) on top of the earlier within-request dedup + amount validation. No period-format/index change, so no money-math risk.
2. **Float→integer-cents — effectively resolved.** Commission is rounded to whole cents before persist/sync (the `36.300000000000004` symptom is gone). Remaining is internal cleanliness only, no user-visible effect.
3. **PDP re-sync resurrecting switched-out PODs — DONE.** `pdp-chunked.ts` now only reactivates a switched-out POD when the PDP file's `Inizio fornitura` is newer than the POD's `switched_out_at` (or no date recorded). Re-importing a stale PDP no longer un-switches a POD; the SWITCH_OUT tag/flag/date are preserved.

All shipped. Tests 55/55, tsc clean, build green.
