import { createHash } from 'node:crypto';
import { readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
const root=process.argv[2];if(!root)throw new Error('EVIDENCE_ROOT_REQUIRED');
async function files(dir){const result=[];for(const name of await readdir(dir)){if(name==='SHA256SUMS.json')continue;const full=join(dir,name),info=await stat(full);if(info.isDirectory())result.push(...await files(full));else result.push(full);}return result;}
const entries=[];for(const file of (await files(root)).sort()){const data=await readFile(file);entries.push({file:relative(root,file).replaceAll('\\','/'),bytes:data.length,sha256:createHash('sha256').update(data).digest('hex')});}
const manifest={contract:'agm-server-correlated-evidence-hashes.v1',generatedAt:new Date().toISOString(),immutableAfterHash:true,files:entries};await writeFile(join(root,'SHA256SUMS.json'),JSON.stringify(manifest,null,2)+'\n');console.log(`EVIDENCE HASHED - ${entries.length} files`);
