import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { BehaviorSubject, Observable, forkJoin, throwError, of } from 'rxjs';
import { map, catchError, tap, switchMap } from 'rxjs/operators';

import { environment } from 'src/environments/environment';
import { ReservaDetalleDisponible } from '../reservas/reservas.service';

export type EstadoOrden = 'PEN' | 'ASI' | 'PRO' | 'COM' | 'CAN';

/**
 * Interfaz para opciones de estado con código y descripción
 */
export interface EstadoOrdenOption {
  codigo: EstadoOrden;
  descripcion: string;
  badge: string; // Clase CSS para el badge
}

/**
 * Catálogo de estados de órdenes de trabajo
 */
export const ESTADOS_OT: EstadoOrdenOption[] = [
  { codigo: 'PEN', descripcion: 'Pendiente', badge: 'badge-secondary' },
  { codigo: 'ASI', descripcion: 'Asignada', badge: 'badge-info' },
  { codigo: 'PRO', descripcion: 'En Proceso', badge: 'badge-warning' },
  { codigo: 'COM', descripcion: 'Completada', badge: 'badge-success' },
  { codigo: 'CAN', descripcion: 'Cancelada', badge: 'badge-danger' }
];

// ==================== DTOs del API ====================

/**
 * DTO para enviar al endpoint POST/PUT /api/ordentrabajo
 */
export interface OrdenTrabajoEncabezadoDTO {
  tipo: number;
  codOT?: string;              // Solo en PUT, generado automáticamente en POST
  codReserva: string;
  codSuplidor: string;
  fecServicio: string;         // ISO 8601: "2026-02-05T03:55:13.213Z"
  rutaCodigo: string;
  rotulacion: string;
  conexion: string;
  kmInicial: number;
  kmFinal: number;
  observaciones: string;
  estado: string;
  moneda: string;
  tCambio: number;
  totalOT: number;
  operador: string;
  codVehiculo: string;         // Código del vehículo asignado
  codChofer: string;           // Código del chofer asignado
  fechaInicio: string;
  fechaFin: string;
  nombreSuplidor: string;
  pageNumber?: number;
  pageSize?: number;
  respuesta?: string;
}

/**
 * Response del POST encabezado
 */
export interface OrdenTrabajoEncabezadoResponse {
  mensaje?: string;
  datos?: Array<{ CodOT?: string }>;
  respuesta?: string;  // Mantener retrocompatibilidad
}

/**
 * DTO de respuesta del GET /api/ordentrabajo/codigo/{codOT}
 */
export interface EncabezadoOrdenTrabajoApiDTO {
  PRV10_CodOT: string;
  PRV10_CodReserva: string;
  PRV10_CodSuplidor: string;
  MRV10_DescSuplidor: string;
  PRV10_FecServicio: string;
  PRV10_RutaCodigo: string;
  PRV10_Rotulacion: string;
  PRV10_Conexion: string;
  PRV10_KmInicial: number;
  PRV10_KmFinal: number;
  KmRecorridos: number;
  PRV10_Observaciones: string;
  PRV10_Estado: string;
  EstadoDescripcion: string;
  PRV10_Moneda: string;
  PRV10_TCambio: number;
  PRV10_TotalOT: number;
  PRV10_Operador: string;
  PRV10_FechaRegistro: string;
  PRV10_CodVehiculo: string;
  MRV11_Placa:string;
  PRV10_CodChofer: string;
  MRV12_NombreCompleto:string;
}

/**
 * Response del GET encabezado por código
 */
export interface EncabezadoOrdenTrabajoApiResponse {
  datos: EncabezadoOrdenTrabajoApiDTO[];
}

/**
 * DTO para enviar al endpoint POST/PUT /api/orden-trabajo/detalle
 */
export interface OrdenTrabajoDetalleDTO {
  tipo: number;
  id?: number;                 // Solo en PUT
  codOT: string;
  linea: number;               // Secuencia
  codReserva: string;
  idDetReserva: number;
  codServicio: string;
  nomServicio: string;
  origenTexto: string;
  destinoTexto: string;
  origenPlaceId: string;
  destinoPlaceId: string;
  origenLat: number;
  origenLng: number;
  destinoLat: number;
  destinoLng: number;
  horaPax: string;
  adultos: number;
  ninos: number;
  totalPax: number;
  boleta: string;
  voucher: string;
  agenciaCobro: string;
  estado: string;
  observacion: string;
  operador: string;
  respuesta?: string;
}

/**
 * DTO de respuesta del GET /api/orden-trabajo/detalle/por-codOT
 */
export interface DetalleOrdenTrabajoApiDTO {
  PRV11_ID: number;
  PRV11_CodOT: string;
  PRV11_Linea: number;
  PRV11_CodReserva: string;
  PRV11_IdDetReserva: number;
  PRV11_CodServicio: string;
  PRV11_NomServicio: string;
  PRV11_OrigenTexto: string;
  PRV11_DestinoTexto: string;
  PRV11_OrigenPlaceId: string;
  PRV11_DestinoPlaceId: string;
  PRV11_OrigenLat: number;
  PRV11_OrigenLng: number;
  PRV11_DestinoLat: number;
  PRV11_DestinoLng: number;
  PRV11_HoraPax: string;
  PRV11_Adultos: number;
  PRV11_Ninos: number;
  PRV11_TotalPax: number;
  PRV11_Boleta: string;
  PRV11_Voucher: string;
  PRV11_AgenciaCobro: string;
  PRV11_Estado: string;
  PRV11_Observacion: string;
  PRV11_Operador: string;
  PRV11_FechaRegistro: string;
  PRV01_NomCliente: string;
  PRV01_TelCliente: string;
  PRV01_EmailCliente: string;
}

/**
 * Response del GET detalles por codOT
 */
export interface DetalleOrdenTrabajoApiResponse {
  datos: DetalleOrdenTrabajoApiDTO[];
}

// ==================== Modelos de UI ====================

