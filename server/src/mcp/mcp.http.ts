import {
  bearerAuthChallengeResponse,
  buildOAuthProtectedResourceMetadata,
  createMcpHandler,
  getOAuthProtectedResourceMetadataUrl,
  verifyBearerToken,
} from '@modelcontextprotocol/server';
import {
  hostHeaderValidation,
  toNodeHandler,
} from '@modelcontextprotocol/node';
import type { Express, Request, Response } from 'express';
import { McpService } from './mcp.service';
import { McpOAuthService } from './auth/mcp-oauth.service';

export function mountMcpEndpoint(
  expressApp: Express,
  mcpService: McpService,
  oauthService: McpOAuthService,
): void {
  expressApp.set('trust proxy', 'loopback');
  const mcpHandler = toNodeHandler(
    createMcpHandler(() => mcpService.createServer()),
  );
  const privateMcpHandler = toNodeHandler(
    createMcpHandler(() => mcpService.createServer(true)),
  );
  const adminPrivateMcpHandler = toNodeHandler(
    createMcpHandler(() => mcpService.createServer(true, true)),
  );
  const resourceMetadataUrl = getOAuthProtectedResourceMetadataUrl(
    new URL(oauthService.resourceUrl),
  );
  const resourceMetadataPath = new URL(resourceMetadataUrl).pathname;
  const allowedHosts = (
    process.env.MCP_ALLOWED_HOSTS || 'etloj.space,localhost,127.0.0.1,[::1]'
  )
    .split(',')
    .map((host) => host.trim())
    .filter(Boolean);
  const validateHost = hostHeaderValidation(allowedHosts);

  const protectedResourceMetadata = buildOAuthProtectedResourceMetadata({
    oauthMetadata: oauthService.metadata,
    resourceServerUrl: new URL(oauthService.resourceUrl),
    scopesSupported: [
      'problems:read',
      'submissions:read',
      'testcases:read',
      'testcases:write',
    ],
    resourceName: 'ETLOJ learning progress and administrator testcases',
    serviceDocumentationUrl: new URL(
      `${oauthService.publicBaseUrl}/#mcp-guide-title`,
    ),
    dangerouslyAllowInsecureIssuerUrl:
      oauthService.publicBaseUrl.startsWith('http://localhost') ||
      oauthService.publicBaseUrl.startsWith('http://127.0.0.1'),
  });

  expressApp.get(resourceMetadataPath, (req: Request, res: Response) => {
    if (!validateHost(req, res)) return;
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.json(protectedResourceMetadata);
  });

  expressApp.get(
    '/.well-known/oauth-authorization-server',
    (req: Request, res: Response) => {
      if (!validateHost(req, res)) return;
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.json(oauthService.metadata);
    },
  );

  expressApp.all('/mcp/private', async (req: Request, res: Response) => {
    if (!validateHost(req, res)) return;
    if (!consumeRateLimit(req, res, mcpService)) return;

    const requiredScopes = requiredScopesForRequest(req.body);
    try {
      const auth = await verifyBearerToken(req.headers.authorization, {
        verifier: oauthService,
        requiredScopes,
        resourceMetadataUrl,
      });
      (req as Request & { auth: typeof auth }).auth = auth;
      const handler =
        auth.extra?.role === 'ADMIN'
          ? adminPrivateMcpHandler
          : privateMcpHandler;
      await handler(req, res, req.body);
    } catch (error) {
      await sendWebResponse(
        res,
        bearerAuthChallengeResponse(error, {
          requiredScopes,
          resourceMetadataUrl,
        }),
      );
    }
  });

  expressApp.all('/mcp', async (req: Request, res: Response) => {
    if (!validateHost(req, res)) return;
    if (!consumeRateLimit(req, res, mcpService)) return;

    try {
      await mcpHandler(req, res, req.body);
    } catch (error) {
      console.error('MCP HTTP handler failed', error);
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: '2.0',
          error: { code: -32603, message: 'Internal ETLOJ error.' },
          id: null,
        });
      }
    }
  });
}

function consumeRateLimit(
  req: Request,
  res: Response,
  mcpService: McpService,
): boolean {
  const rateLimit = mcpService.consumeRateLimit(
    req.ip || req.socket.remoteAddress || 'unknown',
  );
  if (rateLimit.allowed) return true;
  res.setHeader('Retry-After', String(rateLimit.retryAfterSeconds));
  res.status(429).json({
    jsonrpc: '2.0',
    error: { code: -32000, message: 'MCP rate limit exceeded.' },
    id: null,
  });
  return false;
}

function requiredScopesForRequest(body: unknown): string[] {
  if (!body || typeof body !== 'object') return [];
  const request = body as { method?: unknown; params?: { name?: unknown } };
  if (request.method !== 'tools/call') return [];
  if (request.params?.name === 'get_my_problem_status')
    return ['problems:read'];
  if (
    request.params?.name === 'list_my_submissions' ||
    request.params?.name === 'get_submission'
  )
    return ['submissions:read'];
  if (
    request.params?.name === 'list_problem_testcases' ||
    request.params?.name === 'get_problem_testcase'
  )
    return ['testcases:read'];
  if (
    request.params?.name === 'add_problem_testcase' ||
    request.params?.name === 'delete_problem_testcase'
  )
    return ['testcases:write'];
  return [];
}

async function sendWebResponse(
  res: Response,
  response: globalThis.Response,
): Promise<void> {
  response.headers.forEach((value, key) => res.setHeader(key, value));
  const body = await response.text();
  res.status(response.status).send(body);
}
