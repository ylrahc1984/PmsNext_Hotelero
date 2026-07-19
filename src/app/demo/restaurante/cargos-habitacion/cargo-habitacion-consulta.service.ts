import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

import { environment } from 'src/environments/environment';

export interface CargoHabitacion {
  PFD01_TipCrgHab: string;
  PFD01_NumCrgHab: string;
  PFD01_CodReserva: string;
  PFD01_NumHab: string;
  PFD01_PntVenta: string;
  PFD01_Fecha: string;
  PFD01_Hora: string;
  PFD01_NumDocu: string;
  PFD01_NombrePax: string;
  PFD01_MtoTot: number;
  PFD01_Moneda: string;
  PFD01_Cierre: number;
  PFD01_NumCierre: string;
  PFD01_Estado: number;
  PFD01_Operador: string;
}

export interface CargoHabitacionDetalle {
  PFD02_TipCrgHab: string;
  PFD02_NumCrgHab: string;
  PFD02_CodRsv: string;
  PFD02_NumHab: string;
  PFD02_PntVenta: string;
  PFD02_Fecha: string;
  PFD02_Hora: string;
  PFD02_Grupo: string;
  PFD02_Categoria: string;
  PFD02_CodConsumo: string;
  PFD02_NomConsumo: string;
  PFD02_Cantidad: number;
  PFD02_SubTotal: number;
  PFD02_PorDescuento: number;
  PFD02_Descuento: number;
  PFD02_PrecioSinImpNeto: number;
  PPV08_Impuestos: number;
  PFD02_Precio: number;
  PFD02_Total: number;
  PFD02_Moneda: string;
  PFD02_TipNPedido: string;
  PFD02_NumNPedido: string;
  PFD02_CodMozo: string;
  PFD02_Incluido: number;
  PFD02_Exonerado: number;
  PFD02_Orden: number;
  PFD02_Estado: number;
  PFD02_Comentario: string;
  PFD02_PrecioLista: number;
  PFD02_Operador: string;
}

export interface CargosHabitacionResponse {
  mensaje: string;
  totalRegistros: number;
  datos: CargoHabitacion[];
}

export interface CargoHabitacionDetalleResponse {
  mensaje: string;
  encabezado: CargoHabitacion[];
  detalle: CargoHabitacionDetalle[];
}

@Injectable({ providedIn: 'root' })
export class CargoHabitacionConsultaService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${(environment.apiUrl || 'http://localhost:5000/api').toString().replace(/\/+$/, '')}/cargo-habitacion`;

  consultarPorFechas(fechaInicio: string, fechaFin: string): Observable<CargosHabitacionResponse> {
    const params = new HttpParams().set('fechaInicio', fechaInicio).set('fechaFin', fechaFin);
    return this.http.get<CargosHabitacionResponse>(`${this.apiUrl}/consultar-por-fechas`, { params }).pipe(
      map((response) => ({
        mensaje: response?.mensaje ?? '',
        totalRegistros: Number(response?.totalRegistros ?? 0),
        datos: Array.isArray(response?.datos) ? response.datos : []
      })),
      catchError((error: HttpErrorResponse) => this.handleError(error, 'No se pudieron consultar los cargos a habitación.'))
    );
  }

  consultarDetalle(tipCrgHab: string, numCrgHab: string): Observable<CargoHabitacionDetalleResponse> {
    const params = new HttpParams().set('tipCrgHab', tipCrgHab).set('numCrgHab', numCrgHab);
    return this.http.get<CargoHabitacionDetalleResponse>(`${this.apiUrl}/consultar-detalle`, { params }).pipe(
      map((response) => ({
        mensaje: response?.mensaje ?? '',
        encabezado: Array.isArray(response?.encabezado) ? response.encabezado : [],
        detalle: Array.isArray(response?.detalle) ? response.detalle : []
      })),
      catchError((error: HttpErrorResponse) => this.handleError(error, 'No se pudo consultar el detalle del cargo a habitación.'))
    );
  }

  private handleError(error: HttpErrorResponse, fallback: string): Observable<never> {
    const body = error.error as { mensaje?: string; detalle?: string } | null;
    return throwError(() => new Error(body?.detalle || body?.mensaje || error.message || fallback));
  }
}
