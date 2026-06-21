import { WalletState } from '../hooks/useWallet';

interface Props {
  wallet: WalletState & { connect: () => void; disconnect: () => void };
  isMock: boolean;
}

export function WalletConnect({ wallet, isMock }: Props) {
  if (isMock) {
    return (
      <span style={pillStyle('#f59e0b', '#fffbeb')}>
        ● Modo Simulado
      </span>
    );
  }

  if (wallet.status === 'disconnected' || wallet.status === 'error') {
    return (
      <button onClick={wallet.connect} style={btnStyle('#15803d')}>
        Conectar MetaMask
      </button>
    );
  }

  if (wallet.status === 'connecting') {
    return <span style={pillStyle('#6b7280', '#f9fafb')}>Conectando...</span>;
  }

  if (wallet.status === 'wrong_network') {
    return (
      <span style={pillStyle('#dc2626', '#fef2f2')} title={wallet.error ?? ''}>
        ⚠ Rede incorreta
      </span>
    );
  }

  // connected
  const short = wallet.address
    ? `${wallet.address.slice(0, 6)}...${wallet.address.slice(-4)}`
    : '';

  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <span style={pillStyle('#16a34a', '#f0fdf4')}>
        ⛓ {short}
        {wallet.balance !== null && ` · ${wallet.balance} ETH`}
      </span>
      <button onClick={wallet.disconnect} style={{ ...btnStyle('#6b7280'), fontSize: '0.72rem', padding: '3px 8px' }}>
        Desconectar
      </button>
    </span>
  );
}

const pillStyle = (color: string, bg: string): React.CSSProperties => ({
  display: 'inline-block',
  padding: '3px 11px',
  borderRadius: '9999px',
  fontSize: '0.78rem',
  fontWeight: 600,
  color,
  backgroundColor: bg,
  border: `1px solid ${color}44`,
  cursor: 'default',
});

const btnStyle = (bg: string): React.CSSProperties => ({
  background: bg,
  color: '#fff',
  border: 'none',
  borderRadius: '9999px',
  padding: '4px 12px',
  cursor: 'pointer',
  fontSize: '0.78rem',
  fontWeight: 600,
});
