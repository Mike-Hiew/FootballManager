export function Crest({ size }: { size?: number }) {
  return (
    <div className="crest" aria-hidden="true" style={size ? { width: size, height: size } : undefined}>
      <i style={{ top: 14, left: 12 }} />
      <i style={{ top: 26, left: 27, width: 4, height: 4 }} />
      <i style={{ top: 12, left: 31, width: 3, height: 3 }} />
    </div>
  );
}

export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="auth">
      <div className="auth-card">
        <div className="auth-brand">
          <Crest />
          <div>
            <b>{process.env.APP_NAME ?? 'Đom Đóm FC'}</b>
            <span>Quản lý đội bóng phong trào</span>
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}
