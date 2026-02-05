import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from 'src/environments/environment';

export interface Reserva {
  PRV01_CodReserva: string;
  PRV01_CodAgencia: string;
  MPV00_NomClien: string;
  PRV01_NomCliente: string;
  PRV01_TelCliente: string;
  PRV01_EmailCliente: string;
  PRV01_Idioma: number | string;
  PRV01_FormaReserva: number | string;
  PRV01_FormaPago: string;
  PRV01_CodLstPrecio: string;
  PRV01_CodPlan: string;
  PRV01_FecCreacion: string;
  PRV01_FecConfirma: string;
  PRV01_FecAnulada: string;
  PRV01_FecIngresa: string;
  PRV01_FecSalida: string;
  PRV01_FecPrepago: string;
  PRV01_TotNoches: number;
  PRV01_TotDias: number;
  PRV01_Descripcion: string;
  PRV01_TCambio: number;
  PRV01_Folio: string;
  PRV01_Estado: string;
  PRV01_Moneda: string;
  PRV01_TotalRsv: number;
  PRV01_Observacion: string;
  PRV01_Procesado: number;
  PRV01_Directo: string;
  PRV01_CntHabitaciones: number;
  PRV01_Operador: string;
}

// Interfaces para detalles pendientes de asignar
export interface DetalleReservaPendienteDto {
  PRV02_ID: number;
  PRV02_CodReserva: string;
  PRV02_Linea: number;
  PRV01_NomCliente: string;
  PRV01_TelCliente: string;
  PRV01_EmailCliente: string;
  PRV01_CodAgencia: string;
  MPV00_NomAgencia: string;
  PRV01_Estado: string;
  PRV01_Folio: any;
  PRV02_TipoServicio: string;
  PRV02_CodServicio: string;
  PRV02_NomServicio: string;
  PRV02_Observacion: string;
  PRV02_FecServicio: string;
  PRV02_HoraServicio: string;
  PRV02_OrigenTexto: string;
  PRV02_ZonaOrigen: string;
  PRV02_OrigenPlaceId: string;
  PRV02_OrigenLat: number;
  PRV02_OrigenLng: number;
  PRV02_OrigenGoogle: string;
  PRV02_DestinoTexto: string;
  PRV02_ZonaDestino: string;
  PRV02_DestinoPlaceId: string;
  PRV02_DestinoLat: number;
  PRV02_DestinoLng: number;
  PRV02_DestinoGoogle: string;
  PRV02_Adultos: number;
  PRV02_Ninos: number;
  PRV02_TotalPax: number;
  PRV02_CodLstPrecio: string;
  PRV02_IdReglaPrecio: number;
  PRV02_PrecioAdulto: number;
  PRV02_PrecioNino: number;
  PRV02_PrecioPaxExtra: number;
  PRV02_MontoServicio: number;
  PRV01_Moneda: string;
  PRV02_Estado: string;
  AsignadoOT: number;
  CodOrdenTrabajo: any;
  DistanciaKm: number;
  TiempoEstimadoMin: number;
  PRV02_Operador: string;
  PRV02_FechaRegistro: string;
}

// Interfaz UI simplificada para orden de trabajo
export interface ReservaDetalleDisponible {
  key: string;
  id: number;
  codReserva: string;
  linea: number;
  cliente: string;
  telefono: string;
  email: string;
  agencia: string;
  nombreAgencia: string;
  estadoReserva: string;
  folio: string;
  tipoServicio: string;
  codServicio: string;
  servicio: string;
  observacion: string;
  fechaServicio: string;
  hora: string;
  origen: string;
  zonaOrigen: string;
  destino: string;
  zonaDestino: string;
  adultos: number;
  ninos: number;
  pax: number;
  precioAdulto: number;
  precioNino: number;
  montoServicio: number;
  moneda: string;
  distanciaKm: number;
  tiempoEstimadoMin: number;
  asignadoOT: boolean;
  codOrdenTrabajo: string | null;
}

@Injectable({ providedIn: 'root' })
export class ReservasService {
  private apiUrl = `${environment.apiUrl}/reserva`;

  constructor(private http: HttpClient) {}

