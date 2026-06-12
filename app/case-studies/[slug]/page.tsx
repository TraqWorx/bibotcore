import Link from 'next/link'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import { CASE_STUDIES, getCaseStudy } from '../_data'

export function generateStaticParams() {
  return CASE_STUDIES.map((c) => ({ slug: c.slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const cs = getCaseStudy(slug)
  return {
    title: cs ? `${cs.name} — GHL Custom Dash case study` : 'Case study — GHL Custom Dash',
    description: cs?.tagline,
  }
}

export default async function CaseStudyPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const cs = getCaseStudy(slug)
  if (!cs) notFound()

  return (
    <div className="min-h-screen text-white" style={{ background: 'linear-gradient(160deg,#0b0026 0%,#15004d 55%,#0b0026 100%)' }}>
      <div className="pointer-events-none fixed inset-0" style={{ background: 'radial-gradient(ellipse 60% 50% at 50% 0%, rgba(0,214,232,0.10) 0%, transparent 70%)' }} />

      <div className="relative mx-auto w-full max-w-4xl px-5">
        {/* Nav */}
        <header className="flex items-center justify-between py-6">
          <Link href="/" className="flex items-center gap-3">
            <Image src="/ghlcustomdash-mark.svg" alt="GHL Custom Dash" width={32} height={32} className="h-8 w-8 rounded-lg" />
            <span className="text-sm font-bold tracking-tight">GHL Custom Dash</span>
          </Link>
          <Link href="/login" className="rounded-lg px-4 py-2 text-sm font-semibold text-white/80 transition hover:text-white" style={{ border: '1px solid rgba(255,255,255,0.16)' }}>
            Log in
          </Link>
        </header>

        {/* Hero */}
        <section className="pt-10 pb-10">
          <Link href="/#designs" className="text-xs font-semibold text-cyan-300 hover:underline">← All case studies</Link>
          <div className="mt-6 flex items-center gap-5">
            <div className="flex h-20 w-32 items-center justify-center rounded-xl bg-white/90 px-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={cs.logo} alt={cs.name} className="max-h-12 w-auto object-contain" />
            </div>
            <div>
              <h1 className="text-3xl font-black sm:text-4xl">{cs.name}</h1>
              <p className="mt-1 text-base text-white/55">{cs.tagline}</p>
            </div>
          </div>
          <p className="mt-6 max-w-2xl text-base leading-relaxed text-white/65">{cs.intro}</p>
        </section>

        {/* What we built */}
        <section className="pb-12">
          <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200">What we built</h2>
          <ul className="mt-5 space-y-3">
            {cs.did.map((d, i) => (
              <li key={i} className="flex items-start gap-3 rounded-xl p-4 text-sm leading-relaxed text-white/70" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <span className="mt-0.5 text-cyan-300">✓</span>
                <span>{d}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* Screenshots */}
        <section className="pb-16">
          <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200">Screenshots</h2>
          {cs.shots.length > 0 ? (
            <>
              <p className="mt-1 text-xs text-white/35">Real screens from the live build — data blurred for privacy.</p>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                {cs.shots.map((src, i) => (
                  <div key={i} className="overflow-hidden rounded-xl" style={{ border: '1px solid rgba(255,255,255,0.1)' }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={src} alt={`${cs.name} screenshot ${i + 1}`} className="w-full" style={{ filter: 'blur(3px)', transform: 'scale(1.05)' }} />
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="mt-5 rounded-xl p-8 text-center text-sm text-white/40" style={{ background: 'rgba(255,255,255,0.03)', border: '1px dashed rgba(255,255,255,0.14)' }}>
              Screenshots coming soon.
            </div>
          )}
        </section>

        {/* CTA */}
        <section className="flex flex-col items-center gap-4 border-t py-12 text-center" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
          <h3 className="text-xl font-black">Want something like this for your agency?</h3>
          <Link href="/login" className="rounded-xl px-6 py-3 text-sm font-semibold text-white" style={{ background: 'linear-gradient(90deg,#5B2BFF,#00D6E8)', boxShadow: '0 8px 28px rgba(91,43,255,0.45)' }}>
            Log in
          </Link>
          <p className="text-xs text-white/35">Invite-only · <a href="mailto:info@espressotranslations.com" className="text-cyan-300 hover:underline">contact us</a> to get set up.</p>
        </section>
      </div>
    </div>
  )
}
