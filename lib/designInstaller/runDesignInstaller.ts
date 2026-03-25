import { createAdminClient } from '@/lib/supabase-server'
import { getGhlTokenForLocation } from '@/lib/ghl/getGhlTokenForLocation'

// ── Config schema ─────────────────────────────────────────────────────────────

export interface DesignConfig {
  pipelines?: Array<{
    name: string
    stages: string[]
  }>
  tags?: string[]
  customFields?: Array<{
    name: string
    /** GHL dataType values */
    dataType: 'TEXT' | 'LARGE_TEXT' | 'NUMERICAL' | 'PHONE' | 'MONETORY' | 'CHECKBOX' | 'DATE' | 'DROPDOWN' | 'RADIO'
  }>
}

// ── Internal GHL request helper ───────────────────────────────────────────────

function makeRequester(token: string) {
  return async function ghl(
    path: string,
    init: RequestInit = {},
    version = '2021-07-28'
  ): Promise<Record<string, unknown>> {
    const res = await fetch(`https://services.leadconnectorhq.com${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        Version: version,
        'Content-Type': 'application/json',
        ...(init.headers ?? {}),
      },
    })

    if (!res.ok) {
      const text = await res.text()
      throw new Error(`GHL ${init.method ?? 'GET'} ${path} → ${res.status}: ${text}`)
    }

    return res.json()
  }
}

// ── Main installer ─────────────────────────────────────────────────────────────

/**
 * Reads the design_configs entry for designSlug and provisions the GHL location:
 * pipelines + stages, tags, and optional custom fields.
 * Skips any resource that already exists by name.
 * Tracks install_status: 'installing' → 'installed' | 'failed'.
 * Never throws — failures are recorded to installs.install_log.
 */
export async function runDesignInstaller(
  locationId: string,
  designSlug: string
): Promise<void> {
  const supabase = createAdminClient()

  async function setStatus(
    status: 'installing' | 'installed' | 'failed',
    log?: string
  ) {
    await supabase
      .from('installs')
      .update({
        install_status: status,
        ...(status === 'installed' ? { configured: true } : {}),
        ...(log !== undefined ? { install_log: log } : {}),
      })
      .eq('location_id', locationId)
      .eq('design_slug', designSlug)
  }

  // ── Guard: skip if already configured ─────────────────────────────────────
  const { data: install } = await supabase
    .from('installs')
    .select('configured')
    .eq('location_id', locationId)
    .eq('design_slug', designSlug)
    .single()

  if (install?.configured) {
    console.log(`[runDesignInstaller] ${locationId}/${designSlug} already configured, skipping`)
    return
  }

  // ── Mark as installing ─────────────────────────────────────────────────────
  await supabase
    .from('installs')
    .update({ install_started_at: new Date().toISOString() })
    .eq('location_id', locationId)
    .eq('design_slug', designSlug)
  await setStatus('installing')

  try {
    // ── Load config ──────────────────────────────────────────────────────────
    const { data: configRow } = await supabase
      .from('design_configs')
      .select('config')
      .eq('design_slug', designSlug)
      .single()

    if (!configRow) {
      console.log(`[runDesignInstaller] No config found for design_slug="${designSlug}", marking as configured`)
      await setStatus('installed', 'No config — nothing to provision')
      return
    }

    const config = configRow.config as DesignConfig

    // ── Load GHL token ───────────────────────────────────────────────────────
    const token = await getGhlTokenForLocation(locationId)
    const ghl = makeRequester(token)

    // ── Create pipelines ─────────────────────────────────────────────────────
    if (config.pipelines?.length) {
      const existingData = await ghl(`/opportunities/pipelines?locationId=${locationId}`)
      const existingNames = new Set<string>(
        ((existingData.pipelines ?? []) as { name: string }[]).map((p) => p.name.toLowerCase())
      )

      for (const pipeline of config.pipelines) {
        if (existingNames.has(pipeline.name.toLowerCase())) {
          console.log(`[runDesignInstaller] Pipeline "${pipeline.name}" exists, skipping`)
          continue
        }

        let pipelineId: string | undefined
        try {
          const created = await ghl('/opportunities/pipelines', {
            method: 'POST',
            body: JSON.stringify({ name: pipeline.name, locationId }),
          })
          pipelineId =
            (created.pipeline as { id?: string } | undefined)?.id ??
            (created.id as string | undefined)
        } catch (err) {
          console.error(`[runDesignInstaller] Failed to create pipeline "${pipeline.name}":`, err)
          continue
        }

        if (!pipelineId) continue

        for (let i = 0; i < pipeline.stages.length; i++) {
          try {
            await ghl(`/opportunities/pipelines/${pipelineId}/stages`, {
              method: 'POST',
              body: JSON.stringify({ name: pipeline.stages[i], position: i + 1 }),
            })
          } catch (err) {
            console.error(`[runDesignInstaller] Failed to create stage "${pipeline.stages[i]}":`, err)
          }
        }
      }
    }

    // ── Create tags ──────────────────────────────────────────────────────────
    if (config.tags?.length) {
      let existingTagNames = new Set<string>()
      try {
        const existingData = await ghl(`/contacts/tags?locationId=${locationId}`)
        existingTagNames = new Set<string>(
          ((existingData.tags ?? []) as { name: string }[]).map((t) => t.name.toLowerCase())
        )
      } catch {
        // Non-fatal
      }

      for (const tag of config.tags) {
        if (existingTagNames.has(tag.toLowerCase())) continue
        try {
          await ghl('/contacts/tags', {
            method: 'POST',
            body: JSON.stringify({ name: tag, locationId }),
          })
        } catch (err) {
          console.warn(`[runDesignInstaller] Tag "${tag}" failed:`, err)
        }
      }
    }

    // ── Create custom fields ─────────────────────────────────────────────────
    if (config.customFields?.length) {
      let existingFieldNames = new Set<string>()
      try {
        const existingData = await ghl(`/locations/${locationId}/customFields`)
        existingFieldNames = new Set<string>(
          ((existingData.customFields ?? []) as { name: string }[]).map((f) => f.name.toLowerCase())
        )
      } catch {
        // Non-fatal
      }

      for (const field of config.customFields) {
        if (existingFieldNames.has(field.name.toLowerCase())) continue
        try {
          await ghl('/locations/customFields', {
            method: 'POST',
            body: JSON.stringify({ name: field.name, dataType: field.dataType, locationId }),
          })
        } catch (err) {
          console.warn(`[runDesignInstaller] Custom field "${field.name}" failed:`, err)
        }
      }
    }

    // ── Mark as installed ────────────────────────────────────────────────────
    await supabase
      .from('installs')
      .update({ install_completed_at: new Date().toISOString() })
      .eq('location_id', locationId)
      .eq('design_slug', designSlug)
    await setStatus('installed')
    console.log(`[runDesignInstaller] ✓ ${locationId}/${designSlug} installed`)

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    await supabase
      .from('installs')
      .update({ last_error: message })
      .eq('location_id', locationId)
      .eq('design_slug', designSlug)
    await setStatus('failed', message)
    console.error(`[runDesignInstaller] ✗ ${locationId}/${designSlug} failed:`, message)
  }
}
