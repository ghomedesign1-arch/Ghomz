const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function load(path, deps, globals = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, { exports, require: n => deps[n], Response, Request, URL, URLSearchParams,
    AbortSignal, Buffer, Date, ...globals });
  return exports;
}
function fixture({ role='ADMIN', user='admin-1', changed={}, reply={}, env={} }={}) {
  const calls=[], logs=[];
  const rbac=load('src/lib/rbac.ts', {'@/auth': {auth:async()=>user?{user:{id:user,role}}:null}}, {console:{error:e=>logs.push(e)}});
  const variant={id:'gid://shopify/ProductVariant/46363984396459',title:'80x112',price:'12500.00',product:{id:'gid://shopify/Product/8714227810475',title:'Muffin',status:'DRAFT',updatedAt:'2026-10-05T12:00:00Z'}};
  const state={row:{id:'cmuvdzv1k000087mhwf7uk4w5',name:'Muffin',retailPrice:13000,updatedAt:new Date('2026-10-05T12:00:00Z'),...changed},
    shop:{myshopifyDomain:'13e79d-01.myshopify.com',currencyCode:'EGP'},variant,
    scopes:[{handle:'write_products'}],mutationError:false};
  const lib=load('src/lib/shopify-price.ts',{'server-only':{},'node:crypto':require('node:crypto'),'@/lib/rbac':rbac},{
    process:{env:{SHOPIFY_SHOP:'g-homz',SHOPIFY_CLIENT_ID:'fake-id',SHOPIFY_CLIENT_SECRET:'fake-secret',AUTH_SECRET:'test-signing-key',...env}},
    fetch:async(url,options)=>{
      calls.push({url,options});
      if(url.endsWith('access_token'))return Response.json({access_token:'fake-token'});
      const {query,variables}=JSON.parse(options.body);
      if(query.startsWith('mutation'))return Response.json({data:{productVariantsBulkUpdate:state.mutationError?{userErrors:[{message:'fake-token fake-secret'}]}:{productVariants:[{id:variant.id,price:variables.variants[0].price}],userErrors:[]}}});
      return Response.json({data:{shop:state.shop,productVariant:state.variant,currentAppInstallation:{accessScopes:state.scopes},...reply}});
    },
  });
  const route=load('src/app/api/products/[id]/shopify-price/route.ts',{'@/lib/rbac':rbac,'@/lib/shopify-price':lib,'@/lib/prisma':{prisma:{product:{findUnique:async()=>state.row}}}});
  const ctx={params:{id:lib.MUFFIN_ERP_ID}};
  const url=`https://ghomz.vercel.app/api/products/${ctx.params.id}/shopify-price`;
  return {lib,route,state,calls,logs,ctx,
    get:()=>route.GET(new Request(url),ctx),
    post:(approval,origin='https://ghomz.vercel.app')=>route.POST(new Request(url,{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify({approval,price:'1.00',variantId:'attacker'})}),ctx),
  };
}
test('preview is read-only; confirmed mutation contains exactly one mapped variant and price',async()=>{
  const f=fixture();const p=await(await f.get()).json();
  assert.equal(p.oldPrice,'12500.00');assert.equal(p.newPrice,'13000.00');assert.equal(p.status,'DRAFT');
  assert.equal(f.calls.filter(c=>String(c.options.body).includes('mutation')).length,0);
  assert.equal((await f.post(p.approval)).status,200);
  const writes=f.calls.filter(c=>String(c.options.body).includes('mutation'));
  assert.equal(writes.length,1);
  assert.deepEqual(JSON.parse(writes[0].options.body).variables,{productId:'gid://shopify/Product/8714227810475',variants:[{id:'gid://shopify/ProductVariant/46363984396459',price:'13000.00'}]});
  assert.equal(f.logs.length,0);
});
test('non-admin and unauthenticated calls cannot access preview or writes',async()=>{
  for(const args of [{role:'MANAGER'},{role:'VIEWER'},{role:'PRODUCTION'},{user:null}]){
    const f=fixture(args);assert.ok([401,403].includes((await f.get()).status));assert.ok([401,403].includes((await f.post('x')).status));assert.equal(f.calls.length,0);
  }
});
test('forged, expired, cross-user and cross-origin confirmations cannot write',async()=>{
  const f=fixture();const p=await(await f.get()).json();
  assert.equal((await f.post(p.approval+'x')).status,409);
  assert.equal((await f.post(p.approval,'https://evil.example')).status,403);
  for(const changes of [{expiresAt:0},{userId:'someone-else'},{productId:'other'}]){
    const claims=JSON.parse(Buffer.from(p.approval.split('.')[0],'base64url').toString());
    assert.equal((await f.post(f.lib.signApproval({...claims,...changes}))).status,409);
  }
  assert.equal(f.calls.filter(c=>String(c.options.body).includes('mutation')).length,0);
});
test('ERP changes, Shopify changes, wrong shop/variant/currency, and missing scope fail closed',async()=>{
  for(const change of [f=>f.state.row.retailPrice=14000,f=>f.state.row.updatedAt=new Date(),f=>f.state.variant.price='12600.00',f=>f.state.variant.product.updatedAt='changed',f=>f.state.shop.currencyCode='USD',f=>f.state.shop.myshopifyDomain='other.myshopify.com',f=>f.state.variant.id='other',f=>f.state.scopes=[]]){
    const f=fixture();const p=await(await f.get()).json();change(f);
    assert.ok([403,409].includes((await f.post(p.approval)).status));assert.equal(f.calls.filter(c=>String(c.options.body).includes('mutation')).length,0);
  }
});
test('matching prices are a no-op and mutation errors are sanitized without logging',async()=>{
  const same=fixture({changed:{retailPrice:12500}});const p=await(await same.get()).json();
  assert.equal(p.unchanged,true);assert.equal((await same.post(p.approval)).status,200);
  assert.equal(same.calls.filter(c=>String(c.options.body).includes('mutation')).length,0);
  const f=fixture();const preview=await(await f.get()).json();f.state.mutationError=true;
  const r=await f.post(preview.approval);assert.equal(r.status,502);assert.doesNotMatch(await r.text(),/fake-secret|fake-token/);assert.equal(f.logs.length,0);
});
test('unmapped ERP products and invalid prices never call Shopify',async()=>{
  const f=fixture();f.ctx.params.id='unknown';assert.equal((await f.get()).status,404);assert.equal(f.calls.length,0);
  for(const retailPrice of [0,-1,NaN,Infinity,12.345]){const f=fixture({changed:{retailPrice}});assert.equal((await f.get()).status,422);assert.equal(f.calls.length,0);}
});
