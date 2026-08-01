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
  CierreCajaDenominacionReporte,
  CierreCajaDocumento,
  CierreCajaFormaPagoReporte,
  CierreCajaNotaPedido,
  CierreCajaReporteDetalle,
  CierreCajaResumenFormaPago,
  CierreCajaPosReporte,
  ReporteCierreEncabezado,
  TmpFormaPago,
  TmpFormaPagoPayload
} from './models/cierre-caja.model';
import { environment } from 'src/environments/environment';

@Injectable({ providedIn: 'root' })
export class CierreCajaService {
  private readonly http = inject(HttpClient);
  private readonly storageKey = 'ope_cierre_caja_records_v1';
  private readonly baseApiUrl = (environment.apiUrl ?? '').toString().replace(/\/+$/, '');
  private readonly denominacionApiUrl = `${this.baseApiUrl}/denominacion`;
  private readonly tmpFormaPagoApiUrl = `${this.baseApiUrl}/tmpformapago`;
  private readonly ejecutarCierreApiUrl = `${this.baseApiUrl}/ejecutar-cierre`;
  private readonly reporteCierreApiUrl = `${this.baseApiUrl}/reporte-cierre`;
  private readonly cierreCajaPdfApiUrl = `${this.baseApiUrl}/generar-cierre-caja-pdf/Pdf`;
  private readonly cierreCajaReporteApiUrl = `${this.baseApiUrl}/generar-cierre-caja-pdf/Reporte`;
  private readonly cierreCajaPosApiUrl = `${this.baseApiUrl}/puntoventa/restaurante`;
 
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

  getCierreCajaPdf(numCierre: string): Observable<Blob> {
    return this.http
      .get(`${this.cierreCajaPdfApiUrl}/${encodeURIComponent(numCierre)}`, { responseType: 'blob' })
      .pipe(catchError((error) => this.handleHttpError(error, 'No se pudo generar el PDF del cierre de caja.')));
  }

  getCierreCajaReporte(numCierre: string): Observable<CierreCajaReporteDetalle> {
    return this.http.get<unknown>(`${this.cierreCajaReporteApiUrl}/${encodeURIComponent(numCierre)}`).pipe(
      map((response) => this.normalizeCierreCajaReporte(response)),
      catchError((error) => this.handleHttpError(error, 'No se pudo consultar el detalle del cierre de caja.'))
    );
  }

