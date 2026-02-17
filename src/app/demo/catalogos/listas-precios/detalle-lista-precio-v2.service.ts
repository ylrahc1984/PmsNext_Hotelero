import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, catchError, map, throwError } from 'rxjs';
import { environment } from 'src/environments/environment';
import {
  PagedResponseDto,
  ReglaPrecioDetalleDto,
  ReglaPrecioCreateDto,
  ReglaPrecioListItemDto,
  ReglaPrecioPreciosUpdateDto,
  ReglasFiltroVm,
  TipoPaxDto
} from './detalle-lista-precio-v2.models';

@Injectable({
  providedIn: 'root'
})
export class DetalleListaPrecioV2Service {
  // Base URL para endpoints de detalle de lista de precios.
  private apiUrl = `${environment.apiUrl}/detalle-lista-precio`;

  // HttpClient inyectado para consumir el backend.
  constructor(private http: HttpClient) {}

  // Obtiene reglas paginadas segun filtros (lista, servicio, tipo tarifa, activos).
  getReglas(filtro: ReglasFiltroVm): Observable<PagedResponseDto<ReglaPrecioListItemDto>> {
    // Parametros base de paginacion y lista.
    let params = new HttpParams()
      .set('codLstPrecio', filtro.codLstPrecio)
      .set('pageNumber', String(filtro.pageNumber ?? 1))
      .set('pageSize', String(filtro.pageSize ?? 10));

    // Filtros opcionales.
    if (filtro.codServicio) {
      params = params.set('codServicio', filtro.codServicio);
    }
    if (filtro.tipoTarifa !== undefined && filtro.tipoTarifa !== null && `${filtro.tipoTarifa}`.trim() !== '') {
      params = params.set('tipoTarifa', String(filtro.tipoTarifa));
    }
    if (typeof filtro.soloActivos === 'boolean') {
      params = params.set('soloActivos', String(filtro.soloActivos));
    }

    // Normaliza respuesta y propaga error crudo.
    return this.http.get<PagedResponseDto<ReglaPrecioListItemDto>>(`${this.apiUrl}/reglas`, { params }).pipe(
      map((response) => this.normalizePagedResponse(response, filtro.pageNumber, filtro.pageSize)),
      catchError((error) => throwError(() => error))
    );
  }

  // Obtiene detalle de una regla; el backend responde texto que se parsea a JSON.
  getReglaDetalle(reglaPrecioId: number): Observable<ReglaPrecioDetalleDto> {
    return this.http
      .get(`${this.apiUrl}/regla/${reglaPrecioId}`, { responseType: 'text' })
      .pipe(
        map((response) => this.parseTextJson<ReglaPrecioDetalleDto>(response)),
        catchError((error) => throwError(() => error))
      );
  }

  // Crea una regla; la respuesta puede ser JSON o un ID en texto.
  createRegla(body: ReglaPrecioCreateDto): Observable<ReglaPrecioDetalleDto | ReglaPrecioListItemDto> {
    return this.http
      .post(`${this.apiUrl}/regla`, body, { responseType: 'text' })
      .pipe(
        map((response) => this.parseTextJsonOptional<ReglaPrecioDetalleDto | ReglaPrecioListItemDto>(response)),
        catchError((error) => throwError(() => error))
      );
  }

  // Actualiza campos de cabecera de la regla.
  updateRegla(reglaPrecioId: number, body: Record<string, unknown>): Observable<unknown> {
    return this.http.put(`${this.apiUrl}/regla/${reglaPrecioId}`, body, { responseType: 'text' }).pipe(
      catchError((error) => throwError(() => error))
    );
  }

  // Actualiza lista de precios por tipo pax para una regla.
  updatePrecios(reglaPrecioId: number, body: ReglaPrecioPreciosUpdateDto): Observable<unknown> {
    return this.http.put(`${this.apiUrl}/regla/${reglaPrecioId}/precios`, body, { responseType: 'text' }).pipe(
      catchError((error) => throwError(() => error))
    );
  }

  // Desactiva una regla de precios.
  desactivarRegla(reglaPrecioId: number): Observable<unknown> {
    return this.http.put(`${this.apiUrl}/regla/${reglaPrecioId}/desactivar`, {}, { responseType: 'text' }).pipe(
      catchError((error) => throwError(() => error))
    );
  }

  // Parsea respuesta de texto JSON estricta (si falla, lanza error con el texto).
  private parseTextJson<T>(response: string): T {
    if (!response) {
      throw new Error('Respuesta vacia del servidor.');
    }
    const trimmed = response.trim();
    if (!trimmed) {
      throw new Error('Respuesta vacia del servidor.');
    }
    try {
      return JSON.parse(trimmed) as T;
    } catch {
      throw new Error(trimmed);
    }
  }

  // Parsea respuesta opcional: JSON, ID numerico en texto o vacio.
  private parseTextJsonOptional<T>(response: string): T {
    if (!response) {
      return {} as T;
    }
    const trimmed = response.trim();
    if (!trimmed) {
      return {} as T;
    }
    try {
      return JSON.parse(trimmed) as T;
    } catch {
      const asNumber = Number(trimmed);
      if (Number.isFinite(asNumber) && asNumber > 0) {
        return { ReglaPrecioID: asNumber } as T;
      }
      return {} as T;
    }
  }

  // Obtiene catalogo de tipos de pax.
  getTiposPax(): Observable<TipoPaxDto[]> {
    return this.http.get<PagedResponseDto<TipoPaxDto>>(`${environment.apiUrl}/tipo-pax`).pipe(
      map((response) => response?.datos ?? []),
      catchError((error) => throwError(() => error))
    );
  }

  // Asegura un shape estable para datos y paginacion.
  private normalizePagedResponse(
    response: PagedResponseDto<ReglaPrecioListItemDto> | null | undefined,
    pageNumber: number,
    pageSize: number
  ): PagedResponseDto<ReglaPrecioListItemDto> {
    const datos = response?.datos ?? [];
    const paginacion = response?.paginacion ?? {
      totalRegistros: datos.length,
      paginaActual: pageNumber,
      pageSize
    };
    return { datos, paginacion };
  }
}
