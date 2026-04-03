'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { aiGenerateInsight } from '@/lib/ai/actions'
import { sf } from '@/lib/simfonia/ui'

interface Message {
  role: 'user' | 'ai'
  text: string
}

export default function AiChat({ locationId }: { locationId: string }) {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Draggable position
  const [pos, setPos] = useState(() => ({
    x: 270,
    y: typeof window === 'undefined' ? 700 : window.innerHeight - 80,
  }))
  const dragging = useRef(false)
  const dragOffset = useRef({ x: 0, y: 0 })

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (open) return // Don't drag when chat is open
    dragging.current = true
    dragOffset.current = { x: e.clientX - pos.x, y: e.clientY - pos.y }
    e.preventDefault()
  }, [pos, open])

  useEffect(() => {
    function handleMouseMove(e: MouseEvent) {
      if (!dragging.current) return
      setPos({ x: e.clientX - dragOffset.current.x, y: e.clientY - dragOffset.current.y })
    }
    function handleMouseUp() { dragging.current = false }
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [])

  useEffect(() => {
    if (open) messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, open])

  async function handleSend() {
    if (!input.trim() || loading) return
    const question = input.trim()
    setInput('')
    setMessages((prev) => [...prev, { role: 'user', text: question }])
    setLoading(true)
    const result = await aiGenerateInsight(locationId, question)
    setMessages((prev) => [...prev, { role: 'ai', text: result.insight ?? result.error ?? 'Nessuna risposta' }])
    setLoading(false)
  }

  return (
    <>
      {/* Draggable floating button */}
      <div
        style={{ position: 'fixed', left: pos.x, top: pos.y, zIndex: 50, cursor: open ? 'pointer' : 'grab' }}
        onMouseDown={handleMouseDown}
      >
        <button
          onClick={() => setOpen(!open)}
          className="flex h-14 w-14 items-center justify-center rounded-full text-white shadow-[0_12px_40px_-8px_color-mix(in_srgb,var(--brand)_55%,transparent)] ring-2 ring-white/30 transition hover:brightness-110"
          style={{ background: 'linear-gradient(145deg, var(--brand) 0%, color-mix(in srgb, var(--brand) 65%, #6366f1) 100%)' }}
          title="Chiedi all'AI"
        >
          {open ? (
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
            </svg>
          )}
        </button>
      </div>

      {/* Chat panel — clamped to stay on screen */}
      {open && (
        <div
          style={{
            position: 'fixed',
            left: Math.max(0, Math.min(pos.x - 340, (typeof window !== 'undefined' ? window.innerWidth : 1200) - 390)),
            top: Math.min(pos.y + 60, (typeof window !== 'undefined' ? window.innerHeight : 800) - 510),
            zIndex: 50,
          }}
          className={`flex h-[500px] w-[380px] flex-col overflow-hidden ${sf.inbox} shadow-2xl`}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-gray-200/70 bg-white/80 px-5 py-4 backdrop-blur-md">
            <div className="flex items-center gap-3">
              <div
                className="flex h-9 w-9 items-center justify-center rounded-xl text-white shadow-sm"
                style={{ background: 'linear-gradient(145deg, var(--brand) 0%, color-mix(in srgb, var(--brand) 70%, #6366f1) 100%)' }}
              >
                <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-bold text-gray-900">AI assistant</p>
                <p className="text-[10px] text-gray-500">Interroga i dati della location</p>
              </div>
            </div>
            <button type="button" onClick={() => setOpen(false)} className="rounded-xl p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 space-y-3 overflow-y-auto bg-gradient-to-b from-gray-50/40 to-white/30 p-4">
            {messages.length === 0 && !loading && (
              <div className="flex h-full items-center justify-center">
                <div className="text-center">
                  <p className="text-sm text-gray-400">Ciao! Come posso aiutarti?</p>
                  <div className="mt-3 space-y-1.5">
                    {[
                      'Quanti contatti abbiamo?',
                      'Qual è il valore totale della pipeline?',
                      'Chi ha più contatti assegnati?',
                    ].map((q) => (
                      <button
                        key={q}
                        onClick={() => setInput(q)}
                        className="block w-full rounded-xl border border-gray-200/80 bg-white/80 px-3 py-2.5 text-left text-xs font-medium text-gray-600 shadow-sm transition hover:border-brand/25 hover:bg-white"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-2.5 shadow-sm ${
                    m.role === 'user' ? 'text-white' : 'border border-gray-200/80 bg-white text-gray-800'
                  }`}
                  style={m.role === 'user' ? { background: 'linear-gradient(135deg, var(--brand), color-mix(in srgb, var(--brand) 75%, #6366f1))' } : undefined}
                >
                  <p className="text-sm whitespace-pre-wrap">{m.text}</p>
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="rounded-2xl bg-gray-100 px-4 py-3">
                  <div className="flex items-center gap-1.5">
                    <span className="h-2 w-2 animate-bounce rounded-full bg-gray-400" style={{ animationDelay: '0ms' }} />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-gray-400" style={{ animationDelay: '150ms' }} />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-gray-400" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="border-t border-gray-200/70 bg-white/90 p-3 backdrop-blur-md">
            <div className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder="Chiedi qualcosa..."
                className={`flex-1 px-4 py-2.5 text-sm ${sf.input}`}
              />
              <button
                type="button"
                onClick={handleSend}
                disabled={loading || !input.trim()}
                className="rounded-2xl bg-brand px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:brightness-110 disabled:opacity-40"
              >
                Invia
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