  private toIsoDateTime(value: any): string | null {
    if (!value) return null;
    if (typeof value === 'string') {
      const v = value.trim();
      if (!v) return null;
      // If it's already an ISO-ish datetime, keep it as-is.
      if (v.includes('T')) return v;
      // If it's a YYYY-MM-DD date, convert to ISO datetime.
      const d = new Date(v);
      if (!Number.isNaN(d.getTime())) return d.toISOString();
      return v;
    }
    if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString();
    return null;
  }

  private toApiPayload(payload: any, tipo: number): any {
    const p = payload ?? {};

    // Support both "PRV01_*" shape and the API's expected DTO shape.
    const operador = p.operador ?? p.PRV01_Operador ?? '';
    const estado = p.estado ?? p.PRV01_Estado ?? '';
    const fecCreacion = this.toIsoDateTime(p.fecCreacion ?? p.PRV01_FecCreacion) ?? new Date().toISOString();

    return {
      ...p,
      tipo,
      codReserva: p.codReserva ?? p.PRV01_CodReserva ?? p.CodReserva ?? '',
      codAgencia: p.codAgencia ?? p.PRV01_CodAgencia ?? '',
      nomCliente: p.nomCliente ?? p.PRV01_NomCliente ?? '',
      telCliente: p.telCliente ?? p.PRV01_TelCliente ?? '',
      emailCliente: p.emailCliente ?? p.PRV01_EmailCliente ?? '',
      idioma: p.idioma ?? p.PRV01_Idioma ?? '',
      formaReserva: p.formaReserva ?? p.PRV01_FormaReserva ?? '',
      formaPago: p.formaPago ?? p.PRV01_FormaPago ?? '',
      codLstPrecio: p.codLstPrecio ?? p.PRV01_CodLstPrecio ?? '',
      codPlan: p.codPlan ?? p.PRV01_CodPlan ?? '',
      fecCreacion,
      estado,
      moneda: p.moneda ?? p.PRV01_Moneda ?? '',
      totalRsv: p.totalRsv ?? p.PRV01_TotalRsv ?? 0,
      observacion: p.observacion ?? p.PRV01_Observacion ?? '',
      operador
    };
  }

  getReservas(pageNumber: number, pageSize: number): Observable<{ data: Reserva[]; total: number }> {
    return this.http.get<any>(`${this.apiUrl}?pageNumber=${pageNumber}&pageSize=${pageSize}`)
      .pipe(map(res => {
        // Adaptar a la respuesta real de la API
        const datos = res.datos || [];
        const total = res.paginacion?.totalRegistros ?? datos.length;
        return { data: datos, total };
      }));
  }

  consultarReservas(options: {
    fechaInicio?: string | null;
    fechaFin?: string | null;
    parametroBusqueda?: string | null;
    pageNumber: number;
    pageSize: number;
  }): Observable<{ data: Reserva[]; total: number }> {
    let params = new HttpParams()
      .set('pageNumber', (options.pageNumber ?? 1).toString())
      .set('pageSize', (options.pageSize ?? 10).toString());

    const fechaInicio = (options.fechaInicio ?? '').toString().trim();
    const fechaFin = (options.fechaFin ?? '').toString().trim();
    const parametroBusqueda = (options.parametroBusqueda ?? '').toString().trim();

    if (fechaInicio) params = params.set('fechaInicio', fechaInicio);
    if (fechaFin) params = params.set('fechaFin', fechaFin);
    if (parametroBusqueda) params = params.set('parametroBusqueda', parametroBusqueda);

    return this.http.get<any>(`${this.apiUrl}/consulta`, { params }).pipe(
      map((res) => {
        const datos = res?.datos || [];
        const total = res?.paginacion?.totalRegistros ?? datos.length;
        return { data: datos, total };
      })
    );
  }

  getReservaByCod(codReserva: string): Observable<Reserva> {
    const encoded = encodeURIComponent((codReserva ?? '').toString().trim());
    return this.http.get<any>(`${this.apiUrl}/codigo/${encoded}`).pipe(
      map((res) => {
        const item = res?.datos?.[0] ?? (Array.isArray(res) ? res[0] : res);
        if (!item) {
          throw new Error('Reserva no encontrada');
        }
        return item as Reserva;
      })
    );
  }

