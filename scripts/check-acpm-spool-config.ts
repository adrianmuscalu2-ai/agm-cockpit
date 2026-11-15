import { AcpmSpool } from '../apps/api/src/acpm/acpm.spool';

async function main(){
 const spool=new AcpmSpool();await spool.initialization;
 const status=spool.status();
 console.log(JSON.stringify(status));
 if(!status.enabled||!status.owner||status.error||status.directory!==process.env.ACPM_SPOOL_DIR)process.exitCode=1;
 spool.close();
}
main().catch(error=>{console.error(error);process.exitCode=1;});
