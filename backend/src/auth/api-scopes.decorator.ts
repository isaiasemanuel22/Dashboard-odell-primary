import { SetMetadata } from '@nestjs/common';

export const API_SCOPES_KEY = 'apiScopes';
/** Cualquier llave válida (el servidor MCP filtra por herramienta). */
export const MCP_ACCESS = '__mcp__';
/** Permisos de llave que habilitan la ruta. Sin decorador, las llaves no pasan. */
export const ApiScopes = (...scopes: string[]) =>
  SetMetadata(API_SCOPES_KEY, scopes);
