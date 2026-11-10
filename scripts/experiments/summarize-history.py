from pathlib import Path
import json,csv,statistics
root=Path(__file__).resolve().parents[2]
paths=sorted((root/'results/history').glob('*/raw.json'))
p=next(p for p in reversed(paths) if json.loads(p.read_text(encoding='utf-8'))['profile']=='full')
d=json.loads(p.read_text(encoding='utf-8'))
assert d['status']=='completed',d['status']
rows=d['rows']; checks=d['checks']
assert len(rows)==180,len(rows)
assert all(c['passed'] for c in checks)
fields=sorted(set().union(*(r.keys() for r in rows)))
with (p.parent/'samples.csv').open('w',newline='',encoding='utf-8') as f:
 w=csv.DictWriter(f,fieldnames=fields);w.writeheader();w.writerows(rows)
lines=['# Reconstrucao e crescimento do historico','', 'Tres rodadas com contratos novos. Cada cenario tem tres consultas por operacao e rodada. Volumes crescentes no mesmo contrato dentro de cada rodada; tempos incluem decodificacao do ethers. Sem aquecimento excluido.','', '| Creditos | Eventos | getLogs mediana ms | Replay mediana ms | getAuditLog mediana ms | getCreditEvents(5) mediana ms | Falhas |','|---|---|---|---|---|---|---|']
for n in d['volumes']:
 rs=[r for r in rows if r['volume']==n]
 vals=[]
 for op in ['getLogs','replay','getAuditLog','getCreditEvents']:
  vs=[r['durationMs'] for r in rs if r['operation']==op and r['success']]
  vals.append(f'{statistics.median(vs):.3f}' if vs else 'sem sucesso')
 lines.append('| '+str(n)+' | '+str(rs[0]['events'])+' | '+' | '.join(vals)+' | '+str(sum(not r['success'] for r in rs))+' |')
count=sum(c.get('creditsCompared',0) for c in checks)
lines+=['',f'Reconstrucao: {count} comparacoes de registros entre os cenarios (nao sao registros independentes), oito campos por registro, sem divergencia. Campos: id, emissor, proprietario, validador, nome, quantidade de CO2, data de emissao e estado. Localizacao e coordenadas nao constam nos eventos e estao excluidas.','', 'Seis fluxos cobrem os cinco estados, rejeicao, transferencia, retransferencia e aposentadoria com e sem transferencia. Controles negativos exercitam log duplicado, emissao ausente e proprietario divergente.','', 'getCreditEvents(5) retorna sempre cinco eventos, mas o contrato percorre o historico global duas vezes. O aumento do tempo nessa consulta evidencia custo dependente do historico, mesmo com resposta fixa. getAuditLog retorna o historico inteiro. Gas estavel em operacoes por identificador nao implica custo constante dessas consultas.','', 'A reconstrucao mede somente o processamento local de logs ja recuperados; getLogs mede recuperacao. Nao extrapolar os tempos para RPC externo ou rede publica. Ausencia de falhas nesta faixa nao demonstra ausencia de limites em volumes maiores.','', 'Em 2.000 creditos (2.010 eventos), getAuditLog falhou em 9/9 consultas com Transaction ran out of gas. Trata-se do limite observado para eth_call neste ambiente, nao de uma taxa efetivamente paga por uma transacao. Nao foi avaliada a mesma chamada com limites de gas maiores; nao atribuir um limite universal de 2.000 registros ao contrato.', 'Dados individuais e erros, quando existentes, ficam em raw.json e samples.csv.']
(p.parent/'summary.md').write_text('\n'.join(lines)+'\n',encoding='utf-8')
print(p.parent);print('\n'.join(lines))
