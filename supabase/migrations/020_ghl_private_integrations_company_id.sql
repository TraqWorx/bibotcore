-- Add company_id to ghl_private_integrations (required for /saas/agency-plans/:companyId)
ALTER TABLE ghl_private_integrations
  ADD COLUMN IF NOT EXISTS company_id text;
