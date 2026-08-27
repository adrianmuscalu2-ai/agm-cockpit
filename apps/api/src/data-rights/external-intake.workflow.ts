import { createHash, randomBytes } from 'crypto';
import type { PrismaService } from '../prisma/prisma.service';

export type ExternalDsarNotifier=(message:{requestId:string;destination:string;verificationCode:string;expiresAt:Date})=>Promise<void>;
const hash=(value:string)=>createHash('sha256').update(value).digest('hex');

export class ExternalDsarIntakeWorkflow{
  constructor(private readonly prisma:PrismaService,private readonly notifier:ExternalDsarNotifier,private readonly now=()=>new Date()){}
  async intake(input:{email:string;requestType:string}){
    const email=input.email.trim().toLowerCase();if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))return{accepted:true};
    const contactHash=hash(email);const duplicates=await this.prisma.$queryRawUnsafe<Array<{id:string}>>('SELECT id FROM "DataRightsExternalRequest" WHERE "contactHash"=$1 AND status IN (\'IDENTITY_PENDING\',\'VERIFIED\') LIMIT 1',contactHash);if(duplicates.length)return{accepted:true};
    const user=await this.prisma.user.findFirst({where:{email:{equals:email,mode:'insensitive'}},select:{id:true,companyId:true,status:true}});
    const code=randomBytes(16).toString('hex');const expiresAt=new Date(this.now().getTime()+30*60_000);
    const rows=await this.prisma.$queryRawUnsafe<Array<{id:string}>>('INSERT INTO "DataRightsExternalRequest" (id,"companyId","subjectUserId","contactHash","requestType",status,"verificationTokenHash","verificationExpiresAt","notificationStatus","updatedAt",metadata) VALUES (gen_random_uuid(),$1::uuid,$2::uuid,$3,$4,$5,$6,$7,\'PENDING\',CURRENT_TIMESTAMP,$8::jsonb) RETURNING id',user?.companyId??null,user?.id??null,contactHash,input.requestType,user?'IDENTITY_PENDING':'IDENTITY_EVIDENCE_REQUIRED',hash(code),expiresAt,JSON.stringify({identityPath:user?'ACCOUNT_EMAIL_CHALLENGE':'MANUAL_FORMER_USER_EVIDENCE',auditContent:'HASHES_AND_STATUS_ONLY'}));const request=rows[0];
    if(user){try{await this.notifier({requestId:request.id,destination:email,verificationCode:code,expiresAt});await this.prisma.$executeRawUnsafe('UPDATE "DataRightsExternalRequest" SET "notificationStatus"=\'SENT\',"updatedAt"=CURRENT_TIMESTAMP WHERE id=$1::uuid',request.id);}catch{await this.prisma.$executeRawUnsafe('UPDATE "DataRightsExternalRequest" SET "notificationStatus"=\'FAILED\',status=\'NOTIFICATION_FAILED\',"updatedAt"=CURRENT_TIMESTAMP WHERE id=$1::uuid',request.id);}}
    return{accepted:true};
  }
  async verify(requestId:string,code:string){const rows=await this.prisma.$queryRawUnsafe<Array<{status:string;verificationExpiresAt:Date|null;verificationTokenHash:string|null}>>('SELECT status,"verificationExpiresAt","verificationTokenHash" FROM "DataRightsExternalRequest" WHERE id=$1::uuid',requestId);const request=rows[0];if(!request||request.status!=='IDENTITY_PENDING'||!request.verificationExpiresAt||new Date(request.verificationExpiresAt)<=this.now()||request.verificationTokenHash!==hash(code))return{verified:false};await this.prisma.$executeRawUnsafe('UPDATE "DataRightsExternalRequest" SET status=\'VERIFIED\',"verifiedAt"=$2,"verificationTokenHash"=NULL,"updatedAt"=CURRENT_TIMESTAMP WHERE id=$1::uuid',requestId,this.now());return{verified:true};}
}
