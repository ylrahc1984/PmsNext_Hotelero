import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map } from 'rxjs/operators';

import { environment } from 'src/environments/environment';
import { ProductoResponse as ProductoListResponse } from './interfaces/ProductoResponse.interface';
import { LineaProducto } from './interfaces/LineaProducto.interface';
import { CategoriaProducto } from './interfaces/CategoriaProducto.interface';
import { Producto } from './interfaces/Producto.interface';
import { ProductoRequest } from '../producto-form/interfaces/ProductoRequest.interface';
import { ProductoResponse as ProductoFormResponse } from '../producto-form/interfaces/ProductoResponse.interface';
import { Impuesto } from '../producto-form/interfaces/Impuesto.interface';

export interface ProductoFiltros {
  nomProducto?: string;
  linea?: string;
  categoria?: string;
  codigoBarra?: string;
  pageNumber: number;
  pageSize: number;
}

@Injectable({
  providedIn: 'root'
})
export class ProductoService {
  private readonly baseUrl = environment.apiUrl;
  private readonly productosUrl = `${this.baseUrl}/producto`;
  private readonly lineasUrl = `${this.baseUrl}/lineaproducto`;
  private readonly categoriasUrl = `${this.baseUrl}/categoriaproducto/linea`;
  private readonly impuestosUrl = `${this.baseUrl}/impuesto/fe`;

  constructor(private http: HttpClient) {}

  getProductos(filtros: ProductoFiltros): Observable<ProductoListResponse> {
    let params = new HttpParams()
      .set('pageNumber', String(filtros.pageNumber))
      .set('pageSize', String(filtros.pageSize));

    params = this.setParamIfPresent(params, 'nomProducto', filtros.nomProducto);
    params = this.setParamIfPresent(params, 'linea', filtros.linea);
    params = this.setParamIfPresent(params, 'categoria', filtros.categoria);
    params = this.setParamIfPresent(params, 'codigoBarra', filtros.codigoBarra);

    return this.http.get<ProductoListResponse>(this.productosUrl, { params });
  }

  getLineas(): Observable<LineaProducto[]> {
    return this.http.get<LineaProducto[] | LineaProducto>(this.lineasUrl).pipe(map((res) => this.ensureArray(res)));
  }

  getCategoriasPorLinea(linea: string): Observable<CategoriaProducto[]> {
    const normalized = this.normalizeValue(linea);
    if (!normalized) {
      return of([]);
    }
    const url = `${this.categoriasUrl}/${encodeURIComponent(normalized)}`;
    return this.http.get<CategoriaProducto[] | CategoriaProducto>(url).pipe(map((res) => this.ensureArray(res)));
  }

  getImpuestosFe(): Observable<Impuesto[]> {
    return this.http.get<Impuesto[] | Impuesto>(this.impuestosUrl).pipe(map((res) => this.ensureArray(res)));
  }

  obtenerProductoPorCodigo(codProducto: string): Observable<Producto | null> {
    const normalized = this.normalizeValue(codProducto);
    if (!normalized) {
      return of(null);
    }
    let params = new HttpParams().set('pageNumber', '1').set('pageSize', '5');
    params = this.setParamIfPresent(params, 'codProducto', normalized);
    return this.http.get<ProductoListResponse>(this.productosUrl, { params }).pipe(
      map((response) => {
        const item = response?.datos?.[0];
        return item ?? null;
      })
    );
  }

  crearProducto(payload: ProductoRequest): Observable<ProductoFormResponse> {
    return this.http
      .post(this.productosUrl, payload, { responseType: 'text' })
      .pipe(map((response) => this.parseTextResponse(response)));
  }

  actualizarProducto(codProducto: string, payload: ProductoRequest): Observable<ProductoFormResponse> {
    return this.http
      .put(`${this.productosUrl}/${encodeURIComponent(codProducto)}`, payload, { responseType: 'text' })
      .pipe(map((response) => this.parseTextResponse(response)));
  }

  eliminarProducto(codProducto: string): Observable<ProductoFormResponse> {
    return this.http
      .delete(`${this.productosUrl}/${encodeURIComponent(codProducto)}`, { responseType: 'text' })
      .pipe(map((response) => this.parseTextResponse(response)));
  }

  private setParamIfPresent(params: HttpParams, key: string, value?: string): HttpParams {
    const normalized = this.normalizeValue(value);
    return normalized ? params.set(key, normalized) : params;
  }

  private normalizeValue(value?: string): string | undefined {
    if (value === undefined || value === null) {
      return undefined;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }

  private ensureArray<T>(value: T[] | T | null | undefined): T[] {
    if (!value) {
      return [];
    }
    return Array.isArray(value) ? value : [value];
  }

  private parseTextResponse(response: string): ProductoFormResponse {
    if (!response) {
      return {};
    }
    const trimmed = response.trim();
    if (!trimmed) {
      return {};
    }
    try {
      return JSON.parse(trimmed) as ProductoFormResponse;
    } catch {
      return { respuesta: trimmed };
    }
  }
}
