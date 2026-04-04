import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

import { environment } from 'src/environments/environment';

export interface ReservaPendiente {
  codReserva            : string;
  codAgencia            : string;
  fecha                 : string;
  agencia               : string;
  cliente               : string;
  paxPendiente          : number;
  serviciosPendientes   : number;
}

export interface ReservasPendientesPaginacion {
  totalRegistros  : number;
  paginaActual    : number;
  pageSize        : number;
  totalPaginas    : number;
}

export interface ReservasPendientesResponse {
  datos           : ReservaPendiente[];
  paginacion      : ReservasPendientesPaginacion;
}

export interface ReservaPendienteDetalle {
  id              : number;
  codServicio     : string;
  nomServicio     : string;
  codGrupo        : string;
  uMedida         : string;
  codLstPrecio    : string;
  planTarifario   : string;
  saldoPendiente  : number;
  subTotal        : number;
  neto            : number;
  totalPax        : number;
  porDescuento    : number;
  impuesto        : number;
}

type ApiRecord = Record<string, unknown>;

@Injectable({ providedIn: 'root' })
export class ReservasFacturacionService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/reservas-facturacion`;

  getPendientes(fechaInicio: string, fechaFin: string, page = 1, pageSize = 6): Observable<ReservasPendientesResponse> {
    let params = new HttpParams().set('page', String(page)).set('pageSize', String(pageSize));
    const inicio = this.formatDate(fechaInicio);
    const fin = this.formatDate(fechaFin);
    if (inicio) {
      params = params.set('fechaInicio', inicio);
    }
    if (fin) {
      params = params.set('fechaFin', fin);
    }

    return this.http.get<{ datos?: ApiRecord[]; paginacion?: ApiRecord }>(`${this.apiUrl}/pendientes`, { params }).pipe(
      map((response) => {
        const data = (response?.datos ?? []).map((item) => this.mapPendiente(item));
        const paginacion = response?.paginacion ?? {};
        const paginacionNormalized = this.buildNormalizedMap(paginacion);
        const totalRegistros = this.readNumber(paginacion, paginacionNormalized, 'totalRegistros', 'total', 'total_records');
        const currentPage = this.readNumber(paginacion, paginacionNormalized, 'paginaActual', 'page', 'currentPage') || page;
        const size = this.readNumber(paginacion, paginacionNormalized, 'pageSize', 'page_size') || pageSize;
        const totalPaginas =
          this.readNumber(paginacion, paginacionNormalized, 'totalPaginas', 'totalPages', 'total_pages') ||
          (totalRegistros > 0 ? Math.ceil(totalRegistros / size) : 1);

        return {
          datos: data,
          paginacion: {
            totalRegistros,
            paginaActual: currentPage,
            pageSize: size,
            totalPaginas
          }
        };
      }),
      catchError((error: HttpErrorResponse) => {
        const message =
          error.error?.mensaje || error.error?.respuesta || error.message || 'No se pudo cargar las reservas pendientes.';
        return throwError(() => new Error(message));
      })
    );
  }

  getDetalle(codReserva: string): Observable<ReservaPendienteDetalle[]> {
    const normalized = (codReserva ?? '').toString().trim();
    if (!normalized) {
      return of([]);
    }
    const encoded = encodeURIComponent(normalized);
    return this.http.get<unknown>(`${this.apiUrl}/${encoded}/detalle`).pipe(
      map((response) => this.normalizeDetalleResponse(response).map((item) => this.mapDetalle(item))),
      catchError((error: HttpErrorResponse) => {
        const message =
          error.error?.mensaje || error.error?.respuesta || error.message || 'No se pudo cargar el detalle de la reserva.';
        return throwError(() => new Error(message));
      })
    );
  }

  private mapPendiente(item: ApiRecord): ReservaPendiente {
    const normalized = this.buildNormalizedMap(item);
    const codReserva =
      this.readString(item, normalized, 'codReserva', 'PRV01_CodReserva', 'codigoReserva', 'cod_reserva', 'reserva') ||
      this.findStringByHint(normalized, 'reserva', 'cod');
    const fecha =
      this.readString(
        item,
        normalized,
        'fecha',
        'PRV01_Fecha',
        'fechaReserva',
        'PRV01_FecReserva',
        'PRV01_FecCreacion',
        'fecReserva'
      ) || this.findStringByHint(normalized, 'fecha');
    const agencia =
      this.readString(
        item,
        normalized,
        'agencia',
        'nomAgencia',
        'PRV01_NomAgencia',
        'nombreAgencia',
        'MPV00_NomClien',
        'mpV00_NomClien'
      ) || this.findStringByHint(normalized, 'agencia');
    const cliente =
      this.readString(
        item,
        normalized,
        'cliente',
        'nomCliente',
        'PRV01_NomCliente',
        'nombreCliente',
        'MPV00_NomClien',
        'mpV00_NomClien'
      ) || this.findStringByHint(normalized, 'cliente');

    const codAgencia =
      this.readString(
        item,
        normalized,
        'codAgencia',
        'codigoAgencia',
        'codCliente',
        'PRV01_CodAgencia',
        'PRV01_CodCliente',
        'agenciaCodigo'
      ) ||
      this.findStringByHint(normalized, 'agencia', 'cod') ||
      this.findStringByHint(normalized, 'cliente', 'cod');

    return {
      codReserva,
      codAgencia,
      fecha,
      agencia,
      cliente,
      paxPendiente:
        this.readNumber(item, normalized, 'paxPendiente', 'saldoPax', 'pax_pendiente', 'totalPaxPendiente') ||
        this.findNumberByHint(normalized, 'pax', 'pend'),
      serviciosPendientes:
        this.readNumber(
        item,
        normalized,
        'serviciosPendientes',
        'pendientesServicios',
        'servicios_pendientes',
        'totalServiciosPendientes'
        ) || this.findNumberByHint(normalized, 'servicio', 'pend')
    };
  }

  private mapDetalle(item: ApiRecord): ReservaPendienteDetalle {
    const normalized = this.buildNormalizedMap(item);
    return {
      id: this.readNumber(item, normalized, 'prV02_ID', 'PRV02_ID', 'id', 'Id'),
      codServicio: this.readString(item, normalized, 'prV02_CodServicio', 'PRV02_CodServicio', 'codServicio', 'codigoServicio'),
      nomServicio: this.readString(item, normalized, 'prV02_NomServicio', 'PRV02_NomServicio', 'nomServicio', 'nombreServicio'),
      codGrupo: this.readString(item, normalized, 'mpV01_CodGrupo', 'MPV01_CodGrupo', 'codGrupo', 'grupo', 'cod_grupo'),
      uMedida: this.readString(item, normalized, 'mpV01_UMedida', 'MPV01_UMedida', 'uMedida', 'umedida', 'unidadMedida'),
      codLstPrecio: this.readString(
        item,
        normalized,
        'prV02_CodLstPrecio',
        'PRV02_CodLstPrecio',
        'codLstPrecio',
        'lstPrecio'
      ),
      planTarifario: this.readString(
        item,
        normalized,
        'prV02_PlanTarifario',
        'PRV02_PlanTarifario',
        'planTarifario',
        'planTarifa'
      ),
      saldoPendiente: this.readNumber(
        item,
        normalized,
        'saldoPendiente',
        'prV02_SaldoPendiente',
        'PRV02_SaldoPendiente',
        'saldo',
        'pendiente'
      ),
      subTotal: this.readNumber(item, normalized, 'prV02_SubTotal', 'PRV02_SubTotal', 'subTotal', 'montoSubTotal'),
      neto: this.readNumber(item, normalized, 'prV02_Neto', 'PRV02_Neto', 'neto', 'montoNeto'),
      totalPax: this.readNumber(item, normalized, 'prV02_TotalPax', 'PRV02_TotalPax', 'totalPax', 'pax'),
      porDescuento: this.readNumber(item, normalized, 'prV02_PorDescuento', 'PRV02_PorDescuento', 'porDescuento', 'descuento'),
      impuesto: this.readNumber(item, normalized, 'prV02_Impuesto', 'PRV02_Impuesto', 'impuesto')
    };
  }

  private normalizeDetalleResponse(response: unknown): ApiRecord[] {
    if (Array.isArray(response)) {
      return response.filter((item): item is ApiRecord => !!item && typeof item === 'object' && !Array.isArray(item));
    }
    if (response && typeof response === 'object') {
      const record = response as ApiRecord;
      const data = record['datos'] ?? record['data'] ?? record['detalle'] ?? record['detalles'];
      if (Array.isArray(data)) {
        return data.filter((item): item is ApiRecord => !!item && typeof item === 'object' && !Array.isArray(item));
      }
    }
    return [];
  }

  private readString(record: ApiRecord, normalized: Map<string, unknown>, ...keys: string[]): string {
    for (const key of keys) {
      const value = record[key] ?? normalized.get(this.normalizeKey(key));
      if (value !== null && value !== undefined) {
        const asString = String(value).trim();
        if (asString) {
          return asString;
        }
      }
    }
    return '';
  }

  private readNumber(record: ApiRecord, normalized: Map<string, unknown>, ...keys: string[]): number {
    for (const key of keys) {
      const value = record[key] ?? normalized.get(this.normalizeKey(key));
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
    return 0;
  }

  private buildNormalizedMap(record: ApiRecord): Map<string, unknown> {
    const map = new Map<string, unknown>();
    Object.keys(record).forEach((key) => {
      const value = record[key];
      const normalizedKey = this.normalizeKey(key);
      map.set(normalizedKey, value);

      if (value && typeof value === 'object' && !Array.isArray(value)) {
        Object.keys(value as ApiRecord).forEach((nestedKey) => {
          const nestedValue = (value as ApiRecord)[nestedKey];
          const normalizedNestedKey = this.normalizeKey(nestedKey);
          if (!map.has(normalizedNestedKey)) {
            map.set(normalizedNestedKey, nestedValue);
          }
          const combinedKey = this.normalizeKey(`${key}_${nestedKey}`);
          if (!map.has(combinedKey)) {
            map.set(combinedKey, nestedValue);
          }
        });
      }
    });
    return map;
  }

  private normalizeKey(key: string): string {
    return (key ?? '').toString().toLowerCase().replace(/[^a-z0-9]/g, '');
  }

  private findStringByHint(normalized: Map<string, unknown>, ...tokens: string[]): string {
    const normalizedTokens = tokens.map((token) => this.normalizeKey(token)).filter(Boolean);
    for (const [key, value] of normalized.entries()) {
      if (!normalizedTokens.every((token) => key.includes(token))) {
        continue;
      }
      if (value !== null && value !== undefined) {
        const asString = String(value).trim();
        if (asString) {
          return asString;
        }
      }
    }
    return '';
  }

  private findNumberByHint(normalized: Map<string, unknown>, ...tokens: string[]): number {
    const normalizedTokens = tokens.map((token) => this.normalizeKey(token)).filter(Boolean);
    for (const [key, value] of normalized.entries()) {
      if (!normalizedTokens.every((token) => key.includes(token))) {
        continue;
      }
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
    return 0;
  }

  private formatDate(value: string): string {
    const trimmed = (value ?? '').toString().trim();
    if (!trimmed) return '';
    if (trimmed.includes('/')) {
      return trimmed;
    }
    const parts = trimmed.split('-');
    if (parts.length !== 3) {
      return trimmed;
    }
    const [year, month, day] = parts;
    if (!year || !month || !day) {
      return trimmed;
    }
    return `${day}/${month}/${year}`;
  }
}
