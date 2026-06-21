interface Props {
  title: string;
  value: string | number;
  subtitle?: string;
  color?: string;
}

export function StatCard({ title, value, subtitle, color = '#15803d' }: Props) {
  return (
    <div style={{
      background: '#fff',
      borderRadius: '10px',
      padding: '20px',
      boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
      borderTop: `4px solid ${color}`,
      minWidth: '140px',
      flex: '1 1 140px',
    }}>
      <div style={{ fontSize: '0.78rem', color: '#6b7280', marginBottom: '6px', fontWeight: 500 }}>{title}</div>
      <div style={{ fontSize: '2rem', fontWeight: 700, color }}>{value}</div>
      {subtitle && <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '4px' }}>{subtitle}</div>}
    </div>
  );
}
