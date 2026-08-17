import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { CurrentUser } from '../../auth/current-user.decorator';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import {
  McpOAuthService,
  type AuthorizationRequest,
} from './mcp-oauth.service';

@Controller('mcp-oauth')
export class McpOAuthController {
  constructor(private readonly oauth: McpOAuthService) {}

  @Get('authorize')
  async authorize(
    @Query() query: AuthorizationRequest,
    @Res() response: Response,
  ) {
    await this.oauth.validateAuthorizationRequest(query);
    const consent = new URL('/oauth/mcp/authorize', this.oauth.publicBaseUrl);
    for (const [key, value] of Object.entries(query)) {
      if (typeof value === 'string') consent.searchParams.set(key, value);
    }
    response.redirect(302, consent.toString());
  }

  @Post('authorize')
  @UseGuards(JwtAuthGuard)
  async approve(
    @CurrentUser('id') userId: number,
    @Body() body: AuthorizationRequest & { approved: boolean },
  ) {
    return {
      redirect_uri: await this.oauth.createAuthorizationResponse(
        userId,
        body,
        body.approved === true,
      ),
    };
  }

  @Post('register')
  @HttpCode(201)
  @Header('Cache-Control', 'no-store')
  register(@Body() body: Record<string, unknown>) {
    return this.oauth.registerClient(body);
  }

  @Post('token')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  @Header('Pragma', 'no-cache')
  token(@Body() body: Record<string, unknown>) {
    return this.oauth.exchangeToken(body);
  }

  @Post('revoke')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  async revoke(@Body() body: Record<string, unknown>) {
    await this.oauth.revoke(body);
    return {};
  }
}
