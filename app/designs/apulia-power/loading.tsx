export default function Loading() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="ap-skeleton" style={{ height: 36, width: 280 }} />
      <div className="ap-skeleton" style={{ height: 14, width: 420, marginBottom: 16 }} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        <div className="ap-skeleton" style={{ height: 92 }} />
        <div className="ap-skeleton" style={{ height: 92 }} />
        <div className="ap-skeleton" style={{ height: 92 }} />
        <div className="ap-skeleton" style={{ height: 92 }} />
      </div>
      <div className="ap-skeleton" style={{ height: 320 }} />
    </div>
  )
}
