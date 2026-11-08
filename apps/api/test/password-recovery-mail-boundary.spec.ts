import { ConfigService } from '@nestjs/config';
import { GmailCommunicationProvider } from '../src/communications/providers/gmail.provider';

describe('Recovery email ownership boundary',()=>{
  const normal={id:'ordinary',payload:{headers:[{name:'Subject',value:'Loading appointment'}],mimeType:'text/plain',body:{data:Buffer.from('Normal business message').toString('base64url')}}};
  const recovery={id:'security',payload:{headers:[{name:'Subject',value:'[AGM ACCOUNT RECOVERY] Reset'}],mimeType:'text/plain',body:{data:Buffer.from('https://app.agmcockpit.com/access#password-reset=secret').toString('base64url')}}};
  it.each(['searchInbox','readRecent','readThread','readHistory'] as const)('keeps account recovery messages outside %s',async operation=>{
    const provider=new GmailCommunicationProvider(new ConfigService({GMAIL_ACCESS_TOKEN:'test-token',GMAIL_FROM_ADDRESS:'sender@example.invalid'}));
    jest.spyOn(provider as never,'gmail' as never).mockImplementation((async (route:string)=>{
      let value:unknown;
      if(route.startsWith('/threads/'))value={messages:[normal,recovery]};
      else if(route.startsWith('/history'))value={history:[{messagesAdded:[{message:{id:normal.id}},{message:{id:recovery.id}}]}]};
      else if(route.startsWith('/messages?'))value={messages:[{id:normal.id},{id:recovery.id}]};
      else value=route.includes('ordinary')?normal:recovery;
      return new Response(JSON.stringify(value),{status:200});
    }) as never);
    const messages=operation==='readHistory'?await provider.readHistory('history','event')
      :operation==='readThread'?await provider.readThread('thread')
      :operation==='searchInbox'?await provider.searchInbox('')
      :await provider.readRecent();
    expect(messages).toHaveLength(1);
    expect(JSON.stringify(messages)).toContain('Normal business message');
    expect(JSON.stringify(messages)).not.toContain('password-reset');
    expect(JSON.stringify(messages)).not.toContain('security');
  });
});
