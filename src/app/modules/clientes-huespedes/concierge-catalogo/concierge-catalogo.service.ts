import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from 'src/environments/environment';
import { ConciergeApiResponse, TipoSolicitudCatalogo, TipoSolicitudCatalogoEstado, TipoSolicitudCatalogoGuardar } from './concierge-catalogo.models';

@Injectable({ providedIn: 'root' })
export class ConciergeCatalogoService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${String(environment.apiUrl ?? '').replace(/\/+$/, '')}/concierge/catalogo-servicios`;

  listar(): Observable<TipoSolicitudCatalogo[]> {
    return this.http.get<ConciergeApiResponse<TipoSolicitudCatalogo[]>>(this.baseUrl).pipe(map((response) => this.validarLista(response)));
  }
  consultar(id: number): Observable<TipoSolicitudCatalogo> {
    return this.http.get<ConciergeApiResponse<TipoSolicitudCatalogo | TipoSolicitudCatalogo[]>>(`${this.baseUrl}/${id}`).pipe(map((response) => {
      if (!response?.success) throw new Error('No fue posible consultar el servicio.');
      return this.extraerItem(response.data);
    }));
  }
  crear(payload: TipoSolicitudCatalogoGuardar): Observable<TipoSolicitudCatalogo> {
    return this.http.post<ConciergeApiResponse<TipoSolicitudCatalogo | TipoSolicitudCatalogo[]>>(this.baseUrl, payload).pipe(map((r) => this.validarItem(r)));
  }
  actualizar(id: number, payload: TipoSolicitudCatalogoGuardar): Observable<TipoSolicitudCatalogo> {
    return this.http.put<ConciergeApiResponse<TipoSolicitudCatalogo | TipoSolicitudCatalogo[]>>(`${this.baseUrl}/${id}`, payload).pipe(map((r) => this.validarItem(r)));
  }
  cambiarEstado(id: number, activo: boolean): Observable<TipoSolicitudCatalogo> {
    const payload: TipoSolicitudCatalogoEstado = { activo };
    return this.http.patch<ConciergeApiResponse<TipoSolicitudCatalogo | TipoSolicitudCatalogo[]>>(`${this.baseUrl}/${id}/estado`, payload).pipe(map((r) => this.validarItem(r)));
  }
  private validarLista(r: ConciergeApiResponse<TipoSolicitudCatalogo[]>): TipoSolicitudCatalogo[] {
    if (!r?.success) throw new Error('No fue posible consultar el catálogo.');
    if (!Array.isArray(r.data) || !r.data.every((item) => this.esTipo(item))) throw new Error('La respuesta del catálogo no tiene el formato esperado.');
    return r.data;
  }
  private validarItem(r: ConciergeApiResponse<TipoSolicitudCatalogo | TipoSolicitudCatalogo[]>): TipoSolicitudCatalogo {
    if (!r?.success) throw new Error('La operación no pudo completarse.');
    return this.extraerItem(r.data);
  }
  private extraerItem(data: TipoSolicitudCatalogo | TipoSolicitudCatalogo[]): TipoSolicitudCatalogo {
    const item = Array.isArray(data) && data.length === 1 ? data[0] : data;
    if (!this.esTipo(item)) throw new Error('La respuesta del servicio no tiene el formato esperado.');
    return item;
  }
  private esTipo(value: unknown): value is TipoSolicitudCatalogo {
    if (!value || typeof value !== 'object') return false;
    const i = value as TipoSolicitudCatalogo;
    return Number.isInteger(i.idTipoSolicitud) && typeof i.nombre === 'string' && typeof i.area === 'string' && Number.isFinite(i.orden) &&
      typeof i.permiteCantidad === 'boolean' && typeof i.requiereComentario === 'boolean' && typeof i.activo === 'boolean';
  }
}
