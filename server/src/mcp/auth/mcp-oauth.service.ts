import {
  BadRequestException,
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  OAuthError,
  OAuthErrorCode,
  type AuthInfo,
  type OAuthMetadata,
  type OAuthTokenVerifier,
} from '@modelcontextprotocol/server';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { createClient, type RedisClientType } from 'redis';
import { PrismaService } from '../../prisma/prisma.service';

export const MCP_SCOPES = ['problems:read', 'submissions:read'] as const;
const ACCESS_TOKEN_TTL_SECONDS = 60 * 60;
const REFRESH_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60;
const AUTHORIZATION_CODE_TTL_SECONDS = 10 * 60;
const CLIENT_TTL_SECONDS = 90 * 24 * 60 * 60;

interface OAuthClientRecord {
  clientId: string;
  clientName: string;
  redirectUris: string[];
  createdAt: number;
}

interface AuthorizationCodeRecord {
  clientId: string;
  redirectUri: string;
  resource: string;
  scopes: string[];
  codeChallenge: string;
  userId: number;
}

interface TokenRecord {
  clientId: string;
  userId: number;
  resource: string;
  scopes: string[];
  expiresAt: number;
}

export interface AuthorizationRequest {
  response_type: string;
  client_id: string;
  redirect_uri: string;
  code_challenge: string;
  code_challenge_method: string;
  resource: string;
  scope?: string;
  state?: string;
}

