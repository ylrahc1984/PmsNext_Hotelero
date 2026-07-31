import { PosDocumentPrintBuilder } from './pos-document-print.builder';

describe('PosDocumentPrintBuilder', () => {
  it('prints restaurant taxes separately by type and rate', () => {
    const commands = new PosDocumentPrintBuilder().build({
      empresaNombre: 'Casa Lamia Boutique Hotel',
      empresaRazonSocial: '3-102-852015 S.R.L',
      empresaRuc: '3102852015',
      encabezado: {
        tipDocu: 'TRR',
        serie: '000',
        numero: '00000001',
        moneda: 'COL',
        fechaDocu: '31/07/2026'
      },
      detalle: [],
      impuestos: [
        { codigo: 'IGV', descripcion: 'IMP. VALOR AGREGADO', porcentaje: 13, baseImponible: 0, monto: 2210 },
        { codigo: 'SRV', descripcion: 'IMP. DE SERVICIOS 10%', porcentaje: 10, baseImponible: 0, monto: 1700 }
      ],
      pagos: [],
      resumen: {
        subtotal: 17000,
        descuento: 0,
        impuesto: 3910,
        total: 20910
      }
    }).join('');

    expect(commands).toContain('IVA 13%');
    expect(commands).toContain('2,210.00 COL');
    expect(commands).toContain('Servicio 10%');
    expect(commands).toContain('1,700.00 COL');
    expect(commands).not.toContain('Total impuestos');
    expect(commands).toContain(`${'='.repeat(40)}\n\x1B\x45\x01TOTAL`);
  });
});
