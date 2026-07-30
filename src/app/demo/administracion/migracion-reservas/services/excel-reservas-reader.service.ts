import { Injectable } from '@angular/core';
import * as XLSX from 'xlsx';

import { LineaReservaOrigen, ResultadoLecturaExcel } from '../models/reserva-importacion.model';
import { ReservasAltAgrupador } from './reservas-alt-agrupador.service';

type ExcelMatrix = unknown[][];

const REQUIRED_HEADERS = [
  'id rese',
  'nro reserva',
  'fecha ent',
  'fecha sal',
  'nombre',
  'cant habi',
  'pax',
  'total',
  'prepagado',
  'cod mone',
  'id thab',
  'tipo hab',
  'desc t hab',
  'max adultos'
] as const;

@Injectable({ providedIn: 'root' })
export class ExcelReservasReaderService {
  async read(file: File): Promise<ResultadoLecturaExcel> {
    if (!file.name.toLowerCase().endsWith('.xlsx')) {
      throw new Error('Seleccione un archivo con extensión .xlsx.');
    }
    const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true });
    const nombreHoja = workbook.SheetNames[0];
    if (!nombreHoja) throw new Error('El archivo no contiene hojas disponibles.');
    const matrix = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[nombreHoja], {
      header: 1,
      defval: null,
      raw: true
    });
    return { ...this.parseReservasAltMatrix(matrix), nombreHoja };
  }

  parseReservasAltMatrix(matrix: ExcelMatrix): Omit<ResultadoLecturaExcel, 'nombreHoja'> {
    const headerRow = this.findHeaderRow(matrix);
    if (headerRow < 0) {
      throw new Error('El archivo seleccionado no corresponde al formato esperado de migración de reservas.');
    }
    const columns = this.columnMap(matrix[headerRow] ?? []);
    const missing = REQUIRED_HEADERS.filter((header) => !columns.has(header));
    if (missing.length) {
      throw new Error(
        `El archivo seleccionado no corresponde al formato esperado de migración de reservas. Columnas faltantes: ${missing.join(', ')}.`
      );
    }

    const lines: LineaReservaOrigen[] = [];
    let ignoredRows = 0;
    for (let index = headerRow + 1; index < matrix.length; index++) {
      const row = matrix[index] ?? [];
      const idReservation = this.text(this.cell(row, columns, 'id rese'));
      if (!idReservation) {
        ignoredRows++;
        continue;
      }
      lines.push(this.toOriginLine(row, columns, index + 1));
    }

    const reservations = ReservasAltAgrupador.group(lines);
    if (!reservations.length) {
      throw new Error('El archivo no contiene reservas con un valor válido en "id rese".');
    }

    return {
      formato: 'RESERVAS_ALT',
      reservas: reservations,
      lineasHabitacion: lines.length,
      filasIgnoradas: ignoredRows,
      categoriasOrigen: this.unique(
        lines.map((line) => this.categoryKey(line.codigoCategoriaOrigen, line.descripcionCategoriaOrigen))
      ),
      tarifasOrigen: this.unique(reservations.map((item) => item.tarifaOrigen)),
      estadosOrigen: this.unique(lines.map((line) => line.estadoOrigen)),
      monedasOrigen: this.unique(lines.map((line) => line.codigoMonedaOrigen))
    };
  }

  private toOriginLine(row: unknown[], columns: ReadonlyMap<string, number>, filaExcel: number): LineaReservaOrigen {
    const value = (header: string): unknown => this.cell(row, columns, header);
    return {
      filaExcel,
      idReservaOrigen: this.text(value('id rese')),
      numeroReservaOrigen: this.text(value('nro reserva')),
      nombre: this.text(value('nombre')),
      nombreReservante: this.text(value('nombre reserv')),
      telefono: this.text(value('telef reserv')),
      email: this.text(value('email')),
      observaciones: this.text(value('observaciones')),
      referencia: this.text(value('referencia')),
      otaId: this.text(value('id online')),
      idNacionalidadOrigen: this.text(value('id naci')),
      nacionalidadOrigen: this.text(value('desc nac')),
      vip: this.text(value('vip')),
      idEstadoOrigen: this.text(value('id estado')),
      estadoOrigen: this.text(value('estado')),
      idContratoOrigen: this.text(value('id cont')),
      contratoOrigen: this.text(value('contrato')),
      idOrigen: this.text(value('id origen')),
      origen: this.text(value('origen')),
      fechaEntrada: this.date(value('fecha ent')),
      fechaSalida: this.date(value('fecha sal')),
      fechaReserva: this.date(value('fecha reserv'), true),
      fechaAnulada: this.date(value('fecha anulada'), true),
      nochesCabecera: this.integer(value('noches')),
      cantidadHabitacionesCabecera: this.integer(value('cant habi')),
      paxTotalCabecera: this.integer(value('pax')),
      totalReservaCabecera: this.money(value('total')),
      prepagadoCabecera: this.money(value('prepagado')),
      idMonedaOrigen: this.text(value('id mone')),
      codigoMonedaOrigen: this.text(value('cod mone')).toUpperCase(),
      descripcionMonedaOrigen: this.text(value('desc mone')),
      idCategoriaOrigen: this.text(value('id thab')),
      codigoCategoriaOrigen: this.text(value('tipo hab')),
      descripcionCategoriaOrigen: this.text(value('desc t hab')),
      idHabitacionOrigen: this.text(value('id habi')),
      habitacionOrigen: this.text(value('habitacion')),
      maxAdultos: this.integer(value('max adultos')),
      maxNinos: this.integer(value('max ninos')),
      cplOrigen: this.money(value('cpl'))
    };
  }

  private findHeaderRow(matrix: ExcelMatrix): number {
    let bestIndex = -1;
    let bestScore = 0;
    matrix.slice(0, 100).forEach((row, index) => {
      const headers = new Set((row ?? []).map((cell) => this.normalizeHeader(this.text(cell))));
      const score = REQUIRED_HEADERS.filter((header) => headers.has(header)).length;
      if (score > bestScore) {
        bestScore = score;
        bestIndex = index;
      }
    });
    return bestScore >= 5 ? bestIndex : -1;
  }

  private columnMap(header: unknown[]): Map<string, number> {
    const result = new Map<string, number>();
    header.forEach((cell, index) => {
      const key = this.normalizeHeader(this.text(cell));
      if (key && !result.has(key)) result.set(key, index);
    });
    return result;
  }

  private cell(row: unknown[], columns: ReadonlyMap<string, number>, header: string): unknown {
    const index = columns.get(this.normalizeHeader(header));
    return index === undefined ? null : row[index];
  }

  private normalizeHeader(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ');
  }

  private text(value: unknown): string {
    return String(value ?? '').replace(/\s+/g, ' ').trim();
  }

  private integer(value: unknown): number {
    const number = this.number(value);
    return Number.isFinite(number) ? Math.max(0, Math.trunc(number)) : 0;
  }

  private money(value: unknown): number {
    const number = this.number(value);
    return Number.isFinite(number) ? this.round(number) : 0;
  }

  private number(value: unknown): number {
    if (typeof value === 'number') return value;
    let text = this.text(value).replace(/[^\d,.-]/g, '');
    if (!text) return Number.NaN;
    const comma = text.lastIndexOf(',');
    const dot = text.lastIndexOf('.');
    if (comma > dot) text = text.replace(/\./g, '').replace(',', '.');
    else text = text.replace(/,/g, '');
    return Number(text);
  }

  private date(value: unknown, preserveTime = false): string {
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
      return this.dateTime(
        value.getFullYear(),
        value.getMonth() + 1,
        value.getDate(),
        preserveTime ? value.getHours() : 0,
        preserveTime ? value.getMinutes() : 0,
        preserveTime ? value.getSeconds() : 0,
        preserveTime
      );
    }
    if (typeof value === 'number') {
      const parsed = XLSX.SSF.parse_date_code(value);
      return parsed
        ? this.dateTime(
            parsed.y,
            parsed.m,
            parsed.d,
            preserveTime ? parsed.H : 0,
            preserveTime ? parsed.M : 0,
            preserveTime ? Math.trunc(parsed.S) : 0,
            preserveTime
          )
        : '';
    }
    const text = this.text(value);
    if (!text) return '';
    let match = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
    if (match) {
      return this.dateTime(
        Number(match[3]),
        Number(match[2]),
        Number(match[1]),
        Number(match[4] ?? 0),
        Number(match[5] ?? 0),
        Number(match[6] ?? 0),
        preserveTime && !!match[4]
      );
    }
    match = text.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
    return match
      ? this.dateTime(
          Number(match[1]),
          Number(match[2]),
          Number(match[3]),
          Number(match[4] ?? 0),
          Number(match[5] ?? 0),
          Number(match[6] ?? 0),
          preserveTime && !!match[4]
        )
      : '';
  }

  private dateTime(
    year: number,
    month: number,
    day: number,
    hours: number,
    minutes: number,
    seconds: number,
    includeTime: boolean
  ): string {
    const date = new Date(Date.UTC(year, month - 1, day, hours, minutes, seconds));
    if (
      date.getUTCFullYear() !== year ||
      date.getUTCMonth() !== month - 1 ||
      date.getUTCDate() !== day ||
      (includeTime &&
        (date.getUTCHours() !== hours || date.getUTCMinutes() !== minutes || date.getUTCSeconds() !== seconds))
    ) {
      return '';
    }
    const datePart = `${year.toString().padStart(4, '0')}-${month.toString().padStart(2, '0')}-${day
      .toString()
      .padStart(2, '0')}`;
    if (!includeTime) return datePart;
    return `${datePart}T${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds
      .toString()
      .padStart(2, '0')}`;
  }

  private categoryKey(code: string, description: string): string {
    return [code, description].filter(Boolean).join(' · ');
  }

  private unique(values: string[]): string[] {
    const seen = new Set<string>();
    return values.filter((value) => {
      const key = this.normalizeHeader(value);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  private round(value: number): number {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }
}
