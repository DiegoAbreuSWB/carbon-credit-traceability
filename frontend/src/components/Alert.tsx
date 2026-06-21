interface Props {
  type: 'success' | 'error' | 'info';
  message: string;
  onClose?: () => void;
}

const COLORS = {
  success: { bg: '#f0fdf4', border: '#16a34a', text: '#15803d' },
  error:   { bg: '#fef2f2', border: '#dc2626', text: '#991b1b' },
  info:    { bg: '#eff6ff', border: '#2563eb', text: '#1d4ed8' },
};

export function Alert({ type, message, onClose }: Props) {
  const c = COLORS[type];
  return (
    <div style={{
      backgroundColor: c.bg,
      border: `1px solid ${c.border}`,
      borderRadius: '8px',
      padding: '12px 16px',
      color: c.text,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      fontSize: '0.9rem',
      margin: '8px 0',
    }}>
      <span>{type === 'success' ? '✓ ' : type === 'error' ? '✗ ' : 'ℹ '}{message}</span>
      {onClose && (
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: c.text, fontSize: '1rem', marginLeft: '12px' }}>×</button>
      )}
    </div>
  );
}
