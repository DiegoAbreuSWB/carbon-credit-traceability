# setup-local.ps1 — Configura o ambiente local completo no Windows.
# Uso: .\scripts\setup-local.ps1

$ErrorActionPreference = "Stop"
$Root = Split-Path $PSScriptRoot -Parent
Set-Location $Root

Write-Host ""
Write-Host "==============================================" -ForegroundColor Cyan
Write-Host "  CarbonTrace — Setup Local Completo (Win)"   -ForegroundColor Cyan
Write-Host "==============================================" -ForegroundColor Cyan
Write-Host ""

# 1. Dependências
Write-Host "📦 [1/6] Instalando dependências..." -ForegroundColor Yellow
npm install --silent
npm install --silent --prefix frontend
Write-Host "   ✅ Dependências instaladas" -ForegroundColor Green

# 2. Compilação
Write-Host ""
Write-Host "🔨 [2/6] Compilando contratos..." -ForegroundColor Yellow
npx hardhat compile
Write-Host "   ✅ Contratos compilados" -ForegroundColor Green

# 3. Testes
Write-Host ""
Write-Host "🧪 [3/6] Executando testes..." -ForegroundColor Yellow
npx hardhat test
Write-Host "   ✅ Testes passados" -ForegroundColor Green

# 4. Nó Hardhat em background
Write-Host ""
Write-Host "⛓  [4/6] Iniciando nó Hardhat local em background..." -ForegroundColor Yellow
$nodeJob = Start-Job -ScriptBlock {
  Set-Location $using:Root
  npx hardhat node 2>&1
}
Write-Host "   Job ID: $($nodeJob.Id) — aguardando 4s para subir..."
Start-Sleep -Seconds 4
Write-Host "   ✅ Nó rodando em http://127.0.0.1:8545" -ForegroundColor Green
Write-Host "   (Pare com: Stop-Job $($nodeJob.Id) ; Remove-Job $($nodeJob.Id))"

# 5. Deploy
Write-Host ""
Write-Host "🚀 [5/6] Deploy do contrato..." -ForegroundColor Yellow
npx hardhat run scripts/deploy.ts --network localhost
$deployInfo = Get-Content "deployments\localhost.json" | ConvertFrom-Json
$contractAddress = $deployInfo.contractAddress
Write-Host "   ✅ Contrato em: $contractAddress" -ForegroundColor Green

# 6. Seed
Write-Host ""
Write-Host "🌱 [6/6] Populando contrato com dados simulados..." -ForegroundColor Yellow
$env:CONTRACT_ADDRESS = $contractAddress
npx hardhat run scripts/seed.ts --network localhost
Write-Host "   ✅ Dados inseridos" -ForegroundColor Green

Write-Host ""
Write-Host "==============================================" -ForegroundColor Cyan
Write-Host "  ✅ Setup completo!" -ForegroundColor Green
Write-Host ""
Write-Host "  Próximo passo:"
Write-Host "    cd frontend; npm run dev"
Write-Host ""
Write-Host "  Acesse: http://localhost:5173"
Write-Host ""
Write-Host "  MetaMask — Configuração de rede:"
Write-Host "    Nome:    Hardhat Local"
Write-Host "    RPC:     http://127.0.0.1:8545"
Write-Host "    ChainID: 31337"
Write-Host "    Moeda:   ETH"
Write-Host ""
Write-Host "  Conta de teste (importe na MetaMask):"
Write-Host "    Use a conta de desenvolvimento exibida pelo Hardhat."
Write-Host "    (Conta #0 do Hardhat — NÃO use em redes reais)" -ForegroundColor Red
Write-Host "==============================================" -ForegroundColor Cyan
Write-Host ""
