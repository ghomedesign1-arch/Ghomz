const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function load(file, dependencies, globals) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, { exports, require: name => dependencies[name], Response,
    URLSearchParams, AbortSignal, ...globals });
  return exports;
}

function fixture({ role = 'ADMIN', session = true, env = {}, replies = [] } = {}) {
  const calls = [], logs = [];
  const globals = { console: { error: (...args) => logs.push(args) } };
  const rbac = load('src/lib/rbac.ts', { '@/auth': {
    auth: async () => session ? { user: { id: 'test-user', role } } : null,
  } }, globals);
  const route = load('src/app/api/internal/shopify/connection-test/route.ts',
    { '@/lib/rbac': rbac }, { ...globals,
      process: { env: { SHOPIFY_SHOP: 'g-homz', SHOPIFY_CLIENT_ID: 'fake-id',
        SHOPIFY_CLIENT_SECRET: 'fake-secret', ...env } },
      fetch: async (url, options) => {
        calls.push({ url, options });
        const next = replies.shift();
        if (next instanceof Error) throw next;
        return Response.json(next?.body ?? {}, { status: next?.status ?? 200 });
      },
    });
  return { route, calls, logs };
}
const token = { body: { access_token: 'fake-token', expires_in: 86399 } };
const identity = { body: { data: { shop: { name: 'G-HOMZ',
  myshopifyDomain: 'g-homz.myshopify.com', extra: 'must-not-return' } } } };

test('only authenticated ADMIN callers reach Shopify', async () => {
  for (const options of [{ session: false }, { role: 'VIEWER' },
    { role: 'MANAGER' }, { role: 'PRODUCTION' }]) {
    const f = fixture(options);
    assert.equal((await f.route.GET()).status, options.session === false ? 401 : 403);
    assert.equal(f.calls.length, 0);
  }
});

test('missing credentials and untrusted host configurations fail before networking', async () => {
  for (const env of [{ SHOPIFY_CLIENT_SECRET: '' }, { SHOPIFY_SHOP: '' },
    ...['https://g-homz.myshopify.com', 'evil.com', 'g-homz.myshopify.com/evil',
      'g-homz.myshopify.com:443', 'g-homz.myshopify.com@evil.com'].map(SHOPIFY_SHOP => ({ SHOPIFY_SHOP }))]) {
    const f = fixture({ env });
    assert.equal((await f.route.GET()).status, 503);
    assert.equal(f.calls.length, 0);
  }
});

test('exchanges credentials server-side and returns only matching shop identity', async () => {
  for (const SHOPIFY_SHOP of ['g-homz', ' G-HOMZ.myshopify.com ']) {
    const f = fixture({ env: { SHOPIFY_SHOP }, replies: [token, identity] });
    const response = await f.route.GET();
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'private, no-store');
    assert.deepEqual(await response.json(), { ok: true,
      shop: { name: 'G-HOMZ', myshopifyDomain: 'g-homz.myshopify.com' } });
    assert.equal(f.calls.length, 2);
    const [auth, graphql] = f.calls;
    assert.equal(auth.url, 'https://g-homz.myshopify.com/admin/oauth/access_token');
    assert.deepEqual(Object.fromEntries(auth.options.body), {
      grant_type: 'client_credentials', client_id: 'fake-id', client_secret: 'fake-secret' });
    assert.equal(graphql.url, 'https://g-homz.myshopify.com/admin/api/2026-07/graphql.json');
    assert.equal(graphql.options.headers['X-Shopify-Access-Token'], 'fake-token');
    assert.deepEqual(JSON.parse(graphql.options.body), {
      query: 'query ConnectionTest { shop { name myshopifyDomain } }' });
    for (const { options } of f.calls) {
      assert.equal(options.method, 'POST');
      assert.equal(options.redirect, options === auth.options ? 'error' : 'manual');
      assert.equal(options.cache, 'no-store');
      assert.ok(options.signal);
    }
    assert.equal(f.logs.length, 0);
  }
});

test('upstream failures, partial results and invalid domains never leak or log secrets', async () => {
  const failures = [
    [{ status: 401, body: { error: 'fake-secret' } }],
    [new Error('fake-secret fake-token')],
    [{ body: { access_token: 'fake-token' } }],
    [token, { status: 500, body: { error: 'fake-token' } }],
    [token, new Error('fake-token')],
    [token, { body: { ...identity.body, errors: [{ message: 'fake-token' }] } }],
    [token, { body: { data: { shop: { name: 'Other', myshopifyDomain: 'untrusted.example.com' } } } }],
    [token, { body: {} }],
  ];
  for (const replies of failures) {
    const f = fixture({ replies });
    const response = await f.route.GET();
    assert.equal(response.status, 502);
    assert.doesNotMatch(await response.text(), /fake-secret|fake-token/);
    assert.equal(f.logs.length, 0);
  }
});


test('supports the existing lowercase Vercel variable names', async () => {
  const f = fixture({ env: {
    SHOPIFY_SHOP: undefined, SHOPIFY_CLIENT_ID: undefined, SHOPIFY_CLIENT_SECRET: undefined,
    shopify_shop: 'g-homz.myshopify.com', shopify_client_id: 'fake-id',
    shopify_client_secret: 'fake-secret',
  }, replies: [token, identity] });
  assert.equal((await f.route.GET()).status, 200);
  assert.equal(f.calls[0].options.body.get('client_secret'), 'fake-secret');
});


test('accepts Shopify permanent identity for a branded alias without changing request hosts', async () => {
  const f = fixture({ replies: [token, { body: { data: { shop: {
    name: 'G-homz', myshopifyDomain: '13e79d-01.myshopify.com',
  } } } }] });
  const response = await f.route.GET();
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true, shop: {
    name: 'G-homz', myshopifyDomain: '13e79d-01.myshopify.com',
  } });
  assert.ok(f.calls.every(call => new URL(call.url).hostname === 'g-homz.myshopify.com'));
  assert.equal(f.calls.length, 2);
  assert.equal(f.logs.length, 0);
});
