import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

import {
  CierreCajaEstado,
  CierreCajaLinea,
  CierreCajaListFilters,
  CierreCajaRecord,
  CierreCajaUpsertInput,
  Denominacion,
  DenominacionBatchItem,
  DenominacionResumen,
  EjecutarCierrePayload,
  ReporteCierreEncabezado,
  TmpFormaPago,
  TmpFormaPagoPayload
} from './models/cierre-caja.model';
import { environment } from 'src/environments/environment.prod';  

@Injectable({ providedIn: 'root' })
export class CierreCajaService {
  private readonly http = inject(HttpClient);
  private readonly storageKey = 'ope_cierre_caja_records_v1';
  private readonly denominacionApiUrl = `${environment.apiUrl}/denominacion`;
  private readonly tmpFormaPagoApiUrl = 'http://localhost:5000/api/tmpformapago';
  private readonly ejecutarCierreApiUrl = 'http://localhost:5000/api/ejecutar-cierre';
  private readonly reporteCierreApiUrl = 'http://localhost:5000/api/reporte-cierre';
 
  list(filters?: CierreCajaListFilters): Observable<CierreCajaRecord[]> {
    const normalized = this.readAll()
      .filter((item) => this.matchesFilters(item, filters))
      .sort((a, b) => `${b.fecha} ${b.horaApertura}`.localeCompare(`${a.fecha} ${a.horaApertura}`));

    return of(normalized);
  }

  getById(id: string): Observable<CierreCajaRecord | null> {
    const match = this.readAll().find((item) => item.id === id) ?? null;
    return of(match);
  }

  findOpenByUsuario(usuario: string): Observable<CierreCajaRecord | null> {
    const normalizedUsuario = this.cleanText(usuario).toUpperCase();
    const match =
      this.readAll().find(
        (item) => item.estado === 'ABIERTO' && this.cleanText(item.usuario).toUpperCase() === normalizedUsuario
      ) ?? null;
    return of(match);
  }

  create(input: CierreCajaUpsertInput): Observable<CierreCajaRecord> {
    const records = this.readAll();
    const now = new Date().toISOString();
    const record = this.normalizeRecord({
      id: this.buildId(),
      usuario: input.usuario,
      operador: input.operador,
      pntVenta: input.pntVenta,
      caja: input.caja,
      turno: input.turno,
      fecha: input.fecha,
      horaApertura: input.horaApertura,
      horaCierre: input.horaCierre ?? '',
      montoApertura: input.montoApertura,
      estado: input.estado ?? 'ABIERTO',
      observaciones: input.observaciones ?? '',
      lineas: input.lineas ?? [],
      totalSistema: 0,
      totalDeclarado: 0,
      diferenciaTotal: 0,
      createdAt: now,
      updatedAt: now
    });

    records.push(record);
    this.writeAll(records);
    return of(record);
  }

  update(id: string, input: CierreCajaUpsertInput): Observable<CierreCajaRecord> {
    const records = this.readAll();
    const index = records.findIndex((item) => item.id === id);
    if (index < 0) {
      throw new Error('No se encontró el cierre de caja.');
    }

    const current = records[index];
    const record = this.normalizeRecord({
      ...current,
      usuario: input.usuario,
      operador: input.operador,
      pntVenta: input.pntVenta,
      caja: input.caja,
      turno: input.turno,
      fecha: input.fecha,
      horaApertura: input.horaApertura,
      horaCierre: input.horaCierre ?? current.horaCierre,
      montoApertura: input.montoApertura,
      estado: input.estado ?? current.estado,
      observaciones: input.observaciones ?? '',
      lineas: input.lineas ?? [],
      updatedAt: new Date().toISOString()
    });

    records[index] = record;
    this.writeAll(records);
    return of(record);
  }

  close(id: string, input: CierreCajaUpsertInput): Observable<CierreCajaRecord> {
    return this.update(id, { ...input, estado: 'CERRADO' satisfies CierreCajaEstado });
  }

  inicializarDenominaciones(): Observable<unknown> {
    return this.http.post<unknown>(`${this.denominacionApiUrl}/inicializar`, {}).pipe(
      catchError((error) => this.handleHttpError(error, 'No se pudieron inicializar las denominaciones.'))
    );
  }

  getDenominaciones(): Observable<Denominacion[]> {
    return this.http.get<unknown>(this.denominacionApiUrl).pipe(
      map((response) => this.normalizeDenominaciones(response)),
      catchError((error) => this.handleHttpError(error, 'No se pudieron cargar las denominaciones.'))
    );
  }

  getDenominacionesResumen(): Observable<DenominacionResumen> {
    return this.http.get<unknown>(`${this.denominacionApiUrl}/resumen`).pipe(
      map((response) => this.normalizeDenominacionResumen(response)),
      catchError((error) => this.handleHttpError(error, 'No se pudo cargar el resumen de denominaciones.'))
    );
  }

  updateDenominacionesBatch(payload: DenominacionBatchItem[]): Observable<unknown> {
    return this.http.post<unknown>(`${this.denominacionApiUrl}/batch`, payload).pipe(
      catchError((error) => this.handleHttpError(error, 'No se pudieron actualizar las denominaciones.'))
    );
  }