  crearReserva(payload: any): Observable<any> {
    // Algunos endpoints devuelven texto/empty-body con 200 y Angular intenta parsear JSON => "Http failure during parsing".
    // En create normalmente necesitamos JSON para extraer codReserva; si el backend devuelve texto, esto se ajusta luego.
    return this.http.post<any>(this.apiUrl, this.toApiPayload(payload, 1));
  }

  actualizarReserva(codReserva: string, payload: any): Observable<any> {
    // El backend puede responder 200 con texto (no JSON). Forzamos text para evitar error de parsing y que el interceptor lo marque como error.
    return this.http.put(`${this.apiUrl}/${codReserva}`, this.toApiPayload(payload, 2), { responseType: 'text' });
  }

  confirmarReserva(codReserva: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/${codReserva}/confirmar`, {}, { responseType: 'text' });
  }

  eliminarReserva(codReserva: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${codReserva}`, { responseType: 'text' });
  }

  eliminarReservaBorrador(codReserva: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${codReserva}/eliminar`, { responseType: 'text' });
  }

  getDetallesPendientes(fechaIngreso: string, estado?: string, codReserva?: string): Observable<ReservaDetalleDisponible[]> {
    let params = new HttpParams().set('fechaIngreso', fechaIngreso);
    
    if (estado) {
      params = params.set('estado', estado);
    }
    if (codReserva) {
      params = params.set('codReserva', codReserva);
    }

    return this.http.get<{ datos?: DetalleReservaPendienteDto[] }>(`${this.apiUrl}/consulta-fecha-estado`, { params }).pipe(
      map((response) => {
        const datos = response?.datos ?? [];
        return datos
          .filter(d => d.AsignadoOT === 0) // Solo detalles no asignados
          .map((d) => this.mapDetallePendienteFromApi(d));
      })
    );
  }

  private mapDetallePendienteFromApi(apiData: DetalleReservaPendienteDto): ReservaDetalleDisponible {
    return {
      key: `${apiData.PRV02_CodReserva}-${apiData.PRV02_ID}`,
      id: apiData.PRV02_ID,
      codReserva: apiData.PRV02_CodReserva,
      linea: apiData.PRV02_Linea,
      cliente: apiData.PRV01_NomCliente,
      telefono: apiData.PRV01_TelCliente,
      email: apiData.PRV01_EmailCliente,
      agencia: apiData.PRV01_CodAgencia,
      nombreAgencia: apiData.MPV00_NomAgencia,
      estadoReserva: apiData.PRV01_Estado,
      folio: typeof apiData.PRV01_Folio === 'object' ? '' : String(apiData.PRV01_Folio || ''),
      tipoServicio: apiData.PRV02_TipoServicio,
      codServicio: apiData.PRV02_CodServicio,
      servicio: apiData.PRV02_NomServicio,
      observacion: apiData.PRV02_Observacion,
      fechaServicio: apiData.PRV02_FecServicio,
      hora: apiData.PRV02_HoraServicio,
      origen: apiData.PRV02_OrigenTexto,
      zonaOrigen: apiData.PRV02_ZonaOrigen,
      destino: apiData.PRV02_DestinoTexto,
      zonaDestino: apiData.PRV02_ZonaDestino,
      adultos: apiData.PRV02_Adultos,
      ninos: apiData.PRV02_Ninos,
      pax: apiData.PRV02_TotalPax,
      precioAdulto: apiData.PRV02_PrecioAdulto,
      precioNino: apiData.PRV02_PrecioNino,
      montoServicio: apiData.PRV02_MontoServicio,
      moneda: apiData.PRV01_Moneda,
      distanciaKm: apiData.DistanciaKm,
      tiempoEstimadoMin: apiData.TiempoEstimadoMin,
      asignadoOT: apiData.AsignadoOT === 1,
      codOrdenTrabajo: typeof apiData.CodOrdenTrabajo === 'object' ? null : String(apiData.CodOrdenTrabajo || '')
    };
  }
}
