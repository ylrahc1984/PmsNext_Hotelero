import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

import { environment } from 'src/environments/environment';

export interface ColaboradorConsumo {
  MPV30_Codigo: string;
  MPV30_Nombre: string;
  MPV30_Telefono: string;
  MPV30_Direccion: string;
  MPV30_Ruc: string;
  MPV30_CentroCosto: string;
  MPV30_Operador: string;
}

export interface ConsumoColaboradorRequest {
  proceso: number;
  tipOpe: string;
  numOpe: string;
  pntVta: string;
  fecha: string;
  hora: string;
  vendedor: string;
  codColabora: string;
  rucColabora: string;
  nomColabora: string;
  direccion: string;
  totDocu: number;
  estado: string;
  moneda: string;
  tCambio: number;
  lPrecio: string;
  tipNP: string;
  serieNP: string;
  numNP: string;
  numCuenta: number;
  operador: string;
}

export interface CargoColaborador {
  PPV10_TipOpe: string;
  PPV10_NumOpe: string;
  PPV10_PntVenta: string;
  PPV10_Fecha: string;
  PPV10_Hora: string;
  PPV10_CodVendedor: string;
  PPV10_CodCola: string;
  PPV10_RucCola: string;
  PPV10_NomColabora: string;
  PPV10_Direccion: string;
  PPV10_TotalDocu: number;
  PPV10_EstDocu: string;
  PPV10_Moneda: string;
  PPV10_TCambio: number;
  PPV10_LPrecio: string;
  PPV10_TipoNDP: string;
  PPV10_SerieNDP: string;
  PPV10_NumeroNDP: string;
  PPV10_Operador: string;
}

export interface CargoColaboradorDetalle {
  PPV11_TipOpe: string;
  PPV11_NumOpe: string;
  PPV11_Grupo: string;
  PPV11_Categoria: string;
  PPV11_CodProducto: string;
  PPV11_NomProducto: string;
  PPV11_UMedida: string;
  PPV11_Cantidad: number;
  PPV11_Precio: number;
  PPV11_Descuento: number;
  PPV11_PorDescu: number;
  PPV11_Total: number;
  PPV11_Almacen: unknown;
  PPV11_Moneda: string;
  PPV11_TCambio: number;
  PPV11_Orden: number;
  PPV11_Operador: string;
}

export interface CargoColaboradorDetalleResponse {
  encabezado: CargoColaborador[];
  detalle: CargoColaboradorDetalle[];
  mensaje: string;
}

export interface AnularConsumoColaboradorResponse {
  mensaje?: string;
  tipoOperacion?: string;
  numeroOperacion?: string;
  respuesta?: string;
}

@Injectable({ providedIn: 'root' })
export class RestaurantCollaboratorChargeService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiUrl || 'http://localhost:5000/api';

  listarColaboradores(): Observable<ColaboradorConsumo[]> {
    return this.http.get<ColaboradorConsumo[]>(`${this.baseUrl}/colaboradores/listar`);
  }

  guardarConsumo(payload: ConsumoColaboradorRequest): Observable<unknown> {
    return this.http.post<unknown>(`${this.baseUrl}/Consumo-colaborador/guardar`, payload);
  }

  consultarPorFechas(fechaIni: string, fechaFin: string): Observable<CargoColaborador[]> {
    const params = new HttpParams().set('fechaIni', fechaIni).set('fechaFin', fechaFin);
    return this.http.get<unknown>(`${this.baseUrl}/Consumo-colaborador/consultar-por-fechas`, { params }).pipe(
      map((response) => this.normalizeArray<CargoColaborador>(response)),
      catchError((error: HttpErrorResponse) => this.handleError(error, 'No se pudieron consultar los cargos a colaboradores.'))
    );
  }

  consultarDetalle(tipOpe: string, numOpe: string): Observable<CargoColaboradorDetalleResponse> {
    const params = new HttpParams().set('tipOpe', tipOpe).set('numOpe', numOpe);
    return this.http.get<CargoColaboradorDetalleResponse>(`${this.baseUrl}/Consumo-colaborador/consultar-detalle`, { params }).pipe(
      map((response) => ({
        encabezado: Array.isArray(response?.encabezado) ? response.encabezado : [],
        detalle: Array.isArray(response?.detalle) ? response.detalle : [],
        mensaje: response?.mensaje ?? ''
      })),
      catchError((error: HttpErrorResponse) => this.handleError(error, 'No se pudo consultar el detalle del cargo.'))
    );
  }

  anularConsumo(payload: ConsumoColaboradorRequest): Observable<AnularConsumoColaboradorResponse> {
    return this.http
      .post<AnularConsumoColaboradorResponse>(`${this.baseUrl}/Consumo-colaborador/anular`, payload)
      .pipe(catchError((error: HttpErrorResponse) => this.handleError(error, 'No se pudo anular el cargo.')));
  }

  private normalizeArray<T>(response: unknown): T[] {
    if (Array.isArray(response)) return response as T[];
    if (response && typeof response === 'object') {
      const record = response as Record<string, unknown>;
      const data = record['datos'] ?? record['data'];
      return Array.isArray(data) ? (data as T[]) : [];
    }
    return [];
  }

  private handleError(error: HttpErrorResponse, fallback: string): Observable<never> {
    const body = error.error as { mensaje?: string; detalle?: string } | null;
    const message = body?.detalle || body?.mensaje || error.message || fallback;
    return throwError(() => new Error(message));
  }
}
