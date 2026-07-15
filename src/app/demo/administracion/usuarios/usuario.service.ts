import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { AuthService } from 'src/app/core/services/auth.service';
import { environment } from 'src/environments/environment';
import {
  CambioClavePayload,
  DescuentoNivel,
  DescuentoUsuario,
  ModuloCatalogo,
  ModuloCatalogoUI,
  PrivilegioCatalogo,
  PrivilegioCatalogoUI,
  PuntoVenta,
  PuntoVentaUI,
  UsuarioApi,
  UsuarioFiltros,
  UsuarioListResponse,
  UsuarioPayload,
  UsuarioResponse,
  UsuarioUI
} from './usuario.models';

@Injectable({ providedIn: 'root' })
export class UsuarioService {
  private apiUrl = `${environment.apiUrl}/usuarios`;
  private modxUsaurio = `${environment.apiUrl}/modxusuario`;
  private modulosUrl = `${environment.apiUrl}/modulo`;
  private puntosVentaUrl = `${environment.apiUrl}/puntoventa`;
  private mozoxPntVentaUrl = `${environment.apiUrl}/mozoporpuntoventa`;
  private descuentosUrl = `${environment.apiUrl}/confdescuento`;
  private privilegiosUrl = `${environment.apiUrl}/privilegiogeneral`;
  private readonly tipoCreate = 1;
  private readonly tipoUpdate = 2;
  private readonly tipoCambioClave = 3;

  constructor(private http: HttpClient, private auth: AuthService) {}

  getUsuarios(
    pageNumber: number,
    pageSize: number,
    filtros?: UsuarioFiltros
  ): Observable<{ data: UsuarioUI[]; totalRegistros: number; paginaActual: number; pageSize: number; totalPages: number }> {
    const params = this.buildPaginationParams(pageNumber, pageSize, filtros);
    const baseUrl =
      filtros?.departamento !== undefined && filtros?.departamento !== null
        ? `${this.apiUrl}/departamento/${filtros.departamento}`
        : this.apiUrl;
    return this.http.get<UsuarioListResponse>(baseUrl, { params }).pipe(
      map((response) => {
        const data = (response?.datos ?? []).map((item) => this.mapFromApi(item));
        const totalRegistros = response?.paginacion?.totalRegistros ?? data.length;
        const paginaActual = response?.paginacion?.paginaActual ?? pageNumber;
        const size = response?.paginacion?.pageSize ?? pageSize;
        const totalPages = totalRegistros > 0 ? Math.ceil(totalRegistros / size) : 1;
        return { data, totalRegistros, paginaActual, pageSize: size, totalPages };
      })
    );
  }

  getUsuarioById(usuario: string): Observable<UsuarioUI> {
    const params = this.buildPaginationParams(1, 1, { usuario });
    return this.http.get<UsuarioListResponse>(this.apiUrl, { params }).pipe(
      map((response) => {
        const item = response?.datos?.[0];
        if (!item) {
          throw new Error('Usuario no encontrado');
        }
        return this.mapFromApi(item);
      })
    );
  }

  crearUsuario(payload: UsuarioPayload): Observable<UsuarioResponse> {
    const normalized = this.normalizePayload({ ...payload, tipo: this.tipoCreate }, true);
    return this.http
      .post(this.apiUrl, normalized, { responseType: 'text' })
      .pipe(map((response) => this.parseTextResponse(response)));
  }

  actualizarUsuario(payload: UsuarioPayload): Observable<UsuarioResponse> {
    const normalized = this.normalizePayload({ ...payload, tipo: this.tipoUpdate });
    return this.http
      .put(this.apiUrl, normalized, { responseType: 'text' })
      .pipe(map((response) => this.parseTextResponse(response)));
  }

  eliminarUsuario(usuario: string): Observable<UsuarioResponse> {
    return this.http
      .delete(`${this.apiUrl}/${usuario}`, { responseType: 'text' })
      .pipe(map((response) => this.parseTextResponse(response)));
  }

