import { createMcpHandler } from '@modelcontextprotocol/server';
import {
  hostHeaderValidation,
  toNodeHandler,
} from '@modelcontextprotocol/node';
import type { Express, Request, Response } from 'express';
import { McpService } from './mcp.service';

export function mountMcpEndpoint(
  expressApp: Express,
  mcpService: McpService,
): void {
  expressApp.set('trust proxy', 'loopback');
  const mcpHandler = toNodeHandler(
    createMcpHandler(() => mcpService.createServer()),
  );
  const allowedHosts = (
    process.env.MCP_ALLOWED_HOSTS || 'etloj.space,localhost,127.0.0.1,[::1]'
  )
    .split(',')
    .map((host) => host.trim())
    .filter(Boolean);
  const validateHost = hostHeaderValidation(allowedHosts);

  expressApp.all('/mcp', async (req: Request, res: Response) => {
    if (!validateHost(req, res)) return;

    const rateLimit = mcpService.consumeRateLimit(
      req.ip || req.socket.remoteAddress || 'unknown',
    );
    if (!rateLimit.allowed) {
      res.setHeader('Retry-After', String(rateLimit.retryAfterSeconds));
      res.status(429).json({
        jsonrpc: '2.0',
        error: { code: -32000, message: 'MCP rate limit exceeded.' },
        id: null,
      });
      return;
    }

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