export interface OrdenTrabajoDetalle {
  id: number;
  reservaId: string;           // Cambiado de number a string (código de reserva)
  numeroBoleta: string;         // Cambiado de number a string (folio)
  clienteFinal: string;
  telefonoCliente?: string;     // Teléfono del cliente
  emailCliente?: string;        // Email del cliente
  agencia: string;
  servicioId?: string;         // Código del servicio
  servicio: string;
  fechaServicio: string;
  hora: string;
  
  // ORIGEN Y DESTINO DE LA RESERVA (Solo lectura, informativo)
  origenReserva: string;        // Origen original de la reserva
  destinoReserva: string;       // Destino original de la reserva
  
  // ORIGEN Y DESTINO DE LA ORDEN DE TRABAJO (Editable)
  origenOT: string;             // Origen para este tramo específico de la OT
  destinoOT: string;            // Destino para este tramo específico de la OT
  
  // Información geográfica
  origenPlaceId?: string;
  destinoPlaceId?: string;
  origenLat?: number;
  origenLng?: number;
  destinoLat?: number;
  destinoLng?: number;
  
  // Datos de pasajeros
  pax: number;
  adultos?: number;
  ninos?: number;
  
  // Referencias y documentos
  detalleReservaId?: number;    // ID del PRV02
  boleta?: string;              // Número de boleta
  voucher?: string;             // Número de voucher
  
  // Información financiera
  montoServicio?: number;       // Precio del servicio
  moneda?: string;              // Moneda (USD, CRC)
  
  // Observaciones
  observaciones?: string;       // Observaciones del servicio
}

export interface OrdenTrabajo {
  id: number;
  numeroOrden: number;
  codOT?: string;               // Código generado por el backend
  fechaCreacion: string;
  fechaServicio: string;
  suplidor: string;
  codSuplidor?: string;
  ruta: string;
  conexion?: string;
  observaciones?: string;
  kmInicial?: number;
  kmFinal?: number;
  rotulacion?: boolean;
  codVehiculo?: string;
  placaVehiculo?: string;          // Placa del vehículo (opcional, para mostrar en UI)
  codChofer?: string;
  nombreChofer?: string;          // Nombre del chofer (opcional, para mostrar en UI)
  estado: EstadoOrden;
  moneda?: string;              // Moneda de la orden
  detalles: OrdenTrabajoDetalle[];
  totalPax: number;
  totalPagar: number;
}

export interface OrdenTrabajoFiltros {
  numeroOrden?: string;
  fechaDesde?: string;
  fechaHasta?: string;
  suplidor?: string;
  estado?: EstadoOrden | '';
  rutaZona?: string;
  agencia?: string;
}

