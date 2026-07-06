import { HttpClient } from '@angular/common/http';
import { HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs';

import { environment } from 'src/environments/environment';
import { ReservaHabitacionRequest, ReservaHabitacionResponse } from '../interfaces/reserva-habitacion.interface';
import {
  ReservaConsulta,
  ReservaConsultaApiItem,
  ReservaConsultaApiResponse,
  ReservaConsultaPage,
  ReservaConsultaParams
} from '../models/reserva-consulta.model';
import { ReservaHabitacionRepository } from './reserva-habitacion.repository';

@Injectable({ providedIn: 'root' })
export class ReservaHabitacionService implements ReservaHabitacionRepository {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${(environment.apiUrl || 'http://localhost:5000/api').toString().replace(/\/+$/, '')}/reservas-habitacion`;

  createReserva(request: ReservaHabitacionRequest): Observable<ReservaHabitacionResponse> {
    const requestSnapshot = JSON.parse(JSON.stringify(request)) as ReservaHabitacionRequest;
    console.groupCollapsed('[Reservas] POST confirmar reserva');
    console.log('method', 'POST');
    console.log('url', this.apiUrl);
    console.log('body', requestSnapshot);
    console.groupEnd();

    return this.http.post<ReservaHabitacionResponse>(this.apiUrl, request);
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

  private mapConsultaItem(item: ReservaConsultaApiItem): ReservaConsulta {
    return {
      reserva: (item.codReserva ?? '').trim(),
      codAgencia: (item.codAgencia ?? '').trim(),
      codTarifa: (item.codTarifa ?? '').trim(),
      codPlan: (item.codPlan ?? '').trim(),
      agencia: (item.nomAgencia ?? item.codAgencia ?? '').trim(),
      descripcion: (item.descripcion ?? item.observacion ?? '').trim(),
      ingreso: item.fecIngresa ?? '',
      salida: item.fecSalida ?? '',
      noches: Number(item.totNoches ?? 0),
      habitaciones: Number(item.nHab ?? 0),
      pax: Number(item.nPax ?? 0),
      ninos: Number(item.nChild ?? 0),
      estado: (item.estado ?? '').trim(),
      total: Number(item.totalRsv ?? 0),
      moneda: (item.moneda ?? '').trim(),
      operador: (item.operador ?? '').trim()
    };
  }
}
