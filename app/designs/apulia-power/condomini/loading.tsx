export default function Loading() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="ap-skeleton" style={{ height: 32, width: 220 }} />
      <div className="ap-skeleton" style={{ height: 14, width: 380 }} />
      <div className="ap-skeleton" style={{ height: 72 }} />
      <div className="ap-skeleton" style={{ height: 480 }} />
    </div>
  )
}
