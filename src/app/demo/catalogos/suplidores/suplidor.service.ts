import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map } from 'rxjs/operators';
import { AuthService } from 'src/app/core/services/auth.service';
import { environment } from 'src/environments/environment';

export interface SuplidorDto {
  MRV10_CodSuplidor: string;
  MRV10_DescSuplidor: string;
  MRV10_TipCedula: string | Record<string, never>;
  MRV10_Ruc: string;
  MRV10_Contacto: string | Record<string, never>;
  MRV10_Email: string | Record<string, never>;
  MRV10_Telefono1: string | Record<string, never>;
  MRV10_Telefono2: string | Record<string, never>;
  MRV10_Direccion: string | Record<string, never>;
  MRV10_Ciudad: string | Record<string, never>;
  MRV10_Provincia: string | Record<string, never>;
  MRV10_Pais: string | Record<string, never>;
  MRV10_LimCredi: number | Record<string, never>;
  MRV10_BanSuplidor: string | Record<string, never>;
  MRV10_CtaBanco: string | Record<string, never>;
  MRV10_Estado: string;
  EstadoDescripcion?: string;
  MRV10_Operador: string;
  MRV10_FechaRegistro: string;
}

export interface SuplidorPost {
  proceso: number;
  codSuplidor: string;
  descripcion: string;
  tipCedula: string;
  ruc: string;
  contacto: string;
  email: string;
  telefono1: string;
  telefono2: string;
  direccion: string;
  ciudad: string;
  provincia: string;
  pais: string;
  limiteCre: number;
  banco: string;
  ctaBanco: string;
  estado: string;
  operador: string;
  pageNumber: number;
  pageSize: number;
  respuesta: string;
}

export interface SuplidorUI {
  codigo: string;
  descripcion: string;
  tipCedula: string;
  ruc: string;
  contacto: string;
  email: string;
  telefono1: string;
  telefono2: string;
  direccion: string;
  ciudad: string;
  provincia: string;
  pais: string;
  limiteCre: number;
  banco: string;
  ctaBanco: string;
  estado: string;
  operador: string;
  fechaReg: string;
}

// Interfaces para disponibilidad de suplidores (órdenes de trabajo)
export interface VehiculoDisponibilidadDto {
  MRV11_CodSuplidor: string;
  MRV11_CodVehiculo: string;
  MRV11_NombreUnidad: string;
  MRV11_TipoVehiculo: string;
  MRV11_Placa: string;
  MRV11_CapacidadMax: number;
  MRV11_Activo: boolean;
  PasajerosAsignados: number;
  CapacidadDisponible: number;
  PorcentajeOcupacion: number;
  Ocupado: number;
  NumOrdenesAsignadas: number;
}

export interface ChoferDisponibilidadDto {
  MRV12_CodSuplidor: string;
  MRV12_CodChofer: string;
  MRV12_NombreCompleto: string;
  MRV12_TipoLicencia: string;
  MRV12_Telefono: string;
  MRV12_Email: string;
  MRV12_Activo: boolean;
  Asignado: number;
  NumOrdenesAsignadas: number;
}

export interface SuplidorDisponibilidadDto {
  MRV10_CodSuplidor: string;
  MRV10_DescSuplidor: string;
  MRV10_Estado: string;
  TotalVehiculos: number;
  VehiculosActivos: number;
  CapacidadTotal: number;
  CapacidadOcupada: number;
  CapacidadDisponible: number;
  FechaConsulta: string;
  Vehiculos: VehiculoDisponibilidadDto[];
  Choferes: ChoferDisponibilidadDto[];
}

export interface VehiculoDisponibilidadUI {
  codigo: string;
  codSuplidor: string;
  nombre: string;
  tipo: string;
  placa: string;
  capacidadMax: number;
  activo: boolean;
  pasajerosAsignados: number;
  capacidadDisponible: number;
  porcentajeOcupacion: number;
  ocupado: boolean;
  numOrdenesAsignadas: number;
}

export interface ChoferDisponibilidadUI {
  codigo: string;
  codSuplidor: string;
  nombre: string;
  tipoLicencia: string;
  telefono: string;
  email: string;
  activo: boolean;
  asignado: boolean;
  numOrdenesAsignadas: number;
}

export interface SuplidorDisponibilidadUI {
  codigo: string;
  nombre: string;
  estado: string;
  totalVehiculos: number;
  vehiculosActivos: number;
  capacidadTotal: number;
  capacidadOcupada: number;
  capacidadDisponible: number;
  fechaConsulta: string;
  vehiculos: VehiculoDisponibilidadUI[];
  choferes: ChoferDisponibilidadUI[];
  // Estado calculado para UI
  estadoOcupacion: 'sin-asignar' | 'parcial' | 'completo';
}

