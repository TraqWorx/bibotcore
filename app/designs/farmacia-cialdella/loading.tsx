export default function Loading() {
  return (
    <div style={{ padding: 32, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="fc-skeleton" style={{ height: 32, width: 260 }} />
      <div className="fc-skeleton" style={{ height: 14, width: 420, marginBottom: 8 }} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 16 }}>
        {Array.from({ length: 4 }).map((_, i) => <div key={i} className="fc-skeleton" style={{ height: 88 }} />)}
      </div>
      <div className="fc-skeleton" style={{ height: 360, marginTop: 8 }} />
    </div>
  )
}
