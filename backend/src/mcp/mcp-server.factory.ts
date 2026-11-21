import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { ApiKeyPrincipal } from '../api-keys/api-key-scopes';
import { PaymentMethod } from '../common/enums';
import { AgentToolsSettings } from '../common/interfaces';
import { MCP_TOOLS, McpToolName } from '../settings/agent-tools.util';
import { McpToolsService } from './mcp-tools.service';

function asText(result: unknown) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(result) }],
  };
}

/**
 * Servidor MCP para una llave: solo registra las herramientas prendidas en
 * Ajustes y que la llave tiene permiso de usar (§28.4).
 */
export function buildMcpServer(
  principal: ApiKeyPrincipal,
  agentTools: AgentToolsSettings,
  tools: McpToolsService,
): McpServer {
  const server = new McpServer({ name: 'odell', version: '1.0.0' });
  const enabled = (name: McpToolName) =>
    agentTools[name] &&
    MCP_TOOLS.some(
      (tool) => tool.name === name && principal.scopes.includes(tool.scope),
    );

  if (enabled('consultar_stock')) {
    server.registerTool(
      'consultar_stock',
      {
        title: 'Consultar stock',
        description:
          'Stock físico, reservado y disponible y precio de venta de los productos publicados. Filtra por nombre (query) o id.',
        inputSchema: {
          query: z.string().optional(),
          productId: z.string().optional(),
        },
      },
      (args) => asText(tools.consultarStock(args)),
    );
  }

  if (enabled('cotizar_producto')) {
    server.registerTool(
      'cotizar_producto',
      {
        title: 'Cotizar producto',
        description:
          'Precio de lista o mayorista según el cliente, con las reglas de Odell. Sin cliente cotiza a precio de lista.',
        inputSchema: {
          productId: z.string(),
          quantity: z.number().positive(),
          customerId: z.string().optional(),
        },
      },
      (args) => asText(tools.cotizarProducto(args)),
    );
  }

  if (enabled('ver_cola')) {
    server.registerTool(
      'ver_cola',
      {
        title: 'Ver cola de impresión',
        description:
          'Carga de cada impresora. Con hours devuelve la fecha de entrega calculada para un trabajo de esas horas.',
        inputSchema: { hours: z.number().positive().optional() },
      },
      (args) => asText(tools.verCola(args)),
    );
  }

  if (enabled('crear_presupuesto')) {
    server.registerTool(
      'crear_presupuesto',
      {
        title: 'Crear presupuesto',
        description:
          'Crea un presupuesto en borrador con productos del catálogo. Queda pendiente hasta que Isaías lo apruebe. Necesita cliente o descripción.',
        inputSchema: {
          customerId: z.string().optional(),
          items: z
            .array(
              z.object({
                productId: z.string(),
                quantity: z.number().positive(),
              }),
            )
            .min(1),
          description: z.string().optional(),
        },
      },
      async (args) => asText(await tools.crearPresupuesto(args, principal)),
    );
  }

  if (enabled('registrar_pago')) {
    server.registerTool(
      'registrar_pago',
      {
        title: 'Registrar pago',
        description:
          'Propone un pago de un pedido. No se registra hasta que Isaías lo apruebe.',
        inputSchema: {
          orderId: z.string(),
          amount: z.number().positive(),
          method: z.nativeEnum(PaymentMethod).optional(),
          deposit: z.boolean().optional(),
        },
      },
      async (args) => asText(await tools.registrarPago(args, principal)),
    );
  }

  return server;
}
