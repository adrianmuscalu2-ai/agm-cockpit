const {execFileSync,spawnSync}=require('node:child_process');
const {createHash}=require('node:crypto');
const {writeFileSync}=require('node:fs');
const {join}=require('node:path');
const sha='14da4cc394c1340936299d362e97e66cc22e1e63';
const out=process.argv[2];if(!out)throw new Error('Evidence directory required');
const ssh=['-i','C:/Users/adria/.ssh/agm_release_operations_hetzner_ed25519','-o','BatchMode=yes','-o','ConnectTimeout=8','-o','StrictHostKeyChecking=yes','agmops@167.233.237.253'];
const digest=x=>createHash('sha256').update(x).digest('hex');
async function main(){
 const webResponse=await fetch('https://app.agmcockpit.com/build-info.json');const web=await webResponse.json();
 const apiResponse=await fetch('https://api.agmcockpit.com/api/v1/health/ready');const api=await apiResponse.json();
 if(web.commit!==sha||api.data.build.commit!==sha)throw new Error('PRODUCTION_CHANGED_REASSESS');
 const html=await (await fetch('https://app.agmcockpit.com/')).text();
 const asset=html.match(/(?:src|href)=["'](\/assets\/main-[^"']+\.js)["']/)?.[1];if(!asset)throw new Error('MAIN_ASSET_NOT_FOUND');
 const bundle=await fetch('https://app.agmcockpit.com'+asset);if(bundle.status!==200)throw new Error('BUNDLE_UNAVAILABLE');
 const files=['apps/api/src/acpm/acpm.observer.ts','apps/api/src/agmatcc-copilot/agmatcc-copilot.service.ts','apps/api/src/governance-v2/governance-v2.persistence.ts','apps/api/src/authority-control-plane/operational-agent-duty.runner.ts'];
 const source='const fs=require("node:fs"),c=require("node:crypto");console.log(JSON.stringify('+JSON.stringify(files)+'.map(path=>({path,sha256:c.createHash("sha256").update(fs.readFileSync("/app/"+path)).digest("hex")}))))';
 const remote=spawnSync('ssh',[...ssh,'sudo -n docker exec -i agm-production-api node'],{input:source,encoding:'utf8',timeout:30000});
 if(remote.status!==0)throw new Error(remote.stderr);
 const sources=JSON.parse(remote.stdout).map(r=>({...r,gitSha256:digest(execFileSync('git',['show',sha+':'+r.path])),matchesGit:r.sha256===digest(execFileSync('git',['show',sha+':'+r.path]))}));
 const images=execFileSync('ssh',[...ssh,"sudo -n docker inspect agm-production-api agm-production-web --format '{{.Name}}|{{.Image}}|{{.Config.Image}}'"],{encoding:'utf8',timeout:30000}).trim().split('\n');
 const result={at:new Date().toISOString(),productionCommit:sha,web,api:api.data.build,mainAsset:asset,mainAssetSha256:digest(Buffer.from(await bundle.arrayBuffer())),images,sources,sourceTreeEqualsCandidate:execFileSync('git',['rev-parse',sha+'^{tree}'],{encoding:'utf8'}).trim()===execFileSync('git',['rev-parse','89335750^{tree}'],{encoding:'utf8'}).trim(),historicalRootHead:execFileSync('git',['-C','C:/Users/adria/Documents/AGM','rev-parse','HEAD'],{encoding:'utf8'}).trim()};
 writeFileSync(join(out,'production-identity.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