  cambiarClave(payload: CambioClavePayload): Observable<UsuarioResponse> {
    const normalized: CambioClavePayload = {
      tipo: this.tipoCambioClave,
      usuario: payload.usuario,
      clave: payload.clave,
      operador: payload.operador || this.getOperador(),
      respuesta: ''
    };
    return this.http
      .post(`${this.apiUrl}/CambiarClave`, normalized, { responseType: 'text' })
      .pipe(map((response) => this.parseTextResponse(response)));
  }
 
  getModulosUsuario(usuario: string): Observable<ModuloCatalogoUI[]> {
    return this.http
      .get<ModuloCatalogo[]>(`${this.modxUsaurio}/usuario/${usuario}`)
      .pipe(map((response) => (response ?? []).map((item) => this.mapModuloFromApi(item))));
  }

  getCatalogoModulos(): Observable<ModuloCatalogoUI[]> {
    return this.http
      .get<ModuloCatalogo[]>(this.modulosUrl)
      .pipe(map((response) => (response ?? []).map((item) => this.mapModuloFromApi(item))));
  }

  asignarModulo(usuario: string, modulo: string): Observable<unknown> {
    return this.http.post(`${this.apiUrl}/${usuario}/modulos`, { modulo });
  }

  quitarModulo(usuario: string, modulo: string): Observable<unknown> {
    return this.http.delete(`${this.apiUrl}/${usuario}/modulos/${modulo}`);
  }

  getPrivilegiosModulo(modulo: string): Observable<PrivilegioCatalogoUI[]> {
    return this.http
      .get<PrivilegioCatalogo[]>(`${this.privilegiosUrl}/noasignados?usuario='USUARIO'&modulo=${modulo}`)
      .pipe(map((response) => (response ?? []).map((item) => this.mapPrivilegioFromApi(item))));
  }

  getPrivilegiosUsuario(usuario: string, modulo: string): Observable<string[]> {
    return this.http.get<string[]>(`${this.privilegiosUrl}/usuario?usuario=${usuario}&modulo=${modulo}`);
  }

  asignarPrivilegio(usuario: string, modulo: string, idPrivilegio: string): Observable<unknown> {
    return this.http.post(`${this.apiUrl}/${usuario}/privilegios`, { modulo, idPrivilegio });
  }

  quitarPrivilegio(usuario: string, idPrivilegio: string, modulo?: string): Observable<unknown> {
    const params = modulo ? new HttpParams().set('modulo', modulo) : undefined;
    return this.http.delete(`${this.apiUrl}/${usuario}/privilegios/${idPrivilegio}`, { params });
  }

  getPuntosVenta(): Observable<PuntoVentaUI[]> {
    return this.http
      .get<PuntoVenta[]>(this.puntosVentaUrl)
      .pipe(map((response) => (response ?? []).map((item) => this.mapPuntoVentaFromApi(item))));
  }

  getPuntosVentaUsuario(usuario: string): Observable<PuntoVentaUI[]> {
    return this.http
      .get<PuntoVenta[]>(`${this.mozoxPntVentaUrl}/usuario/${usuario}`)
      .pipe(map((response) => (response ?? []).map((item) => this.mapPuntoVentaFromApi(item))));
  }

  asignarPuntoVenta(usuario: string, puntoVenta: string): Observable<unknown> {
    return this.http.post(`${this.apiUrl}/${usuario}/puntosventa`, { puntoVenta });
  }

  quitarPuntoVenta(usuario: string, puntoVenta: string): Observable<unknown> {
    return this.http.delete(`${this.apiUrl}/${usuario}/puntosventa/${puntoVenta}`);
  }

  getNivelesDescuento(): Observable<DescuentoNivel[]> {
    return this.http.get<DescuentoNivel[]>(`${this.descuentosUrl}/configuraciones`);
  }

