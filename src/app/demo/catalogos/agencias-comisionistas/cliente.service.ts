import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map } from 'rxjs/operators';
import { AuthService } from 'src/app/core/services/auth.service';
import { ClienteDto, ClientePost, ClienteUI } from './cliente.models';
import { environment } from 'src/environments/environment';

@Injectable({
  providedIn: 'root'
})
export class ClienteService {
  private apiUrl = `${environment.apiUrl}/cliente`;

  constructor(private http: HttpClient, private auth: AuthService) {}

  getClientes(pageNumber = 1, pageSize = 50, nombreCli?: string): Observable<{
    data: ClienteUI[];
    totalRegistros: number;
    paginaActual: number;
    pageSize: number;
    totalPages: number;
  }> {
    let params = new HttpParams().set('pageNumber', String(pageNumber)).set('pageSize', String(pageSize));
    if (nombreCli) {
      params = params.set('nombreCli', nombreCli);
    }
    return this.http.get<{ datos?: ClienteDto[]; paginacion?: any }>(this.apiUrl, { params }).pipe(
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

  getClienteByCodigo(codigo: string): Observable<ClienteUI | null> {
    const normalized = (codigo || '').trim();
    if (!normalized) {
      return of(null);
    }
    return this.http.get<{ datos?: ClienteDto[] }>(`${this.apiUrl}/${normalized}`).pipe(
      map((response) => {
        const item = response?.datos?.[0];
        return item ? this.mapFromApi(item) : null;
      })
    );
  }

  crearCliente(payload: ClientePost): Observable<{ respuesta?: string }> {
    const normalized = this.normalizePayload(payload, 1);
    return this.http.post(this.apiUrl, normalized, { responseType: 'text' }).pipe(map((res) => this.parseTextResponse(res)));
  }

  editarCliente(codigo: string, payload: ClientePost): Observable<{ respuesta?: string }> {
    const normalized = this.normalizePayload(payload, 2);
    
    return this.http.put( `${this.apiUrl}/${codigo}` , normalized, {responseType: 'text' }).pipe(map((res) => this.parseTextResponse(res)));
  }

  eliminarCliente(codigo: string): Observable<{ respuesta?: string }> {
    return this.http.delete(`${this.apiUrl}/${codigo}`, { responseType: 'text' }).pipe(map((res) => this.parseTextResponse(res)));
  }

  buildPayloadFromUI(value: Partial<ClienteUI>, proceso: number, pageNumber = 0, pageSize = 0): ClientePost {
    return this.normalizePayload(
      {
        proceso,
        codigo: value.codigo || '',
        nombreCli: value.nombre || '',
        ruc: value.ruc || '',
        contacto: value.contacto || '',
        direccion: value.direccion || '',
        provincia: value.provincia || '',
        ciudad: value.ciudad || '',
        pais: value.pais || '',
        zona: value.zona || '',
        email: value.email || '',
        telefono1: value.telefono1 || '',
        telefono2: value.telefono2 || '',
        fax: value.fax || '',
        tipoCli: value.tipoCli || 'AGE',
        mtoCredito: Number(value.mtoCredito || 0),
        idProvincia: value.idProvincia || '',
        idCanton: value.idCanton || '',
        idDistrito: value.idDistrito || '',
        tCliente: value.tCliente || '',
        enviarCorreo: value.enviarCorreo ?? false,
        operador: '',
        respuesta: '',
        pageNumber,
        pageSize
      },
      proceso
    );
  }

  private normalizePayload(payload: ClientePost, proceso: number): ClientePost {
    return {
      ...payload,
      proceso,
      operador: this.getOperador(),
      respuesta: ''
    };
  }

  private mapFromApi(apiData: ClienteDto): ClienteUI {
    const zona = (apiData.MPV00_Zona ?? apiData.MPV00_ZONA ?? '').trim();
    return {
      codigo: apiData.MPV00_CodClien,
      nombre: apiData.MPV00_NomClien,
      ruc: apiData.MPV00_RucClien,
      contacto: apiData.MPV00_Contacto,
      direccion: apiData.MPV00_DirClien,
      provincia: apiData.MPV00_PrvClien || '',
      ciudad: apiData.MPV00_CiuClien || '',
      pais: apiData.MPV00_PaiClien || '',
      zona,
      email: apiData.MPV00_Email,
      telefono1: apiData.MPV00_Te1Clien,
      telefono2: apiData.MPV00_Te2Clien,
      fax: apiData.MPV00_FaxClien || '',
      tipoCli: apiData.MPV00_TipClien,
      mtoCredito: apiData.MPV00_MtoCredito ?? 0,
      idProvincia: apiData.MPV00_IdProvincia || '',
      idCanton: apiData.MPV00_IdCanton || '',
      idDistrito: apiData.MPV00_IdDistrito || '',
      tCliente: (apiData.MPV00_TCliente || '').trim(),
      enviarCorreo: (apiData.MPV00_BanderaCorreo ?? 0) === 1
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
