export default function Loading() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 1080 }}>
      <div className="ap-skeleton" style={{ height: 32, width: 200 }} />
      <div className="ap-skeleton" style={{ height: 34, width: 520 }} />
      <div className="ap-skeleton" style={{ height: 480 }} />
    </div>
  )
}
