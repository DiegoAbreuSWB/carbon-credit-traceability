# Contratos Inteligentes

## CarbonCreditRegistry.sol

Contrato principal do protótipo. Registra créditos de carbono como estruturas de dados auditáveis na blockchain EVM local (Hardhat).

### Estrutura de dados

- `CarbonCredit`: representa cada crédito com metadados completos
- `CreditEvent`: log imutável de cada operação realizada
- `CreditStatus`: enum com estados `Created`, `Validated`, `Transferred`, `Retired`, `Rejected`

### Funções principais

| Função | Descrição |
|--------|-----------|
| `issueCredit` | Emite novo crédito |
| `validateCredit` | Valida crédito pendente |
| `rejectCredit` | Rejeita crédito pendente |
| `transferCredit` | Transfere crédito validado |
| `retireCredit` | Aposenta crédito |
| `getCredit` | Retorna detalhes do crédito |
| `getCreditEvents` | Retorna eventos de um crédito |
| `getAuditLog` | Retorna log completo de auditoria |

> **Aviso:** Este contrato é um protótipo acadêmico. Não utilizar em produção.