  getDescuentosUsuario(usuario: string): Observable<DescuentoUsuario[]> {
    return this.http.get<DescuentoUsuario[]>(`${this.descuentosUrl}/mozo?mozo=${usuario}&pntVenta=0`);
  }

  guardarDescuentoUsuario(usuario: string, payload: { puntoVenta: string; nivelId: number }): Observable<unknown> {
    return this.http.post(`${this.apiUrl}/${usuario}/descuentos`, payload);
  }

  eliminarDescuentoUsuario(usuario: string, id: number): Observable<unknown> {
    return this.http.delete(`${this.apiUrl}/${usuario}/descuentos/${id}`);
  }

  getAll(
    pageNumber: number,
    pageSize: number
  ): Observable<{ data: UsuarioUI[]; totalRegistros: number; paginaActual: number; pageSize: number; totalPages: number }> {
    return this.getUsuarios(pageNumber, pageSize);
  }

  getByUsuario(usuario: string, pageNumber: number, pageSize: number): Observable<UsuarioUI> {
    const params = this.buildPaginationParams(pageNumber, pageSize, { usuario });
    return this.http.get<UsuarioListResponse>(this.apiUrl, { params }).pipe(
      map((response) => {
        const item = response?.datos?.[0];
        if (!item) {
          throw new Error('Usuario no encontrado');
        }
        return this.mapFromApi(item);
      })
    );
  }

  getByDepartamento(
    departamento: number,
    pageNumber: number,
    pageSize: number
  ): Observable<{ data: UsuarioUI[]; totalRegistros: number; paginaActual: number; pageSize: number; totalPages: number }> {
    const params = this.buildPaginationParams(pageNumber, pageSize);
    return this.http.get<UsuarioListResponse>(`${this.apiUrl}/departamento/${departamento}`, { params }).pipe(
      map((response) => {
        const data = (response?.datos ?? []).map((item) => this.mapFromApi(item));
        const totalRegistros = response?.paginacion?.totalRegistros ?? data.length;
        const paginaActual = response?.paginacion?.paginaActual ?? pageNumber;
        const size = response?.paginacion?.pageSize ?? pageSize;
        const totalPages = totalRegistros > 0 ? Math.ceil(totalRegistros / size) : 1;
        return { data, totalRegistros, paginaActual, pageSize: size, totalPages };
      })
    );
  }

  getByNombreUsuario(
    nombreUsu: string,
    pageNumber: number,
    pageSize: number
  ): Observable<{ data: UsuarioUI[]; totalRegistros: number; paginaActual: number; pageSize: number; totalPages: number }> {
    return this.getUsuarios(pageNumber, pageSize, { usuario: nombreUsu });
  }

  create(usuario: UsuarioUI): Observable<UsuarioResponse> {
    const payload = this.buildPayload(usuario, this.tipoCreate, true);
    return this.http
      .post(this.apiUrl, payload, { responseType: 'text' })
      .pipe(map((response) => this.parseTextResponse(response)));
  }

  update(usuario: string, data: UsuarioUI): Observable<UsuarioResponse> {
    const payload = this.buildPayload({ ...data, usuario }, this.tipoUpdate);
    return this.http
      .put(`${this.apiUrl}/${usuario}`, payload, { responseType: 'text' })
      .pipe(map((response) => this.parseTextResponse(response)));
  }

  delete(usuario: string): Observable<UsuarioResponse> {
    return this.eliminarUsuario(usuario);
  }

  private buildPayload(usuario: UsuarioUI, tipo: number, setNuevoPass = false): UsuarioPayload {
    return this.normalizePayload(
      {
        tipo,
        usuario: usuario.usuario,
        nombreUsu: usuario.nombreUsu,
        departamento: usuario.departamento,
        telefono: usuario.telefono || '',
        correo: usuario.correo || '',
        clave: usuario.clave || '',
        pntVenta: usuario.pntVenta ?? 0,
        passPntVenta: usuario.passPntVenta || '',
        operador: usuario.operador || '',
        respuesta: '',
        pageNumber: 0,
        pageSize: 0
      },
      setNuevoPass
    );
  }

