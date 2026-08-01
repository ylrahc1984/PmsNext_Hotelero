import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, concatMap, map, throwError } from 'rxjs';

import { environment } from 'src/environments/environment';
import {
  LimpiezaHabitacion,
  LimpiezaHabitacionesResponse
} from '../models/limpieza-habitacion.model';

@Injectable({ providedIn: 'root' })
export class LimpiezaHabitacionesService {
  private readonly http = inject(HttpClient);
  private readonly endpoint = `${(environment.apiUrl || 'http://localhost:5000/api').replace(/\/+$/, '')}/frontdesk/limpiar-habitacion`;

  inicializar(operador: string): Observable<unknown> {
    const params = new HttpParams().set('operador', this.requireOperator(operador));
    return this.http.post(`${this.endpoint}/inicializar`, {}, { params, responseType: 'text' }).pipe(
      catchError((error) => this.handleError(error, 'No se pudo inicializar la lista de limpieza.'))
    );
  }

  cargar(fechaOperativa: string, operador: string): Observable<unknown> {
    const params = new HttpParams()
      .set('fechaOpe', this.requireText(fechaOperativa, 'La fecha operativa es requerida.'))
      .set('operador', this.requireOperator(operador));

    return this.http.post(`${this.endpoint}/cargar`, {}, { params, responseType: 'text' }).pipe(
      catchError((error) => this.handleError(error, 'No se pudo cargar la información operativa de habitaciones.'))
    );
  }

  listar(operador: string): Observable<LimpiezaHabitacionesResponse> {
    const params = new HttpParams().set('operador', this.requireOperator(operador));
    return this.http.get<unknown>(this.endpoint, { params }).pipe(
      map((response) => this.normalizeResponse(response)),
      catchError((error) => this.handleError(error, 'No se pudo consultar la lista de limpieza de habitaciones.'))
    );
  }

  prepararLista(fechaOperativa: string, operador: string): Observable<LimpiezaHabitacionesResponse> {
    return this.inicializar(operador).pipe(
      concatMap(() => this.cargar(fechaOperativa, operador)),
      concatMap(() => this.listar(operador))
    );
  }

  private normalizeResponse(response: unknown): LimpiezaHabitacionesResponse {
    const raw = this.unwrap(response) as any;
    const respuesta = this.cleanText(raw?.respuesta || raw?.Respuesta);
    const list = raw?.habitaciones ?? raw?.Habitaciones;

    if (respuesta && respuesta.toUpperCase() !== 'OK') {
      throw new Error(respuesta);
    }

    return {
      respuesta: respuesta || 'OK',
      habitaciones: (Array.isArray(list) ? list : []).map((item: any) => this.normalizeRoom(item))
    };
  }

  private normalizeRoom(item: any): LimpiezaHabitacion {
    return {
      room: this.cleanText(item?.room ?? item?.Room),
      fechaIni: this.normalizeApiDate(item?.fechaIni ?? item?.FechaIni),
      fechaFin: this.normalizeApiDate(item?.fechaFin ?? item?.FechaFin),
      huesped: this.cleanGuest(item?.huesped ?? item?.Huesped),
      numPax: this.toNumber(item?.numPax ?? item?.NumPax),
      estado: this.cleanText(item?.estado ?? item?.Estado).toUpperCase(),
      clean: item?.clean ?? item?.Clean ?? null,
      grupo: this.cleanText(item?.grupo ?? item?.Grupo).toUpperCase(),
      numChl: this.toNumber(item?.numChl ?? item?.NumChl)
    };
  }

  /** El contrato de este endpoint entrega fechas de habitación en MM/DD/YYYY. */
  private normalizeApiDate(value: unknown): string {
    const raw = this.cleanText(value).split('T')[0].split(' ')[0];
    if (!raw) return '';

    const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(raw);
    if (iso) return this.formatDate(Number(iso[3]), Number(iso[2]), Number(iso[1]));

    const us = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(raw);
    return us ? this.formatDate(Number(us[2]), Number(us[1]), Number(us[3])) : raw;
  }

  private formatDate(day: number, month: number, year: number): string {
    const candidate = new Date(year, month - 1, day);
    if (
      candidate.getFullYear() !== year ||
      candidate.getMonth() !== month - 1 ||
      candidate.getDate() !== day
    ) {
      return '';
    }
    return `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`;
  }

  private cleanGuest(value: unknown): string {
    return this.cleanText(value).replace(/^\s*\/\s*/, '');
  }

  private unwrap(response: unknown): unknown {
    if (response && typeof response === 'object') {
      return (response as any).data ?? (response as any).datos ?? response;
    }
    return response;
  }

  private requireOperator(value: unknown): string {
    return this.requireText(value, 'No se pudo determinar el operador de la sesión.');
  }

  private requireText(value: unknown, message: string): string {
    const normalized = this.cleanText(value);
    if (!normalized) throw new Error(message);
    return normalized;
  }

  private cleanText(value: unknown): string {
    return String(value ?? '').replace(/\s+/g, ' ').trim();
  }

  private toNumber(value: unknown): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private handleError(error: unknown, fallback: string): Observable<never> {
    if (error instanceof Error && !(error instanceof HttpErrorResponse)) {
      return throwError(() => error);
    }

    const httpError = error as HttpErrorResponse;
    const body = httpError?.error;
    const apiMessage = body && typeof body === 'object'
      ? body.mensaje ?? body.respuesta ?? body.message
      : typeof body === 'string' ? body : '';
    return throwError(() => new Error(this.cleanText(apiMessage || httpError?.message) || fallback));
  }
}
