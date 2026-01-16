import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { AuthService } from 'src/app/core/services/auth.service';
import { CentroCostoApi, CentroCostoListResponse, CentroCostoPayload, CentroCostoResponse, CentroCostoUI } from './centro-costo.models';

@Injectable({ providedIn: 'root' })
export class CentroCostoService {
  private apiUrl = 'http://localhost:5000/api/centrocosto';
  private readonly procesoInsert = 1;
  private readonly procesoUpdate = 2;

  constructor(private http: HttpClient, private auth: AuthService) {}

  getAll(pageNumber: number = 1, pageSize: number = 10): Observable<{ data: CentroCostoUI[]; totalPaginas: number; paginaActual: number; totalRegistros: number }> {
    const url = `${this.apiUrl}?pageNumber=${pageNumber}&pageSize=${pageSize}`;
    return this.http.get<CentroCostoListResponse>(url).pipe(
      map((response) => {
        const data = (response?.datos ?? []).map((item) => this.mapFromApi(item));
        const totalRegistros = response?.paginacion?.totalRegistros ?? data.length;
        const rawTotalPaginas = response?.paginacion?.totalPaginas ?? 0;
        const computedTotalPaginas = totalRegistros > 0 ? Math.ceil(totalRegistros / pageSize) : 1;
        const totalPaginas = (rawTotalPaginas <= 1 && totalRegistros > pageSize) ? computedTotalPaginas : (rawTotalPaginas || computedTotalPaginas);
        return {
          data,
          totalPaginas,
          paginaActual: response?.paginacion?.paginaActual ?? pageNumber,
          totalRegistros
        };
      })
    );
  }
 
  getByCodigo(codGrupo: string, pageNumber: number = 1, pageSize: number = 10): Observable<CentroCostoUI> {
    const url = `${this.apiUrl}?codGrupo=${encodeURIComponent(codGrupo)}&pageNumber=${pageNumber}&pageSize=${pageSize}`;
    return this.http.get<CentroCostoListResponse>(url).pipe(
      map((response) => {
        const item = response?.datos?.[0];
        if (!item) {
          throw new Error('Centro de costo no encontrado');
        }
        return this.mapFromApi(item);
      })
    );
  }
  create(cc: CentroCostoUI): Observable<CentroCostoResponse> {
    const payload = this.buildPayload(cc, this.procesoInsert);
    return this.http
      .post(this.apiUrl, payload, { responseType: 'text' })
      .pipe(map((response) => this.parseTextResponse(response)));
  }

  update(codGrupo: string, cc: CentroCostoUI): Observable<CentroCostoResponse> {
    const payload = this.buildPayload({ ...cc, codGrupo }, this.procesoUpdate);
    return this.http
      .put(`${this.apiUrl}/${codGrupo}`, payload, { responseType: 'text' })
      .pipe(map((response) => this.parseTextResponse(response)));
  }

  delete(codGrupo: string): Observable<CentroCostoResponse> {
    return this.http
      .delete(`${this.apiUrl}/${codGrupo}`, { responseType: 'text' })
      .pipe(map((response) => this.parseTextResponse(response)));
  }

  private buildPayload(cc: CentroCostoUI, proceso: number): CentroCostoPayload {
    return {
      proceso,
      codGrupo: cc.codGrupo,
      descripcion: cc.descripcion,
      impuesto: cc.impuesto,
      orden: cc.orden,
      tcCto: cc.tcCto,
      operador: this.auth.getCurrentUser()?.usuario ?? '',
      respuesta: ''
    };
  }

  private mapFromApi(apiData: CentroCostoApi): CentroCostoUI {
    return {
      codGrupo: apiData.CA10_CodCCto,
      descripcion: apiData.CA10_CentroCosto,
      impuesto: apiData.CA10_Impuesto,
      orden: apiData.CA10_Orden,
      tcCto: apiData.CA10_TipCCto,
      operador: apiData.CA10_Operador,
      impuestoValor: apiData.Impuesto
    };
  }

  private parseTextResponse(response: string): CentroCostoResponse {
    if (!response) {
      return {};
    }
    const trimmed = response.trim();
    if (!trimmed) {
      return {};
    }
    try {
      return JSON.parse(trimmed) as CentroCostoResponse;
    } catch {
      return { respuesta: trimmed };
    }
  }
}
