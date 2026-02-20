import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from 'src/environments/environment';

export type ModoPrecio = 'R' | 'N';

export interface ServicioListaPrecioApiItem {
  ReglaPrecioID: number;
  CodServicio: string;
  NomServicio: string;
  Moneda?: string;
  Precios: Array<{
    tipoPax?: string | null;
    descripcion?: string | null;
    precio?: number | null;
    montoComision?: number | null;
    comision?: number | null;
    // Compatibilidad con variantes anteriores.
    tipo?: string | null;
  }>;
}

export interface ServicioListaPrecioApiResponse {
  datos?: ServicioListaPrecioApiItem[];
}

export interface ServicioListaPrecioItem {
  reglaPrecioId: number;
  codigoServicio: string;
  nombreServicio: string;
  precioUnitario: number;
  moneda: string;
}

@Injectable({ providedIn: 'root' })
export class ServiciosListaPrecioService {
  private readonly apiUrl = `${environment.apiUrl}/detalle-lista-precio`;

  constructor(private http: HttpClient) {}

  getServiciosLista(
    codLista: string,
    pageNumber: number,
    pageSize: number,
    searchTerm?: string
  ): Observable<ServicioListaPrecioApiItem[]> {
    const codLstPrecio = (codLista || '').trim();
    if (!codLstPrecio) {
      return of([]);
    }

    let params = new HttpParams()
      .set('codLstPrecio', codLstPrecio)
      .set('pageNumber', String(pageNumber))
      .set('pageSize', String(pageSize));

    const term = (searchTerm || '').trim();
    if (term) {
      if (this.isLikelyCode(term)) {
        params = params.set('codServicio', term);
      } else {
        params = params.set('nombreServicio', term);
      }
    }

    return this.http
      .get<ServicioListaPrecioApiResponse>(`${this.apiUrl}/servicios/detalle-precios`, { params })
      .pipe(map((res) => res?.datos ?? []));
  }

  mapServicios(items: ServicioListaPrecioApiItem[], modoPrecio: ModoPrecio): ServicioListaPrecioItem[] {
    return (items ?? [])
      .map((item) => this.mapServicio(item, modoPrecio))
      .filter((item): item is ServicioListaPrecioItem => !!item);
  }

  private mapServicio(item: ServicioListaPrecioApiItem, modoPrecio: ModoPrecio): ServicioListaPrecioItem | null {
    if (!item) return null;

    const paxRow = (item.Precios ?? []).find((precio) => this.normalizeTipoPax(precio?.tipoPax || precio?.tipo) === 'PAX');
    const precioUnitario =
      modoPrecio === 'N'
        ? this.toNumber(paxRow?.montoComision ?? paxRow?.comision)
        : this.toNumber(paxRow?.precio);

    return {
      reglaPrecioId: Number(item.ReglaPrecioID ?? 0) || 0,
      codigoServicio: (item.CodServicio || '').toString().trim(),
      nombreServicio: (item.NomServicio || item.CodServicio || '').toString().trim(),
      precioUnitario,
      moneda: (item.Moneda || '').toString().trim().toUpperCase()
    };
  }

  private normalizeTipoPax(value?: string | null): string {
    return (value || '')
      .toString()
      .trim()
      .toUpperCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  private toNumber(value?: number | string | null): number {
    const parsed = Number(value ?? 0);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private isLikelyCode(term: string): boolean {
    if (!term) return false;
    if (term.includes(' ')) return false;
    if (/\d/.test(term)) return true;
    return term.length <= 6;
  }
}
