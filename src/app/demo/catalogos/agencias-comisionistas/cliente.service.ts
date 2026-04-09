import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map } from 'rxjs/operators';
import { AuthService } from 'src/app/core/services/auth.service';
import {
  ClienteContactoDto,
  ClienteContactoPost,
  ClienteContactoUI,
  ClienteDetalleDto,
  ClienteDetalleResponse,
  ClienteDto,
  ClientePost,
  ClienteUI
} from './cliente.models';
import { environment } from 'src/environments/environment';

export type SelectOption<TValue extends string | number = string> = { value: TValue; label: string };

@Injectable({
  providedIn: 'root'
})
export class ClienteService {
  private baseApiUrl = environment.apiUrl;
  private apiUrl = `${this.baseApiUrl}/cliente`;

  constructor(private http: HttpClient, private auth: AuthService) {}

  getTipoIdentificacionOptions(): Observable<SelectOption[]> {
    const url = `${this.baseApiUrl}/tipoidentificacion`;
    return this.http.get<Array<{ CA24_Codigo: string; CA24_Tipo: string }> | null>(url).pipe(
      map((response) => (response ?? []).map((item) => ({ value: (item.CA24_Codigo ?? '').trim(), label: (item.CA24_Tipo ?? '').trim() })))
    );
  }

  getTipoClienteOptions(): Observable<SelectOption[]> {
    const url = `${this.baseApiUrl}/tipocliente`;
    return this.http.get<Array<{ CPV00_Codigo: string; CPV00_Descripcion: string }> | null>(url).pipe(
      map((response) =>
        (response ?? []).map((item) => ({ value: (item.CPV00_Codigo ?? '').trim(), label: (item.CPV00_Descripcion ?? '').trim() }))
      )
    );
  }

  getZonaOptions(): Observable<SelectOption[]> {
    const url = `${this.baseApiUrl}/zona`;
    return this.http.get<Array<{ CPV01_Codigo: string; CPV01_Zona: string }> | null>(url).pipe(
      map((response) => (response ?? []).map((item) => ({ value: (item.CPV01_Codigo ?? '').trim(), label: (item.CPV01_Zona ?? '').trim() })))
    );
  }

  getProvinciasOptions(): Observable<SelectOption<number>[]> {
    const url = `${this.baseApiUrl}/provincia`;
    return this.http.get<Array<{ CA23_numeroProvincia: number; CA23_nombre: string }> | null>(url).pipe(
      map((response) => (response ?? []).map((item) => ({ value: item.CA23_numeroProvincia, label: (item.CA23_nombre ?? '').trim() })))
    );
  }

  getCantonesOptions(idProvincia: string): Observable<SelectOption[]> {
    const normalized = (idProvincia ?? '').toString().trim();
    if (!normalized) {
      return of([]);
    }
    const url = `${this.baseApiUrl}/canton`;
    const params = new HttpParams().set('idProvincia', normalized);
    return this.http.get<Array<{ CA21_numeroCanton: string; CA21_nombre: string }> | null>(url, { params }).pipe(
      map((response) => (response ?? []).map((item) => ({ value: (item.CA21_numeroCanton ?? '').trim(), label: (item.CA21_nombre ?? '').trim() })))
    );
  }

