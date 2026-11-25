import { Injectable, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { from, Observable, of, throwError } from 'rxjs';
import { catchError, concatMap, map, tap, toArray } from 'rxjs/operators';

import { environment } from 'src/environments/environment';

export interface TipoCambio {
  idTCambio?         : number;
  fecha               : string;
  monedaBase          : string;
  monedaReferencia    : string;
  compra              : number;
  venta               : number;
  compraBanco?        : number;
  ventaBanco?         : number;
  operador?           : string;
}

export interface TipoCambioSaveInput {
  idTCambio: number | null;
  fechaDia: string;
  moneda: string;
  compSis: number;
  ventSis: number;
  compBan: number;
  ventBan: number;
  operador: string;
}

export type TipoCambioPostInput = Omit<TipoCambioSaveInput, 'idTCambio'>;

export interface TipoCambioPostPayload extends TipoCambioPostInput {
  tipo: 1;
  idTCambio: 0;
  respuesta: '';
}

export interface TipoCambioPutPayload extends TipoCambioPostInput {
  tipo: 2;
  idTCambio: number;
  respuesta: '';
}

export interface TipoCambioPostResponse {
  respuesta?: string;
}

export interface TipoCambioSaveResult {
  moneda: string;
  success: boolean;
  operation: 'created' | 'updated';
  response?: TipoCambioPostResponse;
  error?: unknown;
}

interface TipoCambioDto {
  CA01_IDTCambio      : number;
  CA01_Fecha          : string;
  CA01_Moneda         : string;
  CA01_CompraS        : number;
  CA01_VentaS         : number;
  CA01_CompraCB       : number;
  CA01_VentaCB        : number;
  CA01_Operador       : string;
}

@Injectable({
  providedIn: 'root'
})
export class TipoCambioService {
  private readonly apiUrl = `${environment.apiUrl}/tipocambio`;
  private historial = signal<TipoCambio[]>([]);

  constructor(private http: HttpClient) {}

  fetchTipoCambio(fechaDia: string, moneda: string): Observable<TipoCambio[]> {
    return this.requestTipoCambio(fechaDia, moneda).pipe(tap((items) => this.historial.set(items)));
  }

  fetchTiposCambio(fechaDia: string, monedas: readonly string[]): Observable<TipoCambio[]> {
    return from(monedas).pipe(
      concatMap((moneda) => this.requestTipoCambio(fechaDia, moneda.toLowerCase())),
      toArray(),
      map((responses) => responses.flat()),
      tap((items) => this.historial.set(items))
    );
  }

  createTipoCambio(input: TipoCambioPostInput): Observable<TipoCambioPostResponse> {
    const payload: TipoCambioPostPayload = {
      tipo: 1,
      idTCambio: 0,
      fechaDia: input.fechaDia,
      moneda: input.moneda,
      compSis: input.compSis,
      ventSis: input.ventSis,
      compBan: input.compBan,
      ventBan: input.ventBan,
      operador: input.operador,
      respuesta: ''
    };

    return this.http.post<TipoCambioPostResponse>(this.apiUrl, payload);
  }

  updateTipoCambio(idTCambio: number, input: TipoCambioPostInput): Observable<TipoCambioPostResponse> {
    if (!Number.isInteger(idTCambio) || idTCambio <= 0) {
      return throwError(() => new Error('El identificador del tipo de cambio no es válido para actualizar.'));
    }
    const payload: TipoCambioPutPayload = {
      tipo: 2,
      idTCambio,
      fechaDia: input.fechaDia,
      moneda: input.moneda,
      compSis: input.compSis,
      ventSis: input.ventSis,
      compBan: input.compBan,
      ventBan: input.ventBan,
      operador: input.operador,
      respuesta: ''
    };
    return this.http.put<TipoCambioPostResponse>(`${this.apiUrl}/${encodeURIComponent(String(idTCambio))}`, payload);
  }

  saveTiposCambio(inputs: readonly TipoCambioSaveInput[]): Observable<TipoCambioSaveResult[]> {
    if (inputs.length === 0) return of([]);

    return from(inputs).pipe(
      concatMap((input) => {
        const operation: TipoCambioSaveResult['operation'] = input.idTCambio ? 'updated' : 'created';
        const request$ = input.idTCambio
          ? this.updateTipoCambio(input.idTCambio, input)
          : this.createTipoCambio(input);
        return request$.pipe(
          map((response): TipoCambioSaveResult => ({ moneda: input.moneda, operation, success: true, response })),
          catchError((error: unknown) => of({ moneda: input.moneda, operation, success: false, error }))
        )
      }),
      toArray()
    );
  }

  getActual(moneda?: string) {
    const history = this.historial();
    return moneda
      ? history.find((item) => item.monedaReferencia.trim().toUpperCase() === moneda.trim().toUpperCase())
      : history[0];
  }

  getHistorial() {
    return this.historial();
  }

  getByRangoFechas(desde?: string, hasta?: string) {
    if (!desde && !hasta) {
      return this.getHistorial();
    }

    const desdeDate = desde ? new Date(desde) : null;
    const hastaDate = hasta ? new Date(hasta) : null;

    return this.historial().filter(item => {
      const current = new Date(item.fecha);
      const afterDesde = !desdeDate || current >= desdeDate;
      const beforeHasta = !hastaDate || current <= hastaDate;
      return afterDesde && beforeHasta;
    }).sort((a, b) => b.fecha.localeCompare(a.fecha));
  }

  private mapFromDto(dto: TipoCambioDto): TipoCambio {
    const fecha = dto.CA01_Fecha ? dto.CA01_Fecha.split('T')[0] : '';
    return {
      idTCambio: this.normalizeNumber(dto.CA01_IDTCambio),
      fecha,
      monedaBase: 'COL',
      monedaReferencia: dto.CA01_Moneda,
      compra: this.normalizeNumber(dto.CA01_CompraS),
      venta: this.normalizeNumber(dto.CA01_VentaS),
      compraBanco: this.normalizeNumber(dto.CA01_CompraCB),
      ventaBanco: this.normalizeNumber(dto.CA01_VentaCB),
      operador: dto.CA01_Operador ?? ''
    };
  }

  private requestTipoCambio(fechaDia: string, moneda: string): Observable<TipoCambio[]> {
    const params = new HttpParams().set('fechaDia', fechaDia).set('moneda', moneda);
    return this.http.get<TipoCambioDto[]>(this.apiUrl, { params }).pipe(
      map((response) => (response ?? []).map((item) => this.mapFromDto(item)))
    );
  }

  private normalizeNumber(value: unknown): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
}