  crearTmpFormaPago(payload: TmpFormaPagoPayload): Observable<unknown> {
    return this.http.post<unknown>(`${this.tmpFormaPagoApiUrl}/crear`, payload).pipe(
      catchError((error) => this.handleHttpError(error, 'No se pudo crear la tabla temporal de formas de pago.'))
    );
  }

  consultarTmpFormaPago(operador: string): Observable<TmpFormaPago[]> {
    return this.http.get<unknown>(`${this.tmpFormaPagoApiUrl}/consultar/${encodeURIComponent(operador)}`).pipe(
      map((response) => this.normalizeTmpFormasPago(response)),
      catchError((error) => this.handleHttpError(error, 'No se pudieron consultar las formas de pago temporales.'))
    );
  }

  actualizarTmpFormaPago(payload: TmpFormaPagoPayload): Observable<unknown> {
    return this.http.put<unknown>(`${this.tmpFormaPagoApiUrl}/actualizar`, payload).pipe(
      catchError((error) => this.handleHttpError(error, 'No se pudo actualizar la forma de pago temporal.'))
    );
  }

  ejecutarCierre(payload: EjecutarCierrePayload): Observable<unknown> {
    return this.http.post<unknown>(this.ejecutarCierreApiUrl, payload).pipe(
      catchError((error) => this.handleHttpError(error, 'No se pudo ejecutar el cierre de caja.'))
    );
  }

  getReporteEncabezados(filters: CierreCajaListFilters): Observable<ReporteCierreEncabezado[]> {
    let params = new HttpParams().set('fecha', this.formatDateForApi(filters.fecha));
    const pntVenta = this.cleanText(filters.pntVenta);
    if (pntVenta) {
      params = params.set('pntVenta', pntVenta);
    }

    return this.http.get<unknown>(`${this.reporteCierreApiUrl}/encabezados`, { params }).pipe(
      map((response) => this.normalizeReporteEncabezados(response)),
      catchError((error) => this.handleHttpError(error, 'No se pudieron consultar los cierres de caja.'))
    );
  }

  private matchesFilters(item: CierreCajaRecord, filters?: CierreCajaListFilters): boolean {
    if (!filters) {
      return true;
    }

    const fecha = this.cleanText(filters.fecha);
    const estado = this.cleanText(filters.estado).toUpperCase();
    const pntVenta = this.cleanText(filters.pntVenta).toUpperCase();
    const usuario = this.cleanText(filters.usuario).toUpperCase();

    if (fecha && item.fecha !== fecha) {
      return false;
    }
    if (estado && item.estado !== estado) {
      return false;
    }
    if (pntVenta && this.cleanText(item.pntVenta).toUpperCase() !== pntVenta) {
      return false;
    }
    if (usuario && this.cleanText(item.usuario).toUpperCase() !== usuario) {
      return false;
    }
    return true;
  }

  private normalizeRecord(record: CierreCajaRecord): CierreCajaRecord {
    const lineas = (record.lineas ?? []).map((item, index) => this.normalizeLinea(item, index + 1));
    const totalSistema = this.round(lineas.reduce((sum, item) => sum + item.montoSistema, 0));
    const totalDeclarado = this.round(lineas.reduce((sum, item) => sum + item.montoDeclarado, 0));

    return {
      ...record,
      usuario: this.cleanText(record.usuario),
      operador: this.cleanText(record.operador),
      pntVenta: this.cleanText(record.pntVenta),
      caja: this.cleanText(record.caja),
      turno: this.cleanText(record.turno),
      fecha: this.cleanText(record.fecha),
      horaApertura: this.cleanText(record.horaApertura),
      horaCierre: this.cleanText(record.horaCierre),
      observaciones: this.cleanText(record.observaciones),
      montoApertura: this.toNumber(record.montoApertura),
      lineas,
      totalSistema,
      totalDeclarado,
      diferenciaTotal: this.round(totalDeclarado - totalSistema)
    };
  }

  private normalizeLinea(linea: CierreCajaLinea, orden: number): CierreCajaLinea {
    const montoSistema = this.toNumber(linea.montoSistema);
    const montoDeclarado = this.toNumber(linea.montoDeclarado);
    return {
      orden,
      frmPago: this.cleanText(linea.frmPago),
      descripcion: this.cleanText(linea.descripcion),
      tipoPago: this.cleanText(linea.tipoPago),
      montoSistema,
      montoDeclarado,
      diferencia: this.round(montoDeclarado - montoSistema)
    };
  }

  private readAll(): CierreCajaRecord[] {
    if (typeof localStorage === 'undefined') {
      return [];
    }

    const raw = localStorage.getItem(this.storageKey);
    if (!raw) {
      return [];
    }

    try {
      const parsed = JSON.parse(raw) as CierreCajaRecord[];
      if (!Array.isArray(parsed)) {
        return [];
      }
      return parsed.map((item) => this.normalizeRecord(item));
    } catch {
      return [];
    }
  }

