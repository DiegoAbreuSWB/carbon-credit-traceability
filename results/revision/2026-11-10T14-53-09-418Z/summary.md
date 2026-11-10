# Resultados da primeira execucao completa

Ambiente: Hardhat interno isolado, cinco rodadas. Tempos nao equivalem aos resultados antigos por RPC.

## E4: gas por operacao (minimo a maximo nas rodadas)

| N apos emissao | Emissao | Validacao | Transferencia | Aposentadoria |
|---|---|---|---|---|
| 1 | 331314 | 146932 | 203931 | 110169 |
| 10 | 339714 | 166844 | 223843 | 130081 |
| 50 | 339714 | 166844 | 223843 | 130081 |
| 100 | 339714 | 166844 | 223843 | 130081 |
| 200 | 339714 | 166844 | 223843 | 130081 |
| 500 | 339714 | 166856 | 223855 | 130093 |
| 1000 | 339714 | 166856 | 223855 | 130093 |
| 2000 | 339714 | 166856 | 223855 | 130093 |

N=1 inclui primeira emissao; IDs diferentes alteram bytes de calldata. Variacoes pequenas nao devem ser atribuidas automaticamente ao volume.

## E12: tempo local em ms

| Operacao | n | Media | Mediana | p95 | IC95 da media entre rodadas |
|---|---|---|---|---|---|
| issueCredit | 150 | 3.500 | 3.136 | 5.027 | 2.622 a 4.378 |
| validateCredit | 150 | 3.233 | 2.903 | 5.134 | 2.888 a 3.577 |
| rejectCredit | 150 | 3.330 | 3.006 | 4.991 | 2.569 a 4.092 |
| transferCredit | 150 | 5.125 | 4.784 | 7.883 | 4.442 a 5.807 |
| retireCredit | 150 | 3.033 | 2.877 | 4.568 | 2.862 a 3.203 |

IC de Student (4 graus de liberdade) sobre cinco medias de rodada; execucao exploratoria no mesmo processo, sem reiniciar o no entre rodadas. p95 pelo posto mais proximo.

## E13: taxa sequencial

| Lote | Rodadas | TPS medio | TPS minimo | TPS maximo | Falhas |
|---|---|---|---|---|---|
| 100 | 5 | 247.81 | 223.83 | 283.48 | 0 |
| 500 | 5 | 208.54 | 185.49 | 223.83 | 0 |
| 1000 | 5 | 206.36 | 190.99 | 219.94 | 0 |

Envio seguido de espera de confirmacao por transacao. Nao representa capacidade maxima, carga concorrente ou desempenho de rede publica.

E3: amostras por tamanho de campos estao em samples.csv e raw.json.

Pendencias: replay/historico, identificacao de logs, integracao real da interface, comparacao bibliografica e revisao do executor antigo. A verificacao global de tipos encontrou erros em arquivos legados.
