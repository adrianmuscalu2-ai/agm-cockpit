const DATABASE = 'agm-premium-evidence-v1';
const STORE = 'originals';
const ORIGINAL_TTL_MS = 24 * 60 * 60 * 1000;
type StoredOriginal = { blob: Blob; createdAt: number; expiresAt: number };
const open = () => new Promise<IDBDatabase>((resolve,reject)=>{
  const request=indexedDB.open(DATABASE,1);
  request.onupgradeneeded=()=>request.result.createObjectStore(STORE);
  request.onsuccess=()=>resolve(request.result); request.onerror=()=>reject(request.error);
});
export async function preserveOriginal(id:string,file:Blob) {
  const db=await open(); const now=Date.now(); const value:StoredOriginal={blob:file,createdAt:now,expiresAt:now+ORIGINAL_TTL_MS}; await new Promise<void>((resolve,reject)=>{const tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).put(value,id);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);});db.close();
}
export async function restoreOriginal(id:string) {
  const db=await open(); const value=await new Promise<Blob|StoredOriginal|undefined>((resolve,reject)=>{const request=db.transaction(STORE).objectStore(STORE).get(id);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});db.close();
  if (!value) return undefined;
  if (value instanceof Blob) { await deleteOriginal(id); return undefined; }
  if (value.expiresAt<=Date.now()) { await deleteOriginal(id); return undefined; }
  return value.blob;
}
export async function deleteOriginal(id:string) { const db=await open(); await new Promise<void>((resolve,reject)=>{const tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).delete(id);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);});db.close(); }
export async function clearOriginalEvidence() { const db=await open(); await new Promise<void>((resolve,reject)=>{const tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).clear();tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);});db.close(); }
export async function sha256(blob:Blob) {
  const digest=await crypto.subtle.digest('SHA-256',await blob.arrayBuffer());
  return [...new Uint8Array(digest)].map((value)=>value.toString(16).padStart(2,'0')).join('');
}
export async function restoreVerifiedOriginal(id:string,expectedSha256:string) {
  const blob=await restoreOriginal(id);
  if (!blob) return { ok:false as const, reason:'ORIGINAL_MISSING' as const };
  const actualSha256=await sha256(blob);
  return actualSha256===expectedSha256 ? {ok:true as const,blob,actualSha256} : {ok:false as const,reason:'ORIGINAL_HASH_MISMATCH' as const,actualSha256};
}
