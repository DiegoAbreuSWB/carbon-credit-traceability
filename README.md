# CarbonTrace

Protótipo acadêmico para registrar, validar e rastrear créditos de carbono simulados com contratos inteligentes e uma interface web.

## Instalação

Use Node.js 22 e npm. Na raiz do repositório, instale as dependências do contrato e da interface e execute a verificação.

    npm ci
    npm ci --prefix frontend
    npm run check

## Interface e rede local

Inicie a interface com npm run frontend:dev e abra http://localhost:5173. Para usar os dados simulados, configure VITE_MODE=mock em frontend/.env.local, conforme frontend/.env.example.

Para iniciar a rede Hardhat, use npm run node. Em outro terminal, execute npm run deploy:local e depois npm run frontend:dev. O deploy configura o endereço do contrato no ambiente local da interface. Na MetaMask, selecione a rede http://127.0.0.1:8545 com chainId 31337 e use uma conta de desenvolvimento exibida pelo Hardhat.

Os comandos npm run setup:local (Windows) e npm run setup:linux (Linux/macOS) automatizam a preparação da rede e a carga de dados simulados.

## Besu local

Para o ambiente Besu opcional, configure localmente o arquivo besu/keys/signer-key. O endereço do validador deve corresponder ao configurado em besu/genesis.json e besu/config/besu-node.toml. Defina BESU_SIGNER_KEY no ambiente do terminal que fará o deploy. Os comandos npm run besu:up e npm run deploy:besu iniciam o nó e implantam o contrato, respectivamente.

## Licença

Uso acadêmico. Consulte sua instituição de ensino para definição de licença apropriada antes de publicação ou distribuição.
