import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';

export interface ReservaDetalle {
  PRV02_ID: number;
  PRV02_CodReserva: string;
  PRV02_Linea: number;
  PRV02_TipoServicio: string;
  PRV02_CodServicio: string;
  PRV02_NomServicio: string;
  PRV02_FecServicio: string;
  PRV02_HoraServicio: string;
  PRV02_OrigenTexto: string;
  PRV02_DestinoTexto: string;
  PRV02_OrigenPlaceId: string;
  PRV02_DestinoPlaceId: string;
  PRV02_OrigenLat: number;
  PRV02_OrigenLng: number;
  PRV02_DestinoLat: number;
  PRV02_DestinoLng: number;
  PRV02_Adultos: number;
  PRV02_Ninos: number;
  PRV02_TotalPax: number;
  PRV02_CodLstPrecio: string;
  PRV02_IdReglaPrecio: number;
  PRV02_PrecioAdulto: number;
  PRV02_PrecioNino: number;
  PRV02_PrecioPaxExtra: number;
  PRV02_MontoServicio: number;
  PRV02_CodSuplidor: string;
  PRV02_Estado: string;
  PRV02_Observacion: string;
  PRV02_Operador: string;
  PRV02_FechaRegistro: string;
}

@Injectable({ providedIn: 'root' })
export class ReservaDetalleService {
  private apiUrl = `${environment.apiUrl}/reserva/detalle`;

  constructor(private http: HttpClient) {}

  private toIsoDateTime(value: any): string | null {
    if (!value) return null;
    if (typeof value === 'string') {
      const v = value.trim();
      if (!v) return null;
      if (v.includes('T')) return v;
      const d = new Date(v);
      if (!Number.isNaN(d.getTime())) return d.toISOString();
      return v;
    }
    if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString();
    return null;
  }

  private toApiPayload(payload: any, tipo: number): any {
    const p = payload ?? {};
    return {
      tipo,
      id: p.id ?? 0,
      codReserva: p.codReserva ?? '',
      linea: p.linea ?? 0,
      tipoServicio: p.tipoServicio ?? '',
      codServicio: p.codServicio ?? '',
      nomServicio: p.nomServicio ?? '',
      fecServicio: this.toIsoDateTime(p.fecServicio) ?? new Date().toISOString(),
      horaServicio: p.horaServicio ?? '',
      origenTexto: p.origenTexto ?? '',
      destinoTexto: p.destinoTexto ?? '',
      origenPlaceId: p.origenPlaceId ?? '',
      destinoPlaceId: p.destinoPlaceId ?? '',
      origenLat: p.origenLat ?? 0,
      origenLng: p.origenLng ?? 0,
      destinoLat: p.destinoLat ?? 0,
      destinoLng: p.destinoLng ?? 0,
      adultos: p.adultos ?? 0,
      ninos: p.ninos ?? 0,
      totalPax: p.totalPax ?? 0,
      codLstPrecio: p.codLstPrecio ?? '',
      idReglaPrecio: p.idReglaPrecio ?? 0,
      precioAdulto: p.precioAdulto ?? 0,
      precioNino: p.precioNino ?? 0,
      precioPaxExtra: p.precioPaxExtra ?? 0,
      montoServicio: p.montoServicio ?? 0,
      codSuplidor: p.codSuplidor ?? '',
      estado: p.estado ?? '',
      observacion: p.observacion ?? '',
      operador: p.operador ?? '',
      respuesta: p.respuesta ?? ''
    };
  }

  getDetalle(codReserva: string): Observable<ReservaDetalle[]> {
    return this.http.get<ReservaDetalle[]>(`${this.apiUrl}?codReserva=${codReserva}`);
  }

  crearDetalle(payload: any): Observable<any> {
    // Algunos endpoints devuelven texto/empty-body con 200 y Angular intenta parsear JSON => "Http failure during parsing".
    // Forzamos responseType 'text' para tratar 200 como éxito y evitar que el interceptor lo marque como error.
    return this.http.post(this.apiUrl, this.toApiPayload(payload, 1), { responseType: 'text' });
  }

  actualizarDetalle(payload: any): Observable<any> {
    return this.http.put(this.apiUrl, this.toApiPayload(payload, 2), { responseType: 'text' });
  }

  eliminarDetalle(id: number, codReserva: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}?id=${id}&codReserva=${codReserva}`, { responseType: 'text' });
  }
}
