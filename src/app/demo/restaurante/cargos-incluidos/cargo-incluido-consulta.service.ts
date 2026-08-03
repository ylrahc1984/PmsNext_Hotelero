import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, throwError } from 'rxjs';

import { environment } from 'src/environments/environment';

export interface CargoIncluido {
  PFD03_TipCrgInc: string;
  PFD03_NumCrgInc: string;
  PFD03_CodReserva: string;
  PFD03_NumHab: string;
  PFD03_PntVenta: string;
  PFD03_Fecha: string;
  PFD03_Hora: string;
  PFD03_NumDocu: string;
  PFD03_NombrePax: string;
  PFD03_MtoTot: number;
  PFD03_Moneda: string;
  PFD03_Cierre: number;
  PFD03_NumCierre: number;
  PFD03_Operador: string;
}

export interface CargoIncluidoOperationResponse {
  success?: boolean;
  mensaje?: string;
  message?: string;
  respuesta?: string;
}

export interface CargoIncluidoDetalle {
  PFD04_CodConsumo: string;
  PFD04_NomConsumo: string;
  PFD04_Cantidad: number;
  PFD04_Precio: number;
  PFD04_Total: number;
  PFD04_Moneda: string;
  PFD04_CodMozo: string;
  PFD04_Comentario: string;
  PFD04_Operador: string;
}

export interface CargoIncluidoDetalleResponse {
  encabezado: CargoIncluido | null;
  detalle: CargoIncluidoDetalle[];
}