@Injectable()
export class McpOAuthService
  implements OnModuleInit, OnModuleDestroy, OAuthTokenVerifier
{
  private redis!: RedisClientType;
  readonly publicBaseUrl: string;
  readonly resourceUrl: string;
  readonly metadata: OAuthMetadata;

  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.publicBaseUrl = (
      config.get<string>('MCP_PUBLIC_BASE_URL') || 'https://etloj.space'
    ).replace(/\/$/, '');
    this.resourceUrl = `${this.publicBaseUrl}/mcp/private`;
    this.metadata = {
      issuer: this.publicBaseUrl,
      authorization_endpoint: `${this.publicBaseUrl}/api/mcp-oauth/authorize`,
      token_endpoint: `${this.publicBaseUrl}/api/mcp-oauth/token`,
      registration_endpoint: `${this.publicBaseUrl}/api/mcp-oauth/register`,
      revocation_endpoint: `${this.publicBaseUrl}/api/mcp-oauth/revoke`,
      response_types_supported: ['code'],
      grant_types_supported: ['authorization_code', 'refresh_token'],
      token_endpoint_auth_methods_supported: ['none'],
      code_challenge_methods_supported: ['S256'],
      scopes_supported: [...MCP_SCOPES],
      authorization_response_iss_parameter_supported: true,
    };
    this.redis = createClient({ url: config.get<string>('REDIS_URL') });
  }

  async onModuleInit(): Promise<void> {
    if (!this.redis.isOpen) await this.redis.connect();
  }

  async onModuleDestroy(): Promise<void> {
    if (this.redis.isOpen) await this.redis.quit();
  }

  async registerClient(input: Record<string, unknown>) {
    const redirectUris = this.parseRedirectUris(input.redirect_uris);
    if (
      input.token_endpoint_auth_method !== undefined &&
      input.token_endpoint_auth_method !== 'none'
    ) {
      throw new BadRequestException({
        error: 'invalid_client_metadata',
        error_description: 'Only public clients are supported.',
      });
    }
    const clientName =
      typeof input.client_name === 'string'
        ? input.client_name.trim()
        : 'MCP Client';
    if (!clientName || clientName.length > 100) {
      throw new BadRequestException({
        error: 'invalid_client_metadata',
        error_description: 'Invalid client_name.',
      });
    }
    this.validateStringArray(
      input.grant_types,
      ['authorization_code', 'refresh_token'],
      'grant_types',
    );
    this.validateStringArray(input.response_types, ['code'], 'response_types');

    const clientId = `mcp_${randomBytes(24).toString('base64url')}`;
    const createdAt = Math.floor(Date.now() / 1000);
    const record: OAuthClientRecord = {
      clientId,
      clientName,
      redirectUris,
      createdAt,
    };
    await this.redis.set(this.clientKey(clientId), JSON.stringify(record), {
      EX: CLIENT_TTL_SECONDS,
    });
    return {
      client_id: clientId,
      client_id_issued_at: createdAt,
      client_name: clientName,
      redirect_uris: redirectUris,
      token_endpoint_auth_method: 'none',
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
    };
  }

  async validateAuthorizationRequest(
    input: AuthorizationRequest,
  ): Promise<OAuthClientRecord> {
    if (input.response_type !== 'code')
      throw this.oauthRequestError('unsupported_response_type');
    if (
      input.code_challenge_method !== 'S256' ||
      !/^[A-Za-z0-9_-]{43,128}$/.test(input.code_challenge || '')
    ) {
      throw this.oauthRequestError('invalid_request', 'PKCE S256 is required.');
    }
    this.assertResource(input.resource);
    this.parseScopes(input.scope);
    const client = await this.getClient(input.client_id);
    if (!client || !client.redirectUris.includes(input.redirect_uri)) {
      throw this.oauthRequestError(
        'invalid_request',
        'Unknown client or redirect URI.',
      );
    }
    return client;
  }

  async createAuthorizationResponse(
    userId: number,
    input: AuthorizationRequest,
    approved: boolean,
  ) {
    await this.validateAuthorizationRequest(input);
    const redirect = new URL(input.redirect_uri);
    if (!approved) {
      redirect.searchParams.set('error', 'access_denied');
      redirect.searchParams.set(
        'error_description',
        'The resource owner denied the request.',
      );
      if (input.state) redirect.searchParams.set('state', input.state);
      redirect.searchParams.set('iss', this.publicBaseUrl);
      return redirect.toString();
    }

    await this.assertActiveUser(userId);
    const code = randomBytes(32).toString('base64url');
    const record: AuthorizationCodeRecord = {
      clientId: input.client_id,
      redirectUri: input.redirect_uri,
      resource: input.resource,
      scopes: this.parseScopes(input.scope),
      codeChallenge: input.code_challenge,
      userId,
    };
    await this.redis.set(this.codeKey(code), JSON.stringify(record), {
      EX: AUTHORIZATION_CODE_TTL_SECONDS,
    });
    redirect.searchParams.set('code', code);
    if (input.state) redirect.searchParams.set('state', input.state);
    redirect.searchParams.set('iss', this.publicBaseUrl);
    return redirect.toString();
  }

  async exchangeToken(input: Record<string, unknown>) {
    const grantType = this.requiredString(input.grant_type, 'grant_type');
    if (grantType === 'authorization_code')
      return this.exchangeAuthorizationCode(input);
    if (grantType === 'refresh_token') return this.exchangeRefreshToken(input);
    throw this.oauthRequestError('unsupported_grant_type');
  }

  async revoke(input: Record<string, unknown>): Promise<void> {
    const token = this.requiredString(input.token, 'token');
    const clientId = this.requiredString(input.client_id, 'client_id');
    const accessKey = this.accessKey(token);
    const refreshKey = this.refreshKey(token);
    for (const key of [accessKey, refreshKey]) {
      const record = await this.readJson<TokenRecord>(key);
      if (record?.clientId === clientId) await this.redis.del(key);
    }
  }

  async verifyAccessToken(token: string): Promise<AuthInfo> {
    const record = await this.readJson<TokenRecord>(this.accessKey(token));
    if (
      !record ||
      record.expiresAt <= Math.floor(Date.now() / 1000) ||
      record.resource !== this.resourceUrl
    ) {
      throw new OAuthError(
        OAuthErrorCode.InvalidToken,
        'Invalid or expired access token.',
      );
    }
    const user = await this.assertActiveUser(record.userId, true);
    return {
      token,
      clientId: record.clientId,
      scopes: record.scopes,
      expiresAt: record.expiresAt,
      resource: new URL(record.resource),
      extra: { userId: user.id, username: user.username, role: user.role },
    };
  }

  private async exchangeAuthorizationCode(input: Record<string, unknown>) {
    const code = this.requiredString(input.code, 'code');
    const clientId = this.requiredString(input.client_id, 'client_id');
    const redirectUri = this.requiredString(input.redirect_uri, 'redirect_uri');
    const verifier = this.requiredString(input.code_verifier, 'code_verifier');
    const resource = this.requiredString(input.resource, 'resource');
    this.assertResource(resource);
    const key = this.codeKey(code);
    const raw = await this.redis.getDel(key);
    if (!raw) throw this.oauthRequestError('invalid_grant');
    const record = JSON.parse(raw) as AuthorizationCodeRecord;
    const actualChallenge = createHash('sha256')
      .update(verifier)
      .digest('base64url');
    if (
      record.clientId !== clientId ||
      record.redirectUri !== redirectUri ||
      record.resource !== resource ||
      !safeEqual(actualChallenge, record.codeChallenge)
    ) {
      throw this.oauthRequestError('invalid_grant');
    }
    await this.assertGrantUser(record.userId);
    return this.issueTokens(
      record.clientId,
      record.userId,
      record.resource,
      record.scopes,
    );
  }

  private async exchangeRefreshToken(input: Record<string, unknown>) {
    const refreshToken = this.requiredString(
      input.refresh_token,
      'refresh_token',
    );
    const clientId = this.requiredString(input.client_id, 'client_id');
    const resource = this.requiredString(input.resource, 'resource');
    this.assertResource(resource);
    const key = this.refreshKey(refreshToken);
    const raw = await this.redis.getDel(key);
    if (!raw) throw this.oauthRequestError('invalid_grant');
    const record = JSON.parse(raw) as TokenRecord;
    if (
      record.clientId !== clientId ||
      record.resource !== resource ||
      record.expiresAt <= Math.floor(Date.now() / 1000)
    ) {
      throw this.oauthRequestError('invalid_grant');
    }
    await this.assertGrantUser(record.userId);
    if (input.scope !== undefined && typeof input.scope !== 'string') {
      throw this.oauthRequestError('invalid_scope');
    }
    const requested =
      input.scope === undefined ? record.scopes : this.parseScopes(input.scope);
    if (requested.some((scope) => !record.scopes.includes(scope)))
      throw this.oauthRequestError('invalid_scope');
    return this.issueTokens(clientId, record.userId, resource, requested);
  }

  private async issueTokens(
    clientId: string,
    userId: number,
    resource: string,
    scopes: string[],
  ) {
    const accessToken = randomBytes(32).toString('base64url');
    const refreshToken = randomBytes(32).toString('base64url');
    const now = Math.floor(Date.now() / 1000);
    const access: TokenRecord = {
      clientId,
      userId,
      resource,
      scopes,
      expiresAt: now + ACCESS_TOKEN_TTL_SECONDS,
    };
    const refresh: TokenRecord = {
      clientId,
      userId,
      resource,
      scopes,
      expiresAt: now + REFRESH_TOKEN_TTL_SECONDS,
    };
    await Promise.all([
      this.redis.set(this.accessKey(accessToken), JSON.stringify(access), {
        EX: ACCESS_TOKEN_TTL_SECONDS,
      }),
      this.redis.set(this.refreshKey(refreshToken), JSON.stringify(refresh), {
        EX: REFRESH_TOKEN_TTL_SECONDS,
      }),
    ]);
    return {
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: ACCESS_TOKEN_TTL_SECONDS,
      refresh_token: refreshToken,
      scope: scopes.join(' '),
    };
  }

  private async assertActiveUser(userId: number, oauthError = false) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        role: true,
        status: true,
        isActive: true,
      },
    });
    if (!user || !user.isActive || user.status !== 'APPROVED') {
      if (oauthError)
        throw new OAuthError(
          OAuthErrorCode.InvalidToken,
          'The resource owner is unavailable.',
        );
      throw new UnauthorizedException('User account is unavailable.');
    }
    return user;
  }

  private async assertGrantUser(userId: number) {
    try {
      return await this.assertActiveUser(userId);
    } catch {
      throw this.oauthRequestError('invalid_grant');
    }
  }

  private parseScopes(value?: string): string[] {
    const scopes = value
      ? [...new Set(value.split(/\s+/).filter(Boolean))]
      : [...MCP_SCOPES];
    if (
      scopes.length === 0 ||
      scopes.some(
        (scope) => !MCP_SCOPES.includes(scope as (typeof MCP_SCOPES)[number]),
      )
    ) {
      throw this.oauthRequestError('invalid_scope');
    }
    return scopes;
  }

  private parseRedirectUris(value: unknown): string[] {
    if (!Array.isArray(value) || value.length < 1 || value.length > 10)
      throw this.oauthRequestError('invalid_client_metadata');
    return value.map((entry) => {
      if (typeof entry !== 'string' || entry.length > 500)
        throw this.oauthRequestError('invalid_client_metadata');
      let url: URL;
      try {
        url = new URL(entry);
      } catch {
        throw this.oauthRequestError('invalid_client_metadata');
      }
      const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(
        url.hostname,
      );
      if (
        url.hash ||
        (url.protocol !== 'https:' && !(loopback && url.protocol === 'http:'))
      ) {
        throw this.oauthRequestError('invalid_client_metadata');
      }
      return url.toString();
    });
  }

  private validateStringArray(
    value: unknown,
    allowed: string[],
    field: string,
  ): void {
    if (value === undefined) return;
    if (
      !Array.isArray(value) ||
      value.some((item) => typeof item !== 'string' || !allowed.includes(item))
    ) {
      throw this.oauthRequestError(
        'invalid_client_metadata',
        `Invalid ${field}.`,
      );
    }
  }

  private assertResource(resource: string): void {
    if (resource !== this.resourceUrl)
      throw this.oauthRequestError(
        'invalid_target',
        `Missing or invalid resource parameter; expected ${this.resourceUrl}.`,
      );
  }

  private async getClient(clientId: string): Promise<OAuthClientRecord | null> {
    return this.readJson<OAuthClientRecord>(this.clientKey(clientId));
  }

  private async readJson<T>(key: string): Promise<T | null> {
    const raw = await this.redis.get(key);
    return raw ? (JSON.parse(raw) as T) : null;
  }

  private requiredString(value: unknown, field: string): string {
    if (typeof value !== 'string' || !value || value.length > 2048)
      throw this.oauthRequestError(
        'invalid_request',
        `Missing or invalid ${field}.`,
      );
    return value;
  }

  private oauthRequestError(
    error: string,
    description?: string,
  ): BadRequestException {
    return new BadRequestException({
      error,
      ...(description ? { error_description: description } : {}),
    });
  }

  private clientKey(value: string) {
    return `mcp:oauth:client:${hash(value)}`;
  }
  private codeKey(value: string) {
    return `mcp:oauth:code:${hash(value)}`;
  }
  private accessKey(value: string) {
    return `mcp:oauth:access:${hash(value)}`;
  }
  private refreshKey(value: string) {
    return `mcp:oauth:refresh:${hash(value)}`;
  }
}

function hash(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}
