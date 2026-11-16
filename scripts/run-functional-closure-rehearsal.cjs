const {execFileSync,spawnSync}=require('node:child_process');
const {createRequire}=require('node:module');
const {resolve}=require('node:path');
const {writeFileSync}=require('node:fs');
const root=resolve(__dirname,'..'), api=resolve(root,'apps/api');
const container=JSON.parse(execFileSync('docker',['inspect','agm-development-postgres'],{encoding:'utf8',windowsHide:true}))[0];
const port=container.NetworkSettings.Ports['5432/tcp'][0];
if(port.HostIp!=='127.0.0.1'||port.HostPort!=='55432')throw new Error('REHEARSAL_TARGET_MISMATCH');
const env=Object.fromEntries(container.Config.Env.map(e=>{const at=e.indexOf('=');return [e.slice(0,at),e.slice(at+1)];}));
const database=`postgresql://${encodeURIComponent(env.POSTGRES_USER)}:${encodeURIComponent(env.POSTGRES_PASSWORD)}@127.0.0.1:55432/agm_cockpit_191_rehearsal`;
const out=process.argv[2];if(!out)throw new Error('Evidence directory required');
const req=createRequire(resolve(api,'package.json'));
const result=spawnSync(process.execPath,['-r',req.resolve('ts-node/register/transpile-only'),'scripts/test-functional-closure.ts'],{cwd:api,env:{...process.env,NODE_ENV:'test',DATABASE_URL:database,FUNCTIONAL_EVIDENCE_DIR:out},encoding:'utf8',windowsHide:true,timeout:120000});
writeFileSync(resolve(out,'real-duty-postgres.log'),result.stdout+result.stderr);
console.log(result.stdout);if(result.status!==0){console.error(result.stderr);process.exitCode=1;}
