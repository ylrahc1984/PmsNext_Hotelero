import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

import { environment } from 'src/environments/environment';
import {
  DepositoCxc,
  DepositoCxcFilters,
  DepositoCxcListItem,
  DepositoCxcResponse
} from './models/deposito-cxc.model';

@Injectable({
  providedIn: 'root'
})
export class DepositoCxcService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/depositos`;

  getDepositosPaged(filters: DepositoCxcFilters): Observable<DepositoCxcResponse> {
    let params = new HttpParams()
      .set('pagina', String(filters.pageNumber))
      .set('registros', String(filters.pageSize));

    params = this.appendIfPresent(params, 'codCtaBanco', filters.codCtaBanco);
    params = this.appendIfPresent(params, 'fechaInicio', this.formatDate(filters.fechaInicio));
    params = this.appendIfPresent(params, 'fechaFin', this.formatDate(filters.fechaFin));

    return this.http.get<unknown>(this.apiUrl, { params }).pipe(
      map((response) => this.normalizeListResponse(response, filters)),
      catchError((error) => this.handleError(error, 'No se pudieron cargar los depósitos.'))
    );
  }

  getDepositoById(idOperacion: string): Observable<DepositoCxc | null> {
    const url = `${this.apiUrl}/${encodeURIComponent(idOperacion)}`;
    return this.http.get<unknown>(url).pipe(
      map((response) => this.normalizeDeposito(response)),
      catchError((error) => this.handleError(error, 'No se pudo cargar el depósito.'))
    );
  }

  createDeposito(payload: DepositoCxc): Observable<DepositoCxc> {
    this.logPayload('POST', this.apiUrl, payload);
    return this.http.post<DepositoCxc>(this.apiUrl, payload).pipe(
      catchError((error) => this.handleError(error, 'No se pudo registrar el depósito.'))
    );
  }

  updateDeposito(idOperacion: string, payload: DepositoCxc): Observable<DepositoCxc> {
    const url = `${this.apiUrl}/${encodeURIComponent(idOperacion)}`;
    this.logPayload('PUT', url, payload);
    return this.http.put<DepositoCxc>(url, payload).pipe(
      catchError((error) => this.handleError(error, 'No se pudo actualizar el depósito.'))
    );
  }

  deleteDeposito(idOperacion: string): Observable<void> {
    const url = `${this.apiUrl}/${encodeURIComponent(idOperacion)}`;
    return this.http.delete<void>(url).pipe(
      catchError((error) => this.handleError(error, 'No se pudo eliminar el depósito.'))
    );
  }

  private normalizeListResponse(response: unknown, filters: DepositoCxcFilters): DepositoCxcResponse {
    const payload = this.unwrapResponse(response);
    const list = this.getFirstArray(payload, ['data', 'datos', 'detalle', 'items']);
    const pagination =
      payload?.paginacion ??
      payload?.pagination ??
      payload?.meta ??
      (response as any)?.paginacion ??
      (response as any)?.pagination ??
      (response as any)?.meta ??
      {};

    const totalRegistros =
      payload?.totalRegistros ??
      payload?.total ??
      pagination?.totalRegistros ??
      pagination?.total ??
      (response as any)?.totalRegistros ??
      (response as any)?.total ??
      list.length;
    const pageNumber =
      payload?.pageNumber ??
      payload?.paginaActual ??
      payload?.pagina ??
      pagination?.paginaActual ??
      pagination?.pageNumber ??
      pagination?.pagina ??
      (response as any)?.pageNumber ??
      (response as any)?.paginaActual ??
      (response as any)?.pagina ??
      filters.pageNumber;
    const pageSize =
      payload?.pageSize ??
      payload?.registros ??
      pagination?.pageSize ??
      pagination?.registros ??
      (response as any)?.pageSize ??
      (response as any)?.registros ??
      filters.pageSize;

    return {
      datos: (list as DepositoCxcListItem[]).map((item) => this.mapListItem(item)),
      totalRegistros,
      pageNumber,
      pageSize
    };
  }

  private normalizeDeposito(response: unknown): DepositoCxc | null {
    const data = this.unwrapResponse(response);
    if (!data) {
      return null;
    }
    const detalle = Array.isArray((data as any).detalle) ? (data as any).detalle : [];
    const cobranzas = Array.isArray((data as any).cobranzas) ? (data as any).cobranzas : [];
    return {
      ...(data as DepositoCxc),
      detalle,
      cobranzas
    };
  }

  private unwrapResponse(response: unknown): any {
    if (response && typeof response === 'object') {
      return (response as any).data ?? (response as any).datos ?? response;
    }
    return response;
  }

  private mapListItem(item: DepositoCxcListItem): DepositoCxcListItem {
    const raw = item as any;
    return {
      idOperacion: this.normalize(raw.idOperacion ?? raw.id ?? raw.operacion),
      codBanco: this.normalize(raw.codBanco ?? raw.banco),
      codCtaBanco: this.normalize(raw.codCtaBanco ?? raw.ctaBanco ?? raw.cuentaBanco),
      fecha: this.normalize(raw.fecha ?? raw.fechaDepo ?? raw.fecOper ?? raw.fechaOperacion),
      numOpera: this.normalize(raw.numOpera ?? raw.numOperacion ?? raw.numAsiento ?? raw.referencia ?? raw.idOperacion),
      depositante: this.normalize(raw.depositante ?? raw.cliente ?? raw.nombreCliente),
      monto: this.normalizeNumber(raw.monto ?? raw.total),
      moneda: this.normalize(raw.moneda ?? raw.codMoneda),
      movCon: raw.movCon ?? raw.conciliado ?? raw.movConciliado ?? 0
    };
  }

  private getFirstArray(payload: any, keys: string[]): any[] {
    if (Array.isArray(payload)) {
      return payload;
    }

    for (const key of keys) {
      const value = payload?.[key];
      if (Array.isArray(value) && value.length > 0) {
        return value;
      }
    }

    for (const key of keys) {
      const value = payload?.[key];
      if (Array.isArray(value)) {
        return value;
      }
    }

    return [];
  }

  private appendIfPresent(params: HttpParams, key: string, value?: string): HttpParams {
    const normalized = (value ?? '').toString().trim();
    return normalized ? params.set(key, normalized) : params;
  }

  private formatDate(value?: string): string {
    const trimmed = (value ?? '').toString().trim();
    if (!trimmed) {
      return '';
    }
    if (trimmed.includes('/')) {
      return trimmed;
    }
    const parts = trimmed.split('-');
    if (parts.length !== 3) {
      return trimmed;
    }
    const [year, month, day] = parts;
    if (!year || !month || !day) {
      return trimmed;
    }
    return `${day}/${month}/${year}`;
  }

  private normalize(value: string | null | undefined): string {
    return (value ?? '').toString().trim();
  }

  private normalizeNumber(value: number | string | null | undefined): number {
    const parsed = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private logPayload(method: 'POST' | 'PUT', url: string, payload: DepositoCxc): void {
    console.groupCollapsed(`[DepositoCxc] ${method} ${url}`);
    console.log('payload', payload);
    console.log('payload.json', JSON.stringify(payload, null, 2));
    console.log('detalle', payload.detalle);
    console.log('cobranzas', payload.cobranzas);
    console.groupEnd();
  }

  private handleError(error: HttpErrorResponse, fallback: string): Observable<never> {
    const message = this.getErrorMessage(error, fallback);
    return throwError(() => new Error(message));
  }

  private getErrorMessage(error: HttpErrorResponse, fallback: string): string {
    const apiMessage = (error.error && (error.error.mensaje || error.error.respuesta || error.error.message)) as
      | string
      | undefined;
    return apiMessage || error.message || fallback;
  }
}