@Injectable({
  providedIn: 'root'
})
export class SuplidorService {
  private apiUrl = `${environment.apiUrl}/suplidor`;

  constructor(private http: HttpClient, private auth: AuthService) {}

  getSuplidores(
    pageNumber = 1,
    pageSize = 20,
    descripcion?: string
  ): Observable<{
    data: SuplidorUI[];
    totalRegistros: number;
    paginaActual: number;
    pageSize: number;
    totalPages: number;
  }> {
    let params = new HttpParams().set('pageNumber', String(pageNumber)).set('pageSize', String(pageSize));
    if (descripcion) {
      params = params.set('descripcion', descripcion);
    }
    return this.http.get<{ datos?: SuplidorDto[]; paginacion?: any }>(this.apiUrl, { params }).pipe(
      map((response) => {
        const data = (response?.datos ?? []).map((item) => this.mapFromApi(item));
        const paginacion = response?.paginacion;
        const totalRegistros = paginacion?.totalRegistros ?? data.length;
        const paginaActual = paginacion?.paginaActual ?? pageNumber;
        const size = paginacion?.pageSize ?? pageSize;
        const totalPages = totalRegistros > 0 ? Math.ceil(totalRegistros / size) : 1;
        return { data, totalRegistros, paginaActual, pageSize: size, totalPages };
      })
    );
  }

  getSuplidorByCodigo(codSuplidor: string): Observable<SuplidorUI | null> {
    const normalized = (codSuplidor || '').trim();
    if (!normalized) {
      return of(null);
    }
    return this.http.get<SuplidorDto[]>(`${this.apiUrl}/por-codigo/${normalized}`).pipe(
      map((items) => {
        const item = items && items.length > 0 ? items[0] : null;
        return item ? this.mapFromApi(item) : null;
      })
    );
  }

  crearSuplidor(payload: SuplidorPost): Observable<{ respuesta?: string }> {
    const normalized = this.normalizePayload(payload, 1);
    return this.http.post(this.apiUrl, normalized, { responseType: 'text' }).pipe(map((res) => this.parseTextResponse(res)));
  }

  editarSuplidor(codSuplidor: string, payload: SuplidorPost): Observable<{ respuesta?: string }> {
    const normalized = this.normalizePayload(payload, 2);
    normalized.codSuplidor = codSuplidor;
    return this.http.put(`${this.apiUrl}/${codSuplidor}`, normalized, { responseType: 'text' }).pipe(map((res) => this.parseTextResponse(res)));
  }

  eliminarSuplidor(codSuplidor: string): Observable<{ respuesta?: string }> {
    return this.http.delete(`${this.apiUrl}/${codSuplidor}`, { responseType: 'text' }).pipe(map((res) => this.parseTextResponse(res)));
  }

  getDisponibilidad(fecha: string, codSuplidor?: string): Observable<SuplidorDisponibilidadUI[]> {
    let params = new HttpParams().set('fecha', fecha);
    if (codSuplidor) {
      params = params.set('codSuplidor', codSuplidor);
    }
    
    return this.http.get<{ datos?: SuplidorDisponibilidadDto[] }>(`${this.apiUrl}/disponibilidad`, { params }).pipe(
      map((response) => {
        const datos = response?.datos ?? [];
        // Filtrar suplidores sin vehículos
        return datos
          .filter(suplidor => suplidor.TotalVehiculos > 0 && suplidor.VehiculosActivos > 0)
          .map((suplidor) => this.mapDisponibilidadFromApi(suplidor));
      })
    );
  }

  buildPayloadFromUI(value: Partial<SuplidorUI>, proceso: number, pageNumber = 0, pageSize = 0): SuplidorPost {
    return this.normalizePayload(
      {
        proceso,
        codSuplidor: value.codigo || '',
        descripcion: value.descripcion || '',
        tipCedula: value.tipCedula || '',
        ruc: value.ruc || '',
        contacto: value.contacto || '',
        email: value.email || '',
        telefono1: value.telefono1 || '',
        telefono2: value.telefono2 || '',
        direccion: value.direccion || '',
        ciudad: value.ciudad || '',
        provincia: value.provincia || '',
        pais: value.pais || '',
        limiteCre: Number(value.limiteCre || 0),
        banco: value.banco || '',
        ctaBanco: value.ctaBanco || '',
        estado: value.estado || 'ACT',
        operador: '',
        pageNumber,
        pageSize,
        respuesta: ''
      },
      proceso
    );
  }

