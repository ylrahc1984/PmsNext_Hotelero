import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { AuthService } from 'src/app/core/services/auth.service';
import { ListaPrecioDto, ListaPrecioPost, ListaPrecioUI } from './lista-precio.models';

@Injectable({
  providedIn: 'root'
})
export class ListaPrecioService {
  private apiUrl = 'http://localhost:5000/api/listaprecio';

  constructor(private http: HttpClient, private auth: AuthService) {}

  getListas(options?: {
    descripcion?: string;
    codigo?: string;
    pageNumber?: number;
    pageSize?: number;
  }): Observable<{
    data: ListaPrecioUI[];
    totalRegistros: number;
    paginaActual: number;
    pageSize: number;
    totalPages: number;
  }> {
    let params = new HttpParams();
    if (options?.descripcion) {
      params = params.set('desLstPrecio', options.descripcion);
    }
    if (options?.codigo) {
      params = params.set('codLstPrecio', options.codigo);
    }
    const pageNumber = options?.pageNumber ?? 1;
    const pageSize = options?.pageSize ?? 10;
    params = params.set('pageNumber', String(pageNumber)).set('pageSize', String(pageSize));

    const url = options?.descripcion ? `${this.apiUrl}/descripcion` : this.apiUrl;
    return this.http.get<ListaPrecioDto[] | { datos?: ListaPrecioDto[]; paginacion?: any }>(url, { params }).pipe(
      map((response) => {
        const dataArray = Array.isArray(response) ? response : (response?.datos ?? []);
        const data = (dataArray ?? []).map((item) => this.mapFromApi(item));
        const paginacion = Array.isArray(response) ? undefined : response?.paginacion;
        const totalRegistros = paginacion?.totalRegistros ?? data.length;
        const paginaActual = paginacion?.paginaActual ?? pageNumber;
        const size = paginacion?.pageSize ?? pageSize;
        const totalPages = totalRegistros > 0 ? Math.ceil(totalRegistros / size) : 1;
        return { data, totalRegistros, paginaActual, pageSize: size, totalPages };
      })
    );
  }

  getListaByCodigo(cod: string): Observable<ListaPrecioUI | null> {
    const params = new HttpParams()
      .set('codLstPrecio', cod)
      .set('pageNumber', '1')
      .set('pageSize', '1');
    return this.http.get<ListaPrecioDto[] | { datos?: ListaPrecioDto[] }>(this.apiUrl, { params }).pipe(
      map((response) => {
        const dataArray = Array.isArray(response) ? response : (response?.datos ?? []);
        const item = dataArray?.[0];
        return item ? this.mapFromApi(item) : null;
      })
    );
  }

  crearLista(payload: ListaPrecioPost): Observable<{ respuesta?: string }> {
    const normalized = this.normalizePayload(payload, 1);
    return this.http
      .post(this.apiUrl, normalized, { responseType: 'text' })
      .pipe(map((response) => this.parseTextResponse(response)));
  }

  editarLista(cod: string, payload: ListaPrecioPost): Observable<{ respuesta?: string }> {
    const normalized = this.normalizePayload(payload, 2);
    return this.http
      .put(`${this.apiUrl}/${cod}`, normalized, { responseType: 'text' })
      .pipe(map((response) => this.parseTextResponse(response)));
  }

  eliminarLista(cod: string): Observable<unknown> {
  
    return this.http.delete(`${this.apiUrl}/${cod}`, { responseType: 'text' });
  }

  buildPayloadFromUI(value: Partial<ListaPrecioUI>, proceso: number): ListaPrecioPost {
    return this.normalizePayload(
      {
        proceso,
        codLstPrecio: value.codigo || '',
        desLstPrecio: value.descripcion || '',
        moneda: value.moneda || '',
        simbolo: value.simbolo || '',
        vigencia: value.vigente || 'S',
        fechaDesde: this.toIsoDate(value.fechaDesde),
        fechaHasta: this.toIsoDate(value.fechaHasta),
        observaciones: value.observaciones || '',
        operador: '',
        respuesta: ''
      },
      proceso
    );
  }

  private normalizePayload(payload: ListaPrecioPost, proceso: number): ListaPrecioPost {
    return {
      ...payload,
      proceso,
      operador: this.getOperador(),
      respuesta: ''
    };
  }

  private mapFromApi(apiData: ListaPrecioDto): ListaPrecioUI {
    return {
      codigo: apiData.MPV04_CodLstPrecio,
      descripcion: apiData.MPV04_DesLstPrecio,
      moneda: apiData.MPV04_Moneda,
      simbolo: this.normalizeString(apiData.MPV04_Simbolo),
      vigente: apiData.MPV04_Vigente,
      fechaDesde: this.normalizeDate(apiData.MPV04_FechaDesde),
      fechaHasta: this.normalizeDate(apiData.MPV04_FechaHasta),
      observaciones: this.normalizeString(apiData.MPV04_Observaciones),
      operador: apiData.MPV04_Operador
    };
  }

  private normalizeString(value: unknown): string {
    if (typeof value === 'string') {
      return value;
    }
    return '';
  }

  private normalizeDate(value: unknown): string {
    if (typeof value !== 'string' || !value) {
      return '';
    }
    return value.includes('T') ? value.substring(0, 10) : value;
  }

  private toIsoDate(value?: string): string {
    if (!value) {
      return '';
    }
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '' : date.toISOString();
  }

  private parseTextResponse(response: string): { respuesta?: string } {
    if (!response) {
      return {};
    }
    const trimmed = response.trim();
    if (!trimmed) {
      return {};
    }
    try {
      return JSON.parse(trimmed) as { respuesta?: string };
    } catch {
      return { respuesta: trimmed };
    }
  }

  private getOperador(): string {
    return this.auth.getCurrentUser()?.usuario ?? '';
  }
}
