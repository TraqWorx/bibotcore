# GHL Dash (Bibot Core)

## WHAT — Project Context

- **Project**: GHL Dash — SaaS dashboard builder for GoHighLevel agencies
- **Tech Stack**: Next.js 16 (App Router, Turbopack), TypeScript, Tailwind CSS 4, Supabase SSR auth, Stripe billing
- **Repository Structure**:
  - `app/` — Next.js App Router pages and API routes
  - `app/admin/` — Agency admin panel (role: admin)
  - `app/platform/` — Super admin god-view (role: super_admin)
  - `app/editor/[locationId]/` — Full-screen dashboard editor (opens in new window)
  - `app/embed/[locationId]/` — Embeddable dashboard for clients (no auth, token-less)
  - `app/agency/` — Agency member view (role: agency)
  - `app/designs/simfonia/` — Bibot-specific CRM design
  - `lib/` — Shared utilities, GHL client, widgets, auth, Stripe
  - `lib/widgets/` — Widget system (registry, types, components, AI prompt, CustomWidget)
  - `lib/isBibotAgency.ts` — Bibot bypass check (ID: `e7b3d0d8-5682-44d5-87c1-c449e6814f15`)
  - `supabase/migrations/` — SQL migrations (001-067)
- **Key Dependencies**: `@supabase/ssr`, `@anthropic-ai/sdk`, `stripe`, `react-grid-layout`, `swr`, `framer-motion`, `lucide-react`
- **Environment Variables**:
  - Supabase: `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - GHL: `GHL_AGENCY_TOKEN`, `GHL_COMPANY_ID`, `GHL_CLIENT_ID`, `GHL_CLIENT_SECRET`, `GHL_REDIRECT_URI`, `GHL_APP_VERSION_ID`, `WEBHOOK_SECRET`
  - SaaS Stripe: `STRIPE_SECRET_KEY`, `STRIPE_PRO_PRICE_ID`, `STRIPE_WEBHOOK_SECRET` (dashboard subscription billing)
  - GHL Stripe: `STRIPE_GHL_SECRET_KEY` (customer payment history — separate Stripe account)
  - AI: `ANTHROPIC_API_KEY`
  - App: `NEXT_PUBLIC_APP_URL`

## WHY — Architecture Principles

- **CRM data is ALWAYS from GHL API — never stored in Supabase** (except cached sync tables)
- **Server actions return `{ error: string } | undefined`** — never throw (Next.js client components can't catch thrown server action errors)
- **Bibot agency bypasses all paywalls** — use `isBibotAgency()` before any paywall check
- **Role hierarchy**: `super_admin` > `admin` > `agency` > `user`
  - `super_admin`: platform owner (info@espressotranslations.com) → `/platform`
  - `admin`: agency owner who buys subscription → `/admin`
  - `agency`: GHL team member assigned to locations → `/agency`
  - `user`: portal contact → `/portal`
- **Single plan**: $19/mo per location. No Basic/Pro split.
- **Two Stripe accounts**:
  - SaaS Stripe (`STRIPE_SECRET_KEY`) — handles $19/mo dashboard subscriptions
  - GHL Stripe (`STRIPE_GHL_SECRET_KEY`) — GHL-connected Stripe for customer payment history
- **Company vs Location tokens**: GHL OAuth may return company-level tokens (for SaaS sub-accounts like Bibot). `refreshIfNeeded` auto-detects and exchanges for location tokens via `/oauth/locationToken`.
- **OAuth URL**: Use v1 (`/oauth/chooselocation`) — v2 shows "Update" prompt for existing installs. New scopes (affiliate, etc.) are granted via `version_id`, not URL scope param.
- **Anti-patterns to avoid**:
  - Don't use `owner_user_id` lookups — use `profile.role === 'admin'` instead
  - Don't insert `role: 'client'` — use `'agency'` for GHL users, `'user'` for contacts
  - Don't query all data without agency scope — always filter by `agency_id`
  - Don't initialize Anthropic/Stripe SDKs at module level — use lazy init
  - GHL API: `/opportunities/search` uses `location_id` (snake_case), NOT `locationId`
  - GHL API: don't pass unknown query params — returns 422

## HOW — Workflows

- **Build**: `npm run build` (uses Turbopack)
- **Dev**: `npm run dev`
- **Test**: `npm test` (vitest)
- **Lint**: `eslint . --fix`
- **Migrations**: `npx supabase db push` (runs against remote Supabase)
- **Deploy**: Push to `main` → Vercel auto-deploys
- **Commit format**: Descriptive subject line, explain why not what
- **All admin pages must have**: `export const dynamic = 'force-dynamic'` (prevents Vercel caching stale content)
- **SDK initialization**: Anthropic and Stripe SDKs must be lazy-initialized (not at module level) — use `getStripe()` and dynamic `import()` for Anthropic

## Key Patterns

- **Auth guard**: `app/admin/layout.tsx` checks `profile.role === 'admin'`
- **Bibot bypass**: `isBibotAgency(agencyId)` — check before any paywall
- **GHL token refresh**: `lib/ghl/refreshIfNeeded.ts` — auto-refreshes expired OAuth tokens AND auto-exchanges company tokens for location tokens
- **Shell theme**: `lib/simfonia/shellTheme.ts` → `resolveSimfoniaShell(theme)` — derives 11 CSS variables from primary/secondary colors
- **Widget system**: `lib/widgets/registry.ts` → `getWidgetComponent(type)` — lazy-loaded components
- **Custom widgets**: `lib/widgets/CustomWidget.tsx` — universal renderer supporting: metric, table, list, bar_chart, line_chart, pie_chart, progress, static, dropdown, tabs, cards_grid
- **Dashboard configs**: `dashboard_configs` table — stores widget layout + theme per location
- **Custom templates**: `agencies.custom_templates` — reusable AI-generated widget templates, shared across locations
- **OAuth state**: `lib/ghl/oauthState.ts` — HMAC-signed state for OAuth flows (`connect_location`, `admin_design_install`, `package_install`)
- **GHL webhooks**: `app/api/webhooks/ghl/route.ts` — handles UserCreate, UserDeleted, location.created events for auto-sync
- **Stripe webhooks**: `app/api/webhooks/stripe/route.ts` — handles checkout.session.completed, subscription updates, charge.refunded (auto-deactivates)

## Admin Nav Structure

**Main nav** (all agencies):
- Dashboard
- Locations (with count)

**Bibot-only nav**:
- Finances (costs tracking, MRR, profit)
- Affiliates (GHL affiliate manager)
- Designs (if installs exist)
- Plan Mapping (if installs exist)

**Bottom nav** (all agencies):
- Users
- Account & Billing

## User Flow (Non-Bibot)

1. Sign up (magic link) → auto-create agency + profile with `admin` role
2. Add location (enter GHL location ID)
3. Subscribe ($19/mo via Stripe checkout)
4. Connect GHL (OAuth — v1 URL)
5. Build dashboard (full-screen editor at `/editor/{locationId}` — AI chat + drag-drop)
6. Embed via `/embed/{locationId}` (GHL custom menu link from Account page)

## User Flow (Bibot)

1. Locations fetched from GHL agency token
2. Connect location via OAuth (with or without design)
3. Set plan manually for PayPal customers (auto-creates profiles for affiliate tracking)
4. Sync data via Sync Now button
5. Dashboard builder, designs, affiliates, finances all available

## Key Tables

- `profiles` — user profiles with role (super_admin, admin, agency, user) and agency_id
- `agencies` — agency accounts with billing fields, custom_templates, Stripe customer ID
- `locations` — GHL locations with agency_id, plan, dates
- `ghl_connections` — OAuth tokens per location (access_token, refresh_token, company_id)
- `agency_subscriptions` — per-location subscriptions (plan, status, Stripe sub ID, refunded_cents)
- `dashboard_configs` — widget layout + theme per location
- `agency_costs` — manual cost tracking for Finances page (monthly/annual)
- `profile_locations` — junction table linking users to locations with roles
- `ghl_plans` — GHL SaaS plan definitions (name, price)
- `installs` — design installations per location
