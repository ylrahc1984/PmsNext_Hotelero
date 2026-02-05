import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map } from 'rxjs/operators';
import { AuthService } from 'src/app/core/services/auth.service';
import { environment } from 'src/environments/environment';

export interface VehiculoSuplidorDto {
  MRV11_CodVehiculo: string;
  MRV11_CodSuplidor: string;
  MRV11_NombreUnidad: string;
  MRV11_TipoVehiculo: string;
  MRV11_Placa: string;
  MRV11_CapacidadMax: number;
  MRV11_Activo: boolean;
  MRV11_Observaciones?: string;
  MRV11_Operador: string;
  MRV11_FechaRegistro: string;
  RowNum?: number;
}

export interface VehiculoSuplidorUI {
  codigo: string;
  codSuplidor: string;
  descripcion: string;
  placa: string;
  capacidad: number;
  tipoVehiculo: string;
  estado: string;
  observaciones: string;
  operador: string;
  fechaReg: string;
}

export interface VehiculoSuplidorPost {
  tipo: number;
  codVehiculo: string;
  codSuplidor: string;
  nombreUnidad: string;
  tipoVehiculo: string;
  placa: string;
  capacidadMax: number;
  activo: boolean;
  observaciones: string;
  operador: string;
  descripcion: string;
  pageNumber: number;
  pageSize: number;
  respuesta: string;
}

@Injectable({
  providedIn: 'root'
})
export class VehiculoSuplidorService {
  private apiUrl = `${environment.apiUrl}/vehiculo-suplidor`;

  constructor(private http: HttpClient, private auth: AuthService) {}

  getVehiculos(
    codSuplidor: string,
    pageNumber = 1,
    pageSize = 20,
    descripcion?: string
  ): Observable<{
    data: VehiculoSuplidorUI[];
    totalRegistros: number;
    paginaActual: number;
    pageSize: number;
    totalPages: number;
  }> {
    let params = new HttpParams()
      .set('codSuplidor', codSuplidor)
      .set('pageNumber', String(pageNumber))
      .set('pageSize', String(pageSize));
    
    if (descripcion) {
      params = params.set('descripcion', descripcion);
    }

    return this.http.get<{ datos?: VehiculoSuplidorDto[]; paginacion?: any }>(this.apiUrl, { params }).pipe(
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

  getVehiculoByCodigo(codVehiculo: string): Observable<VehiculoSuplidorUI | null> {
    const normalized = (codVehiculo || '').trim();
    if (!normalized) {
      return of(null);
    }
    return this.http.get<VehiculoSuplidorDto[]>(`${this.apiUrl}/${normalized}`).pipe(
      map((items) => {
        const item = items && items.length > 0 ? items[0] : null;
        return item ? this.mapFromApi(item) : null;
      })
    );
  }

  crearVehiculo(payload: VehiculoSuplidorPost): Observable<{ respuesta?: string }> {
    const normalized = this.normalizePayload(payload, 1);
    // POST no necesita codVehiculo en URL, se genera en BD
    normalized.codVehiculo = '';
    return this.http.post(this.apiUrl, normalized, { responseType: 'text' }).pipe(
      map((res) => this.parseTextResponse(res))
    );
  }

  editarVehiculo(codVehiculo: string, payload: VehiculoSuplidorPost): Observable<{ respuesta?: string }> {
    const normalized = this.normalizePayload(payload, 2);
    // PUT envía codVehiculo en el body
    normalized.codVehiculo = codVehiculo;
    return this.http.put(this.apiUrl, normalized, { responseType: 'text' }).pipe(
      map((res) => this.parseTextResponse(res))
    );
  }

  eliminarVehiculo(codVehiculo: string): Observable<{ respuesta?: string }> {
    return this.http.delete(`${this.apiUrl}/${codVehiculo}`, { responseType: 'text' }).pipe(
      map((res) => this.parseTextResponse(res))
    );
  }

  buildPayloadFromUI(value: Partial<VehiculoSuplidorUI>, tipo: number): VehiculoSuplidorPost {
    return this.normalizePayload(
      {
        tipo,
        codVehiculo: value.codigo || '',
        codSuplidor: value.codSuplidor || '',
        nombreUnidad: value.descripcion || '',
        tipoVehiculo: value.tipoVehiculo || '',
        placa: value.placa || '',
        capacidadMax: Number(value.capacidad || 0),
        activo: value.estado === 'ACT',
        observaciones: value.observaciones || '',
        operador: '',
        descripcion: value.descripcion || '',
        pageNumber: 0,
        pageSize: 0,
        respuesta: ''
      },
      tipo
    );
  }

  private normalizePayload(payload: VehiculoSuplidorPost, tipo: number): VehiculoSuplidorPost {
    return {
      ...payload,
      tipo,
      operador: this.getOperador(),
      respuesta: ''
    };
  }

  private mapFromApi(apiData: VehiculoSuplidorDto): VehiculoSuplidorUI {
    return {
      codigo: apiData.MRV11_CodVehiculo,
      codSuplidor: apiData.MRV11_CodSuplidor,
      descripcion: apiData.MRV11_NombreUnidad,
      placa: apiData.MRV11_Placa,
      capacidad: apiData.MRV11_CapacidadMax,
      tipoVehiculo: apiData.MRV11_TipoVehiculo || '',
      estado: apiData.MRV11_Activo ? 'ACT' : 'INA',
      observaciones: apiData.MRV11_Observaciones || '',
      operador: apiData.MRV11_Operador,
      fechaReg: apiData.MRV11_FechaRegistro
    };
  }

  private parseTextResponse(response: string): { respuesta?: string } {
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
