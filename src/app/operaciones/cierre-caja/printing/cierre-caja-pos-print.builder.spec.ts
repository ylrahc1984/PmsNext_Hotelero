import { CierreCajaPosReporte } from '../models/cierre-caja.model';
import { CierreCajaPosPrintBuilder } from './cierre-caja-pos-print.builder';

describe('CierreCajaPosPrintBuilder', () => {
  it('organizes the closure response into readable ESC/POS sections and totals', () => {
    const builder = new CierreCajaPosPrintBuilder();
    const report: CierreCajaPosReporte = {
      encabezado: {
        numCierre: 'CCC-000003',
        fechaApertura: '31/07/2026',
        horaApertura: '8:58PM',
        fechaCierre: '31/07/2026',
        puntoVenta: 'PP',
        tipoCierre: 'CIERRE DE CAJA',
        usuario: 'JMORAGA',
        fondoCaja: 0
      },
      documentosVenta: [
        {
          tipoDocumento: 'TRR',
          serie: '000',
          numeroDocumento: '00100004040000000005',
          fechaDocumento: '31/07/2026',
          hora: '7:17PM',
          codCliente: '0000000000',
          rucCliente: '00000000',
          nombreCliente: 'CLIENTE EN GENERAL',
          numMesa: '0',
          numPax: 'S/P',
          codMozo: 'JMORAGA',
          moneda: 'COL',
          tipoCambio: 1,
          subTotal: 20000,
          descuento: 0,
          neto: 20000,
          impuesto: 4600,
          exonerado: 0,
          propinas: 400,
          totalDocumento: 25000,
          totalPago: 50,
          estado: 'C',
          usuarioCreacion: 'JMORAGA'
        }
      ],
      notasCredito: [],
      formasPagoPorDocumento: [
        { codFormaPago: 'CONTA', descFormaPago: 'CONTADO - EFECTIVO', moneda: 'COL', monto: 25000 }
      ],
      denominaciones: [],
      resumenFormasPago: [],
      consumosColaborador: [
        {
          tipo: 'CCO',
          numero: '001-000001',
          pntVenta: 'PP',
          fecha: '18/07/2026',
          hora: '14:48',
          salonero: 'CHARLY',
          nombre: 'INVITADOS DE GERENCIA',
          comentarios: 'prueba de cargo colaborador',
          total: 8000,
          estado: 'PEN',
          moneda: 'COL'
        }
      ],
      platosEliminados: [
        {
          fecha: '07/31/2026 00:00:00',
          tipNdp: 'RR',
          numNdp: '0000020805',
          codProducto: '',
          desProducto: '',
          cantidad: 0,
          precio: 0,
          total: 0,
          motivo: 'la ultima prueba',
          operador: 'CHARLY'
        }
      ],
      datosEmpresa: { nombreEmpresa: 'HOTEL DE PRUEBA', cedula: '3102852015' }
    };

    const output = builder.build(report, new Date(2026, 6, 31, 21, 5)).join('');

    expect(output).toContain('CCC-000003');
    expect(output).toContain('DOCUMENTOS DE VENTA (1)');
    expect(output).toContain('25,000.00 COL');
    expect(output).toContain('FORMAS DE PAGO (1)');
    expect(output).toContain('CONSUMOS COLABORADOR (1)');
    expect(output).toContain('PLATOS ELIMINADOS (1)');
    expect(output).toContain('Motivo: la ultima prueba');
    expect(output).toContain('31/07/2026');
  });
});
