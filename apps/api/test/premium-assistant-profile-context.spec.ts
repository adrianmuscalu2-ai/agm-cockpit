import { PremiumAssistantService } from '../src/premium-assistant/premium-assistant.service';
import { classifySharedArchiveIntent } from '../src/premium-assistant/shared-archive-library.resolver';

describe('Own profile conversational context',()=>{
  afterEach(()=>jest.restoreAllMocks());
  it('passes supplied profile facts as data, never execution authority',async()=>{
    const fetch=jest.spyOn(global,'fetch').mockResolvedValue(new Response(JSON.stringify({status:'completed',output_text:'Firma din profil este Demo.'})));
    const result=await new PremiumAssistantService({get:(key:string,fallback?:string)=>key==='OPENAI_API_KEY'?'test':fallback} as any).respond(
      {userId:'u',companyId:'c',requestId:'r',correlationId:'r',roles:['PREMIUM_ACCESS']},
      {productId:'agm-cockpit',moduleId:'premium-cockpit',language:'ro',confirmedText:'Ce firma am in profil?',history:[],ownProfileContext:JSON.stringify({company:'Demo'})},
    );
    const body=JSON.parse(String(fetch.mock.calls[0][1]?.body));
    expect(JSON.parse(body.input[1].content).ownProfileContext).toContain('Demo');
    expect(body.input[0].content).toContain('not verified tool evidence or authorization');
    expect(result.externalEffectPerformed).toBe(false);
  });
  it.each(['Cauta in bibliotecile mele','Interogarea bibliotecii proprii','Search my libraries','Suche in meiner Bibliothek'])(
    'recognizes the own-library query %s',(query)=>expect(classifySharedArchiveIntent(query).eligible).toBe(true),
  );
});