  getCierreCajaPos(numCierre: string): Observable<CierreCajaPosReporte> {
    const normalized = this.cleanText(numCierre);
    if (!normalized) {
      return throwError(() => new Error('Debe indicar el número de cierre que desea imprimir.'));
    }

    return this.http.get<unknown>(`${this.cierreCajaPosApiUrl}/${encodeURIComponent(normalized)}`).pipe(
      map((response) => this.normalizeCierreCajaPos(response)),
      catchError((error) => this.handleHttpError(error, 'No se pudo consultar el cierre para impresión POS.'))
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

  private normalizeCierreCajaReporte(response: unknown): CierreCajaReporteDetalle {
    const raw = this.unwrapResponse(response) as any;
    const encabezado = raw?.encabezado ?? {};
    const resumen = raw?.resumen ?? {};

    return {
      encabezado: {
        numCierre: this.cleanText(encabezado.numCierre),
        fechaApertura: this.formatDateForInput(this.cleanText(encabezado.fechaApertura)),
        horaApertura: this.cleanText(encabezado.horaApertura),
        fechaCierre: this.formatDateForInput(this.cleanText(encabezado.fechaCierre)),
        puntoVenta: this.cleanText(encabezado.puntoVenta),
        tipoCierre: this.cleanText(encabezado.tipoCierre),
        usuario: this.cleanText(encabezado.usuario),
        fondoCaja: this.toNumber(encabezado.fondoCaja)
      },
      documentos: this.normalizeReporteDocumentos(raw?.documentos),
      notasCredito: this.normalizeReporteDocumentos(raw?.notasCredito),
      formasPagoDocumentos: this.normalizeReporteFormasPago(raw?.formasPagoDocumentos),
      denominaciones: this.normalizeReporteDenominaciones(raw?.denominaciones),
      resumenFormasPago: this.normalizeReporteResumenFormasPago(raw?.resumenFormasPago),
      notasPedido: this.normalizeReporteNotasPedido(raw?.notasPedido),
      formasPagoNotasPedido: this.normalizeReporteFormasPago(raw?.formasPagoNotasPedido),
      resumen: {
        totalVentasBruto: this.toNumber(resumen.totalVentasBruto),
        totalDescuentos: this.toNumber(resumen.totalDescuentos),
        totalVentasNeto: this.toNumber(resumen.totalVentasNeto),
        totalImpuestos: this.toNumber(resumen.totalImpuestos),
        totalVentasFinal: this.toNumber(resumen.totalVentasFinal),
        totalNotasCredito: this.toNumber(resumen.totalNotasCredito),
        totalNotasPedido: this.toNumber(resumen.totalNotasPedido),
        ventaNetaFinal: this.toNumber(resumen.ventaNetaFinal),
        totalSoles: this.toNumber(resumen.totalSoles),
        totalDolares: this.toNumber(resumen.totalDolares),
        totalesPorFormaPago: this.normalizeNumberRecord(resumen.totalesPorFormaPago),
        cantidadFacturas: this.toNumber(resumen.cantidadFacturas),
        cantidadBoletas: this.toNumber(resumen.cantidadBoletas),
        cantidadNotasCredito: this.toNumber(resumen.cantidadNotasCredito),
        cantidadNotasPedido: this.toNumber(resumen.cantidadNotasPedido),
        totalDocumentos: this.toNumber(resumen.totalDocumentos),
        totalEfectivoMN: this.toNumber(resumen.totalEfectivoMN),
        totalEfectivoME: this.toNumber(resumen.totalEfectivoME),
        fondoCaja: this.toNumber(resumen.fondoCaja),
        efectivoEnCaja: this.toNumber(resumen.efectivoEnCaja)
      },
      nombreEmpresa: this.cleanText(raw?.nombreEmpresa),
      rucEmpresa: this.cleanText(raw?.rucEmpresa)
    };
  }

  private normalizeCierreCajaPos(response: unknown): CierreCajaPosReporte {
    const raw = this.unwrapResponse(response) as any;
    const encabezado = raw?.encabezado ?? {};
    const datosEmpresa = raw?.datosEmpresa ?? {};

    return {
      encabezado: {
        numCierre: this.cleanText(encabezado.numCierre),
        fechaApertura: this.cleanText(encabezado.fechaApertura),
        horaApertura: this.cleanText(encabezado.horaApertura),
        fechaCierre: this.cleanText(encabezado.fechaCierre),
        puntoVenta: this.cleanText(encabezado.puntoVenta),
        tipoCierre: this.cleanText(encabezado.tipoCierre),
        usuario: this.cleanText(encabezado.usuario),
        fondoCaja: this.toNumber(encabezado.fondoCaja)
      },
      documentosVenta: this.normalizePosDocumentos(raw?.documentosVenta),
      notasCredito: this.normalizePosDocumentos(raw?.notasCredito),
      formasPagoPorDocumento: this.normalizeReporteFormasPago(raw?.formasPagoPorDocumento),
      denominaciones: this.normalizeReporteDenominaciones(raw?.denominaciones),
      resumenFormasPago: this.normalizeReporteResumenFormasPago(raw?.resumenFormasPago),
      consumosColaborador: (Array.isArray(raw?.consumosColaborador) ? raw.consumosColaborador : []).map((item: any) => ({
        tipo: this.cleanText(item.tipo),
        numero: this.cleanText(item.numero),
        pntVenta: this.cleanText(item.pntVenta),
        fecha: this.cleanText(item.fecha),
        hora: this.cleanText(item.hora),
        salonero: this.cleanText(item.salonero),
        nombre: this.cleanText(item.nombre),
        comentarios: this.cleanText(item.comentarios),
        total: this.toNumber(item.total),
        estado: this.cleanText(item.estado),
        moneda: this.cleanText(item.moneda)
      })),
      platosEliminados: (Array.isArray(raw?.platosEliminados) ? raw.platosEliminados : []).map((item: any) => ({
        fecha: this.cleanText(item.fecha),
        tipNdp: this.cleanText(item.tipNdp),
        numNdp: this.cleanText(item.numNdp),
        codProducto: this.cleanText(item.codProducto),
        desProducto: this.cleanText(item.desProducto),
        cantidad: this.toNumber(item.cantidad),
        precio: this.toNumber(item.precio),
        total: this.toNumber(item.total),
        motivo: this.cleanText(item.motivo),
        operador: this.cleanText(item.operador)
      })),
      datosEmpresa: {
        nombreEmpresa: this.cleanText(datosEmpresa.nombreEmpresa),
        cedula: this.cleanText(datosEmpresa.cedula)
      }
    };
  }

  private normalizePosDocumentos(value: unknown): CierreCajaPosReporte['documentosVenta'] {
    const list = Array.isArray(value) ? value : [];
    return list.map((item: any) => ({
      tipoDocumento: this.cleanText(item.tipoDocumento),
      serie: this.cleanText(item.serie),
      numeroDocumento: this.cleanText(item.numeroDocumento),
      fechaDocumento: this.cleanText(item.fechaDocumento),
      hora: this.cleanText(item.hora),
      codCliente: this.cleanText(item.codCliente),
      rucCliente: this.cleanText(item.rucCliente),
      nombreCliente: this.cleanText(item.nombreCliente),
      numMesa: this.cleanText(item.numMesa),
      numPax: this.cleanText(item.numPax),
      codMozo: this.cleanText(item.codMozo),
      moneda: this.cleanText(item.moneda),
      tipoCambio: this.toNumber(item.tipoCambio),
      subTotal: this.toNumber(item.subTotal),
      descuento: this.toNumber(item.descuento),
      neto: this.toNumber(item.neto),
      impuesto: this.toNumber(item.impuesto),
      exonerado: this.toNumber(item.exonerado),
      propinas: this.toNumber(item.propinas),
      totalDocumento: this.toNumber(item.totalDocumento),
      totalPago: this.toNumber(item.totalPago),
      estado: this.cleanText(item.estado),
      usuarioCreacion: this.cleanText(item.usuarioCreacion)
    }));
  }

  private normalizeReporteDocumentos(value: unknown): CierreCajaDocumento[] {
    const list = Array.isArray(value) ? value : [];
    return list.map((item: any) => ({
      tipoDocumento: this.cleanText(item.tipoDocumento),
      serie: this.cleanText(item.serie),
      numeroDocumento: this.cleanText(item.numeroDocumento),
      fechaDocumento: this.formatDateForInput(this.cleanText(item.fechaDocumento)),
      hora: this.cleanText(item.hora),
      codCliente: this.cleanText(item.codCliente),
      rucCliente: this.cleanText(item.rucCliente),
      nombreCliente: this.cleanText(item.nombreCliente),
      numMesa: this.cleanText(item.numMesa),
      numPax: this.toNumber(item.numPax),
      codMozo: this.cleanText(item.codMozo),
      moneda: this.cleanText(item.moneda),
      tipoCambio: this.toNumber(item.tipoCambio),
      subTotal: this.toNumber(item.subTotal),
      descuento: this.toNumber(item.descuento),
      neto: this.toNumber(item.neto),
      impuesto: this.toNumber(item.impuesto),
      exonerado: this.toNumber(item.exonerado),
      propinas: this.toNumber(item.propinas),
      totalDocumento: this.toNumber(item.totalDocumento),
      totalPago: this.toNumber(item.totalPago),
      estado: this.cleanText(item.estado),
      usuarioCreacion: this.cleanText(item.usuarioCreacion)
    }));
  }

  private normalizeReporteNotasPedido(value: unknown): CierreCajaNotaPedido[] {
    const list = Array.isArray(value) ? value : [];
    return list.map((item: any) => ({
      tipoNDP: this.cleanText(item.tipoNDP),
      serieNDP: this.cleanText(item.serieNDP),
      numeroNDP: this.cleanText(item.numeroNDP),
      puntoVenta: this.cleanText(item.puntoVenta),
      fechaDocumento: this.formatDateForInput(this.cleanText(item.fechaDocumento)),
      hora: this.cleanText(item.hora),
      codVendedor: this.cleanText(item.codVendedor),
      codCliente: this.cleanText(item.codCliente),
      rucCliente: this.cleanText(item.rucCliente),
      nombreCliente: this.cleanText(item.nombreCliente),
      direccionCliente: this.cleanText(item.direccionCliente),
      moneda: this.cleanText(item.moneda),
      tipoCambio: this.toNumber(item.tipoCambio),
      exonerado: this.toNumber(item.exonerado),
      subTotal: this.toNumber(item.subTotal),
      impuesto: this.toNumber(item.impuesto),
      totalDocumento: this.toNumber(item.totalDocumento),
      totalPago: this.toNumber(item.totalPago),
      estadoDocumento: this.cleanText(item.estadoDocumento),
      cantidadItems: this.toNumber(item.cantidadItems),
      numReferencia: this.cleanText(item.numReferencia),
      observaciones: this.cleanText(item.observaciones),
      operador: this.cleanText(item.operador)
    }));
  }

  private normalizeReporteFormasPago(value: unknown): CierreCajaFormaPagoReporte[] {
    const list = Array.isArray(value) ? value : [];
    return list.map((item: any) => ({
      codFormaPago: this.cleanText(item.codFormaPago),
      descFormaPago: this.cleanText(item.descFormaPago),
      moneda: this.cleanText(item.moneda),
      monto: this.toNumber(item.monto)
    }));
  }

  private normalizeReporteDenominaciones(value: unknown): CierreCajaDenominacionReporte[] {
    const list = Array.isArray(value) ? value : [];
    return list.map((item: any) => ({
      numCierre: this.cleanText(item.numCierre),
      codDenominacion: this.cleanText(item.codDenominacion),
      denominacion: this.cleanText(item.denominacion),
      moneda: this.cleanText(item.moneda),
      cantidad: this.toNumber(item.cantidad),
      totalMonedaNacional: this.toNumber(item.totalMonedaNacional),
      totalMonedaExtranjera: this.toNumber(item.totalMonedaExtranjera)
    }));
  }

  private normalizeReporteResumenFormasPago(value: unknown): CierreCajaResumenFormaPago[] {
    const list = Array.isArray(value) ? value : [];
    return list.map((item: any) => ({
      numCierre: this.cleanText(item.numCierre),
      codFormaPago: this.cleanText(item.codFormaPago),
      descFormaPago: this.cleanText(item.descFormaPago),
      tipoFormaPago: this.cleanText(item.tipoFormaPago),
      medioPago: this.cleanText(item.medioPago),
      moneda: this.cleanText(item.moneda),
      total: this.toNumber(item.total),
      detalles: this.cleanText(item.detalles)
    }));
  }

  private normalizeNumberRecord(value: unknown): Record<string, number> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {};
    }

    return Object.entries(value as Record<string, unknown>).reduce<Record<string, number>>((acc, [key, amount]) => {
      acc[this.cleanText(key)] = this.toNumber(amount);
      return acc;
    }, {});
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
