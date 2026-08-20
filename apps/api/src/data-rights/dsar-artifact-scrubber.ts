import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

export async function scrubSubjectArtifact(path:string,identifiers:string[]){
  const original=await readFile(path,'utf8');let value=original;let replacements=0;
  for(const identifier of [...new Set(identifiers.filter(Boolean))]){const replacement=`[subject-redacted:${createHash('sha256').update(identifier).digest('hex').slice(0,12)}]`;const parts=value.split(identifier);replacements+=Math.max(0,parts.length-1);value=parts.join(replacement);}
  if(replacements)await writeFile(path,value,'utf8');
  return{path,replacements,sha256:createHash('sha256').update(value).digest('hex')};
}
