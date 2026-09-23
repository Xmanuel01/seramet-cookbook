export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="brand">
      <div className="brand-mark" aria-hidden="true">S</div>
      {!compact && (
        <div className="brand-copy">
          <strong>Seramet</strong>
          <span>Mona Swahili Cookbook</span>
        </div>
      )}
    </div>
  )
}
