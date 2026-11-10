import json, csv, statistics, math, sys
from pathlib import Path
root=Path(__file__).resolve().parents[2]
paths=sorted((root/'results/revision').glob('*/raw.json'))
reports=[p for p in paths if json.loads(p.read_text(encoding='utf-8'))['profile']=='full']
if not reports: raise SystemExit('No full run found')
p=reports[-1]
d=json.loads(p.read_text(encoding='utf-8'))
if d['status']!='completed': raise SystemExit('Run not completed: '+d['status'])
rows=d['rows']
fields=sorted(set().union(*(set(r)-{'transactions'} for r in rows)))
with (p.parent/'samples.csv').open('w',newline='',encoding='utf-8') as f:
 w=csv.DictWriter(f,fieldnames=fields,extrasaction='ignore'); w.writeheader(); w.writerows(rows)
lines=['# Resultados da primeira execucao completa','', 'Ambiente: Hardhat interno isolado, cinco rodadas. Tempos nao equivalem aos resultados antigos por RPC.','', '## E4: gas por operacao (minimo a maximo nas rodadas)','', '| N apos emissao | Emissao | Validacao | Transferencia | Aposentadoria |','|---|---|---|---|---|']
for n in d['volumes']:
 cells=[]
 for op in ['issueCredit','validateCredit','transferCredit','retireCredit']:
  vs=[int(r['gasUsed']) for r in rows if r['experiment']=='E4' and r['volume']==n and r['operation']==op]
  cells.append(str(min(vs)) if min(vs)==max(vs) else f'{min(vs)}–{max(vs)}')
 lines.append('| '+str(n)+' | '+' | '.join(cells)+' |')
lines+=['','N=1 inclui primeira emissao; IDs diferentes alteram bytes de calldata. Variacoes pequenas nao devem ser atribuidas automaticamente ao volume.','', '## E12: tempo local em ms','', '| Operacao | n | Media | Mediana | p95 | IC95 da media entre rodadas |','|---|---|---|---|---|---|']
for op in ['issueCredit','validateCredit','rejectCredit','transferCredit','retireCredit']:
 rs=[r for r in rows if r['experiment']=='E12' and r['operation']==op]
 vs=sorted(r['durationMs'] for r in rs)
 means=[statistics.mean(r['durationMs'] for r in rs if r['round']==i) for i in range(1,6)]
 mean=statistics.mean(means); half=2.776445*statistics.stdev(means)/math.sqrt(5)
 lines.append(f'| {op} | {len(vs)} | {mean:.3f} | {statistics.median(vs):.3f} | {vs[math.ceil(.95*len(vs))-1]:.3f} | {mean-half:.3f} a {mean+half:.3f} |')
lines+=['','IC de Student (4 graus de liberdade) sobre cinco medias de rodada; execucao exploratoria no mesmo processo, sem reiniciar o no entre rodadas. p95 pelo posto mais proximo.','', '## E13: taxa sequencial','', '| Lote | Rodadas | TPS medio | TPS minimo | TPS maximo | Falhas |','|---|---|---|---|---|---|']
for batch in d['batches']:
 rs=[r for r in rows if r['experiment']=='E13' and r['batch']==batch]
 vs=[r['tps'] for r in rs]
 lines.append(f'| {batch} | {len(vs)} | {statistics.mean(vs):.2f} | {min(vs):.2f} | {max(vs):.2f} | {sum(r["failures"] for r in rs)} |')
lines+=['','Envio seguido de espera de confirmacao por transacao. Nao representa capacidade maxima, carga concorrente ou desempenho de rede publica.','', 'E3: amostras por tamanho de campos estao em samples.csv e raw.json.','', 'Pendencias: replay/historico, identificacao de logs, integracao real da interface, comparacao bibliografica e revisao do executor antigo. A verificacao global de tipos encontrou erros em arquivos legados.']
(p.parent/'summary.md').write_text('\n'.join(lines)+'\n',encoding='utf-8')
print(p.parent)
print('\n'.join(lines))
