-- ============================================================
-- 113: Farmacia Cialdella core schema (client #2).
--
-- Clone of the Apulia DB-first pattern (see 084/095/112) adapted to a
-- pharmacy order-import domain. farmacia_contacts is the source of truth for
-- Bibot; ghl_id is filled once the sync worker pushes a contact to GHL.
-- Orders come from uploaded ShippyPro/Market Rock files (header + line items),
-- NOT a Shopify API. RLS is locked to service_role from the start — the app
-- enforces tenant isolation server-side (location-scoped queries), matching 112.
-- GHL location: JhsFebrSPpgtXzUMa2wg.
-- Idempotent.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ---------- contacts (customers) ----------
CREATE TABLE IF NOT EXISTS farmacia_contacts (
  id                          TEXT PRIMARY KEY,           -- uuid for Bibot-minted rows
  ghl_id                      TEXT,                       -- GHL contact id, null until synced
  email                       TEXT,
  phone                       TEXT,
  phone_norm                  TEXT,                       -- normalized dedup key (+39…)
  first_name                  TEXT,
  last_name                   TEXT,
  tags                        TEXT[] DEFAULT '{}',
  custom_fields               JSONB  DEFAULT '{}'::jsonb,
  -- order-derived rollups
  origin_tags                 TEXT[] DEFAULT '{}',        -- amazon / ebay / online_store seen
  orders_count                INTEGER NOT NULL DEFAULT 0,
  total_spent_cents           BIGINT  NOT NULL DEFAULT 0,
  first_order_at              TIMESTAMPTZ,
  last_order_at               TIMESTAMPTZ,
  first_marketplace_order_at  TIMESTAMPTZ,
  first_online_store_order_at TIMESTAMPTZ,
  is_conversion               BOOLEAN NOT NULL DEFAULT false,
  converted_at                TIMESTAMPTZ,
  -- sync state (cloned from apulia_contacts)
  sync_status                 TEXT NOT NULL DEFAULT 'synced',
  sync_error                  TEXT,
  sync_attempts               INT  DEFAULT 0,
  sync_last_attempt_at        TIMESTAMPTZ,
  ghl_updated_at              TIMESTAMPTZ,
  cached_at                   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT farmacia_contacts_sync_status_check
    CHECK (sync_status IN ('synced','pending_create','pending_update','pending_delete','failed'))
);

CREATE UNIQUE INDEX IF NOT EXISTS farmacia_contacts_ghl_id_unique
  ON farmacia_contacts (ghl_id) WHERE ghl_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS farmacia_contacts_phone_norm_unique
  ON farmacia_contacts (phone_norm) WHERE phone_norm IS NOT NULL;
CREATE INDEX IF NOT EXISTS farmacia_contacts_email_idx       ON farmacia_contacts (lower(email));
CREATE INDEX IF NOT EXISTS farmacia_contacts_conversion_idx  ON farmacia_contacts (is_conversion) WHERE is_conversion = true;
CREATE INDEX IF NOT EXISTS farmacia_contacts_name_trgm_idx   ON farmacia_contacts USING gin (lower(coalesce(first_name,'') || ' ' || coalesce(last_name,'')) gin_trgm_ops);

-- ---------- orders (header) ----------
CREATE TABLE IF NOT EXISTS farmacia_orders (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_ext_id  TEXT NOT NULL,                            -- order id from the upload
  contact_id    TEXT REFERENCES farmacia_contacts(id) ON DELETE SET NULL,
  phone_norm    TEXT,
  channel       TEXT NOT NULL DEFAULT 'other',            -- amazon / ebay / online_store / other
  order_date    TIMESTAMPTZ,
  total_cents   BIGINT,
  currency      TEXT NOT NULL DEFAULT 'EUR',
  category      TEXT,
  status        TEXT,
  import_id     UUID,
  raw           JSONB,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS farmacia_orders_ext_id_unique ON farmacia_orders (order_ext_id);
CREATE INDEX IF NOT EXISTS farmacia_orders_contact_idx ON farmacia_orders (contact_id);
CREATE INDEX IF NOT EXISTS farmacia_orders_phone_idx   ON farmacia_orders (phone_norm);
CREATE INDEX IF NOT EXISTS farmacia_orders_channel_idx ON farmacia_orders (channel);
CREATE INDEX IF NOT EXISTS farmacia_orders_date_idx    ON farmacia_orders (order_date DESC);

-- ---------- order line items ----------
CREATE TABLE IF NOT EXISTS farmacia_order_items (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id         UUID NOT NULL REFERENCES farmacia_orders(id) ON DELETE CASCADE,
  order_ext_id     TEXT,
  sku              TEXT,
  ean              TEXT,
  description      TEXT,
  qty              NUMERIC,
  unit_price_cents BIGINT,
  line_total_cents BIGINT,
  category         TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS farmacia_order_items_order_idx ON farmacia_order_items (order_id);
CREATE INDEX IF NOT EXISTS farmacia_order_items_sku_idx   ON farmacia_order_items (sku) WHERE sku IS NOT NULL;
CREATE INDEX IF NOT EXISTS farmacia_order_items_ean_idx   ON farmacia_order_items (ean) WHERE ean IS NOT NULL;

-- ---------- SKU/EAN → category map (fallback when Market Rock category absent) ----------
CREATE TABLE IF NOT EXISTS farmacia_category_map (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sku        TEXT,
  ean        TEXT,
  category   TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS farmacia_category_map_sku_unique ON farmacia_category_map (sku) WHERE sku IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS farmacia_category_map_ean_unique ON farmacia_category_map (ean) WHERE ean IS NOT NULL;

-- ---------- import history (clone of apulia_imports) ----------
CREATE TABLE IF NOT EXISTS farmacia_imports (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind             TEXT NOT NULL DEFAULT 'orders',
  filename         TEXT,
  rows_total       INTEGER,
  created          INTEGER DEFAULT 0,
  updated          INTEGER DEFAULT 0,
  orders_created   INTEGER DEFAULT 0,
  items_created    INTEGER DEFAULT 0,
  conversions      INTEGER DEFAULT 0,
  unmatched        INTEGER DEFAULT 0,
  skipped          INTEGER DEFAULT 0,
  duration_ms      INTEGER,
  status           TEXT NOT NULL DEFAULT 'completed',
  error_msg        TEXT,
  triggered_by     TEXT,
  progress_done    INTEGER,
  progress_total   INTEGER,
  last_progress_at TIMESTAMPTZ,
  summary          JSONB,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at      TIMESTAMPTZ,
  CONSTRAINT farmacia_imports_status_check CHECK (status IN ('running','completed','failed'))
);

CREATE INDEX IF NOT EXISTS farmacia_imports_created_idx ON farmacia_imports (created_at DESC);
CREATE INDEX IF NOT EXISTS farmacia_imports_running_idx ON farmacia_imports (created_at DESC) WHERE status = 'running';

-- ---------- outbound sync queue (clone of apulia_sync_queue) ----------
CREATE TABLE IF NOT EXISTS farmacia_sync_queue (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id      TEXT,
  ghl_id          TEXT,
  import_id       UUID REFERENCES farmacia_imports(id) ON DELETE SET NULL,
  action          TEXT NOT NULL,
  payload         JSONB,
  status          TEXT NOT NULL DEFAULT 'pending',
  attempts        INT  DEFAULT 0,
  last_attempt_at TIMESTAMPTZ,
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_error      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at    TIMESTAMPTZ,
  CONSTRAINT farmacia_sync_queue_action_check
    CHECK (action IN ('create','update','delete','add_tag','remove_tag','set_field')),
  CONSTRAINT farmacia_sync_queue_status_check
    CHECK (status IN ('pending','in_progress','completed','failed'))
);

CREATE INDEX IF NOT EXISTS farmacia_sync_queue_pending_idx ON farmacia_sync_queue (next_attempt_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS farmacia_sync_queue_contact_idx ON farmacia_sync_queue (contact_id) WHERE status IN ('pending','in_progress');
CREATE INDEX IF NOT EXISTS farmacia_sync_queue_import_idx  ON farmacia_sync_queue (import_id) WHERE import_id IS NOT NULL;

-- ---------- settings (kv) ----------
CREATE TABLE IF NOT EXISTS farmacia_settings (
  key        TEXT PRIMARY KEY,
  value      JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by TEXT
);

-- ---------- RLS lockdown (service_role only) — applied first, per 112 ----------
do $$
declare
  t text;
  tables text[] := array[
    'farmacia_contacts','farmacia_orders','farmacia_order_items',
    'farmacia_category_map','farmacia_imports','farmacia_sync_queue','farmacia_settings'
  ];
begin
  foreach t in array tables loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_service', t);
    execute format(
      'create policy %I on public.%I for all to service_role using (true) with check (true)',
      t || '_service', t
    );
  end loop;
end $$;
