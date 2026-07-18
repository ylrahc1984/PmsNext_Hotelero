import { Injectable } from '@angular/core';

import {
  PuntoVentaUsuario,
  SelectedPointOfSale,
  SelectedRestaurantTableContext
} from '../models/restaurant-operacion.models';

@Injectable({
  providedIn: 'root'
})
export class RestaurantOperationContextService {
  private readonly selectedPointOfSaleKey = 'selectedPointOfSale';
  private readonly selectedTableContextKey = 'selectedRestaurantTableContext';

  selectPointOfSale(item: PuntoVentaUsuario): SelectedPointOfSale {
    const detalle = this.normalizePointOfSale(item);
    const selected: SelectedPointOfSale = {
      codigo: detalle.MPV07_CodPntVenta,
      descripcion: detalle.MPV07_NomPntVenta,
      detalle
    };

    sessionStorage.setItem(this.selectedPointOfSaleKey, JSON.stringify(selected));
    this.clearSelectedTableContext();
    return selected;
  }

  getSelectedPointOfSale(expectedCode?: string): SelectedPointOfSale | null {
    const stored = this.readStorage<SelectedPointOfSale>(this.selectedPointOfSaleKey);
    if (!stored?.detalle) {
      return null;
    }

    const detalle = this.normalizePointOfSale(stored.detalle);
    if (!detalle.MPV07_CodPntVenta) {
      return null;
    }

    const normalizedExpectedCode = this.normalizeText(expectedCode);
    if (normalizedExpectedCode && detalle.MPV07_CodPntVenta !== normalizedExpectedCode) {
      return null;
    }

    return {
      codigo: detalle.MPV07_CodPntVenta,
      descripcion: detalle.MPV07_NomPntVenta || detalle.MPV07_CodPntVenta,
      detalle
    };
  }

  setSelectedTableContext(context: SelectedRestaurantTableContext): void {
    sessionStorage.setItem(this.selectedTableContextKey, JSON.stringify(context));
  }

  getSelectedTableContext(): SelectedRestaurantTableContext | null {
    const stored = this.readStorage<SelectedRestaurantTableContext>(this.selectedTableContextKey);
    if (!stored?.areaOperativa || !stored?.mesa || !stored?.mozo) {
      return null;
    }

    const puntoVenta = stored.puntoVenta?.detalle
      ? this.normalizeSelectedPointOfSale(stored.puntoVenta)
      : this.getSelectedPointOfSale();

    if (!puntoVenta) {
      return null;
    }

    return {
      ...stored,
      puntoVenta
    };
  }

  clearSelectedTableContext(): void {
    sessionStorage.removeItem(this.selectedTableContextKey);
  }

  private normalizeSelectedPointOfSale(selected: SelectedPointOfSale): SelectedPointOfSale | null {
    const detalle = this.normalizePointOfSale(selected.detalle);
    if (!detalle.MPV07_CodPntVenta) {
      return null;
    }
    return {
      codigo: detalle.MPV07_CodPntVenta,
      descripcion: detalle.MPV07_NomPntVenta || detalle.MPV07_CodPntVenta,
      detalle
    };
  }

  private normalizePointOfSale(item: PuntoVentaUsuario): PuntoVentaUsuario {
    return {
      MPV07_CodPntVenta: this.normalizeText(item.MPV07_CodPntVenta),
      MPV07_NomPntVenta: this.normalizeText(item.MPV07_NomPntVenta),
      MPV07_CodComanda: this.normalizeText(item.MPV07_CodComanda),
      MPV10_CodLstPrecio: this.normalizeText(item.MPV10_CodLstPrecio),
      MPV04_Moneda: this.normalizeText(item.MPV04_Moneda),
      MPV07_ImpresoraA: item.MPV07_ImpresoraA ?? null,
      MPV07_ImpresoraB: item.MPV07_ImpresoraB ?? null
    };
  }

  private readStorage<T>(key: string): T | null {
    const raw = sessionStorage.getItem(key);
    if (!raw) {
      return null;
    }
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  private normalizeText(value: unknown): string {
    return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
  }
}
