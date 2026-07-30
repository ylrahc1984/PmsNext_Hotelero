import { Injectable } from '@angular/core';
import * as XLSX from 'xlsx';

import { HabitacionImportacion, ReservaImportacion, ResultadoLecturaExcel } from '../models/reserva-importacion.model';

type ExcelRow = Record<string, unknown>;

@Injectable({ providedIn: 'root' })
export class ExcelReservasReaderService {
  async read(file: File): Promise<ResultadoLecturaExcel> {
    if (!file.name.toLowerCase().endsWith('.xlsx')) {
      throw new Error('Seleccione un archivo con extensión .xlsx.');
    }

    const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true });
    const nombreHoja = workbook.SheetNames[0];
    if (!nombreHoja) {
      throw new Error('El archivo no contiene hojas disponibles.');
    }

    const sheet = workbook.Sheets[nombreHoja];
    const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      defval: null,
      raw: true
    });
    const headerRow = this.findHeaderRow(matrix);
    if (headerRow < 0) {
      throw new Error('No se encontró una fila de encabezados con Número, Entrada y Salida.');
    }

    const rows = XLSX.utils.sheet_to_json<ExcelRow>(sheet, {
      defval: null,
      raw: true,
      range: headerRow
    });

    const reservas: ReservaImportacion[] = [];
    let filasIgnoradas = 0;

    rows.forEach((rawRow, index) => {
      const row = this.normalizeKeys(rawRow);
      const numero = this.text(this.value(row, ['NUMERO', 'NO', 'RESERVA']));
      const entrada = this.date(this.value(row, ['ENTRADA', 'FECHA ENTRADA']));
      const salida = this.date(this.value(row, ['SALIDA', 'FECHA SALIDA']));

      if (!numero || !entrada || !salida || this.isSummaryRow(numero)) {
        filasIgnoradas++;
        return;
      }

      const total = this.money(this.value(row, ['TOTAL']));
      const nochesCalculadas = this.daysBetween(entrada, salida);
      const noches = this.integer(this.value(row, ['NOCHES']), nochesCalculadas);
      const habitaciones = this.integer(this.value(row, ['HAB', 'HABITACIONES']), 0);
      const pax = this.integer(this.value(row, ['PAX']), 0);

      reservas.push({
        id: `excel-${index + 2}-${numero}`,
        filaExcel: index + 2,
        numeroExterno: numero,
        estadoOrigen: this.text(this.value(row, ['EST', 'ESTADO'])),
        tarifaOrigen: this.text(this.value(row, ['TARIFA', 'CANAL'])),
        cplOrigen: this.text(this.value(row, ['CPL'])),
        nombre: this.text(this.value(row, ['NOMBRE', 'HUESPED'])),
        nacionalidad: this.text(this.value(row, ['NAC', 'NACIONALIDAD'])),
        telefono: this.phone(this.value(row, ['TELEFONOS', 'TELEFONO'])),
        fechaEntrada: entrada,
        fechaSalida: salida,
        fechaCreacion: this.date(this.value(row, ['F CREACION', 'FECHA CREACION'])),
        fechaAnulada: this.date(this.value(row, ['F ANULADA', 'FECHA ANULADA'])),
        noches,
        habitaciones,
        pax,
        total,
        impuesto: this.money(this.value(row, ['13', '0 13', '013', 'IMPUESTO', 'IVA'])),
        neto: this.money(this.value(row, ['NETO'])),
        depositado: this.money(this.value(row, ['DEPOSITADO', 'DEPOSITO'])),
        pendiente: this.money(this.value(row, ['PENDIENTE'])),
        codAgencia: '',
        codTarifa: '',
        codPlan: '',
        estadoPms: '',
        directo: 'N',
        moneda: 'USD',
        detalleHabitaciones: [this.initialRoomLine(habitaciones, pax, total, noches)],
        estadoValidacion: 'PENDIENTE',
        errores: [],
        advertencias: [],
        seleccionado: true,
        estadoImportacion: 'PENDIENTE'
      });
    });

    if (!reservas.length) {
      throw new Error('No se detectaron reservas. Verifique que existan Número, Entrada y Salida.');
    }

    return { reservas, filasIgnoradas, nombreHoja };
  }

  private initialRoomLine(habitaciones: number, pax: number, total: number, noches: number): HabitacionImportacion {
    const divisor = habitaciones * noches;
    return {
      catHabita: '',
      tipHabita: '',
      cantHab: habitaciones,
      precio: divisor > 0 ? this.round(total / divisor) : 0,
      moneda: 'USD',
      total,
      cpl: 0,
      impuesto: 0,
      numPax: pax,
      numChild: 0,
      totChild: 0,
      cCosto: 'HOSPED',
      orden: 1
    };
  }

  private normalizeKeys(row: ExcelRow): ExcelRow {
    return Object.entries(row).reduce<ExcelRow>((result, [key, value]) => {
      result[this.normalizeKey(key)] = value;
      return result;
    }, {});
  }

  private findHeaderRow(rows: unknown[][]): number {
    return rows.findIndex((row) => {
      const keys = new Set((row ?? []).map((cell) => this.normalizeKey(String(cell ?? ''))));
      return (
        (keys.has('NUMERO') || keys.has('RESERVA')) &&
        (keys.has('ENTRADA') || keys.has('FECHA ENTRADA')) &&
        (keys.has('SALIDA') || keys.has('FECHA SALIDA'))
      );
    });
  }

  private normalizeKey(value: string): string {
    return String(value)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^A-Z0-9]+/gi, ' ')
      .trim()
      .toUpperCase()
      .replace(/\s+/g, ' ');
  }

  private value(row: ExcelRow, aliases: string[]): unknown {
    for (const alias of aliases) {
      const value = row[this.normalizeKey(alias)];
      if (value !== null && value !== undefined && String(value).trim() !== '') return value;
    }
    return null;
  }

  private text(value: unknown): string {
    return String(value ?? '').replace(/\s+/g, ' ').trim();
  }

  private phone(value: unknown): string {
    if (typeof value === 'number') return String(Math.trunc(value));
    return this.text(value);
  }

  private integer(value: unknown, fallback: number): number {
    const parsed = this.number(value);
    return Number.isFinite(parsed) ? Math.max(0, Math.trunc(parsed)) : fallback;
  }

  private money(value: unknown): number {
    const parsed = this.number(value);
    return Number.isFinite(parsed) ? this.round(parsed) : 0;
  }

  private number(value: unknown): number {
    if (typeof value === 'number') return value;
    let text = this.text(value).replace(/[^\d,.-]/g, '');
    if (!text) return Number.NaN;
    const comma = text.lastIndexOf(',');
    const dot = text.lastIndexOf('.');
    if (comma > dot) {
      text = text.replace(/\./g, '').replace(',', '.');
    } else {
      text = text.replace(/,/g, '');
    }
    return Number(text);
  }

  private date(value: unknown): string {
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
      return this.iso(value.getUTCFullYear(), value.getUTCMonth() + 1, value.getUTCDate());
    }
    if (typeof value === 'number') {
      const parsed = XLSX.SSF.parse_date_code(value);
      return parsed ? this.iso(parsed.y, parsed.m, parsed.d) : '';
    }

    const text = this.text(value);
    if (!text) return '';
    let match = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
    if (match) return this.iso(Number(match[3]), Number(match[2]), Number(match[1]));
    match = text.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);
    if (match) return this.iso(Number(match[1]), Number(match[2]), Number(match[3]));
    return '';
  }

  private iso(year: number, month: number, day: number): string {
    const date = new Date(Date.UTC(year, month - 1, day));
    if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return '';
    return `${year.toString().padStart(4, '0')}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
  }

  private daysBetween(start: string, end: string): number {
    if (!start || !end) return 0;
    return Math.max(0, Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86400000));
  }

  private isSummaryRow(numero: string): boolean {
    return /^(TOTAL|SUBTOTAL|RESUMEN|SUMA)/i.test(numero);
  }

  private round(value: number): number {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }
}
