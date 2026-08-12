import { USER_ACCESS_TOKEN_KEY } from '../premium-access/premium-access.client';
const env=(import.meta as ImportMeta&{env?:Record<string,string|boolean|undefined>}).env;
const base=(typeof env?.VITE_AGM_API_BASE_URL==='string'?env.VITE_AGM_API_BASE_URL.trim():'')||(env?.DEV===true?'/api/v1':'');
export type CarMoverJob={id:string;currentState:string;vehicleSubject:{vehicleClass:string;vehicleType:string;make?:string;model?:string;registration?:string};pickupSnapshot:{label:string};destinationSnapshot:{label:string};updatedAt:string};
export type JobFile={job:CarMoverJob;vehicle:CarMoverJob['vehicleSubject'];timeline:Array<{eventType:string;occurredAt:string;payload:unknown}>;auditReferences:string[];evidenceReferences:string[]};
async function request<T>(path:string,init:RequestInit={}){const token=sessionStorage.getItem(USER_ACCESS_TOKEN_KEY);if(!token)throw new Error('AUTH_REQUIRED');const response=await fetch(`${base}${path}`,{...init,headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json',...(init.headers||{})}});const body=await response.json().catch(()=>({}));if(!response.ok)throw new Error(`HTTP_${response.status}`);return body.data as T;}
export const carMoverClient={list:()=>request<CarMoverJob[]>('/car-mover/jobs'),create:(payload:unknown)=>request<{jobId:string}>('/car-mover/jobs',{method:'POST',body:JSON.stringify(payload)}),file:(id:string)=>request<JobFile>(`/car-mover/jobs/${id}`),transition:(id:string,payload:unknown)=>request(`/car-mover/jobs/${id}/transitions`,{method:'POST',body:JSON.stringify(payload)})};