  private writeAll(records: CierreCajaRecord[]): void {
    if (typeof localStorage === 'undefined') {
      return;
    }
    localStorage.setItem(this.storageKey, JSON.stringify(records.map((item) => this.normalizeRecord(item))));
  }

  private buildId(): string {
    return `CC-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
  }

  private normalizeDenominacionResumen(response: unknown): DenominacionResumen {
    const raw = this.unwrapResponse(response) as any;
    const denominaciones = this.normalizeDenominaciones(raw?.denominaciones ?? raw?.Denominaciones ?? []);
    const totalMonedaNacional =
      this.toNumber(raw?.totalMonedaNacional ?? raw?.TotalMonedaNacional) ||
      this.round(denominaciones.reduce((sum, item) => sum + item.totalMN, 0));
    const totalMonedaExtranjera =
      this.toNumber(raw?.totalMonedaExtranjera ?? raw?.TotalMonedaExtranjera) ||
      this.round(denominaciones.reduce((sum, item) => sum + item.totalME, 0));

    return {
      totalMonedaNacional,
      totalMonedaExtranjera,
      totalGeneral: this.toNumber(raw?.totalGeneral ?? raw?.TotalGeneral) || this.round(totalMonedaNacional + totalMonedaExtranjera),
      denominaciones
    };
  }

  private normalizeDenominaciones(response: unknown): Denominacion[] {
    const raw = this.unwrapResponse(response);
    const list = Array.isArray(raw) ? raw : [];
    return list.map((item: any) => {
      const mon = this.cleanText(item.MON ?? item.mon).toUpperCase();
      const valor = this.toNumber(item.VALOR ?? item.valor);
      const cantidad = this.toNumber(item.CANTIDAD ?? item.cantidad);
      const mp = this.toNumber(item.MP ?? item.mp);
      const computedTotal = this.round(valor * cantidad);

      return {
        orden: this.toNumber(item.ORDEN ?? item.orden),
        nombre: this.cleanText(item.NOMBRE ?? item.nombre),
        mon,
        valor,
        cantidad,
        totalMN: this.toNumber(item.TOTALMN ?? item.totalMN ?? item.totalMn) || (mp === 1 || mon === 'COL' ? computedTotal : 0),
        totalME: this.toNumber(item.TOTALME ?? item.totalME ?? item.totalMe) || (mp === 0 || mon !== 'COL' ? computedTotal : 0),
        mp
      };
    }).sort((a, b) => a.orden - b.orden);
  }

  private normalizeTmpFormasPago(response: unknown): TmpFormaPago[] {
    const raw = this.unwrapResponse(response);
    const list = Array.isArray(raw) ? raw : [];
    return list.map((item: any) => ({
      frmPago: this.cleanText(item.FrmPago ?? item.frmPago),
      descripcion: this.cleanText(item.Descripcion ?? item.descripcion),
      moneda: this.cleanText(item.Moneda ?? item.moneda).toUpperCase(),
      total: this.toNumber(item.Total ?? item.total),
      valor: this.cleanText(item.Valor ?? item.valor)
    }));
  }

  private normalizeReporteEncabezados(response: unknown): ReporteCierreEncabezado[] {
    const raw = this.unwrapResponse(response);
    const list = Array.isArray(raw) ? raw : [];
    return list.map((item: any) => ({
      numCierre: this.cleanText(item.MPV20_NumCierre),
      fecha: this.formatDateForInput(this.cleanText(item.MPV20_Fecha)),
      hora: this.cleanText(item.MPV20_Hora),
      pntVenta: this.cleanText(item.MPV20_PntVenta),
      usuario: this.cleanText(item.MPV20_Usuario || item.MA01_Usuario),
      fondoCaja: this.toNumber(item.MPV20_FondoCaja)
    }));
  }

  private unwrapResponse(response: unknown): unknown {
    if (response && typeof response === 'object') {
      return (response as any).data ?? (response as any).datos ?? response;
    }
    return response;
  }

  private handleHttpError(error: HttpErrorResponse, fallback: string): Observable<never> {
    const apiMessage = (error.error && (error.error.mensaje || error.error.respuesta || error.error.message)) as
      | string
      | undefined;
    return throwError(() => new Error(apiMessage || error.message || fallback));
  }

  private cleanText(value: unknown): string {
    return String(value ?? '').trim();
  }

  private formatDateForApi(value: unknown): string {
    const raw = this.cleanText(value);
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(raw)) {
      return raw;
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
      const [year, month, day] = raw.split('-');
      return `${day}/${month}/${year}`;
    }
    return raw;
  }

  private formatDateForInput(value: unknown): string {
    const raw = this.cleanText(value);
    if (!raw) {
      return '';
    }
    if (/^\d{4}-\d{2}-\d{2}/.test(raw)) {
      return raw.slice(0, 10);
    }
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(raw)) {
      const [day, month, year] = raw.split('/');
      return `${year}-${month}-${day}`;
    }
    return raw;
  }

  private toNumber(value: unknown): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private round(value: number): number {
    return Math.round((this.toNumber(value) + Number.EPSILON) * 100) / 100;
  }
}
