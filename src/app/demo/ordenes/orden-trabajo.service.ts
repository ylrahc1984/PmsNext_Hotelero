import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map, tap } from 'rxjs/operators';
import { environment } from 'src/environments/environment';

export interface OrdenTrabajoEstadoUI {
  codigo?: string;
  descripcion?: string;
}

export interface OrdenTrabajoUI {
  id?: number | string;
  codOT?: string;
  codReserva?: string;
  codSuplidor?: string;
  suplidor?: string;
  fechaServicio?: string;
  ruta?: string;
  rotulacion?: string;
  conexion?: string;
  kmInicial?: number;
  kmFinal?: number;
  kmRecorridos?: number | null;
  observaciones?: string;
  estado?: OrdenTrabajoEstadoUI;
  total?: number | null;
  moneda?: string;
  tCambio?: number;
  operador?: string;
  fechaRegistro?: string;
  codVehiculo?: string | null;
  codChofer?: string | null;
}

export interface OrdenTrabajoPaginacionUI {
  paginaActual: number;
  registrosPorPagina: number;
  totalRegistros: number;
  totalPaginas: number;
  tienePaginaAnterior: boolean;
  tienePaginaSiguiente: boolean;
}

export interface OrdenTrabajoListResult {
  datos: OrdenTrabajoUI[];
  paginacion: OrdenTrabajoPaginacionUI;
}

export interface OrdenTrabajoListQuery {
  codOT?: string;
  codReserva?: string;
  estado?: string;
  fechaInicio?: string;
  fechaFin?: string;
  nombreSuplidor?: string;
  pageNumber?: number;
  pageSize?: number;
}

export interface OrdenTrabajoApiItem {
  PRV10_CodOT?: string;
  PRV10_CodReserva?: string;
  PRV10_CodSuplidor?: string;
  MRV10_DescSuplidor?: string;
  PRV10_FecServicio?: string;
  PRV10_RutaCodigo?: string;
  PRV10_Rotulacion?: string;
  PRV10_Conexion?: string;
  PRV10_KmInicial?: number;
  PRV10_KmFinal?: number;
  KmRecorridos?: number;
  PRV10_Observaciones?: string;
  PRV10_Estado?: string;
  EstadoDescripcion?: string;
  PRV10_Moneda?: string;
  PRV10_TCambio?: number;
  PRV10_TotalOT?: number;
  PRV10_Operador?: string;
  PRV10_FechaRegistro?: string;
  PRV10_CodVehiculo?: any;
  PRV10_CodChofer?: any;
  PaginaActual?: number;
  TotalPaginas?: number;
  TotalRegistros?: number;
}

export interface OrdenTrabajoApiPaginacion {
  paginaActual?: number;
  registrosPorPagina?: number;
  totalRegistros?: number;
  totalPaginas?: number;
  tienePaginaSiguiente?: boolean;
  tienePaginaAnterior?: boolean;
}

export interface OrdenTrabajoApiResponse {
  datos?: OrdenTrabajoApiItem[];
  paginacion?: OrdenTrabajoApiPaginacion;
}

@Injectable({
  providedIn: 'root'
})
export class OrdenTrabajoService {
  private apiUrl = `${environment.apiUrl}/ordentrabajo`;
  private http = inject(HttpClient);

  getOrdenesTrabajo(query: OrdenTrabajoListQuery): Observable<OrdenTrabajoListResult> {
    const pageNumber = query.pageNumber ?? 1;
    const pageSize = query.pageSize ?? 20;

    let params = new HttpParams()
      .set('pageNumber', String(pageNumber))
      .set('pageSize', String(pageSize));
    
    params = this.setIfPresent(params, 'codOT', query.codOT);
    params = this.setIfPresent(params, 'codReserva', query.codReserva);
    params = this.setIfPresent(params, 'estado', query.estado);
    params = this.setIfPresent(params, 'fechaInicio', query.fechaInicio);
    params = this.setIfPresent(params, 'fechaFin', query.fechaFin);
    params = this.setIfPresent(params, 'nombreSuplidor', query.nombreSuplidor);

    return this.http.get<unknown>(this.apiUrl, { params }).pipe(
      tap({
        next: (response) => {
          if (!environment.production) {
            const qs = params.toString();
            const fullUrl = qs ? `${this.apiUrl}?${qs}` : this.apiUrl;
            console.log('🔍 [OrdenTrabajoService] GET Request');
            console.log('   URL:', fullUrl);
            console.log('   Query params:', {
              codOT: query.codOT,
              codReserva: query.codReserva,
              estado: query.estado,
              fechaInicio: query.fechaInicio,
              fechaFin: query.fechaFin,
              nombreSuplidor: query.nombreSuplidor,
              pageNumber,
              pageSize
            });
            console.log('   Raw response:', response);
          }
        },
        error: (error) => {
          if (!environment.production) {
            const qs = params.toString();
            const fullUrl = qs ? `${this.apiUrl}?${qs}` : this.apiUrl;
            console.error('❌ [OrdenTrabajoService] GET Error');
            console.error('   URL:', fullUrl);
            console.error('   Error:', error);
          }
        }
      }),
      map((response) => {
        const rec = this.asRecord(response) ?? {};
        const datosRaw = this.pick(rec, ['datos', 'Datos', 'data', 'items']);
        const datosArr = Array.isArray(datosRaw) ? datosRaw : [];
        const paginacionRaw = this.pick(rec, ['paginacion', 'Paginacion', 'pagination']);

        const datos = datosArr.map((item) => this.mapOrdenTrabajoFromApi(item));
        const fallbackItem = this.asRecord(datosArr[0]);
        const paginacion = this.mapPaginacionFromApi(paginacionRaw, pageNumber, pageSize, datosArr.length, fallbackItem);
        
        if (!environment.production) {
          console.log('✅ [OrdenTrabajoService] Datos mapeados:');
          console.log('   Total registros:', paginacion.totalRegistros);
          console.log('   Registros en página:', datos.length);
          console.log('   Datos:', datos);
        }
        
        return { datos, paginacion };
      })
    );
  }

