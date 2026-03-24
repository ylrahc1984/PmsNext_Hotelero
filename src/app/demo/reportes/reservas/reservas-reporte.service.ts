import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, forkJoin, of } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';

import { environment } from 'src/environments/environment';

export interface ReporteOperacionItem {
  numeroReserva: string;
  fecha: string;
  hora: string;
  servicio: string;
  cliente: string;
  origen: string;
  destino: string;
  pax: number;
  agenciaOCliente: string;
  estado: string;
  total: number;
}

export interface ReporteOperacionPaginacion {
  totalRegistros: number;
  totalPaginas: number;
  paginaActual: number;
  registrosPorPagina: number;
}

export interface ReporteOperacionesResponse {
  datos: ReporteOperacionItem[];
  paginacion: ReporteOperacionPaginacion;
}

@Injectable({ providedIn: 'root' })
export class ReservasReporteService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = (environment.apiUrl ?? '').toString().replace(/\/+$/, '');

  getReporteOperaciones(numeroPagina = 1, registrosPorPagina = 10): Observable<ReporteOperacionesResponse> {
    const params = new HttpParams()
      .set('numeroPagina', numeroPagina.toString())
      .set('registrosPorPagina', registrosPorPagina.toString());

    return this.http.get<ReporteOperacionesResponse>(`${this.baseUrl}/reportes/operaciones`, { params });
  }

  getTodasLasOperaciones(): Observable<ReporteOperacionesResponse> {
    return this.getReporteOperaciones(1, 1000).pipe(
      switchMap((primeraPagina) => {
        const paginacion = primeraPagina.paginacion ?? this.getPaginacionVacia();
        const datosIniciales = primeraPagina.datos ?? [];
        const totalPaginas = Math.max(paginacion.totalPaginas || 0, 1);
        const totalRegistros = Math.max(paginacion.totalRegistros || 0, datosIniciales.length);

        if (totalRegistros === 0) {
          return of({
            datos: [],
            paginacion: this.getPaginacionVacia()
          });
        }

        if (totalPaginas <= 1 || datosIniciales.length >= totalRegistros) {
          return of({
            datos: datosIniciales,
            paginacion: {
              ...paginacion,
              totalRegistros,
              totalPaginas: 1,
              paginaActual: 1,
              registrosPorPagina: totalRegistros
            }
          });
        }

        const pageSize = Math.max(paginacion.registrosPorPagina || datosIniciales.length || 10, 1);
        const requests: Observable<ReporteOperacionesResponse>[] = [];

        for (let pagina = 2; pagina <= totalPaginas; pagina += 1) {
          requests.push(this.getReporteOperaciones(pagina, pageSize));
        }

        return forkJoin(requests).pipe(
          map((responses) => ({
            datos: [datosIniciales, ...responses.map((response) => response.datos ?? [])].flat(),
            paginacion: {
              totalRegistros,
              totalPaginas: 1,
              paginaActual: 1,
              registrosPorPagina: totalRegistros
            }
          }))
        );
      })
    );
  }

  private getPaginacionVacia(): ReporteOperacionPaginacion {
    return {
      totalRegistros: 0,
      totalPaginas: 0,
      paginaActual: 1,
      registrosPorPagina: 0
    };
  }
}