  getDistritosOptions(idProvincia: string, idCanton: string): Observable<SelectOption[]> {
    const provincia = (idProvincia ?? '').toString().trim();
    const canton = (idCanton ?? '').toString().trim();
    if (!provincia || !canton) {
      return of([]);
    }
    const url = `${this.baseApiUrl}/distrito`;
    const params = new HttpParams().set('idProvincia', provincia).set('idCanton', canton);
    return this.http.get<Array<{ CA22_DIS_CODIGO: string; CA22_DIS_NOMBRE: string }> | null>(url, { params }).pipe(
      map((response) => (response ?? []).map((item) => ({ value: (item.CA22_DIS_CODIGO ?? '').trim(), label: (item.CA22_DIS_NOMBRE ?? '').trim() })))
    );
  }

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
        const data = this.extractDatosArray(response?.datos).map((item) => this.mapFromApi(item));
        const paginacion = response?.paginacion;
        const totalRegistros = paginacion?.totalRegistros ?? data.length;
        const paginaActual = paginacion?.paginaActual ?? pageNumber;
        const size = paginacion?.pageSize ?? pageSize;
        const totalPages = paginacion?.totalPaginas ?? (totalRegistros > 0 ? Math.ceil(totalRegistros / size) : 1);
        return { data, totalRegistros, paginaActual, pageSize: size, totalPages };
      })
    );
  }

  getClienteByCodigo(codigo: string): Observable<ClienteUI | null> {
    const normalized = (codigo || '').trim();
    if (!normalized) {
      return of(null);
    }
    return this.http.get<ClienteDetalleResponse>(`${this.apiUrl}/${normalized}`).pipe(
      map((response) => {
        if (response?.cliente) {
          return this.mapFromDetalleApi(response.cliente, response.contactos);
        }
        const item = this.extractDatosArray(response?.datos)[0];
        return item ? this.mapFromApi(item) : null;
      })
    );
  }

  crearCliente(payload: ClientePost): Observable<{ respuesta?: string }> {
    const normalized = this.normalizePayload(payload, 1);
    this.logClienteRequest('POST', this.apiUrl, normalized);
    return this.http.post(this.apiUrl, normalized, { responseType: 'text' }).pipe(map((res) => this.parseTextResponse(res)));
  }

  editarCliente(codigo: string, payload: ClientePost): Observable<{ respuesta?: string }> {
    const normalized = this.normalizePayload(payload, 2);
    const url = `${this.apiUrl}/${codigo}`;
    this.logClienteRequest('PUT', url, normalized);
    return this.http.put(url, normalized, { responseType: 'text' }).pipe(map((res) => this.parseTextResponse(res)));
  }

  eliminarCliente(codigo: string): Observable<{ respuesta?: string }> {
    return this.http.delete(`${this.apiUrl}/${codigo}`, { responseType: 'text' }).pipe(map((res) => this.parseTextResponse(res)));
  }

  buildPayloadFromUI(value: Partial<ClienteUI>, proceso: number, pageNumber = 0, pageSize = 0): ClientePost {
    const contactos = this.buildContactosPayload(value.contactos);
    const contactoPrincipal = this.getPrincipalContacto(contactos);
    const contactoNombre = contactoPrincipal?.nomContacto || value.contacto || '';
    return this.normalizePayload(
      {
        proceso         ,
        codigo          : value.codigo || '',
        nombreCli       : value.nombre || '',
        ruc             : value.ruc || '',
        contacto        : contactoNombre,
        direccion       : value.direccion || '',
        provincia       : value.provincia || '',
        ciudad          : value.ciudad || '',
        pais            : value.pais || '',
        zona            : value.zona || '',
        email           : value.email || '',
        telefono1       : value.telefono1 || '',
        telefono2       : value.telefono2 || '',
        fax             : value.fax || '',
        tipoCli         : value.tipoCli || 'AGE',
        mtoCredito      : Number(value.mtoCredito || 0),
        idProvincia     : value.idProvincia || '',
        idCanton        : value.idCanton || '',
        idDistrito      : value.idDistrito || '',
        tCliente        : value.tCliente || '',
        enviarCorreo    : value.enviarCorreo ?? false,
        operador        : value.operador || '',
        contactos       ,
        nombreContacto  : contactoNombre,
        respuesta       : '',
        pageNumber      ,
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
      contactos: (payload.contactos ?? []).map((contacto) => ({
        ...contacto,
        operador: this.getOperador()
      })),
      respuesta: ''
    };
  }

  private mapFromApi(apiData: ClienteDto): ClienteUI {
    const zona = (apiData.MPV00_Zona ?? apiData.MPV00_ZONA ?? '').trim();
    const contactos = this.mapContactos(apiData.contactos);
    const contactoPrincipal = this.resolveContactoPrincipal(apiData, contactos);
    const nombreComercial = (apiData.MPV00_Contacto ?? '').toString().trim();
    const nombreContacto = contactoPrincipal.nomContacto || nombreComercial;
    const totalContactos = apiData.TotalContactos ?? contactos.length ?? (contactoPrincipal.nomContacto ? 1 : 0);
    return {
      codigo                : apiData.MPV00_CodClien,
      nombre                : apiData.MPV00_NomClien,
      ruc                   : apiData.MPV00_RucClien,
      contacto              : nombreComercial || nombreContacto,
      nombreContacto        : nombreContacto,
      contactoPrincipal     : contactoPrincipal.nomContacto,
      emailPrincipal        : contactoPrincipal.email,
      telefonoPrincipal     : contactoPrincipal.telefono1 || contactoPrincipal.movil,
      cargoPrincipal        : contactoPrincipal.cargo,
      direccion             : apiData.MPV00_DirClien,
      provincia             : apiData.MPV00_PrvClien || '',
      ciudad                : apiData.MPV00_CiuClien || '',
      pais                  : apiData.MPV00_PaiClien || '',
      zona                  : zona,
      email                 : apiData.MPV00_Email,
      telefono1             : apiData.MPV00_Te1Clien,
      telefono2             : apiData.MPV00_Te2Clien,
      fax                   : apiData.MPV00_FaxClien || '',
      tipoCli               : apiData.MPV00_TipClien,
      mtoCredito            : apiData.MPV00_MtoCredito ?? 0,
      idProvincia           : apiData.MPV00_IdProvincia || '',
      idCanton              : apiData.MPV00_IdCanton || '',
      idDistrito            : apiData.MPV00_IdDistrito || '',
      tCliente              : (apiData.MPV00_TCliente || '').trim(),
      enviarCorreo          : (apiData.MPV00_BanderaCorreo ?? 0) === 1,
      totalContactos        : totalContactos,
      contactos             : contactos.length ? contactos : this.buildFallbackContactos(apiData, contactoPrincipal),
      operador              : apiData.MPV00_Operador || '',
      codigoActividad       : apiData.MPV32_CodActividad || '',
      nombreActividad       : apiData.MPV32_NombreActividad || ''
    };
  }

  private mapFromDetalleApi(apiData: ClienteDetalleDto, contactosDto?: ClienteContactoDto[] | null): ClienteUI {
    const contactos = this.mapContactos(contactosDto);
    const contactoPrincipal = contactos.find((item) => item.principal) ?? contactos[0] ?? null;
    const nombreComercial = (apiData.contacto ?? '').toString().trim();
    const contactoNombre = contactoPrincipal?.nomContacto || nombreComercial;
    const totalContactos =
      contactos.length ||
      (contactoNombre || (apiData.email ?? '').toString().trim() || (apiData.telefono1 ?? '').toString().trim() ? 1 : 0);

    const codigoActividad = (apiData.codigoActividad ?? apiData.MPV32_CodActividad ?? '').toString().trim();
    const nombreActividad = (apiData.nombreActividad ?? apiData.MPV32_NombreActividad ?? '').toString().trim();

    return {
      codigo              : (apiData.codigo ?? '').toString().trim(),
      nombre              : (apiData.nombreCli ?? '').toString().trim(),
      ruc                 : (apiData.ruc ?? '').toString().trim(),
      contacto            : nombreComercial || contactoNombre,
      nombreContacto      : contactoNombre,
      contactoPrincipal   : contactoPrincipal?.nomContacto || '',
      emailPrincipal      : contactoPrincipal?.email || '',
      telefonoPrincipal   : contactoPrincipal?.telefono1 || contactoPrincipal?.movil || '',
      cargoPrincipal      : contactoPrincipal?.cargo || '',
      direccion           : (apiData.direccion ?? '').toString().trim(),
      provincia           : '',
      ciudad              : '',
      pais                : (apiData.pais ?? '').toString().trim(),
      zona                : (apiData.zona ?? '').toString().trim(),
      email               : (apiData.email ?? '').toString().trim(),
      telefono1           : (apiData.telefono1 ?? '').toString().trim(),
       telefono2          : (apiData.telefono2 ?? '').toString().trim(),
      fax                 : (apiData.fax ?? '').toString().trim(),
      tipoCli             : (apiData.tipoCli ?? '').toString().trim(),
      mtoCredito          : Number(apiData.mtoCredito ?? 0),
      idProvincia         : (apiData.idProvincia ?? '').toString().trim(),
      idCanton            : (apiData.idCanton ?? '').toString().trim(),
      idDistrito          : (apiData.idDistrito ?? '').toString().trim(),
      tCliente            : (apiData.tCliente ?? '').toString().trim(),
      enviarCorreo        : !!apiData.enviarCorreo,
      totalContactos      ,
      contactos           : contactos.length
        ?contactos
        :this.buildFallbackContactosFromDetalle(apiData, contactoNombre),
      operador            : apiData.operador || '',
      codigoActividad     : codigoActividad,
      nombreActividad     : nombreActividad
    };
  }

  private extractDatosArray(datos?: ClienteDto[] | ClienteDto | null): ClienteDto[] {
    if (!datos) {
      return [];
    }
    return Array.isArray(datos) ? datos : [datos];
  }

  private mapContactos(contactos?: ClienteContactoDto[] | null): ClienteContactoUI[] {
    return (contactos ?? []).map((item) => ({
      id              : Number(item.id ?? 0),
      nomContacto     : (item.nomContacto ?? '').toString().trim(),
      cargo           : this.normalizeText(item.cargo),
      email           : (item.email ?? '').toString().trim(),
      telefono1       : (item.telefono1 ?? '').toString().trim(),
      telefono2       : (item.telefono2 ?? '').toString().trim(),
      movil           : (item.movil ?? '').toString().trim(),
      ext             : (item.ext ?? '').toString().trim(),
      principal       : !!item.principal,
      activo          : item.activo ?? true,
      observacion     : (item.observacion ?? '').toString().trim(),
      accion          : (item.accion ?? '').toString().trim(),
      operador        : (item.operador ?? '').toString().trim(),
      fechaRegistro   : item.fechaRegistro ?? null
    }));
  }

  private resolveContactoPrincipal(
    apiData: ClienteDto,
    contactos: ClienteContactoUI[]
  ): Pick<ClienteContactoUI, 'nomContacto' | 'email' | 'telefono1' | 'movil' | 'cargo'> {
    const principal = contactos.find((item) => item.principal) ?? contactos[0];
    if (principal) {
      return principal;
    }
    return {
      nomContacto   : (apiData.ContactoPrincipal ?? apiData.MPV00_Contacto ?? '').toString().trim(),
      email         : (apiData.EmailPrincipal ?? '').toString().trim(),
      telefono1     : (apiData.TelefonoPrincipal ?? '').toString().trim(),
      movil         : '',
      cargo         : this.normalizeText(apiData.CargoPrincipal)
    };
  }

  private buildFallbackContactos(
    apiData: ClienteDto,
    principal: Pick<ClienteContactoUI, 'nomContacto' | 'email' | 'telefono1' | 'movil' | 'cargo'>
  ): ClienteContactoUI[] {
    if (!principal.nomContacto && !principal.email && !principal.telefono1) {
      return [];
    }
    return [
      {
        id              : 0,
        nomContacto     : principal.nomContacto,
        cargo           : principal.cargo,
        email           : principal.email || apiData.MPV00_Email || '',
        telefono1       : principal.telefono1 || apiData.MPV00_Te1Clien || '',
        telefono2       : apiData.MPV00_Te2Clien || '',
        movil           : principal.movil || '',
        ext             : '',
        principal       : true,
        activo          : true,
        observacion     : '',
        accion          : '',
        operador        : '',
        fechaRegistro   : null
      }
    ];
  }

  private buildFallbackContactosFromDetalle(apiData: ClienteDetalleDto, contactoNombre: string): ClienteContactoUI[] {
    const email = (apiData.email ?? '').toString().trim();
    const telefono1 = (apiData.telefono1 ?? '').toString().trim();
    const telefono2 = (apiData.telefono2 ?? '').toString().trim();
    if (!contactoNombre && !email && !telefono1 && !telefono2) {
      return [];
    }
    return [
      {
        id              : 0,
        nomContacto     : contactoNombre,
        cargo           : '',
        email           ,
        telefono1       ,
        telefono2       ,
        movil           : '',
        ext             : '',
        principal       : true,
        activo          : true,
        observacion     : '',
        accion          : '',
        operador        : '',
        fechaRegistro   : null
      }
    ];
  }

  private buildContactosPayload(contactos: ClienteContactoUI[] | undefined): ClienteContactoPost[] {
    const normalized = (contactos ?? [])
      .map((item, index) => {
        const nomContacto = (item.nomContacto ?? '').trim();
        const email = (item.email ?? '').trim();
        const telefono1 = (item.telefono1 ?? '').trim();
        const telefono2 = (item.telefono2 ?? '').trim();
        const movil = (item.movil ?? '').trim();
        const hasContent = !!(nomContacto || email || telefono1 || telefono2 || movil || (item.cargo ?? '').trim());
        if (!hasContent && (item.accion ?? '').toUpperCase() !== 'D') {
          return null;
        }
        const accion = (item.accion ?? '').trim().toUpperCase() || (Number(item.id) > 0 ? 'U' : 'I');
        return {
          id            : Number(item.id ?? 0),
          nomContacto   ,
          cargo         : (item.cargo ?? '').trim(),
          email         ,
          telefono1     ,
          telefono2     ,
          movil         ,
          ext           : (item.ext ?? '').trim(),
          principal     : item.principal || index === 0,
          activo        : item.activo ?? true,
          observacion   : (item.observacion ?? '').trim(),
          accion        ,
          operador      : '',
          fechaRegistro : item.fechaRegistro ?? null
        };
      })
      .filter((item): item is ClienteContactoPost => !!item);

    const principalIndex = normalized.findIndex((item) => item.principal && item.accion !== 'D' && item.activo !== false);
    if (normalized.length && principalIndex === -1) {
      const firstActive = normalized.find((item) => item.accion !== 'D' && item.activo !== false);
      if (firstActive) {
        firstActive.principal = true;
      }
    } else if (principalIndex > -1) {
      normalized.forEach((item, index) => {
        item.principal = index === principalIndex;
      });
    }

    return normalized;
  }

  private getPrincipalContacto(contactos: ClienteContactoPost[]): ClienteContactoPost | null {
    return (
      contactos.find((item) => item.principal && item.accion !== 'D' && item.activo !== false) ??
      contactos.find((item) => item.accion !== 'D' && item.activo !== false) ??
      null
    );
  }

  private normalizeText(value: unknown): string {
    if (typeof value === 'string') {
      return value.trim();
    }
    if (value && typeof value === 'object') {
      return '';
    }
    return (value ?? '').toString().trim();
  }

  private logClienteRequest(method: 'POST' | 'PUT', url: string, payload: ClientePost): void {
    console.groupCollapsed(`[ClienteService] ${method} ${url}`);
    console.log('payload', payload);
    console.log('contactos', payload.contactos);
    console.groupEnd();
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