  private setIfPresent(params: HttpParams, key: string, value?: string): HttpParams {
    const normalized = (value ?? '').toString().trim();
    if (!normalized) {
      return params;
    }
    return params.set(key, normalized);
  }

  private mapPaginacionFromApi(
    raw: unknown,
    pageNumber: number,
    pageSize: number,
    fallbackTotal: number,
    fallbackFromItem?: Record<string, unknown> | null
  ): OrdenTrabajoPaginacionUI {
    const rec = this.asRecord(raw) ?? {};
    const itemRec = fallbackFromItem ?? {};

    const totalRegistros = this.toNumberOrZero(
      this.pick(rec, ['totalRegistros', 'TotalRegistros', 'total', 'Total']) ??
        this.pick(itemRec, ['TotalRegistros', 'totalRegistros', 'Total', 'total']) ??
        fallbackTotal ??
        0
    );
    const paginaActual = this.toNumberOrZero(
      this.pick(rec, ['paginaActual', 'PaginaActual', 'pageNumber', 'PageNumber']) ??
        this.pick(itemRec, ['PaginaActual', 'paginaActual', 'PageNumber', 'pageNumber']) ??
        pageNumber
    );
    const registrosPorPagina = this.toNumberOrZero(
      this.pick(rec, ['registrosPorPagina', 'RegistrosPorPagina', 'pageSize', 'PageSize']) ?? pageSize
    );

    const totalPaginasRaw =
      this.pick(rec, ['totalPaginas', 'TotalPaginas', 'totalPages', 'TotalPages']) ??
      this.pick(itemRec, ['TotalPaginas', 'totalPaginas', 'TotalPages', 'totalPages']);
    const totalPaginas = this.toNumberOrZero(totalPaginasRaw) || (totalRegistros > 0 ? Math.ceil(totalRegistros / registrosPorPagina) : 1);

    const tienePaginaAnteriorExplicit = this.toBooleanOrUndefined(this.pick(rec, ['tienePaginaAnterior', 'TienePaginaAnterior']));
    const tienePaginaSiguienteExplicit = this.toBooleanOrUndefined(this.pick(rec, ['tienePaginaSiguiente', 'TienePaginaSiguiente']));
    const tienePaginaAnterior = tienePaginaAnteriorExplicit ?? paginaActual > 1;
    const tienePaginaSiguiente = tienePaginaSiguienteExplicit ?? paginaActual < totalPaginas;

    return {
      paginaActual,
      registrosPorPagina,
      totalRegistros,
      totalPaginas,
      tienePaginaAnterior,
      tienePaginaSiguiente
    };
  }

