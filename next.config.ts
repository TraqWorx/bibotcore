import type { NextConfig } from 'next'

// Bibot moved to its own deployment. These send its users, embeds and
// integrations there instead of this SaaS app.
const BIBOT = 'https://core.bibotcrm.it'

const BIBOT_LOCATION_IDS = [
  'VtNhBfleEQDg0KX4eZqY', 'tA7J5VmWkR7ANciRX7Em', '38lvVkcTVVRFDDcHqYd1', 'A9OQOsWw1io1F7vu8t5n',
  '7PhKbXUjN02tDQuNQ2uP', 'dITdGrhNXixE4CBwDfjo', 'J1mcBtsCeCN2MCVPyucc', 'gHljo9VTIrNxCIlz9zTf',
  'qMNx5UwNa4l3cQdu1MJn', 'jLONy5q50OI63ZyciclW', 'BpCMepusuF9jYFpBIhG6', 'SbwHlByYwMSXSgQYO5du',
  'oVpcXrcMoHsWxQ6MUxCK', 'XpIp7h8jzIAHnVkkHvWE', '3f7jC8Xtj9BI1GMzsuC5', 'JhsFebrSPpgtXzUMa2wg',
  'EuPaSwuw52ZVXIjqWFyQ', 'kNTU8OedyCliO0Nj2BEV', 'edQBBus3uRO7lFxrJm34', '8PACD1aAl9kzyxgaAv8P',
  'j8gvQnd081sUKEDfuFc9', 'ekM93qgaYcEQCUAU6EDl',
]

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },
  async redirects() {
    // Loaded by the Bellessere GHL service menu's custom code. Never remove.
    const widget = ['/bellessere-widget.js', '/bellessere-widget.css'].map((source) => ({
      source, destination: `${BIBOT}${source}`, permanent: true,
    }))
    const perLocation = BIBOT_LOCATION_IDS.flatMap((id) => [
      { source: `/embed/${id}`, destination: `${BIBOT}/embed/${id}`, permanent: false },
      { source: `/editor/${id}`, destination: `${BIBOT}/editor/${id}`, permanent: false },
      { source: `/portal/${id}/:path*`, destination: `${BIBOT}/portal/${id}/:path*`, permanent: false },
      { source: `/portal/${id}`, destination: `${BIBOT}/portal/${id}`, permanent: false },
    ])
    const bibotOnly = [
      '/designs/:path*', '/scope/:path*', '/apulia/:path*',
      '/api/apulia/:path*', '/api/apulia-dashboard/:path*', '/api/farmacia/:path*', '/api/bellessere/:path*',
      '/api/webhooks/stripe-ghl',
      '/bellessere-logo.png', '/bellessere-manifest.json',
      '/bellessere-icon-180.png', '/bellessere-icon-192.png', '/bellessere-icon-512.png',
    ].map((source) => ({ source, destination: `${BIBOT}${source}`, permanent: false }))
    return [...widget, ...perLocation, ...bibotOnly]
  },
}

export default nextConfig
