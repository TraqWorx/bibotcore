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

## Deliberately deferred (mutate money/sync in DB paths not safely testable here)
1. **Full cross-request Mark-Paid idempotency** — would need a deterministic cycle-based `period` + upsert against the partial unique index. `period` is user-displayed; risk of a money bug. Mitigated for now by within-request dedup + UI transition guard.
2. **Full float→integer-cents refactor** of the Apulia payment pipeline — did the safe rounding fix; full refactor is larger.
3. **PDP re-sync resurrecting switched-out PODs** (`lib/apulia/pdp-chunked.ts:214`) — needs PDP-file-date vs switch-out-date domain logic.

These three need DB-level testing before changing. Recommend a dedicated session with a staging DB.
