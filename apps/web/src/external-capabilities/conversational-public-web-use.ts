import { PublicWebReadPolicy } from './public-web-read.policy';

export type PublicWebFact = Readonly<{ entity:string; kind:'PHONE'|'ADDRESS'|'HOURS'; value:string; url:string; official:boolean }>;
export type PublicWebConversationResult = Readonly<{ status:'GROUNDED'|'CLARIFICATION_REQUIRED'|'CONFLICT'|'STOP_AUTH_REQUIRED'|'WRITE_PREVIEW'; answer:string; sources:readonly PublicWebFact[]; receiptIds:readonly string[]; preview?:string }>;
export type PublicWebRetriever=(query:string)=>Promise<readonly PublicWebFact[]>;

export class ConversationalPublicWebUse{
 private readonly policy=new PublicWebReadPolicy();
 async answer(request:string,retrieve:PublicWebRetriever):Promise<PublicWebConversationResult>{
  if(['trimite','rezervă','rezerva','cumpără','cumpara','postează','posteaza','completează','completeaza','upload'].some(term=>request.toLocaleLowerCase().includes(term)))return{status:'WRITE_PREVIEW',answer:'Acțiunea externă necesită preview și confirmare explicită.',sources:[],receiptIds:[],preview:request};
  const facts=await retrieve(request),receipts:string[]=[];for(const fact of facts){const d=this.policy.evaluate(fact.url);receipts.push(d.receipt.receiptId);if(d.status!=='ALLOWED')return{status:'STOP_AUTH_REQUIRED',answer:'Sursa necesită autentificare sau acces restricționat.',sources:[],receiptIds:receipts};}
  const entities=new Set(facts.map(f=>f.entity.toLocaleLowerCase()));if(entities.size>1)return{status:'CLARIFICATION_REQUIRED',answer:'Am găsit mai multe entități posibile. Precizează firma dorită.',sources:facts,receiptIds:receipts};
  const grouped=new Map<string,PublicWebFact[]>();for(const fact of facts){const key=fact.kind;grouped.set(key,[...(grouped.get(key)??[]),fact]);}
  const conflicts=[...grouped.values()].some(rows=>new Set(rows.map(r=>r.value)).size>1);if(conflicts)return{status:'CONFLICT',answer:'Sursele publice indică valori diferite; nu pot declara una drept corectă fără verificare suplimentară.',sources:facts,receiptIds:receipts};
  const preferred=facts.filter(f=>f.official);const selected=preferred.length?preferred:facts;if(!selected.length)return{status:'CLARIFICATION_REQUIRED',answer:'Nu am găsit o informație publică verificabilă. Precizează entitatea sau locația.',sources:[],receiptIds:receipts};
  return{status:'GROUNDED',answer:`Conform sursei publice ${selected[0].official?'oficiale':'verificate'}, ${selected.map(f=>`${f.kind.toLowerCase()}: ${f.value}`).join('; ')}.`,sources:selected,receiptIds:receipts};
 }
}
