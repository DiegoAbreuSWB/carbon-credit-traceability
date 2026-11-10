from pathlib import Path
import json,statistics,csv
p=Path('results/revision/2026-11-10T14-53-09-418Z')
d=json.loads((p/'raw.json').read_text(encoding='utf-8'));rows=[]
for b in [16,31,32,33,64]:
 first=[];second=[]
 for r in range(1,6):
  rs=[x for x in d['rows'] if x['experiment']=='E3' and x['operation']=='rejectCredit' and x['bytes']==b and x['round']==r]
  assert len(rs)==2
  first.append(int(rs[0]['gasUsed']));second.append(int(rs[1]['gasUsed']))
 for label,values in [('id=0; H=1',first),('id=1; H=3',second)]:
  rows.append({'reasonBytes':b,'initialCondition':label,'samples':len(values),'meanGas':statistics.mean(values),'minGas':min(values),'maxGas':max(values),'sdGas':statistics.stdev(values)})
q=Path('results/rejection-summary');q.mkdir(exist_ok=True)
(q/'summary.json').write_text(json.dumps({'source':'results/revision/2026-11-10T14-53-09-418Z/raw.json','definition':'H is audit-event count immediately before rejection; name bytes vary with reason bytes; order reconstructed from the executor loops.','rows':rows},indent=2),encoding='utf-8')
with (q/'summary.csv').open('w',newline='',encoding='utf-8') as f:
 w=csv.DictWriter(f,fieldnames=list(rows[0]));w.writeheader();w.writerows(rows)
print(json.dumps(rows,indent=2))
p=Path('package.json');x=json.loads(p.read_text(encoding='utf-8'));x['scripts']['exp:audit-gas']='hardhat run scripts/experiments/audit-gas-limit.ts --network hardhat';p.write_text(json.dumps(x,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
