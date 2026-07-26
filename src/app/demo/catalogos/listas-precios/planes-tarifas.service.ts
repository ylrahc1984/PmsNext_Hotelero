import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from 'src/environments/environment';

export interface PlanTarifaDTO {
  PlanID                  : number;
  NombrePlan              : string;
  TipoTarifa              : string;
  TipoTarifaDescripcion   : string;
  Activo                  : boolean;
  EstadoDescripcion       : string;
  PaginaActual            ?: number;
  TotalPaginas            ?: number;
  TotalRegistros          ?: number;
}

export interface PlanTarifaUI {
  planId                   : number;
  nombrePlan               : string;
  tipoTarifa               : string;
  tipoTarifaDescripcion    : string;
  activo                   : boolean;
  estadoDescripcion        : string;
}

export interface PlanesTarifasResponse {
  datos: PlanTarifaDTO[];
  paginacion?: {
    paginaActual              : number;
    registrosPorPagina        : number;
    totalRegistros            : number;
    totalPaginas              : number;
    tienePaginaSiguiente      : boolean;
    tienePaginaAnterior       : boolean;
  };
}

@Injectable({
  providedIn: 'root'
})
export class PlanesTarifasService {
  private apiUrl = `${environment.apiUrl}/planes-tarifas`;
  private http = inject(HttpClient);

  /**
   * Obtiene todos los planes de tarifas activos
   */
  getPlanesTarifas(pageNumber: number = 1, pageSize: number = 50): Observable<PlanTarifaUI[]> {
    const params = new HttpParams()
      .set('pageNumber', String(pageNumber))
      .set('pageSize', String(pageSize));

    return this.http.get<PlanesTarifasResponse>(this.apiUrl, { params }).pipe(
      map(response => {
        const datos = response?.datos ?? [];
        return datos
          .filter(plan => plan.Activo) // Solo planes activos
          .map(plan => this.mapFromApi(plan));
      })
    );
  }

  /**
   * Obtiene un plan específico por ID
   */
  getPlanById(planId: number): Observable<PlanTarifaUI | null> {
    return this.getPlanesTarifas(1, 100).pipe(
      map(planes => planes.find(p => p.planId === planId) || null)
    );
  }

  /**
   * Mapea del formato API al formato UI
   */
  private mapFromApi(dto: PlanTarifaDTO): PlanTarifaUI {
    return {
      planId                    : dto.PlanID,
      nombrePlan                : dto.NombrePlan,
      tipoTarifa                : dto.TipoTarifa,
      tipoTarifaDescripcion     : dto.TipoTarifaDescripcion,
      activo                    : dto.Activo,
      estadoDescripcion         : dto.EstadoDescripcion
    };
  }
}
