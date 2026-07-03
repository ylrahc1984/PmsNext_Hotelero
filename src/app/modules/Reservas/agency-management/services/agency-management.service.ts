import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { environment } from 'src/environments/environment';
import { AgencyPagination } from '../models/agency-pagination.model';
import { AgencyRequest } from '../models/agency-request.model';
import { Agency } from '../models/agency.model';

interface AgencyPaginationApiResponse {
  datos?: Agency[] | Agency | null;
  totalRegistros?: number;
  paginaActual?: number;
  tamanoPagina?: number;
  totalPaginas?: number;
}

@Injectable({ providedIn: 'root' })
export class AgencyManagementService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/agencia`;

  getAgencies(pageNumber = 1, pageSize = 20): Observable<AgencyPagination> {
    const params = new HttpParams().set('pageNumber', String(pageNumber)).set('pageSize', String(pageSize));
    return this.http
      .get<AgencyPaginationApiResponse>(`${this.apiUrl}/paginado`, { params })
      .pipe(map((response) => this.normalizePagination(response, pageNumber, pageSize)));
  }

  searchAgency(nombre: string, pageNumber = 1, pageSize = 20): Observable<AgencyPagination> {
    const params = new HttpParams()
      .set('nombre', nombre)
      .set('pageNumber', String(pageNumber))
      .set('pageSize', String(pageSize));

    return this.http
      .get<AgencyPaginationApiResponse>(`${this.apiUrl}/buscar`, { params })
      .pipe(map((response) => this.normalizePagination(response, pageNumber, pageSize)));
  }

  createAgency(request: AgencyRequest): Observable<AgencyRequest> {
    return this.http.post<AgencyRequest>(this.apiUrl, { ...request, proceso: 1 });
  }

  updateAgency(codigo: string, request: AgencyRequest): Observable<AgencyRequest> {
    return this.http.put<AgencyRequest>(`${this.apiUrl}/${encodeURIComponent(codigo)}`, { ...request, proceso: 2 });
  }

  deleteAgency(codigo: string): Observable<AgencyRequest> {
    return this.http.delete<AgencyRequest>(`${this.apiUrl}/${encodeURIComponent(codigo)}`);
  }

  private normalizePagination(response: AgencyPaginationApiResponse | null | undefined, pageNumber: number, pageSize: number): AgencyPagination {
    const datos = this.normalizeAgencyList(response?.datos);
    const totalRegistros = response?.totalRegistros ?? datos.length;
    const tamanoPagina = response?.tamanoPagina ?? pageSize;

    return {
      datos,
      totalRegistros,
      paginaActual: response?.paginaActual ?? pageNumber,
      tamanoPagina,
      totalPaginas: response?.totalPaginas ?? Math.max(1, Math.ceil(totalRegistros / Math.max(tamanoPagina, 1)))
    };
  }

  private normalizeAgencyList(datos: Agency[] | Agency | null | undefined): Agency[] {
    if (!datos) {
      return [];
    }

    return Array.isArray(datos) ? datos : [datos];
  }
}
