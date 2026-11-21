import { assistantThinkingProfile, needsConversationPlanning } from '@agm/shared';
import { PremiumAssistantService, requiresLiveSearch } from '../src/premium-assistant/premium-assistant.service';

const config = { get:(key:string, fallback?:string)=>key==='OPENAI_API_KEY'?'test-key':fallback } as any;
const user = {userId:'u',companyId:'c',roles:['PREMIUM_ACCESS'],requestId:'r',correlationId:'c'};
const request = {productId:'agm-cockpit' as const,moduleId:'premium-cockpit',language:'ro',confirmedText:'Organizează agenda de azi: 09:00 atelier, 11:00 client, 14:00 depozit.',history:[]};

describe('AGMA conversational planning without execution authority',()=>{
  afterEach(()=>jest.restoreAllMocks());
  it('preserves an agenda and reasons without searching the public web for private events',async()=>{
    const provider=jest.spyOn(global,'fetch').mockResolvedValue(new Response(JSON.stringify({status:'completed',output_text:'Plan propus pentru ziua ta, înainte de confirmarea în calendar:\n- 09:00 atelier\n- 11:00 client\n- 14:00 depozit'})));
    const result=await new PremiumAssistantService(config).respond(user,request);
    for(const time of ['09:00','11:00','14:00'])expect(result.text).toContain(time);
    expect(result.externalEffectPerformed).toBe(false);
    const body=JSON.parse(String(provider.mock.calls[0][1]?.body));
    expect(body.reasoning.effort).toBe('medium');
    expect(body.max_output_tokens).toBeGreaterThanOrEqual(2048);
    expect(body.tools).toBeUndefined();
    expect(body.input[0].content).toContain('belong exclusively to Guardian');
    expect(body.input[0].content).toContain('never that a message was sent or an event saved');
  });
  it('keeps analysis for a correction to a plan, but handles a greeting quickly',()=>{
    expect(assistantThinkingProfile({...request,confirmedText:'Mută întâlnirea după prânz.',history:[{role:'user',text:request.confirmedText}]}).effort).toBe('medium');
    expect(assistantThinkingProfile({...request,confirmedText:'Salut!'}).effort).toBe('none');
    expect(needsConversationPlanning('Scrie un mesaj pentru Mona și apoi programează întâlnirea.')).toBe(true);
    expect(needsConversationPlanning('Sună Mona Vodafone')).toBe(false);
    expect(needsConversationPlanning('Write a message and then add a meeting')).toBe(true);
    expect(needsConversationPlanning('Schreibe eine Nachricht und erstelle einen Termin')).toBe(true);
  });
  it('still requires verified public information when a plan depends on weather',()=>{
    expect(requiresLiveSearch('Organizează agenda după vremea de azi')).toBe(true);
  });
  it('does not present a truncated provider plan as a complete answer',async()=>{
    jest.spyOn(global,'fetch').mockResolvedValue(new Response(JSON.stringify({status:'incomplete',output_text:'Am pregătit primul pas...'})));
    await expect(new PremiumAssistantService(config).respond(user,request)).rejects.toThrow('incomplete');
  });
  it('rejects an interrupted stream even when a text fragment arrived',async()=>{
    jest.spyOn(global,'fetch').mockResolvedValue(new Response('data: {"type":"response.output_text.delta","delta":"Plan incomplet"}\n\n',{headers:{'content-type':'text/event-stream'}}));
    await expect(new PremiumAssistantService(config).respond(user,request)).rejects.toThrow('incomplete');
  });
  it('accepts a completed stream and keeps the proposed time',async()=>{
    const events=[{type:'response.output_text.delta',delta:'Plan propus: atelier la 09:00.'},{type:'response.completed',response:{status:'completed'}}];
    jest.spyOn(global,'fetch').mockResolvedValue(new Response(events.map(event=>`data: ${JSON.stringify(event)}\n\n`).join(''),{headers:{'content-type':'text/event-stream'}}));
    const result=await new PremiumAssistantService(config).respond(user,request);
    expect(result.text).toContain('09:00');
    expect(result.externalEffectPerformed).toBe(false);
  });
});
