import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, catchError, map, of } from 'rxjs';

import { normalizePmsDateDDMMYYYY } from 'src/app/core/utils/pms-date.util';
import { ClienteService, SelectOption } from 'src/app/demo/catalogos/agencias-comisionistas/cliente.service';
import { environment } from 'src/environments/environment';
import { MealPlan } from '../../settings/meal-plans/models/meal-plan.model';
import { MealPlansService } from '../../settings/meal-plans/services/meal-plans.service';
import { Nationality } from '../../settings/nationalities/models/nationality.model';
import { NationalitiesService } from '../../settings/nationalities/services/nationalities.service';
import { PaxType } from '../../settings/pax-types/models/pax-type.model';
import { PaxTypesService } from '../../settings/pax-types/services/pax-types.service';
import { WalkInAgenciaOption, WalkInAgenciaPage, WalkInOption, WalkInSavePayload, WalkInTarifaOption } from '../models/walk-in.model';

interface AgenciaApiDto {
  MR01_CodAgencia     ?: string;
  MR01_Ruc            ?: string;
  MR01_NomAgencia     ?: string;
  MR01_Ciudad         ?: string;
  MR01_Pais           ?: string;
  MR01_Contacto       ?: string;
  MR01_Telefono1      ?: string;
  MR01_Email          ?: string;
  MR01_Mercado        ?: string;
  MR01_Activo         ?: number | boolean;
}

interface AgenciaApiPageResponse {
  datos             ?: AgenciaApiDto[];
  totalRegistros    ?: number;
  paginaActual      ?: number;
  tamanoPagina      ?: number;
  totalPaginas      ?: number;
}

interface TarifaReservaApiDto {
  MR03_CodTarifa      ?: string;
  MR03_NomTarifa      ?: string;
  MR03_Moneda         ?: string;
  MR03_FecInicial     ?: string;
  MR03_FecFin         ?: string;
  MR03_Activo         ?: number | boolean;
  MR03_Operador       ?: string;
}

export interface WalkInTarifaAlimento {
  codServ: string;
  descSrv: string;
  codTarifa: string;
  codPlan: string;
  tipPax: string;
  moneda: string;
  impInc: number;
  area: string;
  precio: number;
  impInclu: number;
}

@Injectable({ providedIn: 'root' })
export class WalkInService {
  private readonly http                       = inject(HttpClient);
  private readonly clienteService             = inject(ClienteService);
  private readonly nationalitiesService       = inject(NationalitiesService);
  private readonly paxTypesService            = inject(PaxTypesService);
  private readonly mealPlansService           = inject(MealPlansService);
  private readonly agenciaUrl                 = `${(environment.apiUrl ?? '').toString().replace(/\/+$/, '')}/agencia`;
  private readonly tarifaReservaUrl           = `${(environment.apiUrl ?? '').toString().replace(/\/+$/, '')}/tarifa-reserva`;
  private readonly reservasHabitacionUrl      = `${(environment.apiUrl ?? '').toString().replace(/\/+$/, '')}/reservas-habitacion`;
  private readonly walkInUrl                  = `${(environment.apiUrl ?? '').toString().replace(/\/+$/, '')}/walkin`;

  private readonly demoPlanes: WalkInOption[] = [
    { codigo: 'SPL', descripcion: 'Sin plan de alimentacion' },
    { codigo: 'DYN', descripcion: 'Desayuno incluido' },
    { codigo: 'FUL', descripcion: 'Full plan' }
  ];

  createWalkIn(payload: WalkInSavePayload): Observable<unknown> {
    const normalizedPayload = this.normalizeWalkInPayload(payload);
    console.groupCollapsed('[WalkInService] POST /walkin');
    console.log('URL:', this.walkInUrl);
    console.log('Payload:', JSON.parse(JSON.stringify(normalizedPayload)));
    console.groupEnd();

    return this.http.post<unknown>(this.walkInUrl, normalizedPayload);
  }

  getTiposDocumento(): Observable<WalkInOption[]> {
    return this.clienteService
      .getTipoIdentificacionOptions()
      .pipe(map((options: SelectOption[]) => options.map((item) => ({ codigo: String(item.value), descripcion: item.label }))));
  }

