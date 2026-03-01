import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

import { environment } from 'src/environments/environment';
import { RetiroCxp, RetiroCxpFilters, RetiroCxpListItem, RetiroCxpResponse } from './models/retiro-cxp.model';

@Injectable({
  providedIn: 'root'
})
export class RetiroCxpService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/retiros-cxp`;

  getRetiros(filters: RetiroCxpFilters): Observable<RetiroCxpResponse> {
    let params = new HttpParams()
      .set('pageNumber', String(filters.pageNumber))
      .set('pageSize', String(filters.pageSize));

    params = this.appendIfPresent(params, 'codBanco', filters.codBanco);
    params = this.appendIfPresent(params, 'ctaBanco', filters.ctaBanco);
    params = this.appendIfPresent(params, 'fechaInicio', this.formatDate(filters.fechaInicio));
    params = this.appendIfPresent(params, 'fechaFin', this.formatDate(filters.fechaFin));

    return this.http.get<unknown>(this.apiUrl, { params }).pipe(
      map((response) => this.normalizeListResponse(response, filters)),
      catchError((error) => this.handleError(error, 'No se pudieron cargar los retiros.'))
    );
  }

  getRetiro(idOperacion: string): Observable<RetiroCxp | null> {
    const url = `${this.apiUrl}/${encodeURIComponent(idOperacion)}`;
    return this.http.get<unknown>(url).pipe(
      map((response) => this.normalizeRetiro(response)),
      catchError((error) => this.handleError(error, 'No se pudo cargar el retiro.'))
    );
  }

  createRetiro(payload: RetiroCxp): Observable<RetiroCxp> {
    return this.http.post<RetiroCxp>(this.apiUrl, payload).pipe(
      catchError((error) => this.handleError(error, 'No se pudo registrar el retiro.'))
    );
  }

  updateRetiro(idOperacion: string, payload: RetiroCxp): Observable<RetiroCxp> {
    const url = `${this.apiUrl}/${encodeURIComponent(idOperacion)}`;
    return this.http.put<RetiroCxp>(url, payload).pipe(
      catchError((error) => this.handleError(error, 'No se pudo actualizar el retiro.'))
    );
  }

  deleteRetiro(idOperacion: string): Observable<void> {
    const url = `${this.apiUrl}/${encodeURIComponent(idOperacion)}`;
    return this.http.delete<void>(url).pipe(
      catchError((error) => this.handleError(error, 'No se pudo eliminar el retiro.'))
    );
  }

  private normalizeListResponse(response: unknown, filters: RetiroCxpFilters): RetiroCxpResponse {
    const payload = this.unwrapResponse(response);
    const list = Array.isArray(payload)
      ? payload
      : (payload?.detalle ?? payload?.datos ?? payload?.data ?? payload?.items ?? []);
    const pagination = (response as any)?.paginacion ?? (response as any)?.pagination ?? (response as any)?.meta ?? {};

    const totalRegistros =
      pagination?.totalRegistros ??
      (response as any)?.totalRegistros ??
      (response as any)?.total ??
      list.length;
    const pageNumber =
      pagination?.paginaActual ?? (response as any)?.pageNumber ?? (response as any)?.paginaActual ?? filters.pageNumber;
    const pageSize = pagination?.pageSize ?? (response as any)?.pageSize ?? filters.pageSize;

    return {
      datos: (list as RetiroCxpListItem[]).map((item) => this.mapListItem(item)),
      totalRegistros,
      pageNumber,
      pageSize
    };
  }

  private normalizeRetiro(response: unknown): RetiroCxp | null {
    const data = this.unwrapResponse(response);
    if (!data) {
      return null;
    }
    const facturas = Array.isArray((data as any).facturas) ? (data as any).facturas : [];
    const detalles = Array.isArray((data as any).detalles) ? (data as any).detalles : [];

    return {
      ...(data as RetiroCxp),
      facturas,
      detalles
    };
  }

  private unwrapResponse(response: unknown): any {
    if (response && typeof response === 'object') {
      return (response as any).data ?? (response as any).datos ?? response;
    }
    return response;
  }

  private mapListItem(item: RetiroCxpListItem): RetiroCxpListItem {
    const raw = item as any;
    return {
      idOperacion: this.normalize(raw.idOperacion ?? raw.id ?? raw.operacion),
      codBanco: this.normalize(raw.codBanco ?? raw.banco ?? raw.codBanco),
      ctaBanco: this.normalize(raw.ctaBanco ?? raw.cuentaBanco ?? raw.cuenta),
      fecha: this.normalize(raw.fecha ?? raw.fecOper ?? raw.fechaOperacion),
      numOperacion: this.normalize(raw.numOperacion ?? raw.numeroOperacion ?? raw.numOper),
      tipoOperacion: this.normalize(raw.tipoOperacion ?? raw.tipOperacion ?? raw.tipoOper),
      moneda: this.normalize(raw.moneda ?? raw.codMoneda),
      montoTotal: this.normalizeNumber(raw.montoTotal ?? raw.monto ?? raw.total),
      codProve: this.normalize(raw.codProve ?? raw.codigoProveedor ?? raw.proveedor),
      nomProve: this.normalize(raw.nomProve ?? raw.nombreProveedor ?? raw.proveedorNombre),
      movCon: raw.movCon ?? raw.conciliado ?? raw.movConciliado ?? false,
      estado: this.normalize(raw.estado ?? raw.estadoOperacion)
    };
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
