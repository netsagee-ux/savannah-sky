import {createClient, type Client, type InValue, type ResultSet} from '@libsql/client';
let client:Client|undefined;
function connection(){
 if(!process.env.TURSO_DATABASE_URL||!process.env.TURSO_AUTH_TOKEN)throw new Error('Database connection is not configured.');
 return client??=createClient({url:process.env.TURSO_DATABASE_URL,authToken:process.env.TURSO_AUTH_TOKEN});
}
function result<T>(r:ResultSet){return {results:r.rows as unknown as T[],success:true,meta:{changes:r.rowsAffected}};}
class Statement{
 constructor(readonly sql:string,readonly args:InValue[]=[]){ }
 bind(...args:unknown[]){return new Statement(this.sql,args as InValue[]);}
 async all<T=Record<string,unknown>>(){return result<T>(await connection().execute({sql:this.sql,args:this.args}));}
 async first<T=Record<string,unknown>>(){return (await this.all<T>()).results[0]??null;}
 async run(){return this.all();}
}
export function database(){return {
 prepare:(sql:string)=>new Statement(sql),
 // libSQL write batches are atomic: payment and enrolment either both commit or both roll back.
 batch:async(statements:Statement[])=> (await connection().batch(statements.map(s=>({sql:s.sql,args:s.args})),'write')).map(result),
};}
