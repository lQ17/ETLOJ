import type { Response } from 'express';
import { McpOAuthController } from './mcp-oauth.controller';
import {
  McpOAuthService,
  type AuthorizationRequest,
} from './mcp-oauth.service';

describe('McpOAuthController', () => {
  it('redirects a validated request to the frontend consent page with every OAuth parameter', async () => {
    const validateAuthorizationRequest = jest.fn().mockResolvedValue({});
    const oauth = {
      publicBaseUrl: 'https://etloj.space',
      validateAuthorizationRequest,
    } as unknown as McpOAuthService;
    const controller = new McpOAuthController(oauth);
    const query: AuthorizationRequest = {
      response_type: 'code',
      client_id: 'mcp_client',
      redirect_uri: 'http://localhost:6826/oauth/callback',
      code_challenge: 'x'.repeat(43),
      code_challenge_method: 'S256',
      resource: 'https://etloj.space/mcp/private',
      scope: 'problems:read submissions:read',
      state: 'state-value',
    };
    const redirect = jest.fn();
    const response = { redirect } as unknown as Response;

    await controller.authorize(query, response);

    expect(validateAuthorizationRequest).toHaveBeenCalledWith(query);
    expect(redirect).toHaveBeenCalledTimes(1);
    const [status, target] = redirect.mock.calls[0] as [number, string];
    expect(status).toBe(302);
    const consent = new URL(target);
    expect(consent.origin + consent.pathname).toBe(
      'https://etloj.space/oauth/mcp/authorize',
    );
    for (const [key, value] of Object.entries(query)) {
      expect(consent.searchParams.get(key)).toBe(value);
    }
  });
});