  private normalizePayload(payload: UsuarioPayload, setNuevoPass = false): UsuarioPayload {
    return {
      ...payload,
      clave: setNuevoPass && !payload.clave ? 'NUEVO-PASS' : payload.clave,
      operador: payload.operador || this.getOperador(),
      respuesta: '',
      pageNumber: payload.pageNumber ?? 0,
      pageSize: payload.pageSize ?? 0
    };
  }

  private getOperador(): string {
    return this.auth.getCurrentUser()?.usuario ?? '';
  }

  private mapFromApi(apiData: UsuarioApi): UsuarioUI {
    return {
      usuario: apiData.MA01_Usuario,
      nombreUsu: apiData.MA01_NomPersonal,
      departamento: apiData.MA01_CodDepa,
      telefono: apiData.MA01_Telefono,
      correo: apiData.MA01_Correo,
      clave: apiData.MA01_Clave,
      operador: apiData.MA01_Operador
    };
  }

  private mapModuloFromApi(apiData: ModuloCatalogo): ModuloCatalogoUI {
    return {
      codigo: apiData.MA03_Modulo,
      descripcion: apiData.MA03_Descripcion,
      orden: apiData.MA03_Orden,
      operador: apiData.MA03_Operador
    };
  }

  private mapPrivilegioFromApi(apiData: PrivilegioCatalogo): PrivilegioCatalogoUI {
    return {
      id: apiData.CA08_CodParametro,
      descripcion: apiData.CA08_Descripcion,
      modulo: apiData.CA08_Modulo,
      valor: apiData.CA08_Valor,
      orden: apiData.CA08_Orden,
      tipo: apiData.CA08_Tipo
    };
  }

  private mapPuntoVentaFromApi(apiData: PuntoVenta): PuntoVentaUI {
    return {
      codigo: this.normalizeCatalogText(apiData.MPV07_CodPntVenta ?? apiData.MPV08_CodPntVenta ?? apiData.codPntVenta),
      descripcion: this.normalizeCatalogText(apiData.MPV07_NomPntVenta ?? apiData.MPV08_NomPntVenta ?? apiData.nomPntVenta),
      codComanda: this.normalizeCatalogText(apiData.MPV07_CodComanda),
      codDocumento: this.normalizeCatalogText(apiData.MPV07_CodDocumento),
      codLstPrecio: this.normalizeCatalogText(apiData.MPV07_CodLstPrecio),
      numMesas: Number(apiData.MPV07_NumMesas ?? 0),
      pntTouch: Number(apiData.MPV07_PntTouch ?? 0),
      orden: Number(apiData.MPV07_Orden ?? apiData.MPV08_Orden ?? 0),
      operador: this.normalizeCatalogText(apiData.MPV07_Operador),
      impresoraA: this.normalizeCatalogText(apiData.MPV07_ImpresoraA),
      impresoraB: this.normalizeCatalogText(apiData.MPV07_ImpresoraB)
    };
  }

  private normalizeCatalogText(value: unknown): string {
    if (typeof value === 'string') {
      return value.trim();
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value).trim();
    }
    if (value && typeof value === 'object' && Object.keys(value as Record<string, unknown>).length > 0) {
      return JSON.stringify(value);
    }
    return '';
  }

  private parseTextResponse(response: string): UsuarioResponse {
    if (!response) {
      return {};
    }
    const trimmed = response.trim();
    if (!trimmed) {
      return {};
    }
    try {
      return JSON.parse(trimmed) as UsuarioResponse;
    } catch {
      return { respuesta: trimmed };
    }
  }

  private buildPaginationParams(pageNumber: number, pageSize: number, filtros?: UsuarioFiltros): HttpParams {
    let params = new HttpParams().set('pageNumber', String(pageNumber)).set('pageSize', String(pageSize));
    if (filtros?.usuario) {
      params = params.set('usuario', filtros.usuario);
    }
    return params;
  }
}
