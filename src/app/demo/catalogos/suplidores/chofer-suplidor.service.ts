import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map } from 'rxjs/operators';
import { AuthService } from 'src/app/core/services/auth.service';
import { environment } from 'src/environments/environment';

export interface ChoferSuplidorDto {
  MRV12_CodChofer: string;
  MRV12_CodSuplidor: string;
  MRV12_NombreCompleto: string;
  MRV12_TipoLicencia: string;
  MRV12_Telefono: string;
  MRV12_Email: string;
  MRV12_Activo: boolean;
  MRV12_Observaciones?: string;
  MRV12_Operador: string;
  MRV12_FechaRegistro: string;
  RowNum?: number;
}

export interface ChoferSuplidorUI {
  codigo: string;
  codSuplidor: string;
  nombre: string;
  tipoLicencia: string;
  telefono: string;
  email: string;
  estado: string;
  observaciones: string;
  operador: string;
  fechaReg: string;
}

export interface ChoferSuplidorPost {
  tipo: number;
  codChofer: string;
  codSuplidor: string;
  nombreCompleto: string;
  tipoLicencia: string;
  telefono: string;
  email: string;
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
export class ChoferSuplidorService {
  private apiUrl = `${environment.apiUrl}/chofer-suplidor`;

  constructor(private http: HttpClient, private auth: AuthService) {}

  getChoferes(
    codSuplidor: string,
    pageNumber = 1,
    pageSize = 20,
    descripcion?: string
  ): Observable<{
    data: ChoferSuplidorUI[];
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

    return this.http.get<{ datos?: ChoferSuplidorDto[]; paginacion?: any }>(this.apiUrl, { params }).pipe(
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

  getChoferByCodigo(codChofer: string): Observable<ChoferSuplidorUI | null> {
    const normalized = (codChofer || '').trim();
    if (!normalized) {
      return of(null);
    }
    return this.http.get<ChoferSuplidorDto[]>(`${this.apiUrl}/${normalized}`).pipe(
      map((items) => {
        const item = items && items.length > 0 ? items[0] : null;
        return item ? this.mapFromApi(item) : null;
      })
    );
  }

  crearChofer(payload: ChoferSuplidorPost): Observable<{ respuesta?: string }> {
    const normalized = this.normalizePayload(payload, 1);
    // POST no necesita codChofer en URL, se genera en BD
    normalized.codChofer = '';
    return this.http.post(this.apiUrl, normalized, { responseType: 'text' }).pipe(
      map((res) => this.parseTextResponse(res))
    );
  }

  editarChofer(codChofer: string, payload: ChoferSuplidorPost): Observable<{ respuesta?: string }> {
    const normalized = this.normalizePayload(payload, 2);
    // PUT envía codChofer en el body y en la ruta
    normalized.codChofer = codChofer;
    return this.http.put(`${this.apiUrl}/${encodeURIComponent(codChofer)}`, normalized, { responseType: 'text' }).pipe(
      map((res) => this.parseTextResponse(res))
    );
  }

  eliminarChofer(codChofer: string): Observable<{ respuesta?: string }> {
    return this.http.delete(`${this.apiUrl}/${codChofer}`, { responseType: 'text' }).pipe(
      map((res) => this.parseTextResponse(res))
    );
  }

  buildPayloadFromUI(value: Partial<ChoferSuplidorUI>, tipo: number): ChoferSuplidorPost {
    return this.normalizePayload(
      {
        tipo,
        codChofer: value.codigo || '',
        codSuplidor: value.codSuplidor || '',
        nombreCompleto: value.nombre || '',
        tipoLicencia: value.tipoLicencia || '',
        telefono: value.telefono || '',
        email: value.email || '',
        activo: value.estado === 'ACT',
        observaciones: value.observaciones || '',
        operador: '',
        descripcion: value.nombre || '',
        pageNumber: 0,
        pageSize: 0,
        respuesta: ''
      },
      tipo
    );
  }

  private normalizePayload(payload: ChoferSuplidorPost, tipo: number): ChoferSuplidorPost {
    return {
      ...payload,
      tipo,
      operador: this.getOperador(),
      respuesta: ''
    };
  }

  private mapFromApi(apiData: ChoferSuplidorDto): ChoferSuplidorUI {
    return {
      codigo: apiData.MRV12_CodChofer,
      codSuplidor: apiData.MRV12_CodSuplidor,
      nombre: apiData.MRV12_NombreCompleto,
      tipoLicencia: apiData.MRV12_TipoLicencia || '',
      telefono: apiData.MRV12_Telefono || '',
      email: apiData.MRV12_Email || '',
      estado: apiData.MRV12_Activo ? 'ACT' : 'INA',
      observaciones: apiData.MRV12_Observaciones || '',
      operador: apiData.MRV12_Operador,
      fechaReg: apiData.MRV12_FechaRegistro
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

  private getOperador(): string {
    return this.auth.getCurrentUser()?.usuario ?? '';
  }
}
