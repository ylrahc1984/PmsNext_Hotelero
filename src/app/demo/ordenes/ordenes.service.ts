import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
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

// ==================== Modelos de UI ====================

export interface OrdenTrabajoDetalle {
  id: number;
  reservaId: string;           // Cambiado de number a string (código de reserva)
  numeroBoleta: string;         // Cambiado de number a string (folio)
  clienteFinal: string;
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
  codChofer?: string;
  estado: EstadoOrden;
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
      
      // Información geográfica (por defecto vacía, se puede agregar más tarde)
      origenPlaceId: '',
      destinoPlaceId: '',
      origenLat: 0,
      origenLng: 0,
      destinoLat: 0,
      destinoLng: 0,
      
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
   */
  actualizarEncabezado(codOT: string, dto: OrdenTrabajoEncabezadoDTO): Observable<any> {
    return this.http.put(this.apiUrl, { ...dto, codOT }).pipe(
      tap(response => console.log('Encabezado actualizado:', response)),
      catchError(error => {
        console.error('Error al actualizar encabezado:', error);
        return throwError(() => new Error(error.error?.respuesta || 'Error al actualizar el encabezado'));
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
   * Guarda la orden completa: encabezado + todos los detalles.
   * Estrategia:
   * 1. Guarda encabezado (POST) → recibe codOT
   * 2. Guarda todos los detalles en paralelo usando forkJoin (optimización)
   * 3. Retorna el codOT y el resultado de todos los detalles
   */
  guardarOrdenCompleta(
    encabezadoDTO: OrdenTrabajoEncabezadoDTO, 
    detalles: OrdenTrabajoDetalle[],
    operador: string = 'Admin'
  ): Observable<{ codOT: string; detallesGuardados: number; errores: any[] }> {
    console.log('🚀 === INICIANDO GUARDADO DE ORDEN COMPLETA ===');
    console.log('Cantidad de detalles:', detalles.length);
    console.log('Operador:', operador);
    
    // Paso 1: Guardar encabezado
    return this.guardarEncabezado(encabezadoDTO).pipe(
      // Paso 2: Con el codOT, preparar y guardar detalles
      switchMap(responseEncabezado => {
        // Extraer codOT de la nueva estructura de respuesta
        const codOT = responseEncabezado.datos?.[0]?.CodOT || '';
        
        console.log('🎯 CodOT recibido del backend:', codOT);
        
        if (!codOT) {
          console.error('⚠️ No se recibió codOT del backend');
          return throwError(() => new Error('No se recibió el código de la orden del servidor'));
        }
        
        // Si no hay detalles, retornar directamente
        if (!detalles || detalles.length === 0) {
          return of({ codOT, detallesGuardados: 0, errores: [] });
        }
        
        // Mapear cada detalle al DTO
        const detallesDTO = detalles.map((detalle, index) => 
          this.mapDetalleToDTO(detalle, codOT, index + 1, operador)
        );

        // Crear observables para cada detalle con manejo de errores individual
        const detalleObservables = detallesDTO.map(dto => 
          this.guardarDetalle(dto).pipe(
            map(() => ({ success: true, dto, error: null })),
            catchError(error => {
              console.error(`Error guardando detalle línea ${dto.linea}:`, error);
              // No lanzar error, sino retornar objeto con el error
              return of({ success: false, dto, error });
            })
          )
        );

        // Ejecutar todas las llamadas en paralelo y procesar resultados
        return forkJoin(detalleObservables).pipe(
          map(resultados => {
            const exitosos = resultados.filter(r => r.success).length;
            const errores = resultados.filter(r => !r.success);
            
            return {
              codOT,
              detallesGuardados: exitosos,
              errores
            };
          })
        );
      }),
      
      catchError(error => {
        console.error('Error en guardarOrdenCompleta:', error);
        return throwError(() => error);
      })
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
