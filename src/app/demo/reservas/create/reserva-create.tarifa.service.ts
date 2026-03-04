import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { firstValueFrom, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from 'src/environments/environment';

import {
  DetallePrecioServicioQuery,
  DetallePrecioServicioApiItem,
  DetallePrecioServicioApiResponse,
  ServicioPrecioApiItem,
  ServicioPrecioApiResponse,
  ServicioPrecioQuery,
  MejorPrecioRegla,
  MejorPrecioReglaDto,
  ReglaTarifaAplicada
} from './reserva-create.tarifa.models';

/**
 * Resultado de aplicar una regla tarifaria.
 * - `ok: true`: se encontró una regla y se calculó el monto del servicio.
 * - `ok: false`: no se pudo aplicar la regla; `error` contiene el motivo (o vacío si aún faltan datos).
 */
export type ApplyReglaTarifaResult =
  | { ok: true; regla: ReglaTarifaAplicada; montoServicio: number }
  | { ok: false; error: string };

export interface ReglaTarifaPaxAplicada {
  tipoPax: string;
  cantidad: number;
  precioTotal: number;
  precioUnitario: number;
  precioPaxExtra: number;
  reglaPrecioId: number;
  error?: string;
}

export type ModoPrecio = 'R' | 'N';

export type ApplyReglaTarifaPorTiposResult =
  | { ok: true; detalles: ReglaTarifaPaxAplicada[]; montoServicio: number }
  | { ok: false; error: string; detalles: ReglaTarifaPaxAplicada[]; faltantes: string[] };

/**
 * Servicio de dominio para la pantalla de creación/edición de reservas.
 *
 * Responsabilidades:
 * - Consultar la regla tarifaria más adecuada via endpoint especializado.
 * - Calcular el monto del servicio agregando resultados por tipo pax.
 *
 * Nota: no mantiene estado de UI; devuelve resultados para que el componente actualice su formulario.
 */
@Injectable({ providedIn: 'root' })
export class ReservaCreateTarifaService {
  private apiUrl = `${environment.apiUrl}/mejor-precio-regla`;
  private detalleListaPrecioApiUrl = `${environment.apiUrl}/detalle-lista-precio`;

  constructor(private http: HttpClient) {}

  getTarifasServicio(params: { codLstPrecio: string; codServicio: string }): Observable<DetallePrecioServicioApiItem | null> {
    return this.getTarifasServicioDetalle({
      codLstPrecio: params.codLstPrecio,
      codServicio: params.codServicio,
      pageNumber: 1,
      pageSize: 1
    }).pipe(map((items) => items[0] ?? null));
  }

  getTarifasServicioDetalle(params: DetallePrecioServicioQuery): Observable<DetallePrecioServicioApiItem[]> {
    let requestParams = new HttpParams().set('codLstPrecio', (params.codLstPrecio || '').trim());
    const codServicio = (params.codServicio || '').trim();
    const nombreServicio = (params.nombreServicio || '').trim();
    const pageNumber = Number(params.pageNumber ?? 1) || 1;
    const pageSize = Number(params.pageSize ?? 20) || 20;

    if (codServicio) {
      requestParams = requestParams.set('codServicio', codServicio);
    }
    if (nombreServicio) {
      requestParams = requestParams.set('nombreServicio', nombreServicio);
    }
    requestParams = requestParams.set('pageNumber', String(pageNumber));
    requestParams = requestParams.set('pageSize', String(pageSize));

    return this.http
      .get<DetallePrecioServicioApiResponse>(`${this.detalleListaPrecioApiUrl}/servicios/detalle-precios`, { params: requestParams })
      .pipe(map((res) => res?.datos ?? []));
  }

  getServiciosPorListaPrecio(params: ServicioPrecioQuery): Observable<ServicioPrecioApiItem[]> {
    const codLstPrecio = (params.codLstPrecio || '').trim();
    const nombreServicio = (params.nombreServicio || '').trim();
    const pageNumber = Number(params.pageNumber ?? 1) || 1;
    const pageSize = Number(params.pageSize ?? 50) || 50;

    let requestParams = new HttpParams()
      .set('codLstPrecio', codLstPrecio)
      // En este endpoint, el backend usa `tipoTarifa` como campo de busqueda por nombre de servicio.
      .set('tipoTarifa', nombreServicio)
      .set('pageNumber', String(pageNumber))
      .set('pageSize', String(pageSize));

    if (typeof params.soloActivos === 'boolean') {
      requestParams = requestParams.set('soloActivos', String(params.soloActivos));
    }
    return this.http
      .get<ServicioPrecioApiResponse>(`${this.detalleListaPrecioApiUrl}/servicio-precio`, { params: requestParams })
      .pipe(map((res) => res?.datos ?? []));
  }

  /**
   * Limpia toda la caché de reglas.
   * Usar cuando el contexto cambia (ej: lista de precios) o para forzar refresco.
   */
  clearCache(): void {
    // Sin caché por ahora; se deja para compatibilidad de llamadas existentes.
  }

  /**
   * Obtiene la mejor regla tarifaria para un tipo pax y cantidad específicos.
   */
  async getMejorRegla(params: {
    planId: number;
    codLstPrecio: string;
    codServicio: string;
    cantidadPax: number;
    horaSolicitud: string;
    tipoPaxCodigo: string;
    modoDebug?: boolean;
  }): Promise<MejorPrecioRegla | null> {
    const planId = Number(params.planId ?? 0) || 0;
    if (!planId) return null;

    const requestParams = new HttpParams()
      .set('planId', String(planId))
      .set('codLstPrecio', (params.codLstPrecio || '').trim())
      .set('codServicio', (params.codServicio || '').trim())
      .set('cantidadPax', String(Number(params.cantidadPax ?? 0) || 0))
      .set('horaSolicitud', this.normalizeHoraSolicitud(params.horaSolicitud))
      .set('tipoPaxCodigo', (params.tipoPaxCodigo || '').trim().toUpperCase())
      .set('modoDebug', String(!!params.modoDebug));

    const response = await firstValueFrom(
      this.http.get<{ datos?: MejorPrecioReglaDto[] }>(this.apiUrl, { params: requestParams }).pipe(
        map((res) => res?.datos ?? [])
      )
    );

    const first = (response ?? [])[0];
    return first ? this.mapFromApi(first) : null;
  }

  /**
   * Aplica reglas tarifarias a un conjunto de parámetros del detalle (servicio).
   *
   * Flujo:
   * 1) Normaliza/valida inputs mínimos (`planId`, `codLstPrecio`, `codServicio`, `horaPickup`).
   * 2) Consulta la mejor regla por tipo pax (adultos / niños).
   * 3) Agrega resultados y retorna montos finales.
   *
   * Devuelve `ok:false` con error cuando:
   * - Falta hora pick-up o es inválida.
   * - No hay candidatas o no se puede seleccionar una.
   * - Faltan datos mínimos (error vacío para permitir edición sin ruido).
   */
  async applyReglaTarifa(options: {
    planId: number;
    codLstPrecio: string;
    codServicio: string;
    adultos: number;
    ninos: number;
    horaPickup: string;
    tipoPaxAdulto: string;
    modoPrecio?: ModoPrecio;
  }): Promise<ApplyReglaTarifaResult> {
    const modoPrecio: ModoPrecio = options.modoPrecio === 'N' ? 'N' : 'R';
    const planId = Number(options.planId ?? 0) || 0;
    const codLstPrecio = (options.codLstPrecio || '').trim();
    const codServicio = (options.codServicio || '').trim();
    const cantidad = Number(options.adultos ?? 0) || 0;
    const ninos = Number(options.ninos ?? 0) || 0;
    const tipoPaxAdulto = (options.tipoPaxAdulto || '').trim().toUpperCase();
    const horaPickup = (options.horaPickup || '').trim();

    if (!planId || !codLstPrecio || !codServicio || !tipoPaxAdulto) {
      return { ok: false, error: '' };
    }

    if (!horaPickup) {
      return { ok: false, error: 'Debe indicar la hora Pick-Up para aplicar la tarifa.' };
    }

    const horaSolicitud = this.normalizeHoraSolicitud(horaPickup);
    if (!horaSolicitud) {
      return { ok: false, error: 'Hora Pick-Up inválida.' };
    }

    if (cantidad <= 0 && ninos <= 0) {
      return { ok: false, error: '' };
    }

    let reglaAdultos: MejorPrecioRegla | null = null;
    let reglaNinos: MejorPrecioRegla | null = null;

    if (cantidad > 0) {
      reglaAdultos = await this.getMejorRegla({
        planId,
        codLstPrecio,
        codServicio,
        cantidadPax: cantidad,
        horaSolicitud,
        tipoPaxCodigo: tipoPaxAdulto,
        modoDebug: false
      });
    }

    if (ninos > 0) {
      reglaNinos = await this.getMejorRegla({
        planId,
        codLstPrecio,
        codServicio,
        cantidadPax: ninos,
        horaSolicitud,
        tipoPaxCodigo: 'CHL',
        modoDebug: false
      });
    }

    if ((cantidad > 0 && !reglaAdultos) || (ninos > 0 && !reglaNinos)) {
      return { ok: false, error: 'No hay una regla tarifaria que coincida con los filtros seleccionados.' };
    }

    const paxExtras = this.computePaxExtras(reglaAdultos, cantidad);
    const precioAdultoBase = this.getPrecioBase(reglaAdultos, modoPrecio);
    const precioNinoBase = this.getPrecioBase(reglaNinos, modoPrecio);

    const totalAdultos =
      modoPrecio === 'R'
        ? reglaAdultos?.precioTotalCalculado ?? (precioAdultoBase + paxExtras * (reglaAdultos?.precioPaxExtra ?? 0))
        : (precioAdultoBase + paxExtras * (reglaAdultos?.precioPaxExtra ?? 0));
    const totalNinos =
      modoPrecio === 'R'
        ? reglaNinos?.precioTotalCalculado ?? (precioNinoBase * ninos)
        : (precioNinoBase * ninos);

    const montoServicio = totalAdultos + totalNinos;

    const regla: ReglaTarifaAplicada = {
      idReglaPrecio: reglaAdultos?.reglaPrecioId ?? reglaNinos?.reglaPrecioId ?? 0,
      precioAdulto: precioAdultoBase,
      precioNino: precioNinoBase,
      precioPaxExtra: reglaAdultos?.precioPaxExtra ?? 0,
      paxExtras,
      montoServicio,
      moneda: reglaAdultos?.moneda ?? reglaNinos?.moneda ?? '',
      simbolo: reglaAdultos?.simbolo ?? reglaNinos?.simbolo ?? '',
      detalleAdultos: reglaAdultos ?? undefined,
      detalleNinos: reglaNinos ?? undefined
    };

    return { ok: true, regla, montoServicio };
  }

  /**
   * Aplica reglas tarifarias para un listado dinámico de tipos pax.
   */
  async applyReglaTarifaPorTipos(options: {
    planId: number;
    codLstPrecio: string;
    codServicio: string;
    horaPickup: string;
    detallesPax: Array<{ tipoPax: string; cantidad: number }>;
    modoPrecio?: ModoPrecio;
  }): Promise<ApplyReglaTarifaPorTiposResult> {
    const modoPrecio: ModoPrecio = options.modoPrecio === 'N' ? 'N' : 'R';
    const planId = Number(options.planId ?? 0) || 0;
    const codLstPrecio = (options.codLstPrecio || '').trim();
    const codServicio = (options.codServicio || '').trim();
    const horaPickup = (options.horaPickup || '').trim();

    if (!planId || !codLstPrecio || !codServicio) {
      return { ok: false, error: '', detalles: [], faltantes: [] };
    }

    if (!horaPickup) {
      return { ok: false, error: 'Debe indicar la hora Pick-Up para aplicar la tarifa.', detalles: [], faltantes: [] };
    }

    const horaSolicitud = this.normalizeHoraSolicitud(horaPickup);
    if (!horaSolicitud) {
      return { ok: false, error: 'Hora Pick-Up inválida.', detalles: [], faltantes: [] };
    }

    const entradas = (options.detallesPax ?? [])
      .map((item) => ({
        tipoPax: (item.tipoPax || '').trim().toUpperCase(),
        cantidad: Number(item.cantidad ?? 0) || 0
      }))
      .filter((item) => !!item.tipoPax && item.cantidad > 0);

    if (!entradas.length) {
      return { ok: false, error: '', detalles: [], faltantes: [] };
    }

    const detalles: ReglaTarifaPaxAplicada[] = [];
    const faltantes: string[] = [];

    for (const item of entradas) {
      const regla = await this.getMejorRegla({
        planId,
        codLstPrecio,
        codServicio,
        cantidadPax: item.cantidad,
        horaSolicitud,
        tipoPaxCodigo: item.tipoPax,
        modoDebug: false
      });

      if (!regla) {
        detalles.push({
          tipoPax: item.tipoPax,
          cantidad: item.cantidad,
          precioTotal: 0,
          precioUnitario: 0,
          precioPaxExtra: 0,
          reglaPrecioId: 0,
          error: 'No hay una regla tarifaria que coincida con los filtros seleccionados.'
        });
        faltantes.push(item.tipoPax);
        continue;
      }

      const paxExtras = this.computePaxExtras(regla, item.cantidad);
      const precioBase = this.getPrecioBase(regla, modoPrecio);
      const calculado = Number(regla.precioTotalCalculado ?? 0) || 0;
      const maxPax = Number(regla.cantMaxPax ?? 0) || 0;
      const precioPaxExtra = Number(regla.precioPaxExtra ?? 0) || 0;
      const shouldMultiply = maxPax === 1 && precioPaxExtra <= 0;
      const precioTotal = shouldMultiply
        ? (precioBase * item.cantidad)
        : (modoPrecio === 'R'
          ? (calculado > 0 ? calculado : (precioBase + paxExtras * precioPaxExtra))
          : (precioBase + paxExtras * precioPaxExtra));

      detalles.push({
        tipoPax: item.tipoPax,
        cantidad: item.cantidad,
        precioTotal,
        precioUnitario: precioBase,
        precioPaxExtra: regla.precioPaxExtra ?? 0,
        reglaPrecioId: regla.reglaPrecioId ?? 0
      });
    }

    const montoServicio = detalles.reduce((sum, item) => sum + (Number(item.precioTotal ?? 0) || 0), 0);

    if (faltantes.length > 0) {
      const missingLabel = faltantes.join(', ');
      return {
        ok: false,
        error: `No hay una regla tarifaria para: ${missingLabel}.`,
        detalles,
        faltantes
      };
    }

    return { ok: true, detalles, montoServicio };
  }

  private normalizeHoraSolicitud(value: string): string {
    const v = (value || '').trim();
    if (!v) return '';
    if (/^\d{2}:\d{2}:\d{2}$/.test(v)) return v;
    if (/^\d{2}:\d{2}$/.test(v)) return `${v}:00`;
    return '';
  }

  private mapFromApi(apiData: MejorPrecioReglaDto): MejorPrecioRegla {
    return {
      reglaPrecioId: Number(apiData.ReglaPrecioID ?? 0) || 0,
      precioId: Number(apiData.PrecioID ?? 0) || 0,
      planId: Number(apiData.PlanID ?? 0) || 0,
      nombrePlan: (apiData.NombrePlan || '').toString().trim(),
      codLstPrecio: (apiData.MPV04_CodLstPrecio || '').toString().trim(),
      desLstPrecio: (apiData.MPV04_DesLstPrecio || '').toString().trim(),
      codServicio: (apiData.MPV05_CodServicio || '').toString().trim(),
      tipoTarifa: (apiData.MPV05_TipoTarifa || '').toString().trim(),
      cantMinPax: Number(apiData.MPV05_CantMinPax ?? 0) || 0,
      cantMaxPax: Number(apiData.MPV05_CantMaxPax ?? 0) || 0,
      horaDesde: (apiData.MPV05_HoraDesde || '').toString().trim(),
      horaHasta: (apiData.MPV05_HoraHasta || '').toString().trim(),
      tipoPaxCodigo: (apiData.MPV06_TipoPaxCodigo || '').toString().trim().toUpperCase(),
      precioBase: Number(apiData.PrecioBase ?? 0) || 0,
      precioPaxExtra: Number(apiData.PrecioPaxExtra ?? 0) || 0,
      cantMaxPaxTipo: Number(apiData.MPV06_CantMaxPax ?? 0) || 0,
      paxIncluidos: Number(apiData.PaxIncluidos ?? 0) || 0,
      paxExtras: Number(apiData.PaxExtras ?? 0) || 0,
      precioTotalCalculado: Number(apiData.PrecioTotalCalculado ?? 0) || 0,
      porcentajeComision: Number(apiData.MPV06_PorcentajeComision ?? 0) || 0,
      montoComision: Number(apiData.MPV06_MontoComision ?? 0) || 0,
      scoreCoincidencia: Number(apiData.ScoreCoincidencia ?? 0) || 0,
      moneda: (apiData.MPV04_Moneda || '').toString().trim().toUpperCase(),
      simbolo: (apiData.MPV04_Simbolo || '').toString().trim(),
      listaVigenteDesde: (apiData.ListaVigenteDesde || '').toString(),
      listaVigenteHasta: (apiData.ListaVigenteHasta || '').toString()
    };
  }

  private getPrecioBase(regla: MejorPrecioRegla | null, modo: ModoPrecio): number {
    if (!regla) return 0;
    if (modo === 'N') {
      return Number(regla.montoComision ?? 0) || 0;
    }
    return Number(regla.precioBase ?? 0) || 0;
  }

  private computePaxExtras(regla: MejorPrecioRegla | null, cantidad: number): number {
    if (!regla) return 0;
    const declared = Number(regla.paxExtras ?? 0) || 0;
    if (declared > 0) return declared;

    const max = Number(regla.cantMaxPax ?? 0) || 0;
    if (max > 0 && cantidad > max) {
      return Math.max(0, cantidad - max);
    }
    return 0;
  }
}
