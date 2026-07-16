import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, forkJoin, of } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { AuthService } from 'src/app/core/services/auth.service';
import { environment } from 'src/environments/environment';

export interface ServicioDto {
  MPV01_CodCategoria: string;
  MPV01_CodGrupo: string;
  MPV01_CodReceta: string;
  MPV01_NomReceta: string;
  MPV01_NomCorto: string;
  MPV01_UMedida: string;
  MPV01_NumPorciones: number;
  MPV01_CtoReceta: number;
  MPV01_CtoProduccion: number;
  MPV01_CtoNeto: number;
  MPV01_Utilidad: number;
  MPV01_TotalCUtilidad: number;
  MPV01_CtoIva: number;
  MPV01_CtoTotal: number;
  MPV01_Descripcion: string;
  MPV01_Visible: number;
  MPV01_UrlImagen: unknown;
  MPV01_Operador: string;
  MPV01_CABYS: string;
  MPV01_Compuesto: string;
}

export interface ServicioPost {
  proceso: number;
  tmpDetalle: string;
  codCateg: string;
  codGrupo: string;
  codReceta: string;
  nomReceta: string;
  nomCorto: string;
  uMedida: string;
  numPorciones: number;
  ctoReceta: number;
  ctoProduccion: number;
  ctoNeto: number;
  utilidad: number;
  totalCUtilidad: number;
  ctoIva: number;
  ctoTotal: number;
  descripcion: string;
  visible: number;
  urlImagen: string;
  operador: string;
  cabys: string;
  compuesto: string;
  pageNumber: number;
  pageSize: number;
  respuesta: string;
}

export interface RecetaDetallePayload {
  dR_Tipo: string;
  dR_CodProducto: string;
  dR_NomProducto: string;
  dR_UnMProducto: string;
  dR_CodEquival: string;
  dR_PorMerma: number;
  dR_CanProducto: number;
  dR_UMDestino: string;
  dR_CtoProducto: number;
  dR_CtoTotal: number;
  dR_Orden: number;
}

export interface ManejoRecetaPayload {
  proceso: number;
  tmpdetalle: RecetaDetallePayload[];
  codcateg: string;
  codgrupo: string;
  codreceta: string;
  nomreceta: string;
  nomcorto: string;
  umedida: string;
  numporciones: number;
  ctoreceta: number;
  ctoproduccion: number;
  ctoneto: number;
  utilidad: number;
  totalcutilidad: number;
  ctototal: number;
  descripcion: string;
  visible: number;
  urlimagen: string;
  operador: string;
  cabys: string;
  compuesto: string;
  pageNumber: number;
  pageSize: number;
}

export interface EquivalenciaGeneralDto {
  MPV03_CodEqui: number;
  MPV03_UMOrigen: string;
  MPV03_Cantidad: number;
  MPV03_UMDestino: string;
  MPV03_Equivalencia: number;
  MPV03_Descripcion: string;
  MPV03_Operador: string;
}

interface RecetaDetalleDto {
  MPV02_CodReceta: string;
  MPV02_Tipo: string;
  MPV02_CodProducto: string;
  MPV02_NomProducto: string;
  MPV02_UnMProducto: string;
  MPV02_CodEquival: number;
  MPV02_PorMerma: number;
  MPV02_CanProducto: number;
  MPV02_UnMDestino: string;
  MPV02_CtoProducto: number;
  MPV02_CtoTotal: number;
  MPV02_Orden: number;
}

interface EstructuraRecetaResponse {
  mensaje?: string;
  encabezado?: ServicioDto;
  detalle?: RecetaDetalleDto[];
  totalDetalles?: number;
}

export interface EstructuraRecetaCompleta {
  mensaje: string;
  encabezado: ServicioUI | null;
  detalle: RecetaDetallePayload[];
  totalDetalles: number;
}

export interface ServicioUI {
  codCateg          : string;
  codGrupo          : string;
  codReceta         : string;
  nomReceta         : string;
  nomCorto          : string;
  uMedida           : string;
  numPorciones      : number;
  ctoReceta         : number;
  ctoProduccion     : number;
  ctoNeto           : number;
  utilidad          : number;
  totalCUtilidad    : number;
  ctoTotal          : number;
  descripcion       : string;
  visible           : number;
  urlImagen         : string;
  cabys             : string;
  compuesto         : string;
  operador          ?: string;
  ctoIva            : number;
}

export interface CentroCostoDto {
  CA10_CodCCto: string;
  CA10_CentroCosto: string;
  CA10_Impuesto: number;
  CA10_Orden: number;
  CA10_TipCCto: string;
  CA10_Operador: string;
  Impuesto: number;
}

