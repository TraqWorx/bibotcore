import { notFound } from 'next/navigation'
import { getStoreBySlug } from '@/lib/apulia/stores'
import LeadForm from './_components/LeadForm'

export const dynamic = 'force-dynamic'

export const metadata = { title: 'Apulia Power — Richiedi informazioni' }

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const store = await getStoreBySlug(slug)
  if (!store || !store.active) notFound()

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(180deg, #f4f7fb 0%, #e7eef6 100%)', padding: '40px 20px' }}>
      <div style={{ maxWidth: 480, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/apulia-power-logo.webp" alt="Apulia Power" style={{ width: 96, height: 96, borderRadius: 18, background: 'white', padding: 4, boxShadow: '0 8px 24px -10px rgba(0,0,0,0.15)' }} />
          <h1 style={{ marginTop: 16, fontSize: 26, fontWeight: 800, color: '#0f2540', letterSpacing: '-0.02em' }}>Apulia Power</h1>
          <p style={{ marginTop: 4, fontSize: 14, color: '#5b6b7d' }}>{store.name}{store.city ? ` · ${store.city}` : ''}</p>
        </div>

        <div style={{ background: 'white', borderRadius: 18, padding: 24, boxShadow: '0 16px 48px -16px rgba(15, 37, 64, 0.18)', border: '1px solid #e3eaf3' }}>
          <h2 style={{ fontSize: 18, fontWeight: 800, color: '#0f2540', marginBottom: 6 }}>Lasciaci i tuoi dati</h2>
          <p style={{ fontSize: 13, color: '#5b6b7d', marginBottom: 20 }}>
            Ti ricontatteremo a breve con un&apos;offerta personalizzata gas e luce.
          </p>
          <LeadForm slug={slug} />
        </div>

        <p style={{ fontSize: 11, color: '#93a1b3', textAlign: 'center', marginTop: 16 }}>
          Inviando il modulo accetti di essere contattato da Apulia Power.
        </p>
      </div>
    </div>
  )
}
