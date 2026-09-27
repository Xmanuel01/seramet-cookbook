export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="brand">
      <div className="brand-mark" aria-hidden="true">
        <img
          className="logo-light"
          src="/brand/seramet-mark-light.png"
          width="36"
          height="36"
          alt=""
        />
        <img
          className="logo-dark"
          src="/brand/seramet-mark-dark.png"
          width="36"
          height="36"
          alt=""
        />
      </div>
      {!compact && (
        <div className="brand-copy">
          <strong>SERAMET</strong>
          <span>Cookbook</span>
        </div>
      )}
    </div>
  );
}
