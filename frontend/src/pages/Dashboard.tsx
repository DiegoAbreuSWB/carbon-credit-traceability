import { useCredits } from '../hooks/useCredits';
import { getDashboardStats } from '../services/blockchainService';
import { StatCard } from '../components/StatCard';
import { StatusBadge } from '../components/StatusBadge';
import { Link } from 'react-router-dom';

export function Dashboard() {
  const { credits, loading, error } = useCredits();
  const stats = getDashboardStats(credits);

  if (loading) return <div style={pageStyle}><p style={{ color: '#6b7280' }}>Carregando dados...</p></div>;
  if (error) return <div style={pageStyle}><p style={{ color: '#dc2626' }}>Erro: {error}</p></div>;

  return (
    <div style={pageStyle}>
      <h1 style={h1Style}>Dashboard</h1>
      <p style={subtitleStyle}>
        Visão geral dos créditos de carbono registrados no protótipo acadêmico.{' '}
        <span style={{ color: '#f59e0b', fontWeight: 600 }}>⚠ Dados sintéticos para fins de pesquisa.</span>
      </p>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', marginBottom: '32px' }}>
        <StatCard title="Total de Créditos" value={stats.totalCredits} color="#15803d" />
        <StatCard title="CO₂ Equivalente" value={`${stats.totalCO2.toLocaleString('pt-BR')} t`} subtitle="toneladas simuladas" color="#0891b2" />
        <StatCard title="Áreas Preservadas" value={stats.totalAreas} subtitle="áreas distintas" color="#7c3aed" />
        <StatCard title="Emitidos" value={stats.created} color="#1d4ed8" />
        <StatCard title="Validados" value={stats.validated} color="#16a34a" />
        <StatCard title="Transferidos" value={stats.transferred} color="#ea580c" />
        <StatCard title="Aposentados" value={stats.retired} color="#4b5563" />
        <StatCard title="Rejeitados" value={stats.rejected} color="#dc2626" />
      </div>

      <h2 style={h2Style}>Últimos Créditos Registrados</h2>
      <div style={{ overflowX: 'auto' }}>
        <table style={tableStyle}>
          <thead>
            <tr style={{ backgroundColor: '#f9fafb' }}>
              <th style={thStyle}>ID</th>
              <th style={thStyle}>Área</th>
              <th style={thStyle}>CO₂ (t)</th>
              <th style={thStyle}>Status</th>
              <th style={thStyle}>Ação</th>
            </tr>
          </thead>
          <tbody>
            {credits.slice(0, 6).map((c) => (
              <tr key={c.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                <td style={tdStyle}>#{c.id}</td>
                <td style={tdStyle}>{c.areaName}</td>
                <td style={tdStyle}>{c.co2Tonnes.toLocaleString('pt-BR')}</td>
                <td style={tdStyle}><StatusBadge status={c.status} /></td>
                <td style={tdStyle}>
                  <Link to={`/credits/${c.id}`} style={{ color: '#15803d', fontSize: '0.85rem', fontWeight: 600 }}>Ver detalhes →</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ marginTop: '12px' }}>
        <Link to="/credits" style={{ color: '#15803d', fontWeight: 600, fontSize: '0.9rem' }}>
          Ver todos os créditos ({credits.length}) →
        </Link>
      </div>

      <div style={{ marginTop: '32px', padding: '16px', backgroundColor: '#f0fdf4', borderRadius: '10px', border: '1px solid #bbf7d0' }}>
        <h3 style={{ margin: '0 0 8px', fontSize: '0.9rem', color: '#15803d' }}>ℹ Glossário rápido</h3>
        <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '0.83rem', color: '#374151', lineHeight: '1.8' }}>
          <li><strong>Crédito de Carbono:</strong> unidade que representa a compensação de 1 tonelada de CO₂ equivalente.</li>
          <li><strong>Validação:</strong> processo de verificação da autenticidade e conformidade do crédito por entidade certificadora.</li>
          <li><strong>Aposentadoria:</strong> ato de retirar o crédito de circulação após uso em compensação ambiental — não pode ser revertido.</li>
          <li><strong>Contrato Inteligente:</strong> código executado automaticamente na blockchain, garantindo regras imutáveis.</li>
        </ul>
      </div>
    </div>
  );
}

const pageStyle: React.CSSProperties = { padding: '24px', maxWidth: '1100px', margin: '0 auto' };
const h1Style: React.CSSProperties = { fontSize: '1.6rem', fontWeight: 700, color: '#111827', marginBottom: '4px' };
const subtitleStyle: React.CSSProperties = { color: '#6b7280', marginBottom: '24px', fontSize: '0.9rem' };
const h2Style: React.CSSProperties = { fontSize: '1.1rem', fontWeight: 600, color: '#374151', margin: '0 0 12px' };
const tableStyle: React.CSSProperties = { width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem', background: '#fff', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' };
const thStyle: React.CSSProperties = { padding: '10px 14px', textAlign: 'left', fontSize: '0.78rem', color: '#6b7280', fontWeight: 600, textTransform: 'uppercase' };
const tdStyle: React.CSSProperties = { padding: '10px 14px', verticalAlign: 'middle' };
