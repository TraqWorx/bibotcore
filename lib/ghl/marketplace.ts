import { getGhlAccessToken } from './getGhlAccessToken'

const BASE_URL = 'https://services.leadconnectorhq.com'

export interface MarketplaceApp {
  appId: string
  name: string
  description?: string
  versionId?: string
}

export async function getInstalledMarketplaceApps(): Promise<MarketplaceApp[]> {
  const { accessToken } = await getGhlAccessToken()

  const res = await fetch(`${BASE_URL}/marketplace/apps`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Version: '2021-07-28',
    },
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`GHL marketplace API error: ${text}`)
  }

  const data = await res.json()
  // GHL returns `{ apps: [...] }` or `{ installedApps: [...] }` — handle both shapes
  const apps: {
    appId?: string
    id?: string
    name?: string
    description?: string
    versionId?: string
  }[] = data?.apps ?? data?.installedApps ?? []

  return apps.map((app) => ({
    appId: app.appId ?? app.id ?? '',
    name: app.name ?? '',
    description: app.description,
    versionId: app.versionId,
  })).filter((app) => app.appId && app.name)
}
