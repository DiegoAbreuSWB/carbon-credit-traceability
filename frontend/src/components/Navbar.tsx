import { NavLink } from 'react-router-dom';
import { WalletConnect } from './WalletConnect';
import { useWallet } from '../hooks/useWallet';
import { isMockMode, MODE } from '../services/blockchainService';

export function Navbar() {
  const wallet = useWallet();
  const mock = isMockMode();

  const linkStyle = ({ isActive }: { isActive: boolean }): React.CSSProperties => ({
    color: isActive ? '#86efac' : '#f0fdf4',
    fontWeight: isActive ? 700 : 400,
    textDecoration: 'none',
    padding: '6px 12px',
    borderRadius: '6px',
    backgroundColor: isActive ? 'rgba(255,255,255,0.12)' : 'transparent',
    fontSize: '0.9rem',
  });

  return (
    <nav style={{
      backgroundColor: '#15803d',
      padding: '10px 24px',
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
      flexWrap: 'wrap',
      boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
    }}>
      <span style={{ color: '#fff', fontWeight: 700, fontSize: '1rem', marginRight: '12px', flexShrink: 0 }}>
        🌿 CarbonTrace
      </span>
      <NavLink to="/" end style={linkStyle}>Dashboard</NavLink>
      <NavLink to="/credits" style={linkStyle}>Créditos</NavLink>
      <NavLink to="/simulator" style={linkStyle}>Simulador</NavLink>
      <NavLink to="/audit" style={linkStyle}>Auditoria</NavLink>

      <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px' }}>
        {!mock && wallet.status === 'wrong_network' && (
          <span style={{ fontSize: '0.75rem', color: '#fca5a5', fontWeight: 600 }}>
            ⚠ Rede errada
          </span>
        )}
        <WalletConnect wallet={wallet} isMock={mock} />
      </span>
    </nav>
  );
}
