import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map } from 'rxjs/operators';
import { AuthService } from 'src/app/core/services/auth.service';
import { environment } from 'src/environments/environment';

export interface ProveedorDto {
  MAC01_CodProve: string;
  MAC01_DescProve: string;
  MAC01_TipCedula: string;
  MAC01_Ruc: string;
  MAC01_Contacto: string;
  MAC01_Email: string;
  MAC01_Telefono1: string;
  MAC01_Telefono2: string;
  MAC01_Fax: string;
  MAC01_Direccion: string;
  MAC01_Ciudad: string;
  MAC01_Provincia: string;
  MAC01_Pais: string;
  MAC01_LimCredi: number;
  MAC01_BanProve: string;
  MAC01_CtaBanco: string;
  MAC01_CodTipo: string;
  CAC01_TipoProve: string;
  MAC01_Operador: string;
}

export interface ProveedorPost {
  proceso: number;
  codProve: string;
  descripcion: string;
  tipCedula: string;
  ruc: string;
  contacto: string;
  email: string;
  telefono1: string;
  telefono2: string;
  fax: string;
  direccion: string;
  ciudad: string;
  provincia: string;
  pais: string;
  limiteCre: number;
  banco: string;
  ctaBanco: string;
  codTipo: string;
  operador: string;
  pageNumber: number;
  pageSize: number;
  respuesta: string;
}

export interface ProveedorUI {
  codigo: string;
  descripcion: string;
  tipCedula: string;
  ruc: string;
  contacto: string;
  email: string;
  telefono1: string;
  telefono2: string;
  fax: string;
  direccion: string;
  ciudad: string;
  provincia: string;
  pais: string;
  limiteCre: number;
  banco: string;
  ctaBanco: string;
  codTipo: string;
  tipoProveedor: string;
}

@Injectable({
  providedIn: 'root'
})
export class ProveedorService {
  private apiUrl = `${environment.apiUrl}/proveedor`;

  constructor(private http: HttpClient, private auth: AuthService) {}

  getProveedores(
    pageNumber = 1,
    pageSize = 20,
    codProve?: string,
    descripcion?: string
  ): Observable<{
    data: ProveedorUI[];
    totalRegistros: number;
    paginaActual: number;
    pageSize: number;
    totalPages: number;
  }> {
    let params = new HttpParams().set('pageNumber', String(pageNumber)).set('pageSize', String(pageSize));
    if (codProve) {
      params = params.set('codProve', codProve);
    }
    if (descripcion) {
      params = params.set('descripcion', descripcion);
    }
    return this.http.get<{ datos?: ProveedorDto[]; paginacion?: any }>(this.apiUrl, { params }).pipe(
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

  getProveedorByCodigo(codProve: string): Observable<ProveedorUI | null> {
    const normalized = (codProve || '').trim();
    if (!normalized) {
      return of(null);
    }
    const params = new HttpParams().set('codProve', normalized).set('pageNumber', '1').set('pageSize', '50');
    return this.http.get<{ datos?: ProveedorDto[] }>(this.apiUrl, { params }).pipe(
      map((response) => {
        const item = response?.datos?.[0];
        return item ? this.mapFromApi(item) : null;
      })
    );
  }

  crearProveedor(payload: ProveedorPost): Observable<{ respuesta?: string }> {
    const normalized = this.normalizePayload(payload, 1);
    return this.http.post(this.apiUrl, normalized, { responseType: 'text' }).pipe(map((res) => this.parseTextResponse(res)));
  }

  editarProveedor(codProve: string, payload: ProveedorPost): Observable<{ respuesta?: string }> {
    const normalized = this.normalizePayload(payload, 2);
    
    return this.http.put( `${this.apiUrl}/${codProve}`, normalized, { responseType: 'text' }).pipe(map((res) => this.parseTextResponse(res)));

  }

  eliminarProveedor(codProve: string): Observable<{ respuesta?: string }> {
    
    return this.http.delete(`${this.apiUrl}/${codProve}`, { responseType: 'text' }).pipe(map((res) => this.parseTextResponse(res)));
  }

  buildPayloadFromUI(value: Partial<ProveedorUI>, proceso: number, pageNumber = 0, pageSize = 0): ProveedorPost {
    return this.normalizePayload(
      {
        proceso,
        codProve: value.codigo || '',
        descripcion: value.descripcion || '',
        tipCedula: value.tipCedula || '',
        ruc: value.ruc || '',
        contacto: value.contacto || '',
        email: value.email || '',
        telefono1: value.telefono1 || '',
        telefono2: value.telefono2 || '',
        fax: value.fax || '',
        direccion: value.direccion || '',
        ciudad: value.ciudad || '',
        provincia: value.provincia || '',
        pais: value.pais || '',
        limiteCre: Number(value.limiteCre || 0),
        banco: value.banco || '',
        ctaBanco: value.ctaBanco || '',
        codTipo: value.codTipo || '',
        operador: '',
        pageNumber,
        pageSize,
        respuesta: ''
      },
      proceso
    );
  }

  private normalizePayload(payload: ProveedorPost, proceso: number): ProveedorPost {
    return {
      ...payload,
      proceso,
      operador: this.getOperador(),
      respuesta: ''
    };
  }

  private mapFromApi(apiData: ProveedorDto): ProveedorUI {
    return {
      codigo: apiData.MAC01_CodProve,
      descripcion: apiData.MAC01_DescProve,
      tipCedula: apiData.MAC01_TipCedula,
      ruc: apiData.MAC01_Ruc,
      contacto: apiData.MAC01_Contacto,
      email: apiData.MAC01_Email,
      telefono1: apiData.MAC01_Telefono1,
      telefono2: apiData.MAC01_Telefono2,
      fax: apiData.MAC01_Fax,
      direccion: apiData.MAC01_Direccion,
      ciudad: apiData.MAC01_Ciudad,
      provincia: apiData.MAC01_Provincia,
      pais: apiData.MAC01_Pais,
      limiteCre: apiData.MAC01_LimCredi ?? 0,
      banco: apiData.MAC01_BanProve,
      ctaBanco: apiData.MAC01_CtaBanco,
      codTipo: apiData.MAC01_CodTipo,
      tipoProveedor: apiData.CAC01_TipoProve
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
