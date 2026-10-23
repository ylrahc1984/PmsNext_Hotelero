import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from 'src/environments/environment';
import { CompraIvaConsolidado, CompraIvaDetalle, CompraIvaFactura, ComprasIvaQuery } from '../models/compras-iva.models';

type CollectionResponse<T> = T[] | { datos?: T[]; data?: T[]; items?: T[]; detalle?: T[]; facturas?: T[]; consolidado?: T[] };

@Injectable({ providedIn: 'root' })
export class ComprasIvaService {
  private readonly http = inject(HttpClient);
  private readonly apiBase = `${environment.apiUrl}/contabilidad/compras-iva`;

  detalle(query: ComprasIvaQuery): Observable<CompraIvaDetalle[]> {
    return this.getCollection<CompraIvaDetalle>('detalle', query);
  }

  facturas(query: ComprasIvaQuery): Observable<CompraIvaFactura[]> {
    return this.getCollection<CompraIvaFactura>('facturas', query);
  }

  consolidado(query: ComprasIvaQuery): Observable<CompraIvaConsolidado[]> {
    return this.getCollection<CompraIvaConsolidado>('consolidado', query);
  }

  private getCollection<T>(path: string, query: ComprasIvaQuery): Observable<T[]> {
    let params = new HttpParams()
      .set('fechaInicio', this.toApiDate(query.fechaInicio))
      .set('fechaFin', this.toApiDate(query.fechaFin));
    if (query.proveedor) params = params.set('proveedor', query.proveedor);

    return this.http.get<CollectionResponse<T>>(`${this.apiBase}/${path}`, { params }).pipe(
      map((response) => {
        if (Array.isArray(response)) return response;
        return response?.datos ?? response?.data ?? response?.items ?? response?.detalle ?? response?.facturas ?? response?.consolidado ?? [];
      })
    );
  }

  private toApiDate(value: string): string {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    return match ? `${match[3]}/${match[2]}/${match[1]}` : value;
  }
}
