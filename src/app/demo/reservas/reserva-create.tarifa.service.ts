import { Injectable } from '@angular/core';
import { firstValueFrom, take } from 'rxjs';

import { ReglaTarifa, ReglasTarifariasService } from '../catalogos/listas-precios/listas-precios.service';
import { computeMontoServicio, getReglaPaxRange, matchHoraEnRango, pickReglaForAdultos, timeToMinutes } from './reserva-create.tarifa-engine';

/**
 * Resultado de aplicar una regla tarifaria.
 * - `ok: true`: se encontró una regla y se calculó el monto del servicio.
 * - `ok: false`: no se pudo aplicar la regla; `error` contiene el motivo (o vacío si aún faltan datos).
 */
export type ApplyReglaTarifaResult =
  | { ok: true; regla: ReglaTarifa; montoServicio: number }
  | { ok: false; error: string };

/**
 * Servicio de dominio para la pantalla de creación/edición de reservas.
 *
 * Responsabilidades:
 * - Consultar reglas tarifarias por (listaPrecio, servicio).
 * - Cachear esas reglas para evitar llamadas repetidas mientras el usuario edita.
 * - Filtrar/seleccionar la regla más específica que aplique.
 * - Calcular el monto del servicio (precio base + niños + pax extra).
 *
 * Nota: no mantiene estado de UI; devuelve resultados para que el componente actualice su formulario.
 */
@Injectable({ providedIn: 'root' })
export class ReservaCreateTarifaService {
  /**
   * Caché in-memory por combinación `codLstPrecio::codServicio`.
   * Se limpia cuando cambia la lista de precios o cuando se necesita forzar recálculo.
   */
  private cache = new Map<string, ReglaTarifa[]>();

  constructor(private reglasTarifariasService: ReglasTarifariasService) {}

  /**
   * Limpia toda la caché de reglas.
   * Usar cuando el contexto cambia (ej: lista de precios) o para forzar refresco.
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Obtiene reglas tarifarias para una lista de precios y un servicio.
   * - Primero intenta caché.
   * - Si no hay caché, consulta a `ReglasTarifariasService` y normaliza por `codLstPrecio`.
   */
  async getReglasTarifa(codLstPrecio: string, codServicio: string): Promise<ReglaTarifa[]> {
    const key = `${codLstPrecio}::${codServicio}`;
    const cached = this.cache.get(key);
    if (cached) return cached;

    const reglas = await firstValueFrom(
      this.reglasTarifariasService.getByListaPrecioAndServicio(codLstPrecio, codServicio).pipe(take(1))
    );
    const normalized = (reglas ?? []).filter((r) => (r.codLstPrecio || '').trim() === codLstPrecio);
    this.cache.set(key, normalized);
    return normalized;
  }

  /**
   * Aplica reglas tarifarias a un conjunto de parámetros del detalle (servicio).
   *
   * Flujo:
   * 1) Normaliza/valida inputs mínimos (`codLstPrecio`, `codServicio`, `tarifa`, `horaPickup`).
   * 2) Convierte `horaPickup` a minutos (para comparar rangos).
   * 3) Carga reglas (cacheable).
   * 4) Filtra candidatas por: activa, moneda (si aplica), tarifa, rango de pax, rango horario.
   * 5) Selecciona la regla "más específica".
   * 6) Calcula `montoServicio` usando la regla seleccionada.
   *
   * Devuelve `ok:false` con error cuando:
   * - Falta hora pick-up o es inválida.
   * - No hay candidatas o no se puede seleccionar una.
   * - Faltan datos mínimos (error vacío para permitir edición sin ruido).
   */
  async applyReglaTarifa(options: {
    codLstPrecio: string;
    codServicio: string;
    tarifa: string;
    adultos: number;
    ninos: number;
    horaPickup: string;
    moneda?: string;
  }): Promise<ApplyReglaTarifaResult> {
    const codLstPrecio = (options.codLstPrecio || '').trim();
    const codServicio = (options.codServicio || '').trim();
    const tarifa = (options.tarifa || '').trim().toUpperCase();
    const moneda = (options.moneda || '').trim().toUpperCase();
    const adultos = Number(options.adultos ?? 0) || 0;
    const ninos = Number(options.ninos ?? 0) || 0;
    const horaPickup = (options.horaPickup || '').trim();

    if (!codLstPrecio || !codServicio || !tarifa) {
      return { ok: false, error: '' };
    }

    if (!horaPickup) {
      return { ok: false, error: 'Debe indicar la hora Pick-Up para aplicar la tarifa.' };
    }

    const horaMin = timeToMinutes(horaPickup);
    if (horaMin == null) {
      return { ok: false, error: 'Hora Pick-Up inválida.' };
    }

    const reglas = await this.getReglasTarifa(codLstPrecio, codServicio);
    const candidatas = (reglas ?? [])
      .filter((r) => !!r.activa)
      .filter((r) => !moneda || (r.moneda || '').trim().toUpperCase() === moneda)
      .filter((r) => (r.tarifa || '').toString().toUpperCase() === tarifa)
      .filter((r) => matchHoraEnRango(horaMin, r.horaInicio, r.horaFin));

    if (!candidatas.length) {
      return { ok: false, error: 'No hay una regla tarifaria que coincida con adultos y hora Pick-Up.' };
    }

    // Validación explícita: si existe un mínimo configurado y el usuario está por debajo,
    // no intentamos "pax extra" ni habilitamos edición manual: debe corregir el valor.
    const minCandidates = candidatas.map((r) => getReglaPaxRange(r).min).filter((v) => v > 0);
    const minAllowed = minCandidates.length ? Math.min(...minCandidates) : 0;
    if (minAllowed > 0 && adultos < minAllowed) {
      return { ok: false, error: `Cantidad de adultos menor al mínimo permitido (${minAllowed}).` };
    }

    const selected = pickReglaForAdultos(candidatas, adultos);
    if (!selected) {
      return { ok: false, error: 'No se pudo seleccionar una regla tarifaria.' };
    }

    const montoServicio = computeMontoServicio({ regla: selected, adultos, ninos });
    return { ok: true, regla: selected, montoServicio };
  }
}