  getNacionalidades(): Observable<Nationality[]> {
    return this.nationalitiesService.getNationalities();
  }

  getTiposPax(): Observable<PaxType[]> {
    return this.paxTypesService.getPaxTypes();
  }

  getPlanes(): Observable<WalkInOption[]> {
    return this.mealPlansService
      .getMealPlans()
      .pipe(
        map((planes) => {
          const mappedPlanes = planes
            .map((plan) => this.mapMealPlan(plan))
            .filter((plan) => plan.codigo)
            .sort((a, b) => a.orden - b.orden || a.descripcion.localeCompare(b.descripcion))
            .map(({ codigo, descripcion }) => ({ codigo, descripcion }));
          return mappedPlanes.length > 0 ? mappedPlanes : this.demoPlanes;
        }),
        catchError(() => of(this.demoPlanes))
      );
  }

  getTarifaAlimentos(codTarifa: string, codPlan: string): Observable<WalkInTarifaAlimento[]> {
    const params = new HttpParams().set('codTarifa', codTarifa.trim()).set('codPlan', codPlan.trim());

    return this.http
      .get<WalkInTarifaAlimento[] | { datos?: WalkInTarifaAlimento[]; data?: WalkInTarifaAlimento[] }>(
        `${this.reservasHabitacionUrl}/tarifa-alimentos`,
        { params }
      )
      .pipe(map((response) => this.normalizeTarifaAlimentosResponse(response)));
  }

  searchAgencias(term: string): Observable<WalkInAgenciaOption[]> {
    const sanitizedTerm = term.trim();
    if (sanitizedTerm.length < 2) {
      return this.getAgenciasPaginadas(1, 8).pipe(
        map((response) => response.datos),
        catchError(() => of([]))
      );
    }

    return this.buscarAgenciasPorNombre(sanitizedTerm, 1, 50).pipe(
      map((response) => response.datos.slice(0, 8)),
      catchError(() => of([]))
    );
  }

  getAgenciasPaginadas(pageNumber = 1, pageSize = 10): Observable<WalkInAgenciaPage> {
    const params = new HttpParams().set('pageNumber', pageNumber).set('pageSize', pageSize);

    return this.http
      .get<AgenciaApiPageResponse>(`${this.agenciaUrl}/paginado`, { params })
      .pipe(map((response) => this.mapAgenciaPage(response, pageNumber, pageSize)));
  }

  buscarAgenciasPorNombre(nombre: string, pageNumber = 1, pageSize = 50): Observable<WalkInAgenciaPage> {
    const params = new HttpParams().set('nombre', nombre.trim()).set('pageNumber', pageNumber).set('pageSize', pageSize);

    return this.http
      .get<AgenciaApiPageResponse>(`${this.agenciaUrl}/buscar`, { params })
      .pipe(map((response) => this.mapAgenciaPage(response, pageNumber, pageSize)));
  }

  searchTarifas(term: string): Observable<WalkInTarifaOption[]> {
    const sanitizedTerm = term.trim();

    return this.getTarifasReserva().pipe(
      map((items) => this.filterTarifas(items, sanitizedTerm).slice(0, 8)),
      catchError(() => of([]))
    );
  }

  getTarifasReserva(): Observable<WalkInTarifaOption[]> {
    return this.http
      .get<TarifaReservaApiDto[] | { datos?: TarifaReservaApiDto[] }>(this.tarifaReservaUrl)
      .pipe(map((response) => this.normalizeTarifasResponse(response).map((item) => this.mapTarifa(item))));
  }

  private mapAgenciaPage(response: AgenciaApiPageResponse, pageNumber: number, pageSize: number): WalkInAgenciaPage {
    const datos = Array.isArray(response?.datos) ? response.datos.map((item) => this.mapAgencia(item)) : [];
    const totalRegistros = Number(response?.totalRegistros ?? datos.length);
    const tamanoPagina = Number(response?.tamanoPagina ?? pageSize);
    const totalPaginas = Number(response?.totalPaginas ?? Math.ceil(totalRegistros / Math.max(tamanoPagina, 1)));

    return {
      datos,
      totalRegistros,
      paginaActual: Number(response?.paginaActual ?? pageNumber),
      tamanoPagina,
      totalPaginas
    };
  }

