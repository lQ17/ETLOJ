/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { McpOAuthService } from './mcp-oauth.service';

class FakeRedis {
  isOpen = true;
  data = new Map<string, string>();
  connect() {
    this.isOpen = true;
    return Promise.resolve();
  }
  quit() {
    this.isOpen = false;
    return Promise.resolve();
  }
  set(key: string, value: string) {
    this.data.set(key, value);
    return Promise.resolve('OK');
  }
  get(key: string) {
    return Promise.resolve(this.data.get(key) ?? null);
  }
  getDel(key: string) {
    const value = this.data.get(key) ?? null;
    this.data.delete(key);
    return Promise.resolve(value);
  }
  del(key: string) {
    return Promise.resolve(this.data.delete(key) ? 1 : 0);
  }
}

describe('McpOAuthService OAuth 2.1 flow', () => {
  let service: McpOAuthService;
  let redis: FakeRedis;
  let currentUser: {
    id: number;
    username: string;
    role: string;
    status: string;
    isActive: boolean;
  };
  const prisma = {
    user: {
      findUnique: jest
        .fn()
        .mockImplementation(() => Promise.resolve(currentUser)),
    },
  };

  beforeEach(() => {
    currentUser = {
      id: 7,
      username: 'alice',
      role: 'USER',
      status: 'APPROVED',
      isActive: true,
    };
    redis = new FakeRedis();
    service = new McpOAuthService(
      {
        get: (name: string) =>
          name === 'MCP_PUBLIC_BASE_URL' ? 'https://etloj.space' : undefined,
      } as ConfigService,
      prisma as unknown as PrismaService,
    );
    (service as unknown as { redis: FakeRedis }).redis = redis;
    jest.clearAllMocks();
  });

  it('publishes authorization metadata for PKCE, DCR, refresh and revocation', () => {
    expect(service.metadata).toEqual(
      expect.objectContaining({
        issuer: 'https://etloj.space',
        authorization_endpoint: 'https://etloj.space/api/mcp-oauth/authorize',
        token_endpoint_auth_methods_supported: ['none'],
        code_challenge_methods_supported: ['S256'],
        scopes_supported: [
          'problems:read',
          'submissions:read',
          'testcases:read',
          'testcases:write',
        ],
        authorization_response_iss_parameter_supported: true,
      }),
    );
  });

  it('keeps the legacy scopes when an authorization request omits scope', async () => {
    const client = await service.registerClient({
      redirect_uris: ['http://127.0.0.1:49152/callback'],
    });
    const verifier = 'v'.repeat(64);
    const request = {
      response_type: 'code',
      client_id: client.client_id,
      redirect_uri: client.redirect_uris[0],
      code_challenge: createHash('sha256').update(verifier).digest('base64url'),
      code_challenge_method: 'S256',
      resource: service.resourceUrl,
    };

    const redirect = new URL(
      await service.createAuthorizationResponse(7, request, true),
    );
    const tokens = await service.exchangeToken({
      grant_type: 'authorization_code',
      code: redirect.searchParams.get('code'),
      client_id: client.client_id,
      redirect_uri: client.redirect_uris[0],
      code_verifier: verifier,
      resource: service.resourceUrl,
    });

    expect(tokens.scope).toBe('problems:read submissions:read');
    await expect(
      service.verifyAccessToken(tokens.access_token),
    ).resolves.toEqual(
      expect.objectContaining({
        scopes: ['problems:read', 'submissions:read'],
      }),
    );
  });

  it('completes authorization-code PKCE, binds resource/user/scopes, rotates refresh and revokes', async () => {
    const client = await service.registerClient({
      client_name: 'Standard MCP Client',
      redirect_uris: ['http://127.0.0.1:49152/callback'],
      token_endpoint_auth_method: 'none',
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
    });
    const verifier = 'v'.repeat(64);
    const challenge = createHash('sha256').update(verifier).digest('base64url');
    const request = {
      response_type: 'code',
      client_id: client.client_id,
      redirect_uri: client.redirect_uris[0],
      code_challenge: challenge,
      code_challenge_method: 'S256',
      resource: service.resourceUrl,
      scope: 'problems:read submissions:read',
      state: 'state-1',
    };
    const redirect = new URL(
      await service.createAuthorizationResponse(7, request, true),
    );
    expect(redirect.searchParams.get('state')).toBe('state-1');
    expect(redirect.searchParams.get('iss')).toBe('https://etloj.space');
    const code = redirect.searchParams.get('code')!;
    const tokens = await service.exchangeToken({
      grant_type: 'authorization_code',
      code,
      client_id: client.client_id,
      redirect_uri: client.redirect_uris[0],
      code_verifier: verifier,
      resource: service.resourceUrl,
    });
    const auth = await service.verifyAccessToken(tokens.access_token);
    expect(auth).toEqual(
      expect.objectContaining({
        clientId: client.client_id,
        scopes: ['problems:read', 'submissions:read'],
        extra: expect.objectContaining({ userId: 7 }),
      }),
    );
    await expect(
      service.exchangeToken({
        grant_type: 'authorization_code',
        code,
        client_id: client.client_id,
        redirect_uri: client.redirect_uris[0],
        code_verifier: verifier,
        resource: service.resourceUrl,
      }),
    ).rejects.toEqual(expect.any(BadRequestException));

    const rotated = await service.exchangeToken({
      grant_type: 'refresh_token',
      refresh_token: tokens.refresh_token,
      client_id: client.client_id,
      resource: service.resourceUrl,
      scope: 'problems:read',
    });
    expect(rotated.scope).toBe('problems:read');
    await expect(
      service.exchangeToken({
        grant_type: 'refresh_token',
        refresh_token: tokens.refresh_token,
        client_id: client.client_id,
        resource: service.resourceUrl,
      }),
    ).rejects.toEqual(expect.any(BadRequestException));
    await service.revoke({
      token: rotated.access_token,
      client_id: client.client_id,
    });
    await expect(
      service.verifyAccessToken(rotated.access_token),
    ).rejects.toThrow();
  });

  it('rejects non-S256 PKCE, unregistered redirects, unsupported scopes and wrong resources', async () => {
    const client = await service.registerClient({
      redirect_uris: ['https://client.example/callback'],
    });
    const base = {
      response_type: 'code',
      client_id: client.client_id,
      redirect_uri: client.redirect_uris[0],
      code_challenge: 'x'.repeat(43),
      code_challenge_method: 'S256',
      resource: service.resourceUrl,
    };
    await expect(
      service.validateAuthorizationRequest({
        ...base,
        code_challenge_method: 'plain',
      }),
    ).rejects.toEqual(expect.any(BadRequestException));
    await expect(
      service.validateAuthorizationRequest({
        ...base,
        redirect_uri: 'https://evil.example/callback',
      }),
    ).rejects.toEqual(expect.any(BadRequestException));
    await expect(
      service.validateAuthorizationRequest({ ...base, scope: 'admin:read' }),
    ).rejects.toEqual(expect.any(BadRequestException));
    for (const resource of [undefined, 'https://etloj.space/mcp']) {
      await expect(
        service.validateAuthorizationRequest({
          ...base,
          resource,
        } as typeof base),
      ).rejects.toMatchObject({
        response: {
          error: 'invalid_target',
          error_description:
            'Missing or invalid resource parameter; expected https://etloj.space/mcp/private.',
        },
      });
    }
  });

  it('allows ADMIN accounts to obtain explicit testcase scopes', async () => {
    currentUser.role = 'ADMIN';
    const client = await service.registerClient({
      redirect_uris: ['http://127.0.0.1:49152/callback'],
    });
    const verifier = 'a'.repeat(64);
    const request = {
      response_type: 'code',
      client_id: client.client_id,
      redirect_uri: client.redirect_uris[0],
      code_challenge: createHash('sha256').update(verifier).digest('base64url'),
      code_challenge_method: 'S256',
      resource: service.resourceUrl,
      scope: 'problems:read submissions:read testcases:read testcases:write',
    };

    const redirect = new URL(
      await service.createAuthorizationResponse(7, request, true),
    );
    const tokens = await service.exchangeToken({
      grant_type: 'authorization_code',
      code: redirect.searchParams.get('code'),
      client_id: client.client_id,
      redirect_uri: client.redirect_uris[0],
      code_verifier: verifier,
      resource: service.resourceUrl,
    });

    expect(tokens.scope).toBe(
      'problems:read submissions:read testcases:read testcases:write',
    );
    await expect(
      service.verifyAccessToken(tokens.access_token),
    ).resolves.toEqual(
      expect.objectContaining({
        scopes: [
          'problems:read',
          'submissions:read',
          'testcases:read',
          'testcases:write',
        ],
        extra: expect.objectContaining({ role: 'ADMIN' }),
      }),
    );
  });

  it('rejects testcase scopes for non-admins at authorization and token issuance', async () => {
    const client = await service.registerClient({
      redirect_uris: ['http://127.0.0.1:49152/callback'],
    });
    const verifier = 'b'.repeat(64);
    const request = {
      response_type: 'code',
      client_id: client.client_id,
      redirect_uri: client.redirect_uris[0],
      code_challenge: createHash('sha256').update(verifier).digest('base64url'),
      code_challenge_method: 'S256',
      resource: service.resourceUrl,
      scope: 'testcases:read',
    };

    await expect(
      service.createAuthorizationResponse(7, request, true),
    ).rejects.toMatchObject({ response: { error: 'invalid_scope' } });

    currentUser.role = 'ADMIN';
    const redirect = new URL(
      await service.createAuthorizationResponse(7, request, true),
    );
    currentUser.role = 'TEACHER';
    await expect(
      service.exchangeToken({
        grant_type: 'authorization_code',
        code: redirect.searchParams.get('code'),
        client_id: client.client_id,
        redirect_uri: client.redirect_uris[0],
        code_verifier: verifier,
        resource: service.resourceUrl,
      }),
    ).rejects.toMatchObject({ response: { error: 'invalid_scope' } });

    currentUser.role = 'ADMIN';
    const refreshVerifier = 'c'.repeat(64);
    const refreshRequest = {
      ...request,
      code_challenge: createHash('sha256')
        .update(refreshVerifier)
        .digest('base64url'),
    };
    const refreshRedirect = new URL(
      await service.createAuthorizationResponse(7, refreshRequest, true),
    );
    const tokens = await service.exchangeToken({
      grant_type: 'authorization_code',
      code: refreshRedirect.searchParams.get('code'),
      client_id: client.client_id,
      redirect_uri: client.redirect_uris[0],
      code_verifier: refreshVerifier,
      resource: service.resourceUrl,
    });
    currentUser.role = 'USER';
    await expect(
      service.exchangeToken({
        grant_type: 'refresh_token',
        refresh_token: tokens.refresh_token,
        client_id: client.client_id,
        resource: service.resourceUrl,
      }),
    ).rejects.toMatchObject({ response: { error: 'invalid_scope' } });
  });

  it('keeps an existing management token verifiable while returning the current role', async () => {
    currentUser.role = 'ADMIN';
    const client = await service.registerClient({
      redirect_uris: ['http://127.0.0.1:49152/callback'],
    });
    const verifier = 'd'.repeat(64);
    const request = {
      response_type: 'code',
      client_id: client.client_id,
      redirect_uri: client.redirect_uris[0],
      code_challenge: createHash('sha256').update(verifier).digest('base64url'),
      code_challenge_method: 'S256',
      resource: service.resourceUrl,
      scope: 'testcases:read testcases:write',
    };
    const redirect = new URL(
      await service.createAuthorizationResponse(7, request, true),
    );
    const tokens = await service.exchangeToken({
      grant_type: 'authorization_code',
      code: redirect.searchParams.get('code'),
      client_id: client.client_id,
      redirect_uri: client.redirect_uris[0],
      code_verifier: verifier,
      resource: service.resourceUrl,
    });

    currentUser.role = 'TEACHER';
    await expect(
      service.verifyAccessToken(tokens.access_token),
    ).resolves.toEqual(
      expect.objectContaining({
        scopes: ['testcases:read', 'testcases:write'],
        extra: expect.objectContaining({ role: 'TEACHER' }),
      }),
    );
  });
});