export interface CentroCostoPagination {
  totalRegistros: number;
  paginaActual: number;
  totalPaginas: number;
}

export interface CentroCostoListResponse {
  datos?: CentroCostoDto[];
  paginacion?: CentroCostoPagination;
}

export interface CentroCostoOption {
  codigo: string;
  nombre: string;
}

export interface CategoriaDto {
  MPV00_CodCategoria: string;
  MPV00_NomCategoria: string;
  MPV00_VisiblePnt: number;
  MPV00_Orden: number;
  MPV00_Operador: string;
}

export interface CategoriaOption {
  codigo: string;
  nombre: string;
}

export interface UnidadMedidaDto {
  CAC04_UnmMed: string;
  CAC04_Descripcion: string;
  CAC04_Operador: string;
}

export interface UnidadMedidaOption {
  codigo: string;
  descripcion: string;
}

export interface ServiciosPaginados {
  data: ServicioUI[];
  totalRegistros: number;
  paginaActual: number;
  pageSize: number;
  totalPages: number;
}

@Injectable({
  providedIn: 'root'
})
export class ServiciosService {
  private apiUrl = `${environment.apiUrl}/encreceta`;
  private manejoRecetaUrl = `${environment.apiUrl}/manejo-receta`;
  private centroCostoUrl = `${environment.apiUrl}/centrocosto`;
  private categoriaUrl = `${environment.apiUrl}/categoria`;
  private unidadMedidaUrl = `${environment.apiUrl}/unidadmedida`;
  private equivalenciaGeneralUrl = `${environment.apiUrl}/equivalencia-general`;

  constructor(private http: HttpClient, private auth: AuthService) {}

  consultarServiciosPorGrupo(
    visible: number | undefined,
    pageNumber = 1,
    pageSize = 20,
    codGrupo?: string,
    codCateg?: string,
    nomReceta?: string
  ): Observable<ServiciosPaginados> {
    let params = new HttpParams()
      .set('pageNumber', String(pageNumber))
      .set('pageSize', String(pageSize));

    if (typeof visible === 'number') {
      params = params.set('visible', String(visible));
    }
    if (codGrupo?.trim()) {
      params = params.set('codGrupo', codGrupo.trim());
    }
    if (codCateg?.trim()) {
      params = params.set('codCateg', codCateg.trim());
    }
    if (nomReceta?.trim()) {
      params = params.set('nomReceta', nomReceta.trim());
    }

    return this.http
      .get<{ datos?: ServicioDto[]; paginacion?: unknown }>(`${this.manejoRecetaUrl}/consultar-por-grupo`, { params })
      .pipe(map((response) => this.mapPagedResponse(response, pageNumber, pageSize)));
  }

  consultarServiciosPorNombre(
    nomReceta: string,
    visible: number | undefined,
    pageNumber = 1,
    pageSize = 20
  ): Observable<ServiciosPaginados> {
    let params = new HttpParams()
      .set('nomReceta', nomReceta.trim())
      .set('pageNumber', String(pageNumber))
      .set('pageSize', String(pageSize));

    if (typeof visible === 'number') {
      params = params.set('visible', String(visible));
    }

    return this.http
      .get<{ datos?: ServicioDto[]; paginacion?: unknown }>(`${this.manejoRecetaUrl}/consultar-por-nombre`, { params })
      .pipe(map((response) => this.mapPagedResponse(response, pageNumber, pageSize)));
  }

  getServicios(
    visible: number | undefined,
    pageNumber = 1,
    pageSize = 20,
    codGrupo?: string,
    codCateg?: string
  ): Observable<{
    data: ServicioUI[];
    totalRegistros: number;
    paginaActual: number;
    pageSize: number;
    totalPages: number;
  }> {
    let params = new HttpParams().set('pageNumber', String(pageNumber)).set('pageSize', String(pageSize));
    if (typeof visible === 'number') {
      params = params.set('visible', String(visible));
    }
    if (codGrupo) {
      params = params.set('codGrupo', codGrupo);
    }
    if (codCateg) {
      params = params.set('codCateg', codCateg);
    }
    return this.http.get<{ datos?: ServicioDto[]; paginacion?: any }>(this.apiUrl, { params }).pipe(
      map((response) => {
        const data = (response?.datos ?? []).map((item) => this.mapFromApi(item));
        const { totalRegistros, paginaActual, size, totalPages } = this.resolvePagination(response?.paginacion, {
          fallbackPageNumber: pageNumber,
          fallbackPageSize: pageSize,
          fallbackTotalRegistros: data.length
        });
        return { data, totalRegistros, paginaActual, pageSize: size, totalPages };
      })
    );
  }

