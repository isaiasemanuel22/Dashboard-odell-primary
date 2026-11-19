import { Body, Controller, Delete, Get, Post, Req, Res } from '@nestjs/common';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import type { Request, Response } from 'express';
import { ApiScopes, MCP_ACCESS } from '../auth/api-scopes.decorator';
import { SettingsService } from '../settings/settings.service';
import { buildMcpServer } from './mcp-server.factory';
import { McpToolsService } from './mcp-tools.service';

function jsonRpcError(res: Response, status: number, message: string): void {
  res.status(status).json({
    jsonrpc: '2.0',
    error: { code: -32000, message },
    id: null,
  });
}

/** Servidor MCP de Odell (§28.4): sin sesión, una instancia por request. */
@Controller('mcp')
@ApiScopes(MCP_ACCESS)
export class McpController {
  constructor(
    private readonly tools: McpToolsService,
    private readonly settings: SettingsService,
  ) {}

  @Post()
  async handle(
    @Req() req: Request,
    @Res() res: Response,
    @Body() body: unknown,
  ): Promise<void> {
    if (!req.apiKey) {
      jsonRpcError(res, 401, 'Se necesita una llave de acceso');
      return;
    }
    const server = buildMcpServer(
      req.apiKey,
      this.settings.getAgentTools(),
      this.tools,
    );
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    res.on('close', () => {
      void transport.close();
      void server.close();
    });
    await server.connect(transport);
    await transport.handleRequest(req, res, body);
  }

  @Get()
  get(@Res() res: Response): void {
    jsonRpcError(res, 405, 'Método no permitido');
  }

  @Delete()
  remove(@Res() res: Response): void {
    jsonRpcError(res, 405, 'Método no permitido');
  }
}
