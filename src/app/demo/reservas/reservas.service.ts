import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from 'src/environments/environment';

export interface Reserva {
  PRV01_CodReserva: string;
  PRV01_CodAgencia: string;
  PRV01_NomCliente: string;
  PRV01_TelCliente: string;
  PRV01_EmailCliente: string;
  PRV01_Idioma: string;
  PRV01_FormaReserva: string;
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

// Copia local del tipo para compatibilidad con ordenes.service.ts y orden-trabajo-form.component.ts
export interface ReservaDetalleDisponible {
  key: string;
  reservaId: number;
  detalleReservaId: number;
  numeroBoleta: number;
  clienteFinal: string;
  agencia: string;
  servicio: string;
  fechaServicio: string;
  hora: string;
  origen: string;
  destino: string;
  pax: number;
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

  getReservaByCod(codReserva: string): Observable<Reserva> {
    return this.http.get<Reserva>(`${this.apiUrl}?codReserva=${codReserva}`);
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

  // Devuelve un array vacío y muestra advertencia, ya que la función ya no existe en el servicio real
  getDetallesDisponibles(asignados: Set<string>): ReservaDetalleDisponible[] {
    // Esta función debe ser implementada con una llamada real a la API si es necesario
    // Por ahora, retorna un array vacío para evitar errores de compilación
    console.warn('getDetallesDisponibles: función mock, implementar llamada real a API si es necesario');
    return [];
  }
}
