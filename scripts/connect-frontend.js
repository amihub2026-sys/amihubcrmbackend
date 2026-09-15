import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, join } from "node:path";
const folder = process.argv[2];
if (!folder) {
  console.error(
    'Usage: npm run connect:frontend -- "C:\\path\\to\\your-angular-frontend"',
  );
  process.exit(1);
}
const file = join(
  resolve(folder),
  "src/app/core/services/crm-store.service.ts",
);
let source = readFileSync(file, "utf8");
if (source.includes("private paymentKeys=new Map")) {
  console.log(
    "Frontend already contains the integration changes. No changes made.",
  );
  process.exit(0);
}
const replacements = [
  [
    "private allowed:string[]=[];",
    "private allowed:string[]=[];\n private paymentKeys=new Map<string,string>();",
  ],
  [
    "body,withCredentials:true",
    "body,withCredentials:true,headers:path==='/payments'&&method==='POST'?{'Idempotency-Key':this.paymentKey(body)}:{}",
  ],
  [
    "list(key:string):any[]",
    "private paymentKey(body:unknown):string {const fingerprint=JSON.stringify(body);let key=this.paymentKeys.get(fingerprint);if(!key){key=crypto.randomUUID();this.paymentKeys.set(fingerprint,key);}return key;}\n list(key:string):any[]",
  ],
  [
    "this.records.update(state=>({...state,[key]:[result.record",
    "if(key==='payments')this.paymentKeys.delete(JSON.stringify(body));\n this.records.update(state=>({...state,[key]:[result.record",
  ],
  [
    "'/subscriptions/'+subscription.id+'/invoice',{}",
    "'/subscriptions/'+subscription.id+'/invoice',{cycleDate:subscription.nextBillingDate}",
  ],
  [
    "?['invoices','installments']:key==='invoices'",
    "?['invoices','installments','promises']:key==='invoices'",
  ],
];
for (const [before, after] of replacements) {
  if (!source.includes(before)) {
    console.error(
      "Frontend differs from the supplied version. No files changed; review the integration instructions in README.md.",
    );
    process.exit(1);
  }
  source = source.replace(before, after);
}
const backup = file + ".before-backend";
if (existsSync(backup)) {
  console.error(
    "A backup already exists. Review it before running this command again. No files changed.",
  );
  process.exit(1);
}
writeFileSync(backup, readFileSync(file));
writeFileSync(file, source);
console.log(
  "CRM store updated. Original saved beside it as crm-store.service.ts.before-backend. Run npm run build in the frontend folder.",
);