  private normalizePayload(payload: SuplidorPost, proceso: number): SuplidorPost {
    return {
      ...payload,
      proceso,
      operador: this.getOperador(),
      respuesta: ''
    };
  }

  private mapFromApi(apiData: SuplidorDto): SuplidorUI {
    return {
      codigo: apiData.MRV10_CodSuplidor,
      descripcion: apiData.MRV10_DescSuplidor,
      tipCedula: this.normalizeValue(apiData.MRV10_TipCedula),
      ruc: apiData.MRV10_Ruc,
      contacto: this.normalizeValue(apiData.MRV10_Contacto),
      email: this.normalizeValue(apiData.MRV10_Email),
      telefono1: this.normalizeValue(apiData.MRV10_Telefono1),
      telefono2: this.normalizeValue(apiData.MRV10_Telefono2),
      direccion: this.normalizeValue(apiData.MRV10_Direccion),
      ciudad: this.normalizeValue(apiData.MRV10_Ciudad),
      provincia: this.normalizeValue(apiData.MRV10_Provincia),
      pais: this.normalizeValue(apiData.MRV10_Pais),
      limiteCre: this.normalizeNumber(apiData.MRV10_LimCredi),
      banco: this.normalizeValue(apiData.MRV10_BanSuplidor),
      ctaBanco: this.normalizeValue(apiData.MRV10_CtaBanco),
      estado: apiData.MRV10_Estado,
      operador: apiData.MRV10_Operador,
      fechaReg: apiData.MRV10_FechaRegistro
    };
  }

  private normalizeValue(value: string | Record<string, never> | null | undefined): string {
    if (!value || typeof value !== 'string') {
      return '';
    }
    return value;
  }

  private normalizeNumber(value: number | Record<string, never> | null | undefined): number {
    if (typeof value === 'number') {
      return value;
    }
    return 0;
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

  private mapDisponibilidadFromApi(apiData: SuplidorDisponibilidadDto): SuplidorDisponibilidadUI {
    const vehiculos = apiData.Vehiculos
      .filter(v => v.MRV11_Activo)
      .map(v => ({
        codigo: v.MRV11_CodVehiculo,
        codSuplidor: v.MRV11_CodSuplidor,
        nombre: v.MRV11_NombreUnidad,
        tipo: v.MRV11_TipoVehiculo,
        placa: v.MRV11_Placa,
        capacidadMax: v.MRV11_CapacidadMax,
        activo: v.MRV11_Activo,
        pasajerosAsignados: v.PasajerosAsignados,
        capacidadDisponible: v.CapacidadDisponible,
        porcentajeOcupacion: v.PorcentajeOcupacion,
        ocupado: v.Ocupado === 1,
        numOrdenesAsignadas: v.NumOrdenesAsignadas
      }));

    const choferes = apiData.Choferes
      .filter(c => c.MRV12_Activo)
      .map(c => ({
        codigo: c.MRV12_CodChofer,
        codSuplidor: c.MRV12_CodSuplidor,
        nombre: c.MRV12_NombreCompleto,
        tipoLicencia: c.MRV12_TipoLicencia,
        telefono: c.MRV12_Telefono,
        email: c.MRV12_Email,
        activo: c.MRV12_Activo,
        asignado: c.Asignado === 1,
        numOrdenesAsignadas: c.NumOrdenesAsignadas
      }));

    // Calcular estado de ocupación
    let estadoOcupacion: 'sin-asignar' | 'parcial' | 'completo' = 'sin-asignar';
    if (apiData.CapacidadOcupada === 0) {
      estadoOcupacion = 'sin-asignar';
    } else if (apiData.CapacidadOcupada >= apiData.CapacidadTotal) {
      estadoOcupacion = 'completo';
    } else {
      estadoOcupacion = 'parcial';
    }

    return {
      codigo: apiData.MRV10_CodSuplidor,
      nombre: apiData.MRV10_DescSuplidor,
      estado: apiData.MRV10_Estado,
      totalVehiculos: apiData.TotalVehiculos,
      vehiculosActivos: apiData.VehiculosActivos,
      capacidadTotal: apiData.CapacidadTotal,
      capacidadOcupada: apiData.CapacidadOcupada,
      capacidadDisponible: apiData.CapacidadDisponible,
      fechaConsulta: apiData.FechaConsulta,
      vehiculos,
      choferes,
      estadoOcupacion
    };
  }

  private getOperador(): string {
    return this.auth.getCurrentUser()?.usuario ?? '';
  }
}
