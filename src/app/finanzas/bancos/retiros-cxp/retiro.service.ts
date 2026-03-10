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

    params = this.appendIfPresent(params, 'codCtaBanco', filters.codCtaBanco);
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
    this.logRequest('POST', this.apiUrl, payload);
    return this.http.post<RetiroCxp>(this.apiUrl, payload).pipe(
      catchError((error) => this.handleError(error, 'No se pudo registrar el retiro.'))
    );
  }

  updateRetiro(idOperacion: string, payload: RetiroCxp): Observable<RetiroCxp> {
    const url = `${this.apiUrl}/${encodeURIComponent(idOperacion)}`;
    this.logRequest('PUT', url, payload);
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
      : this.pickFirstArray(payload?.data, payload?.datos, payload?.detalle, payload?.items);
    const pagination =
      payload?.paginacion ??
      payload?.pagination ??
      payload?.meta ??
      (response as any)?.paginacion ??
      (response as any)?.pagination ??
      (response as any)?.meta ??
      {};

    const totalRegistros =
      pagination?.totalRegistros ??
      payload?.totalRegistros ??
      (response as any)?.totalRegistros ??
      (response as any)?.total ??
      list.length;
    const pageNumber =
      pagination?.pageNumber ??
      pagination?.paginaActual ??
      payload?.pageNumber ??
      payload?.paginaActual ??
      (response as any)?.pageNumber ??
      (response as any)?.paginaActual ??
      filters.pageNumber;
    const pageSize = pagination?.pageSize ?? payload?.pageSize ?? (response as any)?.pageSize ?? filters.pageSize;

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
    const raw = data as any;
    const pagos = Array.isArray(raw.pagos) ? raw.pagos : Array.isArray(raw.facturas) ? raw.facturas : [];
    const detalle = Array.isArray(raw.detalle) ? raw.detalle : Array.isArray(raw.detalles) ? raw.detalles : [];

    return {
      idOperacion: this.normalize(raw.idOperacion ?? raw.id ?? raw.operacion),
      codBanco: this.normalize(raw.codBanco ?? raw.banco),
      codCtaBanco: this.normalize(raw.codCtaBanco ?? raw.ctaBanco ?? raw.cuentaBanco ?? raw.cuenta),
      fecha: this.formatDate(raw.fecha ?? raw.fecOper ?? raw.fechaOperacion),
      numBeneficiario: this.normalize(raw.numBeneficiario ?? raw.codProve ?? raw.codigoProveedor ?? raw.proveedor),
      beneficiario: this.normalize(raw.beneficiario ?? raw.nomProve ?? raw.nombreProveedor ?? raw.proveedorNombre),
      concepto: this.normalize(raw.concepto),
      numOperacion: this.normalize(raw.numOperacion ?? raw.numeroOperacion ?? raw.numOper),
      tipoOperacion: this.normalize(raw.tipoOperacion ?? raw.tipOperacion ?? raw.tipoOper),
      moneda: this.normalize(raw.moneda ?? raw.codMoneda),
      monto: this.normalizeNumber(raw.monto ?? raw.montoTotal ?? raw.total),
      tCambio: this.normalizeNumber(raw.tCambio ?? raw.tipoCambio),
      operador: this.normalize(raw.operador),
      empresa: this.normalize(raw.empresa),
      movCon: raw.movCon ?? raw.conciliado ?? raw.movConciliado ?? 0,
      fechaCon: this.formatDate(raw.fechaCon),
      operCon: this.normalize(raw.operCon),
      pagos: pagos.map((item: unknown) => this.mapPago(item)),
      detalle: detalle.map((item: unknown) => this.mapDetalle(item))
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
      ctaBanco: this.normalize(raw.ctaBanco ?? raw.codCtaBanco ?? raw.cuentaBanco ?? raw.cuenta),
      fecha: this.formatDate(raw.fecha ?? raw.fechaRetiro ?? raw.fecOper ?? raw.fechaOperacion),
      numOperacion: this.normalize(raw.numOperacion ?? raw.numeroOperacion ?? raw.numOper),
      tipoOperacion: this.normalize(raw.tipoOperacion ?? raw.tipOperacion ?? raw.tipoOper ?? raw.tipDocu),
      concepto: this.normalize(raw.concepto),
      moneda: this.normalize(raw.moneda ?? raw.codMoneda),
      montoTotal: this.normalizeNumber(raw.montoTotal ?? raw.monto ?? raw.total),
      codProve: this.normalize(raw.codProve ?? raw.numBeneficiario ?? raw.codigoProveedor ?? raw.proveedor),
      nomProve: this.normalize(raw.nomProve ?? raw.beneficiario ?? raw.nombreProveedor ?? raw.proveedorNombre),
      movCon: raw.movCon ?? raw.conciliado ?? raw.movConciliado ?? false,
      estado: this.normalize(raw.estado ?? raw.estadoOperacion)
    };
  }

  private pickFirstArray(...candidates: unknown[]): unknown[] {
    const arrays = candidates.filter(Array.isArray) as unknown[][];
    return arrays.find((candidate) => candidate.length > 0) ?? arrays[0] ?? [];
  }

  private mapPago(item: unknown) {
    const raw = item as any;
    return {
      tipoOpe: this.normalize(raw.tipoOpe ?? raw.tipoOperacion),
      tipoDocu: this.normalize(raw.tipoDocu ?? raw.tipDocu),
      numDocu: this.normalize(raw.numDocu),
      tipDocPrv: this.normalize(raw.tipDocPrv),
      serieDocPrv: this.normalize(raw.serieDocPrv ?? raw.serie),
      numFacPrv: this.normalize(raw.numFacPrv ?? raw.numFactura),
      fechaCobra: this.formatDate(raw.fechaCobra ?? raw.fecFactu),
      fechaVen: this.formatDate(raw.fechaVen ?? raw.fecVen),
      tipoPago: this.normalize(raw.tipoPago),
      moneda: this.normalize(raw.moneda),
      totalDocu: this.normalizeNumber(raw.totalDocu ?? raw.total),
      montoPago: this.normalizeNumber(raw.montoPago ?? raw.monto ?? raw.montoPagar),
      tCambio: this.normalizeNumber(raw.tCambio ?? raw.tipoCambio),
      estado: this.normalize(raw.estado),
      descripcion: this.normalize(raw.descripcion),
      saldo: this.normalizeNumber(raw.saldo ?? raw.montoPago ?? raw.monto ?? raw.montoPagar ?? raw.totalDocu ?? raw.total)
    };
  }

  private mapDetalle(item: unknown) {
    const raw = item as any;
    return {
      codConcepto: this.normalize(raw.codConcepto),
      concepto: this.normalize(raw.concepto ?? raw.descripcion),
      moneda: this.normalize(raw.moneda),
      monto: this.normalizeNumber(raw.monto),
      tCambio: this.normalizeNumber(raw.tCambio ?? raw.tipoCambio),
      numAsientoObs: this.normalize(raw.numAsientoObs),
      operador: this.normalize(raw.operador)
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
      const parts = trimmed.split('/');
      if (parts.length === 3) {
        const [day, month, year] = parts;
        if (day && month && year) {
          return `${day.padStart(2, '0')}/${month.padStart(2, '0')}/${year.slice(0, 4)}`;
        }
      }
      return trimmed;
    }
    const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) {
      const [, year, month, day] = isoMatch;
      return `${day}/${month}/${year}`;
    }
    const compactMatch = trimmed.match(/^(\d{4})(\d{2})(\d{2})$/);
    if (compactMatch) {
      const [, year, month, day] = compactMatch;
      return `${day}/${month}/${year}`;
    }
    const parsed = new Date(trimmed);
    if (!Number.isNaN(parsed.getTime())) {
      const year = parsed.getFullYear();
      const month = `${parsed.getMonth() + 1}`.padStart(2, '0');
      const day = `${parsed.getDate()}`.padStart(2, '0');
      return `${day}/${month}/${year}`;
    }
    return trimmed;
  }

  private normalize(value: string | null | undefined): string {
    return (value ?? '').toString().trim();
  }

  private normalizeNumber(value: number | string | null | undefined): number {
    const parsed = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private logRequest(method: 'POST' | 'PUT', url: string, payload: RetiroCxp): void {
    console.log(`[RetiroCxpService] ${method} ${url}`, payload);
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
