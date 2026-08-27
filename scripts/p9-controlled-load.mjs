import { spawn } from 'node:child_process';
const root=process.cwd(),durationMs=Number(process.argv[2]??120000),end=Date.now()+durationMs;let runs=0,stopped=false,child=null;
const stop=()=>{stopped=true;if(child&&!child.killed)child.kill();};process.on('SIGTERM',stop);process.on('SIGINT',stop);
while(!stopped&&Date.now()<end){await new Promise(resolve=>{child=spawn('pnpm.cmd',['exec','tsx','scripts/test-copilot-v1-2-p9-pilot.ts'],{cwd:root,stdio:'ignore',windowsHide:true});child.once('exit',()=>{runs++;resolve();});});}
console.log(`P9 CONTROLLED LOAD STOPPED runs=${runs}`);