  buscarServicios(
    nomReceta: string,
    visible: number | undefined,
    pageNumber = 1,
    pageSize = 20,
    codGrupo?: string,
    codCateg?: string
  ): Observable<{
    data: ServicioUI[];
    totalRegistros: number;
    paginaActual: number;
    pageSize: number;
    totalPages: number;
  }> {
    let params = new HttpParams().set('nomReceta', nomReceta).set('pageNumber', String(pageNumber)).set('pageSize', String(pageSize));
    if (typeof visible === 'number') {
      params = params.set('visible', String(visible));
    }
    if (codGrupo) {
      params = params.set('codGrupo', codGrupo);
    }
    if (codCateg) {
      params = params.set('codCateg', codCateg);
    }
    return this.http.get<{ datos?: ServicioDto[]; paginacion?: any }>(`${this.apiUrl}/buscar`, { params }).pipe(
      map((response) => {
        const data = (response?.datos ?? []).map((item) => this.mapFromApi(item));
        const { totalRegistros, paginaActual, size, totalPages } = this.resolvePagination(response?.paginacion, {
          fallbackPageNumber: pageNumber,
          fallbackPageSize: pageSize,
          fallbackTotalRegistros: data.length
        });
        return { data, totalRegistros, paginaActual, pageSize: size, totalPages };
      })
    );
  }

  getServicioByCodigo(codReceta: string): Observable<ServicioUI | null> {
    const normalized = codReceta.trim();
    return this.http.get<ServicioDto[]>(`${this.apiUrl}/${normalized}`).pipe(
      map((response) => {
        const item = response?.[0];
        return item ? this.mapFromApi(item) : null;
      })
    );
  }

  getEstructuraRecetaCompleta(codReceta: string): Observable<EstructuraRecetaCompleta> {
    const codigo = encodeURIComponent(codReceta.trim());
    return this.http
      .get<EstructuraRecetaResponse>(`${this.manejoRecetaUrl}/consultar-estructura-completa/${codigo}`)
      .pipe(map((response) => {
        const detalle = (response?.detalle ?? [])
          .map((item) => this.mapDetalleFromApi(item))
          .sort((a, b) => a.dR_Orden - b.dR_Orden);
        return {
          mensaje: response?.mensaje ?? '',
          encabezado: response?.encabezado ? this.mapFromApi(response.encabezado) : null,
          detalle,
          totalDetalles: Number(response?.totalDetalles ?? detalle.length) || detalle.length
        };
      }));
  }

  getServiciosActivosAll(pageSize = 20): Observable<ServicioUI[]> {
    return this.buscarServicios('', 1, 1, pageSize).pipe(
      switchMap((result) => {
        const totalPages = result.totalPages ?? 1;
        if (totalPages <= 1) {
          return of(result.data ?? []);
        }
        const requests = Array.from({ length: totalPages - 1 }, (_, index) =>
          this.buscarServicios('', 1, index + 2, pageSize).pipe(map((page) => page.data ?? []))
        );
        return forkJoin(requests).pipe(map((pages) => (result.data ?? []).concat(...pages)));
      })
    );
  }

  getCentroCostoOptions(pageNumber = 1, pageSize = 100): Observable<CentroCostoOption[]> {
    const params = new HttpParams().set('pageNumber', String(pageNumber)).set('pageSize', String(pageSize));
    return this.http.get<CentroCostoListResponse>(this.centroCostoUrl, { params }).pipe(
      map((response) => {
        const uniqueByCodigo = new Map<string, CentroCostoOption>();
        (response?.datos ?? []).forEach((item) => {
          const codigo = (item?.CA10_CodCCto || '').trim().toUpperCase();
          if (!codigo) {
            return;
          }
          uniqueByCodigo.set(codigo, {
            codigo,
            nombre: (item.CA10_CentroCosto || '').trim() || codigo
          });
        });
        return Array.from(uniqueByCodigo.values()).sort((a, b) => a.codigo.localeCompare(b.codigo));
      })
    );
  }

  getCategoriaOptions(): Observable<CategoriaOption[]> {
    return this.http.get<CategoriaDto[]>(this.categoriaUrl).pipe(
      map((response) => {
        const uniqueByCodigo = new Map<string, CategoriaOption>();
        (response ?? []).forEach((item) => {
          const codigo = (item?.MPV00_CodCategoria || '').trim().toUpperCase();
          if (!codigo) {
            return;
          }
          uniqueByCodigo.set(codigo, {
            codigo,
            nombre: (item.MPV00_NomCategoria || '').trim() || codigo
          });
        });
        return Array.from(uniqueByCodigo.values()).sort((a, b) => a.codigo.localeCompare(b.codigo));
      })
    );
  }

