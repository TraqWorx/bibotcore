export default function Loading() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="ap-skeleton" style={{ height: 32, width: 240 }} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        <div className="ap-skeleton" style={{ height: 80 }} />
        <div className="ap-skeleton" style={{ height: 80 }} />
        <div className="ap-skeleton" style={{ height: 80 }} />
      </div>
      <div className="ap-skeleton" style={{ height: 480 }} />
    </div>
  )
}
