import { CreditStatus } from '../types';

const STATUS_CONFIG: Record<CreditStatus, { label: string; color: string; bg: string }> = {
  Created:     { label: 'Emitido',     color: '#1e40af', bg: '#dbeafe' },
  Validated:   { label: 'Validado',    color: '#166534', bg: '#dcfce7' },
  Transferred: { label: 'Transferido', color: '#7c2d12', bg: '#fed7aa' },
  Retired:     { label: 'Aposentado',  color: '#374151', bg: '#e5e7eb' },
  Rejected:    { label: 'Rejeitado',   color: '#991b1b', bg: '#fee2e2' },
};

interface Props {
  status: CreditStatus;
}

export function StatusBadge({ status }: Props) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.Created;
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '2px 10px',
        borderRadius: '9999px',
        fontSize: '0.78rem',
        fontWeight: 600,
        color: cfg.color,
        backgroundColor: cfg.bg,
        border: `1px solid ${cfg.color}33`,
      }}
    >
      {cfg.label}
    </span>
  );
}
