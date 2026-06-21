#!/usr/bin/env bash
# setup-local.sh — Configura o ambiente local completo em um único passo.
#
# O que faz:
#  1. Instala dependências (raiz + frontend)
#  2. Compila os contratos
#  3. Executa os testes
#  4. Inicia o nó Hardhat em background
#  5. Faz o deploy do contrato (grava endereço em frontend/.env.local)
#  6. Popula o contrato com dados simulados
#
# Uso:
#   chmod +x scripts/setup-local.sh
#   ./scripts/setup-local.sh
#
# Depois: cd frontend && npm run dev

set -e
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo ""
echo "=============================================="
echo "  CarbonTrace — Setup Local Completo"
echo "=============================================="
echo ""

# 1. Dependências
echo "📦 [1/6] Instalando dependências..."
npm install --silent
npm install --silent --prefix frontend
echo "   ✅ Dependências instaladas"

# 2. Compilação
echo ""
echo "🔨 [2/6] Compilando contratos..."
npx hardhat compile
echo "   ✅ Contratos compilados"

# 3. Testes
echo ""
echo "🧪 [3/6] Executando testes..."
npx hardhat test
echo "   ✅ Testes passados"

# 4. Nó Hardhat em background
echo ""
echo "⛓  [4/6] Iniciando nó Hardhat local..."
npx hardhat node > /tmp/hardhat-node.log 2>&1 &
HARDHAT_PID=$!
echo "   PID: $HARDHAT_PID | Log: /tmp/hardhat-node.log"
sleep 3  # aguarda o nó subir

if ! kill -0 $HARDHAT_PID 2>/dev/null; then
  echo "   ❌ Falha ao iniciar o nó Hardhat. Verifique /tmp/hardhat-node.log"
  exit 1
fi
echo "   ✅ Nó rodando em http://127.0.0.1:8545"

# 5. Deploy
echo ""
echo "🚀 [5/6] Fazendo deploy do contrato..."
npx hardhat run scripts/deploy.ts --network localhost
CONTRACT_ADDRESS=$(node -e "const f=require('./deployments/localhost.json'); console.log(f.contractAddress)")
echo "   ✅ Contrato em: $CONTRACT_ADDRESS"

# 6. Seed
echo ""
echo "🌱 [6/6] Populando contrato com dados simulados..."
CONTRACT_ADDRESS="$CONTRACT_ADDRESS" npx hardhat run scripts/seed.ts --network localhost
echo "   ✅ Dados inseridos"

echo ""
echo "=============================================="
echo "  ✅ Setup completo!"
echo ""
echo "  Próximo passo:"
echo "    cd frontend && npm run dev"
echo ""
echo "  Acesse: http://localhost:5173"
echo ""
echo "  MetaMask — Configuração de rede:"
echo "    Nome:    Hardhat Local"
echo "    RPC:     http://127.0.0.1:8545"
echo "    ChainID: 31337"
echo "    Moeda:   ETH"
echo ""
echo "  Conta de teste (importe a chave privada na MetaMask):"
echo "    Use a conta de desenvolvimento exibida pelo Hardhat."
echo "    (Conta #0 do Hardhat — NÃO use em produção)"
echo "=============================================="
echo ""
echo "  Nó Hardhat rodando em background (PID: $HARDHAT_PID)"
echo "  Para parar: kill $HARDHAT_PID"
echo ""
