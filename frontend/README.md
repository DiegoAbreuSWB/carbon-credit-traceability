# Frontend — CarbonTrace

Interface web React + TypeScript para rastreabilidade de créditos de carbono.

## Instalação e execução

```bash
cd frontend
npm install
npm run dev
```

Acesse: http://localhost:5173

## Modos de operação

| Modo | Variável | Descrição |
|------|----------|-----------|
| Mock (padrão) | `VITE_MODE=mock` | Usa dados simulados locais, sem necessidade de MetaMask |
| Blockchain | `VITE_MODE=blockchain` | Conecta ao contrato via Ethers.js + MetaMask |

Edite `.env.local` para alternar.

## Estrutura

```
src/
├── components/   # Componentes reutilizáveis (StatusBadge, Navbar, StatCard, Alert, Tooltip)
├── pages/        # Dashboard, CreditList, CreditDetail, Simulator, Audit
├── services/     # blockchainService.ts — abstração de integração
├── hooks/        # useCredits, useAuditLog
├── data/         # mockCredits.ts — dados sintéticos
└── types/        # Tipagem TypeScript
```
