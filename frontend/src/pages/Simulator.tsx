import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { issueCredit, validateCredit, rejectCredit, transferCredit, retireCredit, getAllCredits } from '../services/blockchainService';
import { Alert } from '../components/Alert';

type Tab = 'issue' | 'validate' | 'reject' | 'transfer' | 'retire';

const TABS: { key: Tab; label: string; desc: string }[] = [
  { key: 'issue', label: '+ Emitir', desc: 'Registra um novo crédito de carbono na blockchain.' },
  { key: 'validate', label: '✓ Validar', desc: 'Valida um crédito no estado "Emitido", atestando sua legitimidade.' },
  { key: 'reject', label: '✗ Rejeitar', desc: 'Rejeita um crédito no estado "Emitido" por inconformidade.' },
  { key: 'transfer', label: '→ Transferir', desc: 'Transfere a propriedade de um crédito validado para outro endereço.' },
  { key: 'retire', label: '⊘ Aposentar', desc: 'Retira um crédito de circulação após uso em compensação ambiental.' },
];

export function Simulator() {
  const [tab, setTab] = useState<Tab>('issue');
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string; creditId?: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const [form, setForm] = useState({
    areaName: '',
    location: '',
    geoCoordinates: '',
    co2Tonnes: '',
    creditId: '',
    reason: '',
    recipient: '',
  });

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const handle = async (action: () => Promise<string>, success: string, afterIssue = false) => {
    setLoading(true);
    setMsg(null);
    try {
      const hash = await action();
      if (afterIssue) {
        // Descobre o ID do crédito recém-emitido (último da lista)
        const all = await getAllCredits();
        const newId = all.length > 0 ? all[all.length - 1].id : undefined;
        setMsg({ type: 'success', text: `${success} TX: ${hash}`, creditId: newId });
        setForm((f) => ({ ...f, areaName: '', location: '', geoCoordinates: '', co2Tonnes: '' }));
      } else {
        setMsg({ type: 'success', text: `${success} TX: ${hash}` });
      }
    } catch (e) {
      setMsg({ type: 'error', text: e instanceof Error ? e.message : 'Erro na operação' });
    } finally {
      setLoading(false);
    }
  };

  const currentTab = TABS.find((t) => t.key === tab)!;

  return (
    <div style={pageStyle}>
      <h1 style={h1Style}>Simulador de Transações</h1>
      <p style={subtitleStyle}>
        Execute operações sobre créditos de carbono. Em modo simulado, os dados são salvos apenas na sessão atual.
      </p>

      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '20px' }}>
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => { setTab(t.key); setMsg(null); }}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              border: '1px solid',
              borderColor: tab === t.key ? '#15803d' : '#d1d5db',
              background: tab === t.key ? '#15803d' : '#fff',
              color: tab === t.key ? '#fff' : '#374151',
              fontWeight: tab === t.key ? 700 : 400,
              cursor: 'pointer',
              fontSize: '0.88rem',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div style={cardStyle}>
        <p style={{ fontSize: '0.85rem', color: '#6b7280', marginBottom: '20px' }}>{currentTab.desc}</p>

        {msg && (
          <div>
            <Alert type={msg.type} message={msg.text} onClose={() => setMsg(null)} />
            {msg.type === 'success' && msg.creditId !== undefined && (
              <div style={{ marginTop: '8px', fontSize: '0.85rem' }}>
                <Link to={`/credits/${msg.creditId}`} style={{ color: '#15803d', fontWeight: 600 }}>
                  → Ver crédito #{msg.creditId} nos detalhes
                </Link>
              </div>
            )}
          </div>
        )}

        {tab === 'issue' && (
          <form onSubmit={(e) => { e.preventDefault(); handle(() => issueCredit({ areaName: form.areaName, location: form.location, geoCoordinates: form.geoCoordinates, co2Tonnes: Number(form.co2Tonnes) }), 'Crédito emitido com sucesso!', true); }}>
            <Field label="Nome da Área Preservada *" value={form.areaName} onChange={set('areaName')} placeholder="ex: Reserva Florestal Rio Jutaí" required />
            <Field label="Localização (Município, Estado)" value={form.location} onChange={set('location')} placeholder="ex: Jutaí, AM" />
            <Field label="Coordenadas Geográficas (simuladas)" value={form.geoCoordinates} onChange={set('geoCoordinates')} placeholder="ex: -2.7450,-66.7825" />
            <Field label="CO₂ Equivalente (toneladas) *" value={form.co2Tonnes} onChange={set('co2Tonnes')} type="number" placeholder="ex: 1000" required />
            <button type="submit" disabled={loading} style={submitBtn('#15803d')}>
              {loading ? 'Emitindo...' : '+ Emitir Crédito'}
            </button>
          </form>
        )}

        {tab === 'validate' && (
          <form onSubmit={(e) => { e.preventDefault(); handle(() => validateCredit(form.creditId), `Crédito #${form.creditId} validado!`); }}>
            <Field label="ID do Crédito *" value={form.creditId} onChange={set('creditId')} placeholder="ex: 3" required />
            <p style={hintStyle}>O crédito deve estar no estado "Emitido" (Created).</p>
            <button type="submit" disabled={loading} style={submitBtn('#16a34a')}>
              {loading ? 'Validando...' : '✓ Validar Crédito'}
            </button>
          </form>
        )}

        {tab === 'reject' && (
          <form onSubmit={(e) => { e.preventDefault(); handle(() => rejectCredit(form.creditId, form.reason), `Crédito #${form.creditId} rejeitado.`); }}>
            <Field label="ID do Crédito *" value={form.creditId} onChange={set('creditId')} placeholder="ex: 3" required />
            <Field label="Motivo da Rejeição *" value={form.reason} onChange={set('reason')} placeholder="ex: Documentação insuficiente" required />
            <p style={hintStyle}>O crédito deve estar no estado "Emitido" (Created).</p>
            <button type="submit" disabled={loading} style={submitBtn('#dc2626')}>
              {loading ? 'Rejeitando...' : '✗ Rejeitar Crédito'}
            </button>
          </form>
        )}

        {tab === 'transfer' && (
          <form onSubmit={(e) => { e.preventDefault(); handle(() => transferCredit(form.creditId, form.recipient), `Crédito #${form.creditId} transferido!`); }}>
            <Field label="ID do Crédito *" value={form.creditId} onChange={set('creditId')} placeholder="ex: 1" required />
            <Field label="Endereço do Destinatário *" value={form.recipient} onChange={set('recipient')} placeholder="ex: 0xAbcDef..." required />
            <p style={hintStyle}>O crédito deve estar "Validado" ou "Transferido". Apenas o proprietário atual pode transferir.</p>
            <button type="submit" disabled={loading} style={submitBtn('#ea580c')}>
              {loading ? 'Transferindo...' : '→ Transferir Crédito'}
            </button>
          </form>
        )}

        {tab === 'retire' && (
          <form onSubmit={(e) => { e.preventDefault(); handle(() => retireCredit(form.creditId), `Crédito #${form.creditId} aposentado. Operação irreversível.`); }}>
            <Field label="ID do Crédito *" value={form.creditId} onChange={set('creditId')} placeholder="ex: 1" required />
            <p style={hintStyle}>
              ⚠ <strong>Atenção:</strong> Aposentar um crédito é uma ação <strong>irreversível</strong>.
              O crédito representa CO₂ compensado e não poderá mais ser transferido.
            </p>
            <button type="submit" disabled={loading} style={submitBtn('#4b5563')}>
              {loading ? 'Aposentando...' : '⊘ Aposentar Crédito'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, type = 'text', required }: {
  label: string; value: string; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string; type?: string; required?: boolean;
}) {
  return (
    <div style={{ marginBottom: '14px' }}>
      <label style={{ display: 'block', fontSize: '0.83rem', fontWeight: 600, color: '#374151', marginBottom: '4px' }}>{label}</label>
      <input
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '0.9rem', boxSizing: 'border-box' }}
      />
    </div>
  );
}

const pageStyle: React.CSSProperties = { padding: '24px', maxWidth: '700px', margin: '0 auto' };
const h1Style: React.CSSProperties = { fontSize: '1.5rem', fontWeight: 700, color: '#111827', margin: '0 0 4px' };
const subtitleStyle: React.CSSProperties = { color: '#6b7280', marginBottom: '24px', fontSize: '0.9rem' };
const cardStyle: React.CSSProperties = { background: '#fff', borderRadius: '10px', padding: '24px', boxShadow: '0 1px 4px rgba(0,0,0,0.07)' };
const hintStyle: React.CSSProperties = { fontSize: '0.83rem', color: '#6b7280', margin: '8px 0 14px', lineHeight: '1.5' };
const submitBtn = (bg: string): React.CSSProperties => ({
  background: bg, color: '#fff', border: 'none', borderRadius: '8px',
  padding: '10px 24px', cursor: 'pointer', fontWeight: 700, fontSize: '0.95rem', marginTop: '4px',
});