  getUnidadMedidaOptions(): Observable<UnidadMedidaOption[]> {
    return this.http.get<UnidadMedidaDto[]>(this.unidadMedidaUrl).pipe(
      map((response) => {
        const uniqueByCodigo = new Map<string, UnidadMedidaOption>();
        (response ?? []).forEach((item) => {
          const codigo = (item?.CAC04_UnmMed || '').trim().toUpperCase();
          if (!codigo) {
            return;
          }
          uniqueByCodigo.set(codigo, {
            codigo,
            descripcion: (item.CAC04_Descripcion || '').trim() || codigo
          });
        });
        return Array.from(uniqueByCodigo.values()).sort((a, b) => a.codigo.localeCompare(b.codigo));
      })
    );
  }

  getEquivalenciasPorUnidadOrigen(umOrigen: string): Observable<EquivalenciaGeneralDto[]> {
    const params = new HttpParams().set('umOrigen', umOrigen.trim());
    return this.http
      .get<EquivalenciaGeneralDto[]>(`${this.equivalenciaGeneralUrl}/consultar-por-umorigen`, { params })
      .pipe(map((response) => Array.isArray(response) ? response : []));
  }

  crearServicio(payload: ServicioPost): Observable<{ respuesta?: string }> {
    const normalized = this.normalizePayload(payload, 1);
    return this.http.post(this.apiUrl, normalized, { responseType: 'text' }).pipe(map((res) => this.parseTextResponse(res)));
  }

  insertarManejoReceta(payload: ManejoRecetaPayload): Observable<{ respuesta?: string }> {
    return this.http
      .post(`${this.manejoRecetaUrl}/insertar`, { ...payload, operador: this.getOperador() }, { responseType: 'text' })
      .pipe(map((response) => this.parseTextResponse(response)));
  }

  actualizarManejoReceta(payload: ManejoRecetaPayload): Observable<{ respuesta?: string }> {
    return this.http
      .put(`${this.manejoRecetaUrl}/actualizar`, { ...payload, operador: this.getOperador() }, { responseType: 'text' })
      .pipe(map((response) => this.parseTextResponse(response)));
  }

  editarServicio(codReceta: string, payload: ServicioPost): Observable<{ respuesta?: string }> {
    const normalized = this.normalizePayload(payload, 2);
    return this.http.put( `${this.apiUrl}/${codReceta}`, normalized, { responseType: 'text' }).pipe(map((res) => this.parseTextResponse(res)));
  }

  eliminarServicio(codReceta: string): Observable<{ respuesta?: string }> {
    
    return this.http.delete( `${this.apiUrl}/${codReceta}`, { responseType: 'text' }).pipe(map((res) => this.parseTextResponse(res)));
  }

  buildPayloadFromUI(value: Partial<ServicioUI>, proceso: number, pageNumber = 0, pageSize = 0): ServicioPost {
    return this.normalizePayload(
      {
        proceso,
        tmpDetalle: '',
        codCateg: value.codCateg || '',
        codGrupo: value.codGrupo || '',
        codReceta: value.codReceta || '',
        nomReceta: value.nomReceta || '',
        nomCorto: value.nomCorto || '',
        uMedida: value.uMedida || '',
        numPorciones: Number(value.numPorciones || 0),
        ctoReceta: Number(value.ctoReceta || 0),
        ctoProduccion: Number(value.ctoProduccion || 0),
        ctoNeto: Number(value.ctoNeto || 0),
        utilidad: Number(value.utilidad || 0),
        totalCUtilidad: Number(value.totalCUtilidad || 0),
        ctoIva: Number(value.ctoIva || 0),
        ctoTotal: Number(value.ctoTotal || 0),
        descripcion: value.descripcion || '',
        visible: Number(value.visible ?? 0),
        urlImagen: value.urlImagen || '',
        operador: '',
        cabys: value.cabys || '',
        compuesto: value.compuesto || 'N',
        pageNumber,
        pageSize,
        respuesta: ''
      },
      proceso
    );
  }

  private normalizePayload(payload: ServicioPost, proceso: number): ServicioPost {
    return {
      ...payload,
      proceso,
      operador: this.getOperador(),
      respuesta: ''
    };
  }