@Injectable({
  providedIn: 'root'
})
export class OrdenesService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/ordentrabajo`;
  private readonly apiDetalleUrl = `${environment.apiUrl}/orden-trabajo/detalle`;
  
  private readonly ordenesSubject = new BehaviorSubject<OrdenTrabajo[]>([]);

  private lastId = this.ordenesSubject.getValue().length;
  private readonly detallesAsignados = new Set<string>();

  constructor() {
    this.syncDetallesAsignados();
  }

  getAll(): Observable<OrdenTrabajo[]> {
    return this.ordenesSubject.asObservable();
  }

  getOrdenes(): OrdenTrabajo[] {
    return this.ordenesSubject.getValue();
  }

  getOrdenById(id: number): OrdenTrabajo | undefined {
    return this.getOrdenes().find(o => o.id === id);
  }

  getOrdenByCodOT(codOT: string): OrdenTrabajo | undefined {
    return this.getOrdenes().find(o => o.codOT === codOT);
  }

  /**
   * Obtiene los detalles de una orden desde el API por codOT
   */
  getDetallesPorCodOT(codOT: string): Observable<OrdenTrabajoDetalle[]> {
    const url = `${this.apiDetalleUrl}/por-codOT`;
    const params = new HttpParams().set('codOT', codOT);

    console.log('🔍 Obteniendo detalles de orden:', codOT);
    console.log('   URL:', url);

    return this.http.get<DetalleOrdenTrabajoApiResponse>(url, { params }).pipe(
      map(response => {
        const datos = response?.datos ?? [];
        console.log('✅ Detalles recibidos:', datos.length);
        return datos.map(d => this.mapDetalleApiToUI(d));
      }),
      catchError(error => {
        console.error('❌ Error obteniendo detalles de orden:', error);
        return throwError(() => new Error(error.error?.respuesta || 'Error al obtener detalles de la orden'));
      })
    );
  }

  /**
   * Obtiene el encabezado de una orden desde el API por codOT
   */
  getEncabezadoPorCodOT(codOT: string): Observable<OrdenTrabajo | null> {
    const url = `${this.apiUrl}/codigo/${codOT}`;

    console.log('🔍 Obteniendo encabezado de orden:', codOT);
    console.log('   URL:', url);

    return this.http.get<EncabezadoOrdenTrabajoApiResponse>(url).pipe(
      map(response => {
        const datos = response?.datos ?? [];
        if (datos.length === 0) {
          console.warn('⚠️ No se encontró encabezado para:', codOT);
          return null;
        }
        console.log('✅ Encabezado recibido:', datos[0]);
        return this.mapEncabezadoApiToUI(datos[0]);
      }),
      catchError(error => {
        console.error('❌ Error obteniendo encabezado de orden:', error);
        return throwError(() => new Error(error.error?.respuesta || 'Error al obtener el encabezado de la orden'));
      })
    );
  }

  /**
   * Obtiene la orden completa (encabezado + detalles) por codOT
   */
  getOrdenCompletaPorCodOT(codOT: string): Observable<OrdenTrabajo> {
    console.log('🚀 Obteniendo orden completa:', codOT);
    
    return forkJoin({
      encabezado: this.getEncabezadoPorCodOT(codOT),
      detalles: this.getDetallesPorCodOT(codOT)
    }).pipe(
      map(({ encabezado, detalles }) => {
        if (!encabezado) {
          throw new Error('No se encontró el encabezado de la orden');
        }
        
        // Combinar encabezado con detalles
        const ordenCompleta: OrdenTrabajo = {
          ...encabezado,
          detalles
        };
        
        console.log('✅ Orden completa obtenida:', ordenCompleta);
        return ordenCompleta;
      })
    );
  }

  /**
   * Mapea el encabezado del API al modelo de UI
   */
  private mapEncabezadoApiToUI(apiEncabezado: EncabezadoOrdenTrabajoApiDTO): OrdenTrabajo {
    return {
      id: 0, // No hay ID numérico en el API
      numeroOrden: 0, // Se podría extraer del codOT si es necesario
      codOT: apiEncabezado.PRV10_CodOT,
      fechaCreacion: apiEncabezado.PRV10_FechaRegistro?.split('T')[0] ?? '',
      fechaServicio: apiEncabezado.PRV10_FecServicio?.split('T')[0] ?? '',
      suplidor: apiEncabezado.MRV10_DescSuplidor || '',
      codSuplidor: apiEncabezado.PRV10_CodSuplidor,
      ruta: apiEncabezado.PRV10_RutaCodigo || '',
      conexion: apiEncabezado.PRV10_Conexion || '',
      observaciones: apiEncabezado.PRV10_Observaciones || '',
      kmInicial: apiEncabezado.PRV10_KmInicial || 0,
      kmFinal: apiEncabezado.PRV10_KmFinal || 0,
      rotulacion: apiEncabezado.PRV10_Rotulacion === '1' || apiEncabezado.PRV10_Rotulacion?.toLowerCase() === 'true',
      codVehiculo: apiEncabezado.PRV10_CodVehiculo || '',
      placaVehiculo: apiEncabezado.MRV11_Placa || '', // Placa del vehículo
      codChofer: apiEncabezado.PRV10_CodChofer || '',
      nombreChofer: apiEncabezado.MRV12_NombreCompleto || '', // Nombre del chofer
      estado: this.mapEstadoCodigo(apiEncabezado.PRV10_Estado),
      moneda: apiEncabezado.PRV10_Moneda || 'USD',
      detalles: [], // Se llenarán después
      totalPax: 0, // Se calculará desde detalles
      totalPagar: apiEncabezado.PRV10_TotalOT || 0
    };
  }

  /**
   * Mapea el código de estado del API al tipo EstadoOrden
   */
  private mapEstadoCodigo(estadoApi: string): EstadoOrden {
    const codigo = (estadoApi || 'PEN').toUpperCase().trim();
    
    if (['PEN', 'ASI', 'PRO', 'COM', 'CAN'].includes(codigo)) {
      return codigo as EstadoOrden;
    }
    
    // Mapeo de estados no estándar
    const mapeo: Record<string, EstadoOrden> = {
      'PENDIENTE': 'PEN',
      'ASIGNADA': 'ASI',
      'EN PROCESO': 'PRO',
      'PROCESO': 'PRO',
      'COMPLETADA': 'COM',
      'FINALIZADA': 'COM',
      'CANCELADA': 'CAN',
      'ANULADA': 'CAN'
    };
    
    return mapeo[codigo] || 'PEN';
  }

  /**
   * Mapea un detalle del API al modelo de UI
   */
  private mapDetalleApiToUI(apiDetalle: DetalleOrdenTrabajoApiDTO): OrdenTrabajoDetalle {
    // Parsear PlaceId JSON para obtener lat/lng
    const origenPlace = this.parsePlaceIdJson(apiDetalle.PRV11_OrigenPlaceId);
    const destinoPlace = this.parsePlaceIdJson(apiDetalle.PRV11_DestinoPlaceId);
    
    return {
      id: apiDetalle.PRV11_ID,
      reservaId: apiDetalle.PRV11_CodReserva,
      numeroBoleta: apiDetalle.PRV11_Boleta || apiDetalle.PRV11_CodReserva,
      clienteFinal: apiDetalle.PRV01_NomCliente || '',
      telefonoCliente: apiDetalle.PRV01_TelCliente || '',
      emailCliente: apiDetalle.PRV01_EmailCliente || '',
      agencia: apiDetalle.PRV11_AgenciaCobro,
      servicioId: apiDetalle.PRV11_CodServicio,
      servicio: apiDetalle.PRV11_NomServicio,
      fechaServicio: apiDetalle.PRV11_FechaRegistro?.split('T')[0] ?? '',
      hora: apiDetalle.PRV11_HoraPax,
      
      origenReserva: apiDetalle.PRV11_OrigenTexto,
      destinoReserva: apiDetalle.PRV11_DestinoTexto,
      
      origenOT: apiDetalle.PRV11_OrigenTexto,
      destinoOT: apiDetalle.PRV11_DestinoTexto,
      
      origenPlaceId: origenPlace?.placeId || apiDetalle.PRV11_OrigenPlaceId || '',
      destinoPlaceId: destinoPlace?.placeId || apiDetalle.PRV11_DestinoPlaceId || '',
      origenLat: origenPlace?.lat || apiDetalle.PRV11_OrigenLat || 0,
      origenLng: origenPlace?.lng || apiDetalle.PRV11_OrigenLng || 0,
      destinoLat: destinoPlace?.lat || apiDetalle.PRV11_DestinoLat || 0,
      destinoLng: destinoPlace?.lng || apiDetalle.PRV11_DestinoLng || 0,
      
      pax: apiDetalle.PRV11_TotalPax,
      adultos: apiDetalle.PRV11_Adultos,
      ninos: apiDetalle.PRV11_Ninos,
      
      detalleReservaId: apiDetalle.PRV11_IdDetReserva,
      boleta: apiDetalle.PRV11_Boleta,
      voucher: apiDetalle.PRV11_Voucher,
      
      montoServicio: 0, // No viene en la respuesta
      moneda: undefined,
      
      observaciones: apiDetalle.PRV11_Observacion
    };
  }

  /**
   * Parsea el JSON string del PlaceId para extraer coordenadas
   */
  private parsePlaceIdJson(placeIdJson: string): { placeId: string; lat: number; lng: number } | null {
    if (!placeIdJson) return null;
    
    try {
      const parsed = JSON.parse(placeIdJson);
      return {
        placeId: parsed.placeId || '',
        lat: parsed.lat || 0,
        lng: parsed.lng || 0
      };
    } catch (err) {
      console.warn('Error parseando PlaceId JSON:', err);
      return null;
    }
  }

  createOrden(
    orden: Omit<OrdenTrabajo, 'id' | 'numeroOrden' | 'fechaCreacion' | 'estado' | 'totalPax'> & { estado?: EstadoOrden; totalPagar?: number }
  ): OrdenTrabajo {
    this.lastId += 1;
    const numeroOrden = this.generarNumeroOrden();
    const fechaCreacion = new Date().toISOString().split('T')[0];
    const estado = orden.estado ?? 'PEN';
    const { totalPax, totalPagar } = this.recalcularTotales(orden.detalles, orden.totalPagar);

    const nuevaOrden: OrdenTrabajo = {
      ...orden,
      id: this.lastId,
      numeroOrden,
      fechaCreacion,
      estado,
      totalPax,
      totalPagar
    };

    this.emit([...this.getOrdenes(), nuevaOrden]);
    return nuevaOrden;
  }

  updateOrden(ordenActualizada: OrdenTrabajo): void {
    const { totalPax, totalPagar } = this.recalcularTotales(ordenActualizada.detalles, ordenActualizada.totalPagar);
    const updated = this.getOrdenes().map(orden =>
      orden.id === ordenActualizada.id ? { ...ordenActualizada, totalPax, totalPagar } : orden
    );
    this.emit(updated);
  }

  addDetalle(ordenId: number, detalle: OrdenTrabajoDetalle): void {
    const updated = this.getOrdenes().map(orden => {
      if (orden.id !== ordenId) {
        return orden;
      }
      const detalles = [...orden.detalles, detalle];
      const { totalPax, totalPagar } = this.recalcularTotales(detalles);
      return { ...orden, detalles, totalPax, totalPagar };
    });
    this.emit(updated);
  }

  removeDetalle(ordenId: number, detalleId: number): void {
    const updated = this.getOrdenes().map(orden => {
      if (orden.id !== ordenId) {
        return orden;
      }
      const detalles = orden.detalles.filter(d => d.id !== detalleId);
      const { totalPax, totalPagar } = this.recalcularTotales(detalles);
      return { ...orden, detalles, totalPax, totalPagar };
    });
    this.emit(updated);
  }

  changeEstado(id: number, estado: EstadoOrden): void {
    const updated = this.getOrdenes().map(orden => (orden.id === id ? { ...orden, estado } : orden));
    this.emit(updated);
  }

  actualizarEstado(id: number, estado: EstadoOrden): void {
    this.changeEstado(id, estado);
  }

  anularOrden(id: number): void {
    this.changeEstado(id, 'CAN');
  }

  filtrarOrdenes(filtros: OrdenTrabajoFiltros): OrdenTrabajo[] {
    return this.getOrdenes().filter(orden => {
      const ruta = orden.ruta || '';
      const matchNumero =
        !filtros.numeroOrden || orden.numeroOrden.toString().toLowerCase().includes(filtros.numeroOrden.toLowerCase());
      const matchFechaDesde = !filtros.fechaDesde || orden.fechaServicio >= filtros.fechaDesde;
      const matchFechaHasta = !filtros.fechaHasta || orden.fechaServicio <= filtros.fechaHasta;
      const matchSuplidor = !filtros.suplidor || orden.suplidor === filtros.suplidor;
      const matchEstado = !filtros.estado || orden.estado === filtros.estado;
      const matchRuta =
        !filtros.rutaZona || ruta.toLowerCase().includes(filtros.rutaZona.toLowerCase());
      const matchAgencia =
        !filtros.agencia ||
        orden.detalles.some(det => det.agencia === filtros.agencia) ||
        (orden.detalles.length === 0 && ruta.includes(filtros.agencia));

      return (
        matchNumero &&
        matchFechaDesde &&
        matchFechaHasta &&
        matchSuplidor &&
        matchEstado &&
        matchRuta &&
        matchAgencia
      );
    });
  }

  getDetallesAsignados(): Set<string> {
    return new Set(this.detallesAsignados);
  }

  /**
   * Mapea un detalle de reserva disponible a un detalle de orden de trabajo.
   * @param disponible - Detalle de reserva disponible
   * @param nextDetalleId - ID secuencial para el detalle
   * @param origenCustom - Origen personalizado para la OT (opcional, si no se provee usa el de la reserva)
   * @param destinoCustom - Destino personalizado para la OT (opcional, si no se provee usa el de la reserva)
   */
  mapDisponibleADetalle(
    disponible: ReservaDetalleDisponible, 
    nextDetalleId: number,
    origenCustom?: string,
    destinoCustom?: string
  ): OrdenTrabajoDetalle {
    return {
      id: nextDetalleId,
      reservaId: disponible.codReserva,
      numeroBoleta: disponible.folio || disponible.codReserva,
      clienteFinal: disponible.cliente,
      agencia: disponible.nombreAgencia || disponible.agencia,
      servicioId: disponible.codServicio,
      servicio: disponible.servicio,
      fechaServicio: disponible.fechaServicio,
      hora: disponible.hora,
      
      // Origen y destino de la reserva (inmutable)
      origenReserva: disponible.origen,
      destinoReserva: disponible.destino,
      
      // Origen y destino de la OT (editable, por defecto copia los de la reserva)
      origenOT: origenCustom || disponible.origen,
      destinoOT: destinoCustom || disponible.destino,
      
      // Información geográfica (Google Places ID y coordenadas)
      origenPlaceId: disponible.origenPlaceId || '',
      destinoPlaceId: disponible.destinoPlaceId || '',
      origenLat: disponible.origenLat || 0,
      origenLng: disponible.origenLng || 0,
      destinoLat: disponible.destinoLat || 0,
      destinoLng: disponible.destinoLng || 0,
      
      // Pasajeros
      pax: disponible.pax,
      adultos: disponible.adultos,
      ninos: disponible.ninos,
      
      // Referencias
      detalleReservaId: disponible.id,
      boleta: disponible.folio,
      voucher: disponible.folio, // Usar folio como voucher por ahora
      
      // Financiero
      montoServicio: disponible.montoServicio,
      moneda: disponible.moneda,
      
      // Observaciones
      observaciones: disponible.observacion
    };
  }

  private generarNumeroOrden(): number {
    const base = 2025000;
    const currentMax = Math.max(...this.getOrdenes().map(o => o.numeroOrden), base);
    return currentMax + 1;
  }

  private recalcularTotales(detalles: OrdenTrabajoDetalle[], totalPagarManual?: number): { totalPax: number; totalPagar: number } {
    const totalPax = detalles.reduce((sum, d) => sum + d.pax, 0);
    const totalCalculado = detalles.reduce((sum, d) => sum + d.pax * 15000, 0);
    const totalPagar = typeof totalPagarManual === 'number' && totalPagarManual > 0 ? totalPagarManual : totalCalculado;
    return { totalPax, totalPagar };
  }

  private emit(ordenes: OrdenTrabajo[]): void {
    this.ordenesSubject.next(ordenes);
    this.syncDetallesAsignados();
  }

  private syncDetallesAsignados(): void {
    this.detallesAsignados.clear();
    this.getOrdenes().forEach(orden => {
      orden.detalles.forEach(det => {
        const key = `${det.reservaId}-${det.detalleReservaId ?? det.id}`;
        this.detallesAsignados.add(key);
      });
    });
  }

  // ========================================
  // API PERSISTENCE METHODS
  // ========================================

  /**
   * Guarda el encabezado de la orden de trabajo (POST).
   * Retorna el codOT generado por el backend.
   */
  guardarEncabezado(dto: OrdenTrabajoEncabezadoDTO): Observable<OrdenTrabajoEncabezadoResponse> {
    console.log('=== GUARDANDO ENCABEZADO ===');
    console.log('URL:', this.apiUrl);
    console.log('Método: POST');
    console.log('DTO enviado:', JSON.stringify(dto, null, 2));
    console.log('🔍 Verificación de tipos de datos:');
    console.log('  - tipo:', typeof dto.tipo, dto.tipo);
    console.log('  - codSuplidor:', typeof dto.codSuplidor, dto.codSuplidor);
    console.log('  - kmInicial:', typeof dto.kmInicial, dto.kmInicial);
    console.log('  - kmFinal:', typeof dto.kmFinal, dto.kmFinal);
    console.log('  - tCambio:', typeof dto.tCambio, dto.tCambio);
    console.log('  - totalOT:', typeof dto.totalOT, dto.totalOT);
    console.log('  - estado:', typeof dto.estado, dto.estado);
    console.log('  - codVehiculo:', typeof dto.codVehiculo, dto.codVehiculo);
    console.log('  - codChofer:', typeof dto.codChofer, dto.codChofer);
    
    return this.http.post<OrdenTrabajoEncabezadoResponse>(this.apiUrl, dto).pipe(
      tap(response => {
        console.log('✅ Encabezado guardado exitosamente');
        console.log('Response completo:', response);
        console.log('Estructura de response:', {
          mensaje: response.mensaje,
          datos: response.datos,
          codOT_extraido: response.datos?.[0]?.CodOT
        });
      }),
      catchError(error => {
        console.error('❌ Error al guardar encabezado');
        console.error('Status:', error.status);
        console.error('StatusText:', error.statusText);
        console.error('Error completo:', error);
        console.error('Error body:', error.error);
        return throwError(() => new Error(error.error?.respuesta || error.error?.mensaje || error.message || 'Error al guardar el encabezado de la orden'));
      })
    );
  }

  /**
   * Actualiza el encabezado de una orden existente (PUT).
   * El codOT va en la URL, no en el body.
   */
  actualizarEncabezado(codOT: string, dto: OrdenTrabajoEncabezadoDTO): Observable<any> {
    const url = `${this.apiUrl}/${codOT}`;
    console.log('=== ACTUALIZANDO ENCABEZADO ===');
    console.log('URL completa:', url);
    console.log('Método: PUT');
    console.log('CodOT en URL:', codOT);
    console.log('DTO enviado (body):', JSON.stringify(dto, null, 2));
    
    // Usar responseType: 'text' porque la API devuelve texto plano en vez de JSON
    return this.http.put(url, dto, { responseType: 'text' }).pipe(
      tap(response => {
        console.log('✅ Encabezado actualizado exitosamente');
        console.log('Response:', response);
      }),
      catchError(error => {
        console.error('❌ Error al actualizar encabezado');
        console.error('Status:', error.status);
        console.error('Error completo:', error);
        
        // Si el error es 200 con problema de parsing, considerarlo éxito
        if (error.status === 200) {
          console.log('⚠️ Status 200 con error de parsing - considerando como éxito');
          return of({ mensaje: 'Actualizado correctamente' });
        }
        
        return throwError(() => new Error(error.error?.respuesta || error.error?.mensaje || 'Error al actualizar el encabezado'));
      })
    );
  }

  /**
   * Guarda un detalle individual de la orden (POST).
   */
  guardarDetalle(dto: OrdenTrabajoDetalleDTO): Observable<any> {
    console.log(`📝 Guardando detalle línea ${dto.linea}:`, { codOT: dto.codOT, servicio: dto.nomServicio });
    
    return this.http.post(this.apiDetalleUrl, dto).pipe(
      tap(response => console.log(`✅ Detalle línea ${dto.linea} guardado:`, response)),
      catchError(error => {
        console.error(`❌ Error al guardar detalle línea ${dto.linea}:`, error);
        return throwError(() => new Error(error.error?.respuesta || 'Error al guardar detalle'));
      })
    );
  }

  /**
   * Actualiza un detalle existente de la orden (PUT).
   */
  actualizarDetalle(dto: OrdenTrabajoDetalleDTO): Observable<any> {
    console.log(`🔄 Actualizando detalle ID ${dto.id}, línea ${dto.linea}:`, { codOT: dto.codOT, servicio: dto.nomServicio });
    
    return this.http.put(this.apiDetalleUrl, dto).pipe(
      tap(response => console.log(`✅ Detalle ID ${dto.id} actualizado:`, response)),
      catchError(error => {
        console.error(`❌ Error al actualizar detalle ID ${dto.id}:`, error);
        return throwError(() => new Error(error.error?.respuesta || 'Error al actualizar detalle'));
      })
    );
  }

  /**
   * Elimina un detalle de la orden (DELETE).
   */
  eliminarDetalle(id: number): Observable<any> {
    console.log(`🗑️ Eliminando detalle ID ${id}`);
    
    return this.http.delete(`${this.apiDetalleUrl}/${id}`).pipe(
      tap(response => console.log(`✅ Detalle ID ${id} eliminado:`, response)),
      catchError(error => {
        console.error(`❌ Error al eliminar detalle ID ${id}:`, error);
        return throwError(() => new Error(error.error?.respuesta || 'Error al eliminar detalle'));
      })
    );
  }

  /**
   * Actualiza el suplidor, vehículo y chofer de una orden de trabajo.
   * Endpoint: PUT /api/ordentrabajo/{codOT}/suplidor-vehiculo
   */
  actualizarSuplidorVehiculo(
    codOT: string, 
    codSuplidor: string, 
    codVehiculo: string, 
    codChofer: string,
    operador: string
  ): Observable<any> {
    const url = `${this.apiUrl}/${codOT}/suplidor-vehiculo`;
    const body = {
      codSuplidor,
      codVehiculo,
      codChofer,
      operador
    };
    
    console.log('=== ACTUALIZANDO SUPLIDOR/VEHÍCULO/CHOFER ===');
    console.log('URL:', url);
    console.log('Body:', body);
    
    return this.http.put(url, body, { responseType: 'text' }).pipe(
      tap(response => {
        console.log('✅ Suplidor/Vehículo/Chofer actualizados exitosamente');
        console.log('Response:', response);
      }),
      catchError(error => {
        console.error('❌ Error al actualizar suplidor/vehículo/chofer');
        console.error('Error completo:', error);
        
        // Si el error es 200 con problema de parsing, considerarlo éxito
        if (error.status === 200) {
          console.log('⚠️ Status 200 con error de parsing - considerando como éxito');
          return of({ mensaje: 'Actualizado correctamente' });
        }
        
        return throwError(() => new Error(error.error?.respuesta || error.error?.mensaje || 'Error al actualizar'));
      })
    );
  }

  /**
   * Guarda o actualiza la orden completa: encabezado + todos los detalles.
   * Estrategia:
   * 1. Si codOTExistente, actualiza encabezado (PUT), sino crea (POST) → recibe codOT
   * 2. Si es edición, hace diff de detalles (nuevos/modificados/eliminados)
   * 3. Ejecuta operaciones correspondientes en paralelo usando forkJoin
   * 4. Retorna el codOT y el resultado de todas las operaciones
   * 
   * @param encabezadoDTO - DTO del encabezado
   * @param detalles - Array de detalles actuales de la orden
   * @param operador - Usuario que realiza la operación
   * @param codOTExistente - Si está presente, actualiza la orden existente (modo edición)
   * @param detallesOriginales - Snapshot de detalles originales para hacer diff (solo en edición)
   */
  guardarOrdenCompleta(
    encabezadoDTO: OrdenTrabajoEncabezadoDTO, 
    detalles: OrdenTrabajoDetalle[],
    operador: string = 'Admin',
    codOTExistente?: string,
    detallesOriginales?: OrdenTrabajoDetalle[]
  ): Observable<{ codOT: string; detallesGuardados: number; errores: any[] }> {
    const esEdicion = !!codOTExistente;
    console.log('🚀 === INICIANDO', esEdicion ? 'ACTUALIZACIÓN' : 'GUARDADO', 'DE ORDEN COMPLETA ===');
    console.log('CodOT existente:', codOTExistente);
    console.log('Cantidad de detalles:', detalles.length);
    console.log('Operador:', operador);
    
    // Paso 1: Guardar o actualizar encabezado
    const encabezadoObs$: Observable<OrdenTrabajoEncabezadoResponse> = esEdicion 
      ? this.actualizarEncabezado(codOTExistente!, encabezadoDTO).pipe(
          map(() => ({ datos: [{ CodOT: codOTExistente }] } as OrdenTrabajoEncabezadoResponse))
        )
      : this.guardarEncabezado(encabezadoDTO);
    
    return encabezadoObs$.pipe(
      // Paso 2: Con el codOT, preparar y guardar detalles
      switchMap((responseEncabezado: OrdenTrabajoEncabezadoResponse) => {
        // Extraer codOT de la nueva estructura de respuesta
        const codOT = responseEncabezado.datos?.[0]?.CodOT || '';
        
        console.log('🎯 CodOT recibido del backend:', codOT);
        
        if (!codOT) {
          console.error('⚠️ No se recibió codOT del backend');
          return throwError(() => new Error('No se recibió el código de la orden del servidor'));
        }
        
        // Si no hay detalles, retornar directamente
        if (!detalles || detalles.length === 0) {
          // Si es edición y había detalles originales, eliminarlos todos
          if (esEdicion && detallesOriginales && detallesOriginales.length > 0) {
            console.log('🗑️ Eliminando todos los detalles de la orden...');
            const deleteObs = detallesOriginales
              .filter(d => d.detalleReservaId)
              .map(d => this.eliminarDetalle(d.detalleReservaId!).pipe(
                map(() => ({ success: true, operacion: 'delete', id: d.detalleReservaId })),
                catchError(error => of({ success: false, operacion: 'delete', id: d.detalleReservaId, error }))
              ));
            
            if (deleteObs.length === 0) {
              return of({ codOT, detallesGuardados: 0, errores: [] });
            }
            
            return forkJoin(deleteObs).pipe(
              map(resultados => ({
                codOT,
                detallesGuardados: 0,
                errores: resultados.filter(r => !r.success)
              }))
            );
          }
          return of({ codOT, detallesGuardados: 0, errores: [] });
        }
        
        // Determinar operaciones a realizar según si es edición o creación
        let operaciones: Observable<{ success: boolean; operacion: string; dto?: any; id?: number; error?: any }>[] = [];
        
        if (esEdicion && detallesOriginales) {
          console.log('🔍 Modo EDICIÓN: Analizando diferencias en detalles...');
          const diff = this.calcularDiffDetalles(detalles, detallesOriginales, codOT, operador);
          
          console.log('📊 Resumen de cambios:', {
            nuevos: diff.nuevos.length,
            modificados: diff.modificados.length,
            eliminados: diff.eliminados.length,
            sinCambios: diff.sinCambios
          });
          
          // Crear observables para cada operación
          operaciones = [
            ...diff.nuevos.map(dto => 
              this.guardarDetalle(dto).pipe(
                map(() => ({ success: true, operacion: 'insert', dto })),
                catchError(error => of({ success: false, operacion: 'insert', dto, error }))
              )
            ),
            ...diff.modificados.map(dto => 
              this.actualizarDetalle(dto).pipe(
                map(() => ({ success: true, operacion: 'update', dto })),
                catchError(error => of({ success: false, operacion: 'update', dto, error }))
              )
            ),
            ...diff.eliminados.map(id => 
              this.eliminarDetalle(id).pipe(
                map(() => ({ success: true, operacion: 'delete', id })),
                catchError(error => of({ success: false, operacion: 'delete', id, error }))
              )
            )
          ];
        } else {
          console.log('📝 Modo CREACIÓN: Guardando todos los detalles como nuevos...');
          // Mapear cada detalle al DTO
          const detallesDTO = detalles.map((detalle, index) => 
            this.mapDetalleToDTO(detalle, codOT, index + 1, operador)
          );

          // Crear observables para guardar (POST)
          operaciones = detallesDTO.map(dto => 
            this.guardarDetalle(dto).pipe(
              map(() => ({ success: true, operacion: 'insert', dto })),
              catchError(error => of({ success: false, operacion: 'insert', dto, error }))
            )
          );
        }

        // Si no hay operaciones, retornar éxito
        if (operaciones.length === 0) {
          console.log('✅ Sin cambios en detalles');
          return of({ codOT, detallesGuardados: detalles.length, errores: [] });
        }

        // Ejecutar todas las operaciones en paralelo y procesar resultados
        return forkJoin(operaciones).pipe(
          map(resultados => {
            const exitosos = resultados.filter(r => r.success);
            const errores = resultados.filter(r => !r.success);
            
            // Contar solo inserts y updates como guardados
            const detallesGuardados = exitosos.filter(r => r.operacion === 'insert' || r.operacion === 'update').length;
            
            console.log('📊 Resultado de operaciones:', {
              total: resultados.length,
              exitosos: exitosos.length,
              errores: errores.length,
              porOperacion: {
                insert: exitosos.filter(r => r.operacion === 'insert').length,
                update: exitosos.filter(r => r.operacion === 'update').length,
                delete: exitosos.filter(r => r.operacion === 'delete').length
              }
            });
            
            return {
              codOT,
              detallesGuardados,
              errores
            };
          })
        );
      }),
      
      catchError(error => {
        console.error('❌ Error en guardarOrdenCompleta:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Calcula las diferencias entre detalles actuales y originales.
   * Detecta: nuevos, modificados, eliminados.
   */
  private calcularDiffDetalles(
    detallesActuales: OrdenTrabajoDetalle[],
    detallesOriginales: OrdenTrabajoDetalle[],
    codOT: string,
    operador: string
  ): {
    nuevos: OrdenTrabajoDetalleDTO[];
    modificados: OrdenTrabajoDetalleDTO[];
    eliminados: number[];
    sinCambios: number;
  } {
    const nuevos: OrdenTrabajoDetalleDTO[] = [];
    const modificados: OrdenTrabajoDetalleDTO[] = [];
    const eliminados: number[] = [];
    let sinCambios = 0;

    // Crear mapa de detalles actuales por detalleReservaId para búsqueda rápida
    const actualesMap = new Map<number, OrdenTrabajoDetalle>();
    detallesActuales.forEach(d => {
      if (d.detalleReservaId) {
        actualesMap.set(d.detalleReservaId, d);
      }
    });

    // Paso 1: Detectar eliminados
    // (están en originales pero no en actuales)
    detallesOriginales.forEach(original => {
      if (original.detalleReservaId && !actualesMap.has(original.detalleReservaId)) {
        eliminados.push(original.detalleReservaId);
      }
    });

    // Paso 2: Detectar nuevos y modificados
    detallesActuales.forEach((actual, index) => {
      const linea = index + 1;
      
      if (!actual.detalleReservaId) {
        // Sin ID de backend = NUEVO
        const dto = this.mapDetalleToDTO(actual, codOT, linea, operador);
        nuevos.push(dto);
      } else {
        // Tiene ID = puede ser MODIFICADO o SIN CAMBIOS
        const original = detallesOriginales.find(o => o.detalleReservaId === actual.detalleReservaId);
        
        if (!original) {
          // No debería pasar, pero por seguridad lo tratamos como nuevo
          const dto = this.mapDetalleToDTO(actual, codOT, linea, operador);
          nuevos.push(dto);
          return;
        }
        
        // Comparar campos relevantes para detectar cambios
        const cambio = this.detalleHaCambiado(actual, original);
        
        if (cambio) {
          // MODIFICADO
          const dto = this.mapDetalleToDTO(actual, codOT, linea, operador);
          dto.id = actual.detalleReservaId; // Importante: incluir ID para PUT
          modificados.push(dto);
        } else {
          // SIN CAMBIOS
          sinCambios++;
        }
      }
    });

    return { nuevos, modificados, eliminados, sinCambios };
  }

  /**
   * Compara dos detalles para determinar si hubo cambios.
   * Solo compara campos editables que afectan la operación.
   */
  private detalleHaCambiado(actual: OrdenTrabajoDetalle, original: OrdenTrabajoDetalle): boolean {
    // Comparar campos que el usuario puede modificar
    return (
      actual.origenOT !== original.origenOT ||
      actual.destinoOT !== original.destinoOT ||
      actual.hora !== original.hora ||
      actual.pax !== original.pax ||
      actual.observaciones !== original.observaciones
    );
  }

  /**
   * Mapea los valores del formulario al DTO del encabezado.
   */
  mapFormToEncabezadoDTO(formValue: any, detalles: OrdenTrabajoDetalle[]): OrdenTrabajoEncabezadoDTO {
    console.log('📋 Mapeando formulario a DTO encabezado...');
    console.log('FormValue recibido:', formValue);
    console.log('Cantidad de detalles:', detalles.length);
    console.log('Vehículo/Chofer en form:', {
      codVehiculo: formValue.codVehiculo,
      codChofer: formValue.codChofer
    });
    
    const totales = this.recalcularTotales(detalles, formValue.totalPagar);
    console.log('Totales calculados:', totales);
    
    // Mapear estado a código corto
    const estadoCodigo = this.mapEstadoToCodigo(formValue.estado);
    console.log('Estado mapeado:', { original: formValue.estado, codigo: estadoCodigo });
    
    const dto = {
      tipo: Number(formValue.tipo ?? 0),
      codOT: '', // Se genera en el backend
      codReserva: String(detalles[0]?.reservaId || ''),
      codSuplidor: String(formValue.suplidor || ''),
      fecServicio: formValue.fechaServicio || new Date().toISOString().split('T')[0],
      rutaCodigo: String(formValue.rutaCodigo || ''),
      rotulacion: String(formValue.rotulacion || ''),
      conexion: String(formValue.conexion || ''),
      kmInicial: this.toSafeNumber(formValue.kmInicial, 0),
      kmFinal: this.toSafeNumber(formValue.kmFinal, 0),
      observaciones: String(formValue.observaciones || ''),
      estado: estadoCodigo,
      moneda: String(formValue.moneda || 'USD'),
      tCambio: this.toSafeNumber(formValue.tCambio, 1),
      totalOT: this.toSafeNumber(totales.totalPagar, 0),
      operador: String(formValue.operador || 'ADMIN').toUpperCase(),
      codVehiculo: String(formValue.codVehiculo || ''),
      codChofer: String(formValue.codChofer || ''),
      fechaInicio: formValue.fechaCreacion || new Date().toISOString(),
      fechaFin: formValue.fechaServicio || new Date().toISOString().split('T')[0],
      nombreSuplidor: '', // Se completa desde el backend o catálogo
      pageNumber: 0,
      pageSize: 0,
      respuesta: ''
    };
    
    console.log('✅ DTO encabezado preparado:', JSON.stringify(dto, null, 2));
    return dto;
  }

  /**
   * Mapea el estado del UI al código del API
   */
  private mapEstadoToCodigo(estado: string | undefined): string {
    if (!estado) return 'PEN';
    
    const estadoUpper = estado.toUpperCase();
    
    // Si ya es un código corto, retornarlo
    if (['PEN', 'ASI', 'PRO', 'COM', 'CAN'].includes(estadoUpper)) {
      return estadoUpper;
    }
    
    // Mapeo de nombres completos a códigos
    const mapeo: Record<string, string> = {
      'PENDIENTE': 'PEN',
      'ASIGNADA': 'ASI',
      'EN PROCESO': 'PRO',
      'COMPLETADA': 'COM',
      'FINALIZADA': 'COM',
      'CANCELADA': 'CAN',
      'ANULADA': 'CAN'
    };
    
    return mapeo[estadoUpper] || 'PEN';
  }

  /**
   * Convierte un valor a número de forma segura, evitando NaN
   */
  private toSafeNumber(value: any, defaultValue: number = 0): number {
    const num = Number(value);
    return isNaN(num) ? defaultValue : num;
  }

  /**
   * Mapea un OrdenTrabajoDetalle al DTO para la API.
   */
  mapDetalleToDTO(
    detalle: OrdenTrabajoDetalle, 
    codOT: string, 
    linea: number, 
    operador: string
  ): OrdenTrabajoDetalleDTO {
    return {
      tipo: 0,
      id: 0, // Se genera en el backend
      codOT,
      linea,
      codReserva: detalle.reservaId,
      idDetReserva: detalle.detalleReservaId || 0,
      codServicio: detalle.servicioId || '',
      nomServicio: detalle.servicio,
      origenTexto: detalle.origenOT || detalle.origenReserva || '',
      destinoTexto: detalle.destinoOT || detalle.destinoReserva || '',
      origenPlaceId: detalle.origenPlaceId || '',
      destinoPlaceId: detalle.destinoPlaceId || '',
      origenLat: detalle.origenLat || 0,
      origenLng: detalle.origenLng || 0,
      destinoLat: detalle.destinoLat || 0,
      destinoLng: detalle.destinoLng || 0,
      horaPax: detalle.hora,
      adultos: detalle.adultos || 0,
      ninos: detalle.ninos || 0,
      totalPax: detalle.pax,
      boleta: detalle.boleta || '',
      voucher: detalle.voucher || '',
      agenciaCobro: detalle.agencia || '',
      estado: 'PENDIENTE',
      observacion: detalle.observaciones || '',
      operador,
      respuesta: ''
    };
  }
}