  private mapAgencia(item: AgenciaApiDto): WalkInAgenciaOption {
    const codigo = String(item.MR01_CodAgencia ?? '').trim();
    const descripcion = String(item.MR01_NomAgencia ?? codigo).trim();

    return {
      codigo          ,
      descripcion     ,
      email           : String(item.MR01_Email ?? '').trim(),
      ruc             : String(item.MR01_Ruc ?? '').trim(),
      contacto        : String(item.MR01_Contacto ?? '').trim(),
      telefono        : String(item.MR01_Telefono1 ?? '').trim(),
      ciudad          : String(item.MR01_Ciudad ?? '').trim(),
      pais            : String(item.MR01_Pais ?? '').trim(),
      mercado         : String(item.MR01_Mercado ?? '').trim(),
      activo          : item.MR01_Activo === true || Number(item.MR01_Activo ?? 0) === 1
    };
  }

  private normalizeTarifasResponse(response: TarifaReservaApiDto[] | { datos?: TarifaReservaApiDto[] }): TarifaReservaApiDto[] {
    if (Array.isArray(response)) return response;
    return Array.isArray(response?.datos) ? response.datos : [];
  }

  private mapTarifa(item: TarifaReservaApiDto): WalkInTarifaOption {
    const codigo = String(item.MR03_CodTarifa ?? '').trim();
    const descripcion = String(item.MR03_NomTarifa ?? codigo).trim();

    return {
      codigo          ,
      descripcion     ,
      moneda          : String(item.MR03_Moneda ?? '').trim(),
      tarifaNoche     : 0,
      fechaInicial    : normalizePmsDateDDMMYYYY(item.MR03_FecInicial),
      fechaFinal      : normalizePmsDateDDMMYYYY(item.MR03_FecFin),
      activo          : item.MR03_Activo === true || Number(item.MR03_Activo ?? 0) === 1,
      operador        : String(item.MR03_Operador ?? '').trim()
    };
  }

  private mapMealPlan(plan: MealPlan): WalkInOption & { orden: number } {
    return {
      codigo: String(plan.MR06_CodPlan ?? '').trim(),
      descripcion: String(plan.MR06_PlanAlimenticio ?? '').trim(),
      orden: Number(plan.MR06_Orden ?? 0)
    };
  }

  private normalizeTarifaAlimentosResponse(
    response: WalkInTarifaAlimento[] | { datos?: WalkInTarifaAlimento[]; data?: WalkInTarifaAlimento[] } | null | undefined
  ): WalkInTarifaAlimento[] {
    if (Array.isArray(response)) {
      return response;
    }

    if (Array.isArray(response?.datos)) {
      return response.datos;
    }

    return Array.isArray(response?.data) ? response.data : [];
  }

  filterTarifas(items: WalkInTarifaOption[], term: string): WalkInTarifaOption[] {
    const normalizedTerm = term.trim().toLowerCase();
    if (!normalizedTerm) return items;

    return items.filter((item) =>
      [item.codigo, item.descripcion, item.moneda, item.operador].join(' ').toLowerCase().includes(normalizedTerm)
    );
  }

  private normalizeWalkInPayload(payload: WalkInSavePayload): WalkInSavePayload {
    return {
      ...payload,
      fecIngreso: normalizePmsDateDDMMYYYY(payload.fecIngreso),
      fecSalida: normalizePmsDateDDMMYYYY(payload.fecSalida),
      fecCreacion: normalizePmsDateDDMMYYYY(payload.fecCreacion),
      fecConfirma: normalizePmsDateDDMMYYYY(payload.fecConfirma),
      fecPrepago: normalizePmsDateDDMMYYYY(payload.fecPrepago),
      fecAnulada: normalizePmsDateDDMMYYYY(payload.fecAnulada),
      detRoom: payload.detRoom.map((guest) => ({ ...guest, fecNaci: normalizePmsDateDDMMYYYY(guest.fecNaci) }))
    };
  }
}
