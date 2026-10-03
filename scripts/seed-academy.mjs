import {createClient} from '@libsql/client';
if(!process.env.TURSO_DATABASE_URL||!process.env.TURSO_AUTH_TOKEN)throw Error('Configure the production database before adding course drafts.');
const db=createClient({url:process.env.TURSO_DATABASE_URL,authToken:process.env.TURSO_AUTH_TOKEN});
const drafts=[
 ['gel-foundations','Gel Polish Foundations','Build a careful gel polish routine, from preparation to a clean, even finish.','Beginner',4900,'Nail preparation and hygiene\nControlled application\nFinishing and aftercare'],
 ['builder-gel','Builder Gel Technique','Study product control, structure and refinement for builder gel application.','Intermediate',7900,'Structure and balance\nProduct placement\nShaping and refinement'],
 ['nail-art','Modern Nail Art','Practise French tips, fine lines and decorative details, one technique at a time.','Creative',3900,'French tip placement\nFine line control\nCombining colour and detail'],
];
try{await db.batch(drafts.map(([id,title,description,level,price,outcomes])=>({sql:'INSERT OR IGNORE INTO courses(id,title,description,level,price,published,outcomes,requirements,access_policy) VALUES (?,?,?,?,?,0,?,?,?)',args:[id,title,description,level,price,outcomes,'The academy must confirm equipment and prerequisites before publishing.','Draft: add the training content, access duration and support terms before publishing.']})),'write');console.log('Three course drafts prepared. Existing courses were not changed.');}finally{db.close();}
