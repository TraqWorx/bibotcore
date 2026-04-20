# GHL Dash (Bibot Core)

## WHAT — Project Context

- **Project**: GHL Dash — SaaS dashboard builder for GoHighLevel agencies
- **Tech Stack**: Next.js 16 (App Router, Turbopack), TypeScript, Tailwind CSS 4, Supabase SSR auth, Stripe billing
- **Repository Structure**:
  - `app/` — Next.js App Router pages and API routes
  - `app/admin/` — Agency admin panel (role: admin)
  - `app/platform/` — Super admin god-view (role: super_admin)
  - `app/embed/` — Embeddable dashboard for clients
  - `app/agency/` — Agency member view (role: agency)
  - `app/designs/simfonia/` — Bibot-specific CRM design
  - `lib/` — Shared utilities, GHL client, widgets, auth, Stripe
  - `lib/widgets/` — Widget system (registry, types, components, AI prompt)
  - `supabase/migrations/` — SQL migrations (001-066)
- **Key Dependencies**: `@supabase/ssr`, `@anthropic-ai/sdk`, `stripe`, `react-grid-layout`, `swr`, `framer-motion`, `lucide-react`
- **Environment Variables**: `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `GHL_AGENCY_TOKEN`, `GHL_COMPANY_ID`, `GHL_CLIENT_ID`, `GHL_CLIENT_SECRET`, `GHL_REDIRECT_URI`, `STRIPE_SECRET_KEY`, `STRIPE_PRO_PRICE_ID`, `STRIPE_WEBHOOK_SECRET`, `ANTHROPIC_API_KEY`, `WEBHOOK_SECRET`

## WHY — Architecture Principles

- **CRM data is ALWAYS from GHL API — never stored in Supabase** (except cached sync tables)
- **Server actions return `{ error: string } | undefined`** — never throw (Next.js client components can't catch thrown server action errors)
- **Bibot agency (ID: `e7b3d0d8-5682-44d5-87c1-c449e6814f15`) bypasses all paywalls** — use `isBibotAgency()` from `lib/isBibotAgency.ts`
- **Role hierarchy**: `super_admin` > `admin` > `agency` > `user`
  - `super_admin`: platform owner → `/platform`
  - `admin`: agency owner who buys subscription → `/admin`
  - `agency`: GHL team member assigned to locations → `/agency`
  - `user`: portal contact → `/portal`
- **Single plan**: $19/mo per location. No Basic/Pro split.
- **Naming**: Use camelCase for variables, PascalCase for components
- **Anti-patterns to avoid**:
  - Don't use `owner_user_id` lookups — use `profile.role === 'admin'` instead
  - Don't insert `role: 'client'` — use `'agency'` for GHL users, `'user'` for contacts
  - Don't query all data without agency scope — always filter by `agency_id`
  - GHL API: `/opportunities/search` uses `location_id` (snake_case), NOT `locationId`
  - GHL API: don't pass unknown query params — returns 422
- **Error handling**: Wrap GHL API calls in try/catch. Return user-friendly errors.

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
- **GHL token refresh**: `lib/ghl/refreshIfNeeded.ts` — auto-refreshes expired OAuth tokens
- **Shell theme**: `lib/simfonia/shellTheme.ts` → `resolveSimfoniaShell(theme)` — derives 11 CSS variables from primary/secondary colors
- **Widget system**: `lib/widgets/registry.ts` → `getWidgetComponent(type)` — lazy-loaded components
- **Custom widgets**: `lib/widgets/CustomWidget.tsx` — universal renderer (metric, table, list, chart, progress, static)
- **Dashboard configs**: `dashboard_configs` table — stores widget layout + theme per location
- **Custom templates**: `agencies.custom_templates` — reusable AI-generated widget templates, shared across locations
- **OAuth state**: `lib/ghl/oauthState.ts` — HMAC-signed state for OAuth flows (`connect_location`, `admin_design_install`, `package_install`)

## User Flow (Non-Bibot)

1. Sign up (magic link) → auto-create agency + profile with `admin` role
2. Add location (enter GHL location ID)
3. Subscribe ($19/mo via Stripe checkout)
4. Connect GHL (OAuth)
5. Build dashboard (drag-drop + AI chat)
6. Embed via `/embed/{locationId}` (GHL custom menu link)
