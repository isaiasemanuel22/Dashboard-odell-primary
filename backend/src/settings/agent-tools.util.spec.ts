import { DEFAULT_AGENT_TOOLS, normalizeAgentTools } from './agent-tools.util';

describe('normalizeAgentTools', () => {
  it('arranca con todo prendido salvo registrar_pago', () => {
    expect(normalizeAgentTools(undefined)).toEqual(DEFAULT_AGENT_TOOLS);
    expect(DEFAULT_AGENT_TOOLS.registrar_pago).toBe(false);
    expect(DEFAULT_AGENT_TOOLS.consultar_stock).toBe(true);
  });

  it('respeta los valores guardados y descarta los que no son booleanos', () => {
    expect(
      normalizeAgentTools({
        ver_cola: false,
        registrar_pago: true,
        consultar_stock: 'no',
        otra: true,
      }),
    ).toEqual({
      ...DEFAULT_AGENT_TOOLS,
      ver_cola: false,
      registrar_pago: true,
    });
  });
});