  private mapOrdenTrabajoFromApi(item: unknown): OrdenTrabajoUI {
    const rec = this.asRecord(item) ?? {};
    const estadoRaw = this.pick(rec, ['estado']);
    const estadoRec = this.asRecord(estadoRaw);
    const estadoObj: OrdenTrabajoEstadoUI = estadoRec
      ? {
          codigo: this.toStringOrUndefined(this.pick(estadoRec, ['codigo', 'cod', 'Codigo'])),
          descripcion: this.toStringOrUndefined(this.pick(estadoRec, ['descripcion', 'desc', 'Descripcion']))
        }
      : {
          codigo: this.toStringOrUndefined(this.pick(rec, ['estadoCodigo', 'codEstado', 'estado', 'PRV10_Estado', 'Estado'])),
          descripcion: this.toStringOrUndefined(this.pick(rec, ['estadoDescripcion', 'descEstado', 'EstadoDescripcion']))
        };

    const km =
      this.toNumberOrNull(this.pick(rec, ['KmRecorridos', 'kmRecorridos', 'kilometros', 'kms', 'km'])) ??
      this.computeKmFromApi(rec);
    const total = this.toNumberOrNull(this.pick(rec, ['PRV10_TotalOT', 'total', 'totalOT', 'montoTotal', 'importe', 'totalPagar']));

    return {
      id: this.pick(rec, ['id', 'Id', 'idOT', 'ordenTrabajoId']) as number | string | undefined,
      codOT: this.toStringOrUndefined(this.pick(rec, ['PRV10_CodOT', 'codOT', 'codOt', 'codigoOT', 'codigoOt', 'numeroOT', 'numeroOrden'])),
      codReserva: this.toStringOrUndefined(this.pick(rec, ['PRV10_CodReserva', 'codReserva', 'codigoReserva', 'reserva', 'reservaId'])),
      codSuplidor: this.toStringOrUndefined(this.pick(rec, ['PRV10_CodSuplidor', 'codSuplidor', 'codigoSuplidor'])),
      suplidor: this.toStringOrUndefined(
        this.pick(rec, ['MRV10_DescSuplidor', 'nombreSuplidor', 'suplidor', 'proveedor', 'nombreProveedor'])
      ),
      fechaServicio: this.toStringOrUndefined(this.pick(rec, ['PRV10_FecServicio', 'fechaServicio', 'fechaServ', 'fecha'])),
      ruta: this.toStringOrUndefined(this.pick(rec, ['PRV10_RutaCodigo', 'ruta', 'rutaConexion', 'rutaZona'])),
      rotulacion: this.toStringOrUndefined(this.pick(rec, ['PRV10_Rotulacion', 'rotulacion'])),
      conexion: this.toStringOrUndefined(this.pick(rec, ['PRV10_Conexion', 'conexion', 'conexión', 'conection'])),
      kmInicial: this.toNumberOrUndefined(this.pick(rec, ['PRV10_KmInicial', 'kmInicial', 'kmInicio'])),
      kmFinal: this.toNumberOrUndefined(this.pick(rec, ['PRV10_KmFinal', 'kmFinal'])),
      kmRecorridos: km,
      observaciones: this.toStringOrUndefined(this.pick(rec, ['PRV10_Observaciones', 'observaciones', 'obs', 'notas'])),
      estado: estadoObj,
      total,
      moneda: this.toStringOrUndefined(this.pick(rec, ['PRV10_Moneda', 'moneda', 'codMoneda', 'currency'])) ?? 'CRC',
      tCambio: this.toNumberOrUndefined(this.pick(rec, ['PRV10_TCambio', 'tCambio', 'tipoCambio'])) ?? 1,
      operador: this.toStringOrUndefined(this.pick(rec, ['PRV10_Operador', 'operador', 'usuario'])),
      fechaRegistro: this.toStringOrUndefined(this.pick(rec, ['PRV10_FechaRegistro', 'fechaRegistro', 'fechaCreacion', 'fechaCreada'])),
      codVehiculo: this.toStringOrNull(this.pick(rec, ['PRV10_CodVehiculo', 'codVehiculo', 'vehiculo'])),
      codChofer: this.toStringOrNull(this.pick(rec, ['PRV10_CodChofer', 'codChofer', 'chofer']))
    };
  }

  private asRecord(value: unknown): Record<string, unknown> | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null;
    }
    return value as Record<string, unknown>;
  }

  private pick(rec: Record<string, unknown>, keys: string[]): unknown {
    for (const key of keys) {
      if (key in rec) {
        return rec[key];
      }
    }
    return undefined;
  }

  private toStringOrUndefined(value: unknown): string | undefined {
    if (value === null || value === undefined) {
      return undefined;
    }
    const normalized = String(value).trim();
    return normalized ? normalized : undefined;
  }

  private toBooleanOrUndefined(value: unknown): boolean | undefined {
    if (value === null || value === undefined) {
      return undefined;
    }
    if (typeof value === 'boolean') {
      return value;
    }
    if (typeof value === 'number') {
      return value !== 0;
    }
    if (typeof value === 'string') {
      const v = value.trim().toLowerCase();
      if (v === 'true' || v === '1' || v === 'yes' || v === 'y' || v === 'si' || v === 'sí') {
        return true;
      }
      if (v === 'false' || v === '0' || v === 'no' || v === 'n') {
        return false;
      }
    }
    return Boolean(value);
  }

  private toNumberOrZero(value: unknown): number {
    if (value === null || value === undefined || value === '') {
      return 0;
    }
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }

  private toNumberOrNull(value: unknown): number | null {
    if (value === null || value === undefined || value === '') {
      return null;
    }
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }

  private toNumberOrUndefined(value: unknown): number | undefined {
    if (value === null || value === undefined || value === '') {
      return undefined;
    }
    const n = Number(value);
    return Number.isFinite(n) ? n : undefined;
  }

  private toStringOrNull(value: unknown): string | null {
    if (value === null || value === undefined) {
      return null;
    }
    // Si es un objeto vacío, retornar null
    if (typeof value === 'object' && Object.keys(value).length === 0) {
      return null;
    }
    const str = String(value).trim();
    return str ? str : null;
  }

  private computeKmFromApi(rec: Record<string, unknown>): number | null {
    const kmInicial = this.toNumberOrNull(this.pick(rec, ['PRV10_KmInicial', 'kmInicial']));
    const kmFinal = this.toNumberOrNull(this.pick(rec, ['PRV10_KmFinal', 'kmFinal']));
    if (kmInicial === null || kmFinal === null) {
      return null;
    }
    const diff = kmFinal - kmInicial;
    return Number.isFinite(diff) ? diff : null;
  }
}
