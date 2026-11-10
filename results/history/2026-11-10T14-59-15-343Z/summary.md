# Reconstrucao e crescimento do historico

Tres rodadas com contratos novos. Cada cenario tem tres consultas por operacao e rodada. Volumes crescentes no mesmo contrato dentro de cada rodada; tempos incluem decodificacao do ethers. Sem aquecimento excluido.

| Creditos | Eventos | getLogs mediana ms | Replay mediana ms | getAuditLog mediana ms | getCreditEvents(5) mediana ms | Falhas |
|---|---|---|---|---|---|---|
| 10 | 20 | 3.023 | 11.801 | 9.991 | 3.608 | 0 |
| 100 | 110 | 11.414 | 55.852 | 67.450 | 7.841 | 0 |
| 500 | 510 | 51.805 | 235.854 | 528.289 | 21.602 | 0 |
| 1000 | 1010 | 94.964 | 466.513 | 1261.266 | 34.254 | 0 |
| 2000 | 2010 | 195.732 | 978.964 | sem sucesso | 71.931 | 9 |

Reconstrucao: 10830 comparacoes de registros entre os cenarios (nao sao registros independentes), oito campos por registro, sem divergencia. Campos: id, emissor, proprietario, validador, nome, quantidade de CO2, data de emissao e estado. Localizacao e coordenadas nao constam nos eventos e estao excluidas.

Seis fluxos cobrem os cinco estados, rejeicao, transferencia, retransferencia e aposentadoria com e sem transferencia. Controles negativos exercitam log duplicado, emissao ausente e proprietario divergente.

getCreditEvents(5) retorna sempre cinco eventos, mas o contrato percorre o historico global duas vezes. O aumento do tempo nessa consulta evidencia custo dependente do historico, mesmo com resposta fixa. getAuditLog retorna o historico inteiro. Gas estavel em operacoes por identificador nao implica custo constante dessas consultas.

A reconstrucao mede somente o processamento local de logs ja recuperados; getLogs mede recuperacao. Nao extrapolar os tempos para RPC externo ou rede publica. Ausencia de falhas nesta faixa nao demonstra ausencia de limites em volumes maiores.

Em 2.000 creditos (2.010 eventos), getAuditLog falhou em 9/9 consultas com Transaction ran out of gas. Trata-se do limite observado para eth_call neste ambiente, nao de uma taxa efetivamente paga por uma transacao. Nao foi avaliada a mesma chamada com limites de gas maiores; nao atribuir um limite universal de 2.000 registros ao contrato.
Dados individuais e erros, quando existentes, ficam em raw.json e samples.csv.
