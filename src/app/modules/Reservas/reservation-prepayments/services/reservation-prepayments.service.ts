import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map, throwError } from 'rxjs';

import { normalizePmsDateDDMMYYYY } from 'src/app/core/utils/pms-date.util';
import { environment } from 'src/environments/environment';
import { ReservationPrepayment, ReservationPrepaymentHistoryItem, ReservationPrepaymentResponse } from '../models/reservation-prepayment.model';

@Injectable({ providedIn: 'root' })
export class ReservationPrepaymentsService {
  private readonly http = inject(HttpClient);
  private readonly baseApiUrl = (environment.apiUrl || 'http://localhost:5000/api').toString().replace(/\/+$/, '');
  private readonly prepaymentsUrl = `${this.baseApiUrl}/prepagos-reserva`;
  private readonly apiUrl = `${this.prepaymentsUrl}/sin-deposito`;
  private readonly historyUrl = `${this.prepaymentsUrl}/por-reserva`;

  consultar(codReserva: string): Observable<ReservationPrepayment[]> {
    const params = new HttpParams().set('codRsv', codReserva);
    return this.http
      .get<ReservationPrepaymentHistoryItem[]>(this.historyUrl, { params })
      .pipe(map((items) => (Array.isArray(items) ? items.map((item) => this.normalizeItem(item)) : [])));
  }

  guardar(prepayment: ReservationPrepayment): Observable<ReservationPrepaymentResponse> {
    return this.execute({ ...prepayment, proceso: 1 });
  }

  actualizar(prepayment: ReservationPrepayment): Observable<ReservationPrepaymentResponse> {
    return this.execute({ ...prepayment, proceso: 2 });
  }

  eliminar(prepayment: ReservationPrepayment): Observable<ReservationPrepaymentResponse> {
    const numInterno = prepayment.numInterno?.trim();
    if (!numInterno) {
      return throwError(() => new Error('No se encontró el número interno del prepago.'));
    }

    return this.http
      .delete<ReservationPrepaymentResponse | ReservationPrepayment[] | ReservationPrepayment | null>(`${this.prepaymentsUrl}/${encodeURIComponent(numInterno)}`)
      .pipe(map((response) => this.normalizeResponse(response)));
  }

  createEmptyPayload(): ReservationPrepayment {
    return {
      proceso: 90,
      numInterno: '',
      codRsv: '',
      codAge: '',
      fechaDepo: '',
      fechaReg: '',
      horaReg: '',
      concepto: '',
      cCosto: 'PREPA',
      totalRsv: 0,
      totalPrepa: 0,
      saldoPrepa: 0,
      moneda: '',
      tCambio: 1,
      frmPago: '',
      numTarjeta: '',
      venTarjeta: '',
      codSeguridad: '',
      tipTarjeta: '',
      nOperacion: '',
      codBanco: '',
      ctaBanco: '',
      procesado: 0,
      cierre: 0,
      numCierre: 0,
      empresa: '',
      operador: ''
    };
  }

  private execute(payload: ReservationPrepayment): Observable<ReservationPrepaymentResponse> {
    return this.http.post<ReservationPrepaymentResponse | ReservationPrepayment[] | ReservationPrepayment>(this.apiUrl, this.buildRequest(payload)).pipe(
      map((response) => this.normalizeResponse(response))
    );
  }

  private buildRequest(payload: ReservationPrepayment): ReservationPrepayment {
    return {
      ...payload,
      fechaDepo: normalizePmsDateDDMMYYYY(payload.fechaDepo),
      fechaReg: normalizePmsDateDDMMYYYY(payload.fechaReg),
      cCosto: 'PREPA',
      codBanco: '',
      ctaBanco: ''
    };
  }

  private normalizeResponse(response: ReservationPrepaymentResponse | ReservationPrepayment[] | ReservationPrepayment | null): ReservationPrepaymentResponse {
    if (Array.isArray(response)) {
      return { ok: true, datos: response.map((item) => this.normalizeItem(item)) };
    }

    if (response && this.isPrepayment(response)) {
      return { ok: true, datos: this.normalizeItem(response) };
    }

    if (!response) {
      return { ok: true, datos: [] };
    }

    const normalizedResponse = response as ReservationPrepaymentResponse;
    return {
      ...normalizedResponse,
      datos: Array.isArray(normalizedResponse.datos)
        ? normalizedResponse.datos.map((item) => this.normalizeItem(item))
        : normalizedResponse.datos
          ? this.normalizeItem(normalizedResponse.datos)
          : normalizedResponse.datos,
      prepagos: normalizedResponse.prepagos?.map((item) => this.normalizeItem(item))
    };
  }

  private extractItems(response: ReservationPrepaymentResponse): ReservationPrepayment[] {
    if (Array.isArray(response.prepagos)) {
      return response.prepagos.map((item) => this.normalizeItem(item));
    }

    if (Array.isArray(response.datos)) {
      return response.datos.map((item) => this.normalizeItem(item));
    }

    if (response.datos && this.isPrepayment(response.datos)) {
      return [this.normalizeItem(response.datos)];
    }

    return [];
  }

  private normalizeItem(item: ReservationPrepayment | ReservationPrepaymentHistoryItem): ReservationPrepayment {
    const source = item as ReservationPrepayment & ReservationPrepaymentHistoryItem;
    return {
      ...this.createEmptyPayload(),
      ...source,
      codRsv: source.codRsv || source.codReserva || '',
      codAge: source.codAge || source.codAgen || '',
      fechaDepo: normalizePmsDateDDMMYYYY(source.fechaDepo || source.fecDepo || ''),
      fechaReg: normalizePmsDateDDMMYYYY(source.fechaReg || ''),
      proceso: Number(source.proceso ?? 90) || 90,
      cCosto: source.cCosto || 'PREPA',
      totalRsv: Number(source.totalRsv ?? 0) || 0,
      totalPrepa: Number(source.totalPrepa ?? 0) || 0,
      saldoPrepa: Number(source.saldoPrepa ?? 0) || 0,
      tCambio: Number(source.tCambio ?? 0) || 1,
      procesado: Number(source.procesado ?? 0) || 0,
      cierre: Number(source.cierre ?? 0) || 0,
      numCierre: Number(source.numCierre ?? 0) || 0,
      empresa: source.empresa || ''
    };
  }

  private isPrepayment(value: unknown): value is ReservationPrepayment {
    return !!value && typeof value === 'object' && ('codRsv' in value || 'numInterno' in value);
  }

}
