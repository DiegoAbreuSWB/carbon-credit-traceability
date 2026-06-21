import { Link } from 'react-router-dom';
import { useAuditLog } from '../hooks/useCredits';

const EVENT_COLOR: Record<string, string> = {
  CreditIssued: '#1d4ed8',
  CreditValidated: '#16a34a',
  CreditRejected: '#dc2626',
  CreditTransferred: '#ea580c',
  CreditRetired: '#4b5563',
};

export function Audit() {
  const { events, loading } = useAuditLog();

  const sorted = [...events].sort((a, b) => b.timestamp - a.timestamp);

  if (loading) return <div style={pageStyle}><p>Carregando auditoria...</p></div>;

  return (
    <div style={pageStyle}>
      <h1 style={h1Style}>Auditoria de Operações</h1>
      <p style={subtitleStyle}>
        Histórico completo de eventos registrados. Em modo blockchain real, cada evento corresponde a uma transação imutável.
      </p>
      <p style={{ fontSize: '0.83rem', color: '#6b7280', marginBottom: '16px' }}>
        {events.length} evento(s) total
      </p>

      <div style={{ overflowX: 'auto' }}>
        <table style={tableStyle}>
          <thead>
            <tr style={{ backgroundColor: '#f9fafb' }}>
              <th style={thStyle}>Evento</th>
              <th style={thStyle}>Crédito</th>
              <th style={thStyle}>Responsável</th>
              <th style={thStyle}>Data/Hora</th>
              <th style={thStyle}>Detalhes</th>
              <th style={thStyle}>TX Hash</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((ev, i) => (
              <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
                <td style={tdStyle}>
                  <span style={{
                    display: 'inline-block',
                    padding: '2px 8px',
                    borderRadius: '6px',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    color: '#fff',
                    backgroundColor: EVENT_COLOR[ev.eventType] ?? '#374151',
                  }}>
                    {ev.eventType}
                  </span>
                </td>
                <td style={tdStyle}>
                  <Link to={`/credits/${ev.creditId}`} style={{ color: '#15803d', fontWeight: 600, fontSize: '0.88rem' }}>
                    #{ev.creditId}
                  </Link>
                </td>
                <td style={{ ...tdStyle, fontFamily: 'monospace', fontSize: '0.78rem', color: '#374151' }}>
                  {ev.actor.length > 20 ? ev.actor.substring(0, 10) + '...' + ev.actor.slice(-6) : ev.actor}
                </td>
                <td style={{ ...tdStyle, fontSize: '0.82rem', whiteSpace: 'nowrap' }}>
                  {new Date(ev.timestamp * 1000).toLocaleString('pt-BR')}
                </td>
                <td style={{ ...tdStyle, fontSize: '0.82rem', color: '#6b7280' }}>
                  {ev.metadata || '—'}
                </td>
                <td style={{ ...tdStyle, fontFamily: 'monospace', fontSize: '0.75rem', color: '#9ca3af' }}>
                  {ev.txHash ?? '(modo simulado)'}
                </td>
              </tr>
            ))}
            {events.length === 0 && (
              <tr>
                <td colSpan={6} style={{ ...tdStyle, textAlign: 'center', color: '#9ca3af', padding: '32px' }}>
                  Nenhum evento registrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const pageStyle: React.CSSProperties = { padding: '24px', maxWidth: '1100px', margin: '0 auto' };
const h1Style: React.CSSProperties = { fontSize: '1.5rem', fontWeight: 700, color: '#111827', margin: '0 0 4px' };
const subtitleStyle: React.CSSProperties = { color: '#6b7280', marginBottom: '12px', fontSize: '0.9rem' };
const tableStyle: React.CSSProperties = { width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem', background: '#fff', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' };
const thStyle: React.CSSProperties = { padding: '10px 14px', textAlign: 'left', fontSize: '0.75rem', color: '#6b7280', fontWeight: 600, textTransform: 'uppercase' };
const tdStyle: React.CSSProperties = { padding: '10px 14px', verticalAlign: 'middle' };
