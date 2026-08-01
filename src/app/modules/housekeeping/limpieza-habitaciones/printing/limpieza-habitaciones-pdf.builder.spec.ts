import { LimpiezaHabitacionesPdfData } from '../models/limpieza-habitacion.model';
import { LimpiezaHabitacionesPdfBuilder } from './limpieza-habitaciones-pdf.builder';

describe('LimpiezaHabitacionesPdfBuilder', () => {
  it('builds a landscape report with summary, repeated table header and room data', () => {
    const data: LimpiezaHabitacionesPdfData = {
      fechaOperativa: '01/08/2026',
      operador: 'CHARLY',
      generadoEn: new Date(2026, 7, 1, 8, 30),
      kpis: { total: 1, salidasHoy: 0, llegadas: 0, ocupadas: 1, pendientes: 1, limpias: 0 },
      habitaciones: [{
        room: '1',
        fechaIni: '31/07/2026',
        fechaFin: '02/08/2026',
        huesped: 'Nuria Gonzales',
        numPax: 4,
        estado: 'OCUPADO',
        clean: null,
        grupo: 'STD',
        numChl: 0,
        estadoLimpieza: 'PENDIENTE',
        prioridad: 'OCUPADA',
        prioridadOrden: 3
      }]
    };

    const definition = new LimpiezaHabitacionesPdfBuilder().build(data, {
      nombre: 'HOTEL DE PRUEBA',
      cedula: '3102852015'
    });
    const content = definition.content as any[];
    const roomTable = content.find((item) => item?.table?.headerRows === 1);
    const serialized = JSON.stringify(content);

    expect(definition.pageOrientation).toBe('landscape');
    expect(roomTable.table.headerRows).toBe(1);
    expect(roomTable.table.body.length).toBe(2);
    expect(serialized).toContain('LIMPIEZA DE HABITACIONES');
    expect(serialized).toContain('Nuria Gonzales');
    expect(serialized).toContain('PENDIENTE');
  });
});
