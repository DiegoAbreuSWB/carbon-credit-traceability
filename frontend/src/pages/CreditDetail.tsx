import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { CarbonCredit, CreditEvent } from '../types';
import { getCreditById, getEventsByCredit, validateCredit, rejectCredit, transferCredit, retireCredit } from '../services/blockchainService';
import { StatusBadge } from '../components/StatusBadge';
import { Alert } from '../components/Alert';

export function CreditDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [credit, setCredit] = useState<CarbonCredit | null>(null);
  const [events, setEvents] = useState<CreditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [txLoading, setTxLoading] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [transferTo, setTransferTo] = useState('');

  const reload = async () => {
    if (!id) return;
    const [c, e] = await Promise.all([getCreditById(id), getEventsByCredit(id)]);
    setCredit(c);
    setEvents(e);
    setLoading(false);
  };

  useEffect(() => { reload(); }, [id]);

  const handle = async (action: () => Promise<string>, successMsg: string) => {
    setTxLoading(true);
    setMsg(null);
    try {
      const hash = await action();
      setMsg({ type: 'success', text: `${successMsg} (tx: ${hash.substring(0, 20)}...)` });
      await reload();
    } catch (e) {
      setMsg({ type: 'error', text: e instanceof Error ? e.message : 'Erro na operação' });
    } finally {
      setTxLoading(false);
    }
  };

  if (loading) return <div style={pageStyle}><p>Carregando crédito #{id}...</p></div>;
  if (!credit) return <div style={pageStyle}><p style={{ color: '#dc2626' }}>Crédito #{id} não encontrado.</p><Link to="/credits">← Voltar</Link></div>;

  return (
    <div style={pageStyle}>
      <div style={{ marginBottom: '16px' }}>
        <Link to="/credits" style={{ color: '#15803d', fontSize: '0.88rem' }}>← Voltar para lista</Link>
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap', marginBottom: '24px' }}>
        <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: '#111827', margin: 0 }}>
          Crédito #{credit.id}
        </h1>
        <StatusBadge status={credit.status} />
      </div>

      {msg && <Alert type={msg.type} message={msg.text} onClose={() => setMsg(null)} />}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px', marginBottom: '24px' }}>
        <section style={cardStyle}>
          <h2 style={h2Style}>Informações da Área</h2>
          <Row label="Nome da Área" value={credit.areaName} />
          <Row label="Localização" value={credit.location} />
          <Row label="Coordenadas (simuladas)" value={credit.geoCoordinates} />
          <Row label="CO₂ Equivalente" value={`${credit.co2Tonnes.toLocaleString('pt-BR')} toneladas`} />
        </section>

        <section style={cardStyle}>
          <h2 style={h2Style}>Rastreabilidade</h2>
          <Row label="Emissor" value={credit.issuer} mono />
          <Row label="Proprietário Atual" value={credit.owner} mono />
          <Row label="Validador" value={credit.validator} mono />
          <Row label="Data de Emissão" value={new Date(credit.issuedAt * 1000).toLocaleString('pt-BR')} />
        </section>
      </div>

      {/* Operações */}
      {credit.status !== 'Retired' && credit.status !== 'Rejected' && (
        <section style={{ ...cardStyle, marginBottom: '24px' }}>
          <h2 style={h2Style}>Operações Disponíveis</h2>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-end' }}>

            {credit.status === 'Created' && (
              <>
                <button disabled={txLoading} onClick={() => handle(() => validateCredit(credit.id), 'Crédito validado com sucesso!')} style={btnStyle('#16a34a')}>
                  ✓ Validar Crédito
                </button>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <input
                    type="text"
                    placeholder="Motivo da rejeição"
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    style={inputStyle}
                  />
                  <button
                    disabled={txLoading || !rejectReason}
                    onClick={() => handle(() => rejectCredit(credit.id, rejectReason), 'Crédito rejeitado.')}
                    style={btnStyle('#dc2626')}
                  >
                    ✗ Rejeitar
                  </button>
                </div>
              </>
            )}

            {(credit.status === 'Validated' || credit.status === 'Transferred') && (
              <>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <input
                    type="text"
                    placeholder="Endereço do destinatário"
                    value={transferTo}
                    onChange={(e) => setTransferTo(e.target.value)}
                    style={{ ...inputStyle, width: '280px' }}
                  />
                  <button
                    disabled={txLoading || !transferTo}
                    onClick={() => handle(() => transferCredit(credit.id, transferTo), 'Crédito transferido com sucesso!')}
                    style={btnStyle('#ea580c')}
                  >
                    → Transferir
                  </button>
                </div>
                <button
                  disabled={txLoading}
                  onClick={() => handle(() => retireCredit(credit.id), 'Crédito aposentado. Não pode mais ser transferido.')}
                  style={btnStyle('#4b5563')}
                >
                  ⊘ Aposentar
                </button>
              </>
            )}
          </div>
          {txLoading && <p style={{ color: '#6b7280', fontSize: '0.85rem', marginTop: '8px' }}>Processando transação...</p>}
        </section>
      )}

      {/* Histórico de eventos */}
      <section style={cardStyle}>
        <h2 style={h2Style}>Histórico de Eventos</h2>
        {events.length === 0 ? (
          <p style={{ color: '#9ca3af' }}>Nenhum evento registrado.</p>
        ) : (
          <div style={{ position: 'relative', paddingLeft: '20px' }}>
            {events.map((ev, i) => (
              <div key={i} style={{ position: 'relative', paddingLeft: '20px', paddingBottom: '16px', borderLeft: '2px solid #d1d5db' }}>
                <div style={{
                  position: 'absolute', left: '-7px', top: '4px',
                  width: '12px', height: '12px', borderRadius: '50%',
                  backgroundColor: '#15803d', border: '2px solid #fff',
                }} />
                <div style={{ fontSize: '0.88rem', fontWeight: 600, color: '#111827' }}>{ev.eventType}</div>
                <div style={{ fontSize: '0.78rem', color: '#6b7280' }}>
                  {new Date(ev.timestamp * 1000).toLocaleString('pt-BR')}
                  {ev.actor && ` · Por: ${ev.actor.substring(0, 16)}...`}
                </div>
                {ev.metadata && <div style={{ fontSize: '0.78rem', color: '#374151', marginTop: '2px' }}>Detalhes: {ev.metadata}</div>}
                {ev.txHash && <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '2px', fontFamily: 'monospace' }}>TX: {ev.txHash}</div>}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Dados geo */}
      <section style={{ ...cardStyle, marginTop: '20px' }}>
        <h2 style={h2Style}>Localização Georreferenciada (Dados Simulados)</h2>
        <p style={{ fontSize: '0.85rem', color: '#6b7280', margin: '0 0 8px' }}>
          As coordenadas abaixo são sintéticas, usadas apenas para demonstração do protótipo.
        </p>
        <div style={{ background: '#f3f4f6', borderRadius: '8px', padding: '12px', fontFamily: 'monospace', fontSize: '0.88rem' }}>
          <div>📍 Coordenadas: <strong>{credit.geoCoordinates}</strong></div>
          <div style={{ marginTop: '4px' }}>🌳 Localização: <strong>{credit.location}</strong></div>
        </div>
      </section>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div style={{ marginBottom: '10px' }}>
      <div style={{ fontSize: '0.75rem', color: '#6b7280', fontWeight: 600, textTransform: 'uppercase', marginBottom: '2px' }}>{label}</div>
      <div style={{ fontSize: '0.88rem', color: '#111827', fontFamily: mono ? 'monospace' : undefined, wordBreak: 'break-all' }}>{value}</div>
    </div>
  );
}

const pageStyle: React.CSSProperties = { padding: '24px', maxWidth: '900px', margin: '0 auto' };
const cardStyle: React.CSSProperties = { background: '#fff', borderRadius: '10px', padding: '20px', boxShadow: '0 1px 4px rgba(0,0,0,0.07)' };
const h2Style: React.CSSProperties = { fontSize: '1rem', fontWeight: 600, color: '#374151', margin: '0 0 14px' };
const inputStyle: React.CSSProperties = { padding: '8px 12px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '0.88rem', flex: '1 1 180px' };
const btnStyle = (bg: string): React.CSSProperties => ({
  background: bg,
  color: '#fff',
  border: 'none',
  borderRadius: '8px',
  padding: '8px 16px',
  cursor: 'pointer',
  fontWeight: 600,
  fontSize: '0.88rem',
  flexShrink: 0,
});
