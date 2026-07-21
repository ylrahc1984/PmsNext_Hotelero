import { HttpClient } from '@angular/common/http';
import { HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs';

import { environment } from 'src/environments/environment';
import { ReservaHabitacionDetalle, ReservaHabitacionRequest, ReservaHabitacionResponse } from '../interfaces/reserva-habitacion.interface';
import {
  ReservaConsulta,
  ReservaConsultaApiItem,
  ReservaConsultaApiResponse,
  ReservaConsultaPage,
  ReservaConsultaParams
} from '../models/reserva-consulta.model';
import { ReservaHabitacionRepository } from './reserva-habitacion.repository';

export interface ReservaTarifaAlimento {
  codServ: string;
  descSrv: string;
  codTarifa: string;
  codPlan: string;
  tipPax: string;
  moneda: string;
  impInc: number;
  area: string;
  precio: number;
  impInclu: number;
}

export interface ReservaDisponibilidadCategoriaRequest {
  proceso: number;
  fechaIni: string;
  fechaSal: string;
  categoria: string;
  cantHab: number;
}

export interface ReservaDisponibilidadCategoriaFecha {
  fecha: string;
  disponibles: number;
}

export interface ReservaDisponibilidadCategoriaResponse {
  success: boolean;
  message: string;
  data: ReservaDisponibilidadCategoriaFecha[];
  totalFechasInsuficientes: number;
}

@Injectable({ providedIn: 'root' })
export class ReservaHabitacionService implements ReservaHabitacionRepository {
  private readonly http = inject(HttpClient);
  private readonly baseApiUrl = (environment.apiUrl || 'http://localhost:5000/api').toString().replace(/\/+$/, '');
  private readonly apiUrl = `${this.baseApiUrl}/reservas-habitacion`;
  private readonly categoryAvailabilityUrl = `${this.baseApiUrl}/reservas/disponibilidad-categoria`;

  createReserva(request: ReservaHabitacionRequest): Observable<ReservaHabitacionResponse> {
    const requestSnapshot = JSON.parse(JSON.stringify(request)) as ReservaHabitacionRequest;
    console.groupCollapsed('[Reservas] POST confirmar reserva');
    console.log('method', 'POST');
    console.log('url', this.apiUrl);
    console.log('body', requestSnapshot);
    console.groupEnd();

    return this.http.post<ReservaHabitacionResponse>(this.apiUrl, request);
  }

  getReservaDetalle(codReserva: string): Observable<ReservaHabitacionDetalle> {
    return this.http.get<ReservaHabitacionDetalle>(`${this.apiUrl}/${encodeURIComponent(codReserva.trim())}`);
  }

  updateReserva(codReserva: string, request: ReservaHabitacionRequest): Observable<ReservaHabitacionResponse> {
    const requestSnapshot = JSON.parse(JSON.stringify(request)) as ReservaHabitacionRequest;
    const url = `${this.apiUrl}/${encodeURIComponent(codReserva.trim())}`;
    console.groupCollapsed('[Reservas] PUT actualizar reserva');
    console.log('method', 'PUT');
    console.log('url', url);
    console.log('body', requestSnapshot);
    console.groupEnd();

    return this.http.put<ReservaHabitacionResponse>(url, request);
  }

  consultarDisponibilidadCategoria(
    request: ReservaDisponibilidadCategoriaRequest
  ): Observable<ReservaDisponibilidadCategoriaResponse> {
    return this.http.post<ReservaDisponibilidadCategoriaResponse>(this.categoryAvailabilityUrl, request);
  }

  anularReserva(codReserva: string, fecAnulada: string, operador: string, observaciones: string, procesa = 1): Observable<ReservaHabitacionResponse> {
    const url = `${this.apiUrl}/${encodeURIComponent(codReserva.trim())}`;
    const params = new HttpParams()
      .set('fecAnulada', fecAnulada.trim())
      .set('operador', operador.trim())
      .set('observaciones', observaciones.trim())
      .set('procesa', String(procesa));

    console.groupCollapsed('[Reservas] DELETE anular reserva');
    console.log('method', 'DELETE');
    console.log('url', url);
    console.log('query', { fecAnulada, operador, observaciones, procesa });
    console.groupEnd();

    return this.http.delete<ReservaHabitacionResponse>(url, { params });
  }

  cambiarEstadoReserva(codReserva: string, estado: string, operador: string): Observable<ReservaHabitacionResponse> {
    const url = `${this.apiUrl}/${encodeURIComponent(codReserva.trim())}/estado`;
    const params = new HttpParams().set('estado', estado.trim().toUpperCase()).set('operador', operador.trim());

    console.groupCollapsed('[Reservas] PATCH cambiar estado reserva');
    console.log('method', 'PATCH');
    console.log('url', url);
    console.log('query', { estado, operador });
    console.groupEnd();

    return this.http.patch<ReservaHabitacionResponse>(url, null, { params });
  }

  getConfirmacionPdf(codReserva: string): Observable<Blob> {
    const url = `${this.apiUrl}/${encodeURIComponent(codReserva.trim())}/confirmacion-pdf`;
    return this.http.get(url, {
      responseType: 'blob',
      headers: { Accept: 'application/pdf' }
    });
  }

  getTarifaAlimentos(codTarifa: string, codPlan: string): Observable<ReservaTarifaAlimento[]> {
    const params = new HttpParams().set('codTarifa', codTarifa.trim()).set('codPlan', codPlan.trim());

    return this.http
      .get<ReservaTarifaAlimento[] | { datos?: ReservaTarifaAlimento[]; data?: ReservaTarifaAlimento[] }>(`${this.apiUrl}/tarifa-alimentos`, { params })
      .pipe(map((response) => this.normalizeTarifaAlimentosResponse(response)));
  }

  consultarReservas(params: ReservaConsultaParams): Observable<ReservaConsultaPage> {
    let query = new HttpParams()
      .set('Proceso', '90')
      .set('FecIngreso', params.fecIngreso)
      .set('FecSalida', params.fecSalida)
      .set('Pagina', String(params.pagina))
      .set('TamanoPagina', String(params.tamanoPagina));

    if (params.agencia?.trim()) {
      query = query.set('CodAgencia', params.agencia.trim());
    }

    if (params.estado?.trim()) {
      query = query.set('Estado', params.estado.trim());
    }

    const descripcion = params.busqueda?.trim() ?? '';
    if (descripcion) {
      query = query.set('Descripcion', descripcion);
      if (/^[a-zA-Z]{2}\d{6,}$/.test(descripcion)) {
        query = query.set('CodReserva', descripcion);
      }
    }

    return this.http
      .get<ReservaConsultaApiResponse>(this.apiUrl, { params: query })
      .pipe(map((response) => this.normalizeConsultaResponse(response, params.pagina, params.tamanoPagina)));
  }

  private normalizeConsultaResponse(response: ReservaConsultaApiResponse | null | undefined, pagina: number, tamanoPagina: number): ReservaConsultaPage {
    const reservas = (response?.reservas ?? []).map((item) => this.mapConsultaItem(item));
    const totalRegistros = Number(response?.totalRegistros ?? reservas.length);
    const pageSize = Number(response?.tamanoPagina ?? tamanoPagina);
    const totalPaginas = Number(response?.totalPaginas ?? Math.ceil(totalRegistros / Math.max(pageSize, 1)));

    return {
      reservas,
      totalRegistros,
      paginaActual: Number(response?.paginaActual ?? pagina),
      tamanoPagina: pageSize,
      totalPaginas: Math.max(totalPaginas, reservas.length ? 1 : 0)
    };
  }

  private normalizeTarifaAlimentosResponse(
    response: ReservaTarifaAlimento[] | { datos?: ReservaTarifaAlimento[]; data?: ReservaTarifaAlimento[] } | null | undefined
  ): ReservaTarifaAlimento[] {
    if (Array.isArray(response)) {
      return response;
    }

    if (Array.isArray(response?.datos)) {
      return response.datos;
    }

    return Array.isArray(response?.data) ? response.data : [];
  }

  private mapConsultaItem(item: ReservaConsultaApiItem): ReservaConsulta {
    return {
      reserva: (item.codReserva ?? '').trim(),
      codAgencia: (item.codAgencia ?? '').trim(),
      codTarifa: (item.codTarifa ?? '').trim(),
      codPlan: (item.codPlan ?? '').trim(),
      categoria: (item.categoria ?? item.Categoria ?? item.catHabita ?? item.CatHabita ?? item.cateHab ?? item.CateHab ?? '').trim(),
      habOrigen: (item.habOrigen ?? item.HabOrigen ?? item.oldHabita ?? item.OldHabita ?? item.numHabita ?? item.NumHabita ?? '').trim(),
      agencia: (item.nomAgencia ?? item.codAgencia ?? '').trim(),
      descripcion: (
        item.descripcion ??
        item.Descripcion ??
        item.observaciones ??
        item.Observaciones ??
        item.observacion ??
        item.Observacion ??
        ''
      ).trim(),
      ingreso: item.fecIngresa ?? '',
      salida: item.fecSalida ?? '',
      noches: Number(item.totNoches ?? 0),
      habitaciones: Number(item.nHab ?? 0),
      pax: Number(item.nPax ?? 0),
      ninos: Number(item.nChild ?? 0),
      estado: (item.estado ?? '').trim(),
      total: Number(item.totalRsv ?? 0),
      prepago: (item.prepago ?? '').trim().toUpperCase() === 'S' ? 'S' : 'N',
      moneda: (item.moneda ?? '').trim(),
      tCambio: Number(item.tCambio ?? 0),
      operador: (item.operador ?? '').trim()
    };
  }
}
