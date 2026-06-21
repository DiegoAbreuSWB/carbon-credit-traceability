import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import { Navbar } from './components/Navbar';
import { Dashboard } from './pages/Dashboard';
import { CreditList } from './pages/CreditList';
import { CreditDetail } from './pages/CreditDetail';
import { Simulator } from './pages/Simulator';
import { Audit } from './pages/Audit';

function NotFound() {
  return (
    <div style={{ padding: '64px 24px', textAlign: 'center', maxWidth: '500px', margin: '0 auto' }}>
      <div style={{ fontSize: '4rem', marginBottom: '16px' }}>🌿</div>
      <h2 style={{ color: '#374151', marginBottom: '8px' }}>Página não encontrada</h2>
      <p style={{ color: '#6b7280', marginBottom: '24px', fontSize: '0.95rem' }}>
        A página que você procura não existe neste protótipo.
      </p>
      <Link to="/" style={{
        background: '#15803d', color: '#fff', padding: '10px 24px',
        borderRadius: '8px', fontWeight: 600, fontSize: '0.95rem',
      }}>
        Voltar ao Dashboard
      </Link>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <div style={{ minHeight: '100vh', backgroundColor: '#f9fafb', fontFamily: 'Inter, system-ui, sans-serif' }}>
        <Navbar />
        <main>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/credits" element={<CreditList />} />
            <Route path="/credits/:id" element={<CreditDetail />} />
            <Route path="/simulator" element={<Simulator />} />
            <Route path="/audit" element={<Audit />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </main>
        <footer style={{ textAlign: 'center', padding: '20px', fontSize: '0.75rem', color: '#9ca3af', borderTop: '1px solid #e5e7eb', marginTop: '40px' }}>
          Protótipo Acadêmico — Iniciação Científica · Dados sintéticos para fins de pesquisa · Não utilizar em produção
        </footer>
      </div>
    </BrowserRouter>
  );
}
