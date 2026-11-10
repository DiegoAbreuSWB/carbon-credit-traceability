# Reprodução dos experimentos

Instale as dependências com npm ci e npm ci --prefix frontend. Use npm run check para compilar, verificar os tipos, executar os testes e gerar a interface.

Na rede Hardhat interna, execute npm run exp:revision para as medições de gás e desempenho, npm run exp:history para as consultas e a reconstrução de eventos, npm run exp:audit-gas para a auditoria do limite de gás e npm run exp:all:isolated para os procedimentos legados. O perfil pilot de REVISION_PROFILE executa um conjunto reduzido de medições.

Os resultados estruturados estão em results/. Os executores e agregadores estão em scripts/experiments/. Cada execução guarda sua configuração, perfil e estado. Os registros de chamadas individuais indicam sucesso ou falha.
