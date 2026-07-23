import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { environment } from 'src/environments/environment';
import { AgencyPagination } from '../models/agency-pagination.model';
import { AgencyRequest } from '../models/agency-request.model';
import { AgencyResponse } from '../models/agency-response.model';
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

  getAgencyByCode(codigo: string): Observable<Agency | null> {
    const params = new HttpParams()
      .set('codigo', codigo.trim())
      .set('pageNumber', '1')
      .set('pageSize', '50');

    console.log('[AgencyManagement] Solicitud para editar agencia', {
      method: 'GET',
      url: `${this.apiUrl}/paginado`,
      params: {
        codigo: params.get('codigo'),
        pageNumber: params.get('pageNumber'),
        pageSize: params.get('pageSize')
      }
    });

    return this.http
      .get<AgencyPaginationApiResponse>(`${this.apiUrl}/paginado`, { params })
      .pipe(map((response) => this.normalizeAgencyList(response?.datos)[0] ?? null));
  }

  createAgency(request: AgencyRequest): Observable<AgencyResponse> {
    const body: AgencyRequest = { ...request, proceso: 1 };

    console.log('[AgencyManagement] Solicitud para crear agencia', {
      method: 'POST',
      url: this.apiUrl,
      body
    });

    return this.http.post<AgencyResponse>(this.apiUrl, body);
  }

  updateAgency(codigo: string, request: AgencyRequest): Observable<AgencyResponse> {
    const normalizedCode = codigo.trim();
    const url = `${this.apiUrl}/${encodeURIComponent(normalizedCode)}`;
    const body: AgencyRequest = {
      ...request,
      proceso: 2,
      codigo: normalizedCode
    };

    console.log('[AgencyManagement] Solicitud para actualizar agencia', {
      method: 'PUT',
      url,
      body
    });

    return this.http.put<AgencyResponse>(url, body);
  }

  deleteAgency(codigo: string, operador: string): Observable<AgencyResponse> {
    const url = `${this.apiUrl}/${encodeURIComponent(codigo.trim())}`;
    const params = new HttpParams().set('operador', operador.trim().toUpperCase());

    console.log('[AgencyManagement] Solicitud para eliminar agencia', {
      method: 'DELETE',
      url,
      params: { operador: params.get('operador') }
    });

    return this.http.delete<AgencyResponse>(url, { params });
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
