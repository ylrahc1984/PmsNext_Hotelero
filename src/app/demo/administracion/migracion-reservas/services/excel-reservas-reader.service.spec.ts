import * as XLSX from 'xlsx';
import { ExcelReservasReaderService } from './excel-reservas-reader.service';

describe('ExcelReservasReaderService', () => {
  const service = new ExcelReservasReaderService();

  it('normaliza DD/MM/YYYY, números y omite filas de totales', async () => {
    const sheet = XLSX.utils.aoa_to_sheet([
      ['Listado de Reservas'],
      [],
      ['Número', 'Est', 'Tarifa', 'Nombre', 'Entrada', 'Salida', 'Noches', 'Hab.', 'Pax', 'TOTAL', '13%', 'NETO', 'Depositado', 'PENDIENTE'],
      ['Moneda:', null, 'USD'],
      ['1006', 'Co', 'DIRECTOS', 'James Wilson', '29/07/2026', '31/07/2026', 2, 1, 2, '1,250.50', 143.86, 1106.64, 100, 1150.5],
      ['TOTAL', null, null, null, '29/07/2026', '31/07/2026', null, null, null, 1250.5]
    ]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, 'Reservas');
    const bytes = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
    const file = new File([bytes], 'reservas.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });

    const result = await service.read(file);

    expect(result.reservas.length).toBe(1);
    expect(result.filasIgnoradas).toBe(2);
    expect(result.reservas[0].fechaEntrada).toBe('2026-07-29');
    expect(result.reservas[0].fechaSalida).toBe('2026-07-31');
    expect(result.reservas[0].total).toBe(1250.5);
    expect(result.reservas[0].impuesto).toBe(143.86);
  });
});