@Injectable({ providedIn: 'root' })
export class CargoIncluidoConsultaService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${(environment.apiUrl || 'http://localhost:5000/api').toString().replace(/\/+$/, '')}/cargo-incluido`;

  consultarPorFechas(fechaInicio: string, fechaFin: string): Observable<CargoIncluido[]> {
    const params = new HttpParams().set('fechaInicio', fechaInicio).set('fechaFin', fechaFin);
    return this.http.get<unknown>(`${this.apiUrl}/por-fecha`, { params }).pipe(
      map((response) => this.normalizeArray(response)),
      catchError((error: HttpErrorResponse) => this.handleError(error, 'No se pudieron consultar los cargos incluidos.'))
    );
  }

  consultarDetalle(tipCrgInc: string, numCrgInc: string): Observable<CargoIncluidoDetalleResponse> {
    const url = `${this.apiUrl}/${encodeURIComponent(tipCrgInc.trim())}/${encodeURIComponent(numCrgInc.trim())}`;
    return this.http.get<Record<string, unknown>>(url).pipe(
      map((response) => this.normalizeDetailResponse(response)),
      catchError((error: HttpErrorResponse) => this.handleError(error, 'No se pudo consultar el detalle del cargo incluido.'))
    );
  }

  anular(cargo: CargoIncluido, motivo: string, operador: string): Observable<CargoIncluidoOperationResponse> {
    const url = `${this.apiUrl}/${encodeURIComponent(cargo.PFD03_TipCrgInc.trim())}/${encodeURIComponent(cargo.PFD03_NumCrgInc.trim())}`;
    const params = new HttpParams().set('motivo', motivo.trim()).set('operador', operador.trim());
    return this.http.delete(url, { params, responseType: 'text' }).pipe(
      map((response) => this.parseResponse(response)),
      catchError((error: HttpErrorResponse) => this.handleError(error, 'No se pudo anular el cargo incluido.'))
    );
  }

  private normalizeArray(response: unknown): CargoIncluido[] {
    let rawItems: Array<Record<string, unknown>> = [];
    if (Array.isArray(response)) {
      rawItems = response as Array<Record<string, unknown>>;
    }
    if (response && typeof response === 'object') {
      const record = response as Record<string, unknown>;
      const data = record['datos'] ?? record['data'];
      if (Array.isArray(data)) rawItems = data as Array<Record<string, unknown>>;
    }
    return rawItems.map((item) => this.normalizeHeader(item));
  }

  private normalizeDetailResponse(response: Record<string, unknown>): CargoIncluidoDetalleResponse {
    const rawHeader = response?.['encabezado'] as Record<string, unknown> | null | undefined;
    const rawDetails = Array.isArray(response?.['detalle']) ? response['detalle'] as Array<Record<string, unknown>> : [];
    return {
      encabezado: rawHeader ? this.normalizeHeader(rawHeader) : null,
      detalle: rawDetails.map((item) => ({
        PFD04_CodConsumo: this.text(item, 'PFD04_CodConsumo', 'pfD04_CodConsumo'),
        PFD04_NomConsumo: this.text(item, 'PFD04_NomConsumo', 'pfD04_NomConsumo'),
        PFD04_Cantidad: this.number(item, 'PFD04_Cantidad', 'pfD04_Cantidad'),
        PFD04_Precio: this.number(item, 'PFD04_Precio', 'pfD04_Precio'),
        PFD04_Total: this.number(item, 'PFD04_Total', 'pfD04_Total'),
        PFD04_Moneda: this.text(item, 'PFD04_Moneda', 'pfD04_Moneda'),
        PFD04_CodMozo: this.text(item, 'PFD04_CodMozo', 'pfD04_CodMozo'),
        PFD04_Comentario: this.text(item, 'PFD04_Comentario', 'pfD04_Comentario'),
        PFD04_Operador: this.text(item, 'PFD04_Operador', 'pfD04_Operador')
      }))
    };
  }

  private normalizeHeader(item: Record<string, unknown>): CargoIncluido {
    return {
      PFD03_TipCrgInc: this.text(item, 'PFD03_TipCrgInc', 'pfD03_TipCrgInc'),
      PFD03_NumCrgInc: this.text(item, 'PFD03_NumCrgInc', 'pfD03_NumCrgInc'),
      PFD03_CodReserva: this.text(item, 'PFD03_CodReserva', 'pfD03_CodReserva'),
      PFD03_NumHab: this.text(item, 'PFD03_NumHab', 'pfD03_NumHab'),
      PFD03_PntVenta: this.text(item, 'PFD03_PntVenta', 'pfD03_PntVenta'),
      PFD03_Fecha: this.text(item, 'PFD03_Fecha', 'pfD03_Fecha'),
      PFD03_Hora: this.text(item, 'PFD03_Hora', 'pfD03_Hora'),
      PFD03_NumDocu: this.text(item, 'PFD03_NumDocu', 'pfD03_NumDocu'),
      PFD03_NombrePax: this.text(item, 'PFD03_NombrePax', 'pfD03_NombrePax'),
      PFD03_MtoTot: this.number(item, 'PFD03_MtoTot', 'pfD03_MtoTot'),
      PFD03_Moneda: this.text(item, 'PFD03_Moneda', 'pfD03_Moneda'),
      PFD03_Cierre: this.number(item, 'PFD03_Cierre', 'pfD03_Cierre'),
      PFD03_NumCierre: this.number(item, 'PFD03_NumCierre', 'pfD03_NumCierre'),
      PFD03_Operador: this.text(item, 'PFD03_Operador', 'pfD03_Operador')
    };
  }

  private text(record: Record<string, unknown>, ...keys: string[]): string {
    const value = keys.map((key) => record[key]).find((item) => item !== undefined && item !== null);
    return String(value ?? '').trim();
  }

  private number(record: Record<string, unknown>, ...keys: string[]): number {
    const value = keys.map((key) => record[key]).find((item) => item !== undefined && item !== null);
    return Number(value) || 0;
  }

  private parseResponse(response: string): CargoIncluidoOperationResponse {
    const value = (response || '').trim();
    if (!value) return { success: true };
    try {
      return JSON.parse(value) as CargoIncluidoOperationResponse;
    } catch {
      return { respuesta: value };
    }
  }

  private handleError(error: HttpErrorResponse, fallback: string): Observable<never> {
    const body = error.error as { mensaje?: string; message?: string; detalle?: string } | string | null;
    const apiMessage = typeof body === 'string' ? body : body?.detalle || body?.mensaje || body?.message;
    return throwError(() => new Error(apiMessage || error.message || fallback));
  }
}
