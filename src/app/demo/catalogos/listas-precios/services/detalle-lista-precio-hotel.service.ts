import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { AuthService } from 'src/app/core/services/auth.service';
import { environment } from 'src/environments/environment';
import {
  AgregarDetalleListaPrecioPayload,
  DetalleListaPrecioHotelModel,
  RecetaNoEnListaHotelModel,
  RecetasNoEnListaResult
} from '../models/detalle-lista-precio-hotel.model';

interface DetalleListaPrecioHotelResponse {
  datos?: Array<Record<string, unknown>>;
}

interface RecetasNoEnListaResponse {
  datos?: Array<Record<string, unknown>>;
  paginacion?: {
    totalRegistros?: number;
    paginaActual?: number;
    pageSize?: number;
    totalPaginas?: number;
    totalPages?: number;
  };
}

@Injectable({
  providedIn: 'root'
})
export class DetalleListaPrecioHotelService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly apiUrl = `${environment.apiUrl}/detalle-lista-precio`;
  private readonly recetasUrl = `${environment.apiUrl}/encreceta`;

  getDetalle(codListaPrecio: string): Observable<DetalleListaPrecioHotelModel[]> {
    const codigo = encodeURIComponent((codListaPrecio || '').trim());
    return this.http
      .get<Array<Record<string, unknown>> | DetalleListaPrecioHotelResponse>(`${this.apiUrl}/punto-venta/${codigo}`)
      .pipe(map((response) => this.extractData(response).map((item) => this.mapFromApi(item))));
  }

  eliminarProducto(codListaPrecio: string, id: string | number): Observable<unknown> {
    const codigo = encodeURIComponent((codListaPrecio || '').trim());
    const detalleId = encodeURIComponent(String(id ?? '').trim());
    return this.http.delete(`${this.apiUrl}/${codigo}/${detalleId}`, { responseType: 'text' });
  }

  getRecetasNoEnLista(codListaPrecio: string, pageNumber = 1, pageSize = 20, nomReceta = ''): Observable<RecetasNoEnListaResult> {
    let params = new HttpParams()
      .set('codLista', (codListaPrecio || '').trim())
      .set('pageNumber', String(pageNumber))
      .set('pageSize', String(pageSize));

    const search = nomReceta.trim();
    if (search) {
      params = params.set('nomReceta', search);
    }

    return this.http.get<RecetasNoEnListaResponse>(`${this.recetasUrl}/no-en-lista`, { params }).pipe(
      map((response) => {
        const data = (response?.datos ?? []).map((item) => this.mapRecetaFromApi(item));
        const totalRegistros = this.toNumber(response?.paginacion?.totalRegistros) || data.length;
        const paginaActual = this.toNumber(response?.paginacion?.paginaActual) || pageNumber;
        const size = this.toNumber(response?.paginacion?.pageSize) || pageSize;
        const totalPagesFromApi = this.toNumber(response?.paginacion?.totalPaginas ?? response?.paginacion?.totalPages);
        const totalPages = totalPagesFromApi > 0 ? totalPagesFromApi : Math.max(1, Math.ceil(totalRegistros / size));

        return { data, totalRegistros, paginaActual, pageSize: size, totalPages };
      })
    );
  }

  agregarProducto(payload: AgregarDetalleListaPrecioPayload): Observable<{ respuesta?: string }> {
    return this.http
      .post(this.apiUrl, this.decorateAgregarPayload(payload), { responseType: 'text' })
      .pipe(map((response) => this.parseTextResponse(response)));
  }

  private mapFromApi(api: Record<string, unknown>): DetalleListaPrecioHotelModel {
    return {
      MPV05_ID: this.toOptionalNumber(api['MPV05_ID'] ?? api['MPV05_Id'] ?? api['id']),
      MPV05_CodLstPrecio: this.toText(api['MPV05_CodLstPrecio']),
      MPV01_CodGrupo: this.toText(api['MPV01_CodGrupo']),
      MPV00_NomCategoria: this.toText(api['MPV00_NomCategoria']),
      MPV05_CodProducto: this.toText(api['MPV05_CodProducto']),
      MPV05_DesProducto: this.toText(api['MPV05_DesProducto']),
      MPV05_NomCorto: this.toText(api['MPV05_NomCorto']),
      MPV01_UMedida: this.toText(api['MPV01_UMedida']),
      MPV05_PrecioTotal: this.toNumber(api['MPV05_PrecioTotal']),
      MPV05_CostoProdu: this.toNumber(api['MPV05_CostoProdu']),
      MPV05_Impuesto: this.toNumber(api['MPV05_Impuesto']),
      MPV05_Moneda: this.toText(api['MPV05_Moneda']),
      MPV05_Orden: this.toNumber(api['MPV05_Orden']),
      MPV01_CodCategoria: this.toText(api['MPV01_CodCategoria']),
      MPV05_Operador: this.toText(api['MPV05_Operador'])
    };
  }

  private extractData(response: Array<Record<string, unknown>> | DetalleListaPrecioHotelResponse | null | undefined): Array<Record<string, unknown>> {
    if (Array.isArray(response)) {
      return response;
    }

    if (Array.isArray(response?.datos)) {
      return response.datos;
    }

    return [];
  }

  private mapRecetaFromApi(api: Record<string, unknown>): RecetaNoEnListaHotelModel {
    return {
      MPV01_CodCategoria: this.toText(api['MPV01_CodCategoria']),
      MPV01_CodGrupo: this.toText(api['MPV01_CodGrupo']),
      MPV01_CodReceta: this.toText(api['MPV01_CodReceta']),
      MPV01_NomReceta: this.toText(api['MPV01_NomReceta']),
      MPV01_NomCorto: this.toText(api['MPV01_NomCorto']),
      MPV01_UMedida: this.toText(api['MPV01_UMedida']),
      MPV01_NumPorciones: this.toNumber(api['MPV01_NumPorciones']),
      MPV01_CtoReceta: this.toNumber(api['MPV01_CtoReceta']),
      MPV01_CtoProduccion: this.toNumber(api['MPV01_CtoProduccion']),
      MPV01_CtoNeto: this.toNumber(api['MPV01_CtoNeto']),
      MPV01_Utilidad: this.toNumber(api['MPV01_Utilidad']),
      MPV01_TotalCUtilidad: this.toNumber(api['MPV01_TotalCUtilidad']),
      MPV01_CtoTotal: this.toNumber(api['MPV01_CtoTotal']),
      MPV01_Descripcion: this.toText(api['MPV01_Descripcion']),
      MPV01_Visible: this.toNumber(api['MPV01_Visible']),
      MPV01_UrlImagen: this.toText(api['MPV01_UrlImagen']),
      MPV01_Operador: this.toText(api['MPV01_Operador']),
      MPV01_CABYS: this.toText(api['MPV01_CABYS']),
      MPV01_Compuesto: this.toText(api['MPV01_Compuesto'])
    };
  }

  private decorateAgregarPayload(payload: AgregarDetalleListaPrecioPayload): AgregarDetalleListaPrecioPayload {
    return {
      ...payload,
      proceso: Number(payload.proceso ?? 0),
      codLstPrecio: this.toText(payload.codLstPrecio),
      codProducto: this.toText(payload.codProducto),
      desProducto: this.toText(payload.desProducto),
      nomCorto: this.toText(payload.nomCorto),
      precioTotal: this.toNumber(payload.precioTotal),
      cstoProdu: this.toNumber(payload.cstoProdu),
      impuesto: this.toNumber(payload.impuesto),
      moneda: this.toText(payload.moneda) || 'USD',
      orden: this.toNumber(payload.orden),
      operador: this.toText(payload.operador) || this.getOperador(),
      pageNumber: this.toNumber(payload.pageNumber),
      pageSize: this.toNumber(payload.pageSize),
      respuesta: payload.respuesta ?? ''
    };
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

  private toText(value: unknown): string {
    if (typeof value === 'string') {
      return value.trim();
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value).trim();
    }
    return '';
  }

  private toNumber(value: unknown): number {
    const numberValue = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(numberValue) ? numberValue : 0;
  }

  private toOptionalNumber(value: unknown): number | undefined {
    const numberValue = this.toNumber(value);
    return numberValue > 0 ? numberValue : undefined;
  }

  private getOperador(): string {
    return this.auth.getCurrentUser()?.usuario ?? '';
  }
}
