import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useCredits } from '../hooks/useCredits';
import { StatusBadge } from '../components/StatusBadge';
import { CreditStatus } from '../types';

const ALL_STATUSES: CreditStatus[] = ['Created', 'Validated', 'Transferred', 'Retired', 'Rejected'];

export function CreditList() {
  const { credits, loading, error } = useCredits();
  const [filter, setFilter] = useState<CreditStatus | 'all'>('all');
  const [search, setSearch] = useState('');

  const filtered = credits.filter((c) => {
    const matchStatus = filter === 'all' || c.status === filter;
    const q = search.toLowerCase();
    const matchSearch = !q || c.areaName.toLowerCase().includes(q) || c.id.includes(q) || c.location.toLowerCase().includes(q);
    return matchStatus && matchSearch;
  });

  if (loading) return <div style={pageStyle}><p>Carregando créditos...</p></div>;
  if (error) return <div style={pageStyle}><p style={{ color: '#dc2626' }}>Erro: {error}</p></div>;

  return (
    <div style={pageStyle}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginBottom: '20px' }}>
        <h1 style={h1Style}>Créditos de Carbono</h1>
        <Link to="/simulator" style={{ background: '#15803d', color: '#fff', padding: '8px 18px', borderRadius: '8px', textDecoration: 'none', fontWeight: 600, fontSize: '0.9rem' }}>
          + Emitir Crédito
        </Link>
      </div>

      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '16px' }}>
        <input
          type="text"
          placeholder="Buscar por nome, ID ou localização..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '0.9rem', flex: '1 1 220px', minWidth: '180px' }}
        />
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as CreditStatus | 'all')}
          style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '0.9rem' }}
        >
          <option value="all">Todos os status</option>
          {ALL_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <p style={{ fontSize: '0.83rem', color: '#6b7280', marginBottom: '12px' }}>
        {filtered.length} crédito(s) encontrado(s)
        {filter !== 'all' && ` com status "${filter}"`}
        {search && ` contendo "${search}"`}
      </p>

      <div style={{ overflowX: 'auto' }}>
        <table style={tableStyle}>
          <thead>
            <tr style={{ backgroundColor: '#f9fafb' }}>
              <th style={thStyle}>ID</th>
              <th style={thStyle}>Área Preservada</th>
              <th style={thStyle}>Localização</th>
              <th style={thStyle}>CO₂ (t)</th>
              <th style={thStyle}>Status</th>
              <th style={thStyle}>Emissão</th>
              <th style={thStyle}>Detalhes</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => (
              <tr key={c.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                <td style={tdStyle}>#{c.id}</td>
                <td style={tdStyle} title={c.areaName}>
                  {c.areaName.length > 38 ? c.areaName.substring(0, 35) + '...' : c.areaName}
                </td>
                <td style={tdStyle}>{c.location}</td>
                <td style={tdStyle}>{c.co2Tonnes.toLocaleString('pt-BR')}</td>
                <td style={tdStyle}><StatusBadge status={c.status} /></td>
                <td style={tdStyle}>{new Date(c.issuedAt * 1000).toLocaleDateString('pt-BR')}</td>
                <td style={tdStyle}>
                  <Link to={`/credits/${c.id}`} style={{ color: '#15803d', fontWeight: 600, fontSize: '0.85rem' }}>Ver →</Link>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} style={{ ...tdStyle, textAlign: 'center', color: '#9ca3af', padding: '32px' }}>
                  Nenhum crédito encontrado com os filtros selecionados.
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
const h1Style: React.CSSProperties = { fontSize: '1.5rem', fontWeight: 700, color: '#111827', margin: 0 };
const tableStyle: React.CSSProperties = { width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem', background: '#fff', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' };
const thStyle: React.CSSProperties = { padding: '10px 14px', textAlign: 'left', fontSize: '0.75rem', color: '#6b7280', fontWeight: 600, textTransform: 'uppercase' };
const tdStyle: React.CSSProperties = { padding: '10px 14px', verticalAlign: 'middle' };
