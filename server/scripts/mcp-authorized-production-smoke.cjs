const { createHash, randomBytes } = require('node:crypto');
require('dotenv').config({ path: process.env.MCP_SMOKE_ENV || '/opt/etloj/server/.env' });
const { JwtService } = require('@nestjs/jwt');
const { PrismaClient } = require('@prisma/client');
const { Client, StreamableHTTPClientTransport } = require('@modelcontextprotocol/client');

const origin = process.env.MCP_SMOKE_ORIGIN || 'http://127.0.0.1:3000';
const publicOrigin = process.env.MCP_PUBLIC_BASE_URL || 'https://etloj.space';
const resource = `${publicOrigin.replace(/\/$/, '')}/mcp/private`;
const redirectUri = 'http://127.0.0.1:49152/callback';
const prisma = new PrismaClient();

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function request(path, { method = 'GET', body, webJwt } = {}) {
  const response = await fetch(`${origin}${path}`, {
    method,
    headers: {
      Host: new URL(publicOrigin).host,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(webJwt ? { Authorization: `Bearer ${webJwt}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`${method} ${path} failed with HTTP ${response.status}: ${payload.error || 'unexpected response'}`);
  return payload;
}

async function authorize(clientId, user, webJwt, scope) {
  const verifier = randomBytes(48).toString('base64url');
  const codeChallenge = createHash('sha256').update(verifier).digest('base64url');
  const state = randomBytes(18).toString('base64url');
  const approved = await request('/api/mcp-oauth/authorize', {
    method: 'POST',
    webJwt,
    body: {
      response_type: 'code',
      client_id: clientId,
      redirect_uri: redirectUri,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      resource,
      scope,
      state,
      approved: true,
    },
  });
  const callback = new URL(approved.redirect_uri);
  assert(callback.searchParams.get('state') === state, 'Authorization state mismatch.');
  assert(callback.searchParams.get('iss') === publicOrigin, 'Authorization issuer mismatch.');
  const code = callback.searchParams.get('code');
  assert(code, 'Authorization code missing.');
  return request('/api/mcp-oauth/token', {
    method: 'POST',
    body: {
      grant_type: 'authorization_code',
      code,
      client_id: clientId,
      redirect_uri: redirectUri,
      code_verifier: verifier,
      resource,
    },
  });
}

async function connect(accessToken) {
  const transport = new StreamableHTTPClientTransport(new URL(`${origin}/mcp/private`), {
    requestInit: {
      headers: {
        Host: new URL(publicOrigin).host,
        Authorization: `Bearer ${accessToken}`,
      },
    },
  });
  const client = new Client({ name: 'etloj-authorized-production-smoke', version: '1.0.0' });
  await client.connect(transport);
  return client;
}

async function revoke(clientId, token) {
  await request('/api/mcp-oauth/revoke', {
    method: 'POST',
    body: { client_id: clientId, token },
  });
}

async function main() {
  assert(process.env.JWT_SECRET, 'JWT_SECRET is unavailable.');
  const user = await prisma.user.findFirst({
    where: { isActive: true, status: 'APPROVED' },
    orderBy: [{ submissions: { _count: 'desc' } }, { id: 'asc' }],
    select: { id: true, username: true, role: true },
  });
  assert(user, 'No active approved user exists for production acceptance.');
  const publicProblems = await prisma.problem.findMany({
    where: { isPublic: true },
    orderBy: { id: 'asc' },
    take: 3,
    select: { id: true },
  });
  assert(publicProblems.length > 0, 'No public problems exist for production acceptance.');

  const webJwt = new JwtService({ secret: process.env.JWT_SECRET }).sign({
    sub: user.id,
    username: user.username,
    role: user.role,
  }, { expiresIn: '5m' });
  const registration = await request('/api/mcp-oauth/register', {
    method: 'POST',
    body: {
      client_name: 'ETLOJ production acceptance',
      redirect_uris: [redirectUri],
      token_endpoint_auth_method: 'none',
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
    },
  });
  assert(registration.client_id, 'Dynamic client registration failed.');

  const full = await authorize(registration.client_id, user, webJwt, 'problems:read submissions:read');
  let fullClient;
  let limitedClient;
  let limited;
  try {
    fullClient = await connect(full.access_token);
    const tools = await fullClient.listTools();
    const names = tools.tools.map((tool) => tool.name).sort();
    assert(names.length === 9, `Expected 9 private endpoint tools, received ${names.length}.`);
    for (const name of ['get_my_problem_status', 'list_my_submissions', 'get_submission']) {
      assert(names.includes(name), `Missing private tool ${name}.`);
    }

    const status = await fullClient.callTool({
      name: 'get_my_problem_status',
      arguments: { problemIds: publicProblems.map((problem) => problem.id), userId: user.id + 1 },
    });
    assert(status.isError !== true, 'Problem status call failed.');
    assert(status.structuredContent.items.length === publicProblems.length, 'Problem status count mismatch.');

    const submissions = await fullClient.callTool({
      name: 'list_my_submissions',
      arguments: { page: 1, pageSize: 10, userId: user.id + 1 },
    });
    assert(submissions.isError !== true, 'Submission list call failed.');
    const expectedCount = await prisma.submission.count({
      where: { userId: user.id, problem: { isPublic: true } },
    });
    assert(submissions.structuredContent.total === expectedCount, 'Authenticated identity isolation failed.');

    let detailVerified = false;
    const first = submissions.structuredContent.items[0];
    if (first) {
      const owner = await prisma.submission.findUnique({ where: { id: first.id }, select: { userId: true } });
      assert(owner && owner.userId === user.id, 'Submission ownership mismatch.');
      const detail = await fullClient.callTool({ name: 'get_submission', arguments: { submissionId: first.id, userId: user.id + 1 } });
      assert(detail.isError !== true, 'Submission detail call failed.');
      assert(detail.structuredContent.sourceCodeIncluded === false, 'Source-code minimization flag missing.');
      assert(!Object.hasOwn(detail.structuredContent, 'code'), 'Source code leaked in submission detail.');
      detailVerified = true;
    }

    limited = await authorize(registration.client_id, user, webJwt, 'problems:read');
    limitedClient = await connect(limited.access_token);
    let insufficientScope = false;
    try {
      await limitedClient.callTool({ name: 'list_my_submissions', arguments: { page: 1, pageSize: 1 } });
    } catch (error) {
      insufficientScope = /403|scope/i.test(error instanceof Error ? error.message : String(error));
    }
    assert(insufficientScope, 'Scope-insufficient request was not rejected.');

    console.log('authorized_flow_ok true');
    console.log('private_tools_total', names.length);
    console.log('problem_status_total', status.structuredContent.items.length);
    console.log('submission_summaries_total', submissions.structuredContent.total);
    console.log('submission_detail_verified', detailVerified);
    console.log('identity_override_rejected true');
    console.log('insufficient_scope_rejected true');
    console.log('actor_role', user.role);
  } finally {
    if (limitedClient) await limitedClient.close().catch(() => {});
    if (fullClient) await fullClient.close().catch(() => {});
    for (const tokens of [limited, full]) {
      if (!tokens) continue;
      await revoke(registration.client_id, tokens.access_token).catch(() => {});
      await revoke(registration.client_id, tokens.refresh_token).catch(() => {});
    }
  }

  let revoked = false;
  try {
    const client = await connect(full.access_token);
    await client.close();
  } catch (error) {
    revoked = /401|invalid|unauthorized/i.test(error instanceof Error ? error.message : String(error));
  }
  assert(revoked, 'Revoked access token was accepted.');
  console.log('revocation_verified true');
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