  private mapFromApi(apiData: ServicioDto): ServicioUI {
    return {
      codCateg: (apiData.MPV01_CodCategoria || '').trim().toUpperCase(),
      codGrupo: (apiData.MPV01_CodGrupo || '').trim().toUpperCase(),
      codReceta: (apiData.MPV01_CodReceta || '').trim(),
      nomReceta: apiData.MPV01_NomReceta,
      nomCorto: apiData.MPV01_NomCorto,
      uMedida: (apiData.MPV01_UMedida || '').trim().toUpperCase(),
      numPorciones: apiData.MPV01_NumPorciones ?? 0,
      ctoReceta: apiData.MPV01_CtoReceta ?? 0,
      ctoProduccion: apiData.MPV01_CtoProduccion ?? 0,
      ctoNeto: apiData.MPV01_CtoNeto ?? 0,
      utilidad: apiData.MPV01_Utilidad ?? 0,
      totalCUtilidad: apiData.MPV01_TotalCUtilidad ?? 0,
      ctoIva: apiData.MPV01_CtoIva ?? 0,
      ctoTotal: apiData.MPV01_CtoTotal ?? 0,
      descripcion: apiData.MPV01_Descripcion,
      visible: apiData.MPV01_Visible ?? 0,
      urlImagen: typeof apiData.MPV01_UrlImagen === 'string' ? apiData.MPV01_UrlImagen.trim() : '',
      cabys: apiData.MPV01_CABYS,
      compuesto: apiData.MPV01_Compuesto || 'N',
      operador: (apiData.MPV01_Operador || '').trim()
    };
  }

  private mapDetalleFromApi(item: RecetaDetalleDto): RecetaDetallePayload {
    return {
      dR_Tipo: (item.MPV02_Tipo || '').trim(),
      dR_CodProducto: (item.MPV02_CodProducto || '').trim(),
      dR_NomProducto: (item.MPV02_NomProducto || '').trim(),
      dR_UnMProducto: (item.MPV02_UnMProducto || '').trim(),
      dR_CodEquival: String(item.MPV02_CodEquival ?? ''),
      dR_PorMerma: Number(item.MPV02_PorMerma) || 0,
      dR_CanProducto: Number(item.MPV02_CanProducto) || 0,
      dR_UMDestino: (item.MPV02_UnMDestino || '').trim(),
      dR_CtoProducto: Number(item.MPV02_CtoProducto) || 0,
      dR_CtoTotal: Number(item.MPV02_CtoTotal) || 0,
      dR_Orden: Number(item.MPV02_Orden) || 0
    };
  }

  private mapPagedResponse(
    response: { datos?: ServicioDto[]; paginacion?: unknown },
    pageNumber: number,
    pageSize: number
  ): ServiciosPaginados {
    const data = (response?.datos ?? []).map((item) => this.mapFromApi(item));
    const { totalRegistros, paginaActual, size, totalPages } = this.resolvePagination(response?.paginacion, {
      fallbackPageNumber: pageNumber,
      fallbackPageSize: pageSize,
      fallbackTotalRegistros: data.length
    });

    return { data, totalRegistros, paginaActual, pageSize: size, totalPages };
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

  private resolvePagination(
    paginacion: any,
    fallback: { fallbackPageNumber: number; fallbackPageSize: number; fallbackTotalRegistros: number }
  ): { totalRegistros: number; paginaActual: number; size: number; totalPages: number } {
    const totalRegistros = Number(
      paginacion?.totalRegistros ??
      paginacion?.totalRecords ??
      fallback.fallbackTotalRegistros
    ) || fallback.fallbackTotalRegistros;

    const paginaActual = Number(
      paginacion?.paginaActual ??
      paginacion?.pageNumber ??
      paginacion?.currentPage ??
      fallback.fallbackPageNumber
    ) || fallback.fallbackPageNumber;

    const size = Number(
      paginacion?.pageSize ??
      paginacion?.tamanoPagina ??
      paginacion?.cantidadPorPagina ??
      fallback.fallbackPageSize
    ) || fallback.fallbackPageSize;

    const totalPagesFromApi = Number(
      paginacion?.totalPaginas ??
      paginacion?.totalPages
    ) || 0;

    const totalPages = totalPagesFromApi > 0
      ? totalPagesFromApi
      : (totalRegistros > 0 ? Math.ceil(totalRegistros / size) : 1);

    return {
      totalRegistros,
      paginaActual,
      size,
      totalPages
    };
  }

  private getOperador(): string {
    return this.auth.getCurrentUser()?.usuario ?? '';
  }
}
