import {
  buildOrderTemplateVars,
  buildQuoteTemplateVars,
  renderWhatsAppTemplate,
  whatsAppMessageUrl,
} from './whatsapp-template.util';

describe('whatsapp-template.util', () => {
  const vars = {
    cliente: 'Lucía',
    pedido: 'ord-14',
    items: '2 × Árbol',
    total: '$ 29.000',
    pagado: '$ 14.500',
    saldo: '$ 14.500',
    entrega: '2 de nov',
  };

  it('reemplaza las variables conocidas y deja las desconocidas', () => {
    expect(renderWhatsAppTemplate('Hola {cliente}, {pedido} {otra}', vars)).toBe(
      'Hola Lucía, ord-14 {otra}',
    );
  });

  it('acomoda los espacios cuando una variable queda vacía', () => {
    expect(
      renderWhatsAppTemplate('¡Hola {cliente}!\nSaldo: {saldo}', {
        ...vars,
        cliente: '',
        saldo: '',
      }),
    ).toBe('¡Hola!\nSaldo:');
  });

  it('arma las variables de un pedido con saldo', () => {
    const result = buildOrderTemplateVars({
      id: 'ord-1',
      customerId: 'c1',
      customerName: 'Lucía Fernández',
      items: [{ productName: 'Árbol', quantity: 2 }],
      total: 1000,
      payments: [{ amount: 400 }],
      dueDate: '',
    } as never);
    expect(result.cliente).toBe('Lucía');
    expect(result.items).toBe('2 × Árbol');
    expect(result.pagado).toContain('400');
    expect(result.saldo).toContain('600');
    expect(result.entrega).toBe('');
  });

  it('en un presupuesto no hay pagado ni saldo', () => {
    const result = buildQuoteTemplateVars({
      id: 'quo-3',
      customerId: null,
      customerName: '',
      items: [],
      total: 500,
    } as never);
    expect(result.cliente).toBe('');
    expect(result.pedido).toBe('quo-3');
    expect(result.pagado).toBe('');
    expect(result.saldo).toBe('');
  });

  it('arma la URL de wa.me con el mensaje codificado', () => {
    expect(whatsAppMessageUrl('0223 15 677-3255', 'Hola mundo')).toBe(
      'https://wa.me/5492236773255?text=Hola%20mundo',
    );
  });
});
