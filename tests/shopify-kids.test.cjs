const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const ts=require('typescript');
const catalog=require('../src/lib/shopify-kids-catalog.json');
function load(file,deps){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:n=>deps[n],Response,Request,URL,console});return exports;}
function fixture(role='ADMIN'){
 const rbac=load('src/lib/rbac.ts',{'@/auth':{auth:async()=>role?{user:{role,id:'admin'}}:null}});
 const initial=[{id:'cmq47b5bc0003retibny481ni',sku:'GH-Bed-Suger',category:'KIDS_BED',parentId:null,heightCm:90,retailPrice:12500},{id:'cmsvp6x11000011mrte0pjb9e',sku:'GH-Bed-Tiny',category:'KIDS_BED',parentId:null,heightCm:100,retailPrice:12500}];
 const state={rows:structuredClone(initial),settings:[],calls:0,fail:false,live:{shop:{myshopifyDomain:'13e79d-01.myshopify.com',currencyCode:'EGP'},nodes:catalog.map(p=>({id:p.id,title:p.name,status:p.status,variants:{pageInfo:{hasNextPage:false},nodes:p.variants.map(v=>({id:v.id,title:v.title,sku:v.sku,price:String(v.price)}))}}))}};
 const db={setting:{findMany:async()=>state.settings},$transaction:async fn=>{
  const rows=structuredClone(state.rows),settings=structuredClone(state.settings);
  const result=await fn({$queryRaw:async()=>[],product:{findMany:async()=>rows,createMany:async({data})=>{rows.push(...data);}},setting:{findMany:async()=>settings,createMany:async({data})=>{if(state.fail)throw new Error('rollback');settings.push(...data);}}});
  state.rows=rows;state.settings=settings;return result;
 }};
 const lib=load('src/lib/shopify-kids-import.ts',{'server-only':{},'node:crypto':require('node:crypto'),'@/lib/prisma':{prisma:db},'@/lib/rbac':rbac,'./shopify-kids-catalog.json':{default:catalog},'@/lib/shopify-price':{shopifyClient:async()=>async q=>{assert.ok(!q.includes('mutation'));state.calls++;return state.live;}}});
 const route=load('src/app/api/internal/shopify/kids-import/route.ts',{'@/lib/rbac':rbac,'@/lib/shopify-kids-import':lib});
 const post=(revision=lib.KIDS_REVISION,origin='https://ghomz.vercel.app')=>route.POST(new Request('https://ghomz.vercel.app/api/internal/shopify/kids-import',{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify({revision})}));
 return{state,initial,lib,route,post};
}
test('imports all 106 variants with unique mappings; preserves old records; retry is a no-op',async()=>{
 const f=fixture();const r=await f.lib.importKids();assert.equal(r.imported,106);assert.equal(r.createdRecords,108);assert.deepEqual(f.state.rows.slice(0,2),f.initial);
 const links=f.state.settings.filter(s=>s.key.startsWith('shopify.variant.'));assert.equal(links.length,106);assert.equal(new Set(links.map(s=>JSON.parse(s.value).erpProductId)).size,106);
 const added=f.state.rows.slice(2);assert.ok(added.every(r=>r.heightCm===90&&r.stockQty===0));assert.equal(added.filter(r=>!r.active).length,2);
 assert.equal(new Set(f.state.rows.map(r=>r.sku.toUpperCase())).size,f.state.rows.length);
 const repeat=await f.lib.importKids();assert.equal(repeat.imported,0);assert.equal(repeat.createdRecords,0);assert.equal(f.state.rows.length,110);
});
test('Shopify drift, wrong shop/currency, missing variants and truncated results fail before writes',async()=>{
 for(const change of [s=>s.live.shop.currencyCode='USD',s=>s.live.shop.myshopifyDomain='wrong.myshopify.com',s=>s.live.nodes[0].variants.nodes[0].sku='wrong',s=>s.live.nodes[0].variants.nodes.pop(),s=>s.live.nodes[0].variants.pageInfo.hasNextPage=true,s=>s.live.nodes[0].variants.nodes[0].price='1']){
  const f=fixture();change(f.state);await assert.rejects(f.lib.importKids());assert.equal(f.state.rows.length,2);assert.equal(f.state.settings.length,0);
 }
});
test('SKU conflicts and failed transactions leave the ERP untouched',async()=>{
 const f=fixture();f.state.rows.push({id:'conflict',sku:catalog[0].variants[0].sku.toLowerCase()});await assert.rejects(f.lib.importKids());assert.equal(f.state.rows.length,3);assert.equal(f.state.settings.length,0);
 const g=fixture();g.state.fail=true;await assert.rejects(g.lib.importKids());assert.deepEqual(g.state.rows,g.initial);assert.equal(g.state.settings.length,0);
});
test('only admins can preview/import; foreign origins and stale revisions cannot import',async()=>{
 for(const role of ['MANAGER','VIEWER','PRODUCTION',null]){const f=fixture(role);assert.ok([401,403].includes((await f.route.GET()).status));assert.ok([401,403].includes((await f.post()).status));assert.equal(f.state.calls,0);}
 const f=fixture();assert.equal((await f.post('stale')).status,409);assert.equal((await f.post(f.lib.KIDS_REVISION,'https://other.test')).status,403);assert.equal(f.state.calls,0);
});
