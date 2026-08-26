import { HttpClient } from '@angular/common/http';
import { HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs';

import { normalizePmsDateDDMMYYYY } from 'src/app/core/utils/pms-date.util';
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
  private readonly http                      = inject(HttpClient);
  private readonly baseApiUrl                = (environment.apiUrl ?? '').toString().replace(/\/+$/, '');
  private readonly apiUrl                    = `${this.baseApiUrl}/reservas-habitacion`;
  private readonly reservationSearchUrl      = `${this.baseApiUrl}/buscar-reservas`;
  private readonly categoryAvailabilityUrl   = `${this.baseApiUrl}/reservas/disponibilidad-categoria`;

  createReserva(request: ReservaHabitacionRequest): Observable<ReservaHabitacionResponse> {
    const normalizedRequest        = this.normalizeReservationRequest(request);
    const requestSnapshot          = JSON.parse(JSON.stringify(normalizedRequest)) as ReservaHabitacionRequest;
    console.groupCollapsed('[Reservas] POST confirmar reserva');
    console.log('method', 'POST');
    console.log('url', this.apiUrl);
    console.log('body', requestSnapshot);
    console.groupEnd();

    return this.http
      .post<ReservaHabitacionResponse>(this.apiUrl, normalizedRequest)
      .pipe(map((response) => this.normalizeReservationResponse(response)));
  }

  getReservaDetalle(codReserva: string): Observable<ReservaHabitacionDetalle> {
    return this.http
      .get<ReservaHabitacionDetalle>(`${this.apiUrl}/${encodeURIComponent(codReserva.trim())}`)
      .pipe(map((detalle) => this.normalizeReservationDetail(detalle)));
  }

  updateReserva(codReserva: string, request: ReservaHabitacionRequest): Observable<ReservaHabitacionResponse> {
    const normalizedRequest = this.normalizeReservationRequest(request);
    const requestSnapshot = JSON.parse(JSON.stringify(normalizedRequest)) as ReservaHabitacionRequest;
    const url = `${this.apiUrl}/${encodeURIComponent(codReserva.trim())}`;
    console.groupCollapsed('[Reservas] PUT actualizar reserva');
    console.log('method', 'PUT');
    console.log('url', url);
    console.log('body', requestSnapshot);
    console.groupEnd();

    return this.http
      .put<ReservaHabitacionResponse>(url, normalizedRequest)
      .pipe(map((response) => this.normalizeReservationResponse(response)));
  }

  consultarDisponibilidadCategoria(
    request: ReservaDisponibilidadCategoriaRequest
  ): Observable<ReservaDisponibilidadCategoriaResponse> {
    return this.http
      .post<ReservaDisponibilidadCategoriaResponse>(this.categoryAvailabilityUrl, {
        ...request,
        fechaIni: normalizePmsDateDDMMYYYY(request.fechaIni),
        fechaSal: normalizePmsDateDDMMYYYY(request.fechaSal)
      })
      .pipe(
        map((response) => ({
          ...response,
          data: (response.data ?? []).map((item) => ({ ...item, fecha: normalizePmsDateDDMMYYYY(item.fecha) }))
        }))
      );
  }

  anularReserva(codReserva: string, fecAnulada: string, operador: string, observaciones: string, procesa = 1): Observable<ReservaHabitacionResponse> {
    const url = `${this.apiUrl}/${encodeURIComponent(codReserva.trim())}`;
    const params = new HttpParams()
      .set('fecAnulada', normalizePmsDateDDMMYYYY(fecAnulada))
      .set('operador', operador.trim())
      .set('observaciones', observaciones.trim())
      .set('procesa', String(procesa));

    console.groupCollapsed('[Reservas] DELETE anular reserva');
    console.log('method', 'DELETE');
    console.log('url', url);
    console.log('query', { fecAnulada: normalizePmsDateDDMMYYYY(fecAnulada), operador, observaciones, procesa });
    console.groupEnd();

    return this.http
      .delete<ReservaHabitacionResponse>(url, { params })
      .pipe(map((response) => this.normalizeReservationResponse(response)));
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
    const url = `${this.baseApiUrl}/reservas-pdf/${encodeURIComponent(codReserva.trim())}`;
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
      .set('FecIngreso', normalizePmsDateDDMMYYYY(params.fecIngreso))
      .set('FecSalida', normalizePmsDateDDMMYYYY(params.fecSalida))
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

  buscarReservas(descripcion: string, pagina: number, tamanoPagina: number): Observable<ReservaConsultaPage> {
    const query = new HttpParams()
      .set('descripcion', descripcion.trim())
      .set('pagina', String(pagina))
      .set('tamanoPagina', String(tamanoPagina));

    return this.http
      .get<ReservaConsultaApiResponse>(this.reservationSearchUrl, { params: query })
      .pipe(map((response) => this.normalizeConsultaResponse(response, pagina, tamanoPagina)));
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
    const tags = Array.isArray(item.tags) ? item.tags : Array.isArray(item.Tags) ? item.Tags : [];
    return {
      reserva: (item.codReserva ?? item.prV01_CodReserva ?? '').trim(),
      codAgencia: (item.codAgencia ?? item.prV01_CodAgencia ?? '').trim(),
      codTarifa: (item.codTarifa ?? item.prV01_CodTarifa ?? '').trim(),
      codPlan: (item.codPlan ?? item.prV01_CodPlan ?? '').trim(),
      categoria: (item.categoria ?? item.Categoria ?? item.catHabita ?? item.CatHabita ?? item.cateHab ?? item.CateHab ?? '').trim(),
      habOrigen: (item.habOrigen ?? item.HabOrigen ?? item.oldHabita ?? item.OldHabita ?? item.numHabita ?? item.NumHabita ?? '').trim(),
      agencia: (item.nomAgencia ?? item.mR01_NomAgencia ?? item.codAgencia ?? item.prV01_CodAgencia ?? '').trim(),
      descripcion: (
        item.descripcion ??
        item.prV01_Descripcion ??
        item.Descripcion ??
        item.observaciones ??
        item.Observaciones ??
        item.observacion ??
        item.Observacion ??
        ''
      ).trim(),
      ingreso: normalizePmsDateDDMMYYYY(item.fecIngresa ?? item.prV01_FecIngresa ?? ''),
      salida: normalizePmsDateDDMMYYYY(item.fecSalida ?? item.prV01_FecSalida ?? ''),
      noches: Number(item.totNoches ?? item.prV01_TotNoches ?? 0),
      habitaciones: Number(item.nHab ?? item.nhab ?? 0),
      pax: Number(item.nPax ?? 0),
      ninos: Number(item.nChild ?? 0),
      estado: (item.estado ?? item.prV01_Estado ?? '').trim(),
      total: Number(item.totalRsv ?? item.prV01_TotalRsv ?? 0),
      prepago: (item.prepago ?? '').trim().toUpperCase() === 'S' ? 'S' : 'N',
      moneda: (item.moneda ?? item.prV01_Moneda ?? '').trim(),
      tCambio: Number(item.tCambio ?? item.prV01_TCambio ?? 0),
      operador: (item.operador ?? item.prV01_Operador ?? '').trim(),
      tags: [...tags],
      cantidadTags: Math.max(Number(item.cantidadTags ?? item.CantidadTags ?? tags.length), tags.length),
      tieneAlertas: Boolean(item.tieneAlertas ?? item.TieneAlertas ?? tags.some((tag) => tag.esAlerta))
    };
  }

  private normalizeReservationRequest(request: ReservaHabitacionRequest): ReservaHabitacionRequest {
    return {
      ...request,
      fecIngreso: normalizePmsDateDDMMYYYY(request.fecIngreso),
      fecSalida: normalizePmsDateDDMMYYYY(request.fecSalida),
      fecCreacion: normalizePmsDateDDMMYYYY(request.fecCreacion),
      fecConfirma: normalizePmsDateDDMMYYYY(request.fecConfirma),
      fecPrepago: normalizePmsDateDDMMYYYY(request.fecPrepago),
      fecAnulada: normalizePmsDateDDMMYYYY(request.fecAnulada)
    };
  }

  private normalizeReservationDetail(detalle: ReservaHabitacionDetalle): ReservaHabitacionDetalle {
    const fecIngreso = normalizePmsDateDDMMYYYY(detalle.fecIngreso || detalle.fecIngresa);
    return {
      ...detalle,
      fecIngresa: fecIngreso,
      fecIngreso,
      fecSalida: normalizePmsDateDDMMYYYY(detalle.fecSalida),
      fecCreacion: normalizePmsDateDDMMYYYY(detalle.fecCreacion),
      fecConfirma: normalizePmsDateDDMMYYYY(detalle.fecConfirma),
      fecPrepago: normalizePmsDateDDMMYYYY(detalle.fecPrepago),
      fecAnulada: normalizePmsDateDDMMYYYY(detalle.fecAnulada)
    };
  }

  private normalizeReservationResponse(response: ReservaHabitacionResponse): ReservaHabitacionResponse {
    return {
      ...response,
      datos: response.datos ? this.normalizeReservationRequest(response.datos) : response.datos
    };
  }
}
