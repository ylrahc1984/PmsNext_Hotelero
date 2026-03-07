import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription, finalize } from 'rxjs';
import Swal from 'sweetalert2';

import { environment } from 'src/environments/environment';
import { SharedModule } from 'src/app/theme/shared/shared.module';
import { EstadoOrden, EstadoOrdenOption, ESTADOS_OT, OrdenTrabajo, OrdenTrabajoDetalle, OrdenesService } from './ordenes.service';
import { ReservaDetalleDisponible, ReservasService } from '../reservas/services/reservas.service';
import { SuplidorDisponibilidadUI, SuplidorService } from '../catalogos/suplidores/suplidor.service';
import { MonedaService, MonedaUI } from '../administracion/monedas/moneda.service';
import { AuthService } from 'src/app/core/services/auth.service';
import { EmpresaContextService } from 'src/app/core/services/empresa-context.service';

interface DetalleDisponibleUI extends ReservaDetalleDisponible {
  esRemanente?: boolean;
}

@Component({
  selector: 'app-orden-trabajo-form',
  standalone: true,
  imports: [CommonModule, SharedModule, ReactiveFormsModule, FormsModule],
  templateUrl: './orden-trabajo-form.component.html',
  styleUrls: ['./orden-trabajo-form.component.scss']
})
export class OrdenTrabajoFormComponent implements OnInit, OnDestroy {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private ordenesService = inject(OrdenesService);
  private reservasService = inject(ReservasService);
  private suplidorService = inject(SuplidorService);
  private monedaService = inject(MonedaService);
  private authService = inject(AuthService);
  private empresaContext = inject(EmpresaContextService);
  private http = inject(HttpClient);
  private orden?: OrdenTrabajo;
  private subs = new Subscription();

  readonly empresa = this.empresaContext.empresa;

  form = this.fb.group({
    numeroOrden: [{ value: '', disabled: true }],
    fechaCreacion: [{ value: '', disabled: true }],
    fechaServicio: ['', Validators.required],
    estado: ['Pendiente' as EstadoOrden, Validators.required],
    suplidor: ['', Validators.required],
    observaciones: [''],
    totalPagar: [0],
    
    // Campos adicionales de configuración OT
    tipo: [0, Validators.required],           // 0=Transfer, 1=Tour, 2=Excursión, etc.
    moneda: ['USD', Validators.required],     // USD, CRC, EUR
    tCambio: [500],                             // Tipo de cambio
    rutaCodigo: [''],                         // Código de ruta
    rotulacion: [''],                         // Indicaciones de rotulación
    conexion: [''],                           // Conexión/enlace
    kmInicial: [null as number | null],       // Kilometraje inicial
    kmFinal: [null as number | null],         // Kilometraje final
    operador: [{ value: '', disabled: true }] // Usuario que crea la OT
  });

  detallesDisponibles: DetalleDisponibleUI[] = [];
  detallesSeleccionados = new Set<string>();
  detallesOrden: OrdenTrabajoDetalle[] = [];
  detallesOriginales: OrdenTrabajoDetalle[] = []; // Snapshot de detalles al cargar la orden
  estadoBloqueado = false;
  isEdit = false;
  titulo = 'Nueva Orden de Trabajo';

  // Propiedades UI/UX para control visual
  selectedSupplierId: string | null = null;
  selectedVehiculoId: string | null = null;
  selectedChoferId: string | null = null;
  selectedTime: string | null = null;
  selectedRows: Set<string> = new Set();
  searchText = '';
  showConfigOT = false; // Controla el acordeón de configuración
  loadingSuplidores = false;
  loadingServicios = false;
  remanentesPendientes: DetalleDisponibleUI[] = [];
  private readonly remanentesStorageKey = 'ot_remanentes_pendientes';
  
  // Datos reales de suplidores con disponibilidad
  suplidoresDisponibles: SuplidorDisponibilidadUI[] = [];
  horariosDisponibles: string[] = [];

  // Catálogos para selectores
  tiposOT = [
    { value: 0, label: 'Transfer' },
    { value: 1, label: 'Tour' },
    { value: 2, label: 'Excursión' },
    { value: 3, label: 'Servicio Especial' }
  ];

  monedas: MonedaUI[] = [];

  // Map para almacenar origen/destino editados temporalmente (key = det.key)
  // Estructura: { key: { origenOT: string, destinoOT: string } }
  origenDestinoEditados = new Map<string, { origenOT: string; destinoOT: string }>();

  ngOnInit(): void {
    this.loadRemanentesFromStorage();
    // Cargar catálogo de monedas
    this.loadMonedas();
    
    // Cargar usuario actual como operador
    this.loadCurrentUser();

    this.subs.add(
      this.route.params.subscribe(params => {
        const codOT = params['id'];
        if (codOT) {
          this.loadOrdenPorCodigo(codOT);
        } else {
          this.iniciarNueva();
        }
      })
    );

    // Cargar suplidores y servicios cuando cambie la fecha de servicio
    this.subs.add(
      this.form.get('fechaServicio')?.valueChanges.subscribe(fecha => {
        if (fecha) {
          this.loadSuplidoresDisponibilidad(fecha);
          this.loadServiciosDisponibles(fecha);
        }
      })
    );
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
  }

  private updateFormDisabledState(): void {
    if (this.estadoBloqueado) {
      this.form.get('fechaServicio')?.disable();
      this.form.get('estado')?.disable();
      this.form.get('observaciones')?.disable();
      this.form.get('totalPagar')?.disable();
      this.form.get('tipo')?.disable();
      this.form.get('moneda')?.disable();
      this.form.get('tCambio')?.disable();
      this.form.get('rutaCodigo')?.disable();
      this.form.get('rotulacion')?.disable();
      this.form.get('conexion')?.disable();
      this.form.get('kmInicial')?.disable();
      this.form.get('kmFinal')?.disable();
    } else {
      this.form.get('fechaServicio')?.enable();
      this.form.get('estado')?.enable();
      this.form.get('observaciones')?.enable();
      this.form.get('totalPagar')?.enable();
      this.form.get('tipo')?.enable();
      this.form.get('moneda')?.enable();
      this.form.get('tCambio')?.enable();
      this.form.get('rutaCodigo')?.enable();
      this.form.get('rotulacion')?.enable();
      this.form.get('conexion')?.enable();
      this.form.get('kmInicial')?.enable();
      this.form.get('kmFinal')?.enable();
    }
  }

  private esOrdenAnulada(orden: OrdenTrabajo | undefined): boolean {
    if (!orden?.estado) return false;
    const estado = orden.estado.toUpperCase().trim();
    return estado === 'ANU';
  }

  get totalServicios(): number {
    return this.detallesOrden.length;
  }

  get totalPax(): number {
    return this.detallesOrden.reduce((sum, d) => sum + d.pax, 0);
  }

  get totalPagarSugerido(): number {
    return this.detallesOrden.reduce((sum, d) => sum + d.pax * 20, 0);
  }

  get detallesDisponiblesFiltrados(): DetalleDisponibleUI[] {
    const filtroHora = this.normalizeHora(this.selectedTime);
    if (!filtroHora) {
      return this.detallesDisponibles;
    }
    return this.detallesDisponibles.filter((detalle) => this.normalizeHora(detalle.hora) === filtroHora);
  }

  get estadosDisponibles(): EstadoOrdenOption[] {
    return ESTADOS_OT;
  }

  /**
   * Obtiene la descripción de un estado por su código
   */
  getEstadoDescripcion(codigo: string | EstadoOrden | undefined): string {
    if (!codigo) return 'Pendiente';
    const estado = ESTADOS_OT.find(e => e.codigo === codigo);
    return estado?.descripcion || codigo;
  }

  /**
   * Obtiene la clase CSS del badge para un estado
   */
  getEstadoBadgeClass(codigo: string | EstadoOrden | undefined): string {
    if (!codigo) return 'badge-secondary';
    const estado = ESTADOS_OT.find(e => e.codigo === codigo);
    return estado?.badge || 'badge-secondary';
  }

  toggleSeleccion(detalle: DetalleDisponibleUI, checked: boolean): void {
    if (checked) {
      this.detallesSeleccionados.add(detalle.key);
    } else {
      this.detallesSeleccionados.delete(detalle.key);
    }
  }

  agregarSeleccionados(): void {
    const seleccionados = this.detallesDisponibles.filter(det => this.detallesSeleccionados.has(det.key));
    if (!seleccionados.length || this.estadoBloqueado) {
      return;
    }

    // Validar capacidad del vehículo
    if (this.selectedVehiculoId && this.selectedSupplierId) {
      const suplidor = this.suplidoresDisponibles.find(s => s.codigo === this.selectedSupplierId);
      const vehiculo = suplidor?.vehiculos.find(v => v.codigo === this.selectedVehiculoId);
      
      if (vehiculo) {
        const totalPaxSeleccionados = seleccionados.reduce((sum, det) => sum + (det.pax || 0), 0);
        const capacidadDisponible = vehiculo.capacidadDisponible;
        
        if (totalPaxSeleccionados > capacidadDisponible) {
          // Mostrar alerta de sobrecarga
          Swal.fire({
            title: '⚠️ Capacidad Excedida',
            html: `
              <div style="text-align: left;">
                <p>La cantidad de pasajeros seleccionados <strong>excede la capacidad disponible</strong> del vehículo:</p>
                <ul style="list-style: none; padding-left: 0;">
                  <li>🚗 <strong>Vehículo:</strong> ${vehiculo.nombre}</li>
                  <li>👥 <strong>Capacidad disponible:</strong> ${capacidadDisponible} pax</li>
                  <li>📊 <strong>Pax seleccionados:</strong> ${totalPaxSeleccionados} pax</li>
                  <li>❌ <strong>Exceso:</strong> ${totalPaxSeleccionados - capacidadDisponible} pax</li>
                </ul>
                <p class="text-danger"><strong>¿Desea continuar y sobrecargar la unidad?</strong></p>
              </div>
            `,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Sí, continuar',
            cancelButtonText: 'Cancelar',
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6'
          }).then((result) => {
            if (result.isConfirmed) {
              this.procesarAgregarSeleccionados(seleccionados);
            }
          });
          return;
        }
      }
    }

    // Si no hay problema de capacidad, proceder normalmente
    this.procesarAgregarSeleccionados(seleccionados);
  }

  private procesarAgregarSeleccionados(seleccionados: DetalleDisponibleUI[]): void {
    let nextId = this.getNextDetalleId();
    const nuevosRemanentes: DetalleDisponibleUI[] = [];
    const remanentesEliminados = new Set<string>();

    seleccionados.forEach(det => {
      // Obtener origen/destino editados o usar los originales
      const editados = this.origenDestinoEditados.get(det.key);
      const origenOT = editados?.origenOT || det.origen;
      const destinoOT = editados?.destinoOT || det.destino;
      
      const detalleOrden = this.ordenesService.mapDisponibleADetalle(det, nextId++, origenOT, destinoOT);
      this.detallesOrden.push(detalleOrden);

      if (det.esRemanente) {
        remanentesEliminados.add(det.key);
      }

      const remanente = this.buildRemanente(det, destinoOT);
      if (remanente) {
        nuevosRemanentes.push(remanente);
      }
    });

    if (remanentesEliminados.size > 0) {
      this.remanentesPendientes = this.remanentesPendientes.filter(item => !remanentesEliminados.has(item.key));
    }

    nuevosRemanentes.forEach((remanente) => {
      const existe = this.remanentesPendientes.some((item) => this.isSameRemanente(item, remanente));
      if (!existe) {
        this.remanentesPendientes.push(remanente);
      }
    });

    if (remanentesEliminados.size > 0 || nuevosRemanentes.length > 0) {
      this.persistRemanentes();
    }
    
    // Limpiar selección y ediciones temporales
    this.detallesSeleccionados.clear();
    this.origenDestinoEditados.clear();
    
    this.recalcularTotales();
    this.refreshDisponibles();
  }

  quitarDetalle(detalle: OrdenTrabajoDetalle): void {
    if (this.estadoBloqueado) {
      return;
    }
    let remanentesActualizados = false;

    if (detalle.esRemanente) {
      const remanente = this.buildRemanenteFromOrdenDetalle(detalle);
      if (remanente) {
        const existe = this.remanentesPendientes.some((item) => this.isSameRemanente(item, remanente));
        if (!existe) {
          this.remanentesPendientes.push(remanente);
          remanentesActualizados = true;
        }
      }
    } else if (this.normalizeTexto(detalle.destinoOT) !== this.normalizeTexto(detalle.destinoReserva)) {
      remanentesActualizados = this.removeRemanenteSegment(
        detalle.detalleReservaId,
        detalle.destinoOT,
        detalle.destinoReserva,
        detalle.hora
      );
    }

    if (remanentesActualizados) {
      this.persistRemanentes();
    }

    this.detallesOrden = this.detallesOrden.filter(d => d.id !== detalle.id);
    this.recalcularTotales();
    this.refreshDisponibles();
  }

  actualizarDetalle(detalle: OrdenTrabajoDetalle, campo: 'fechaServicio' | 'hora', valor: string): void {
    detalle[campo] = valor;
  }

  guardar(estado?: EstadoOrden): void {
    if (this.form.invalid || !this.detallesOrden.length) {
      this.form.markAllAsTouched();
      return;
    }

    const raw = this.form.getRawValue();
    const estadoFinal = estado ?? raw.estado ?? 'PEN';

    // Mostrar diálogo de confirmación
    Swal.fire({
      title: '¿Guardar Orden de Trabajo?',
      html: `
        <div style="text-align: left;">
          <p><strong>Resumen de la orden:</strong></p>
          <ul style="list-style: none; padding-left: 0;">
            <li>📋 Suplidor: <strong>${this.getSuplidorSeleccionado()}</strong></li>
            <li>🚗 Vehículo: <strong>${this.getVehiculoSeleccionado()}</strong></li>
            <li>👤 Chofer: <strong>${this.getChoferSeleccionado()}</strong></li>
            <li>📦 Servicios: <strong>${this.detallesOrden.length}</strong></li>
            <li>👥 Pasajeros: <strong>${this.totalPax}</strong></li>
            <li>💰 Total: <strong>${raw.moneda || 'USD'} ${(raw.totalPagar || this.totalPagarSugerido).toLocaleString()}</strong></li>
            <li>📌 Estado: <strong>${this.getEstadoDescripcion(estadoFinal)}</strong></li>
          </ul>
        </div>
      `,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#4680ff',
      cancelButtonColor: '#6c757d',
      confirmButtonText: '<i class="feather icon-check"></i> Sí, guardar',
      cancelButtonText: '<i class="feather icon-x"></i> Cancelar',
      reverseButtons: true
    }).then((result) => {
      if (!result.isConfirmed) {
        // Usuario canceló, no hacer nada
        return;
      }

      // Usuario confirmó, proceder con el guardado
      this.ejecutarGuardado(raw, estadoFinal);
    });
  }

  private ejecutarGuardado(raw: any, estadoFinal: EstadoOrden): void {
    // Preparar DTO para el encabezado
    const encabezadoDTO = this.ordenesService.mapFormToEncabezadoDTO(raw, this.detallesOrden);
    encabezadoDTO.estado = estadoFinal;
    
    // Agregar suplidor, vehículo y chofer seleccionados (códigos)
    encabezadoDTO.codSuplidor = this.selectedSupplierId || '';
    encabezadoDTO.codVehiculo = this.selectedVehiculoId || '';
    encabezadoDTO.codChofer = this.selectedChoferId || '';

    // Deshabilitar el formulario durante el guardado
    this.form.disable();

    // Determinar si es edición y obtener codOT
    const codOTExistente = this.isEdit && this.orden?.codOT ? this.orden.codOT : undefined;
    const accion = codOTExistente ? 'Actualizando' : 'Guardando';

    // Mostrar loading
    Swal.fire({
      title: `${accion} Orden de Trabajo...`,
      html: `${accion} encabezado y ${this.detallesOrden.length} servicio(s)...`,
      allowOutsideClick: false,
      allowEscapeKey: false,
      didOpen: () => {
        Swal.showLoading();
      }
    });

    // Obtener operador actual
    const currentUser = this.authService.getCurrentUser();
    const operadorActual = raw.operador || (currentUser ? (currentUser.usuario || currentUser.nombre) : null) || 'Admin';

    console.log('🔧 Ejecutando guardado:', {
      esEdicion: this.isEdit,
      codOTExistente,
      accion
    });

    // Llamar al servicio para guardar o actualizar
    this.ordenesService.guardarOrdenCompleta(
      encabezadoDTO, 
      this.detallesOrden, 
      operadorActual, 
      codOTExistente,
      this.detallesOriginales // Pasar detalles originales para diff
    )
      .subscribe({
        next: (resultado) => {
          Swal.close();

          // Verificar si hubo errores en los detalles
          if (resultado.errores && resultado.errores.length > 0) {
            Swal.fire({
              title: 'Guardado con advertencias',
              html: `
                <p>El encabezado se guardó correctamente con código <strong>${resultado.codOT}</strong></p>
                <p>${resultado.detallesGuardados} de ${this.detallesOrden.length} servicios guardados.</p>
                <p>Hubo ${resultado.errores.length} error(es) al guardar algunos detalles.</p>
              `,
              icon: 'warning',
              confirmButtonText: 'Entendido'
            });
          } else {
            // Todo exitoso
            const tituloExito = codOTExistente ? '¡Orden Actualizada!' : '¡Orden Guardada!';
            Swal.fire({
              title: tituloExito,
              html: `
                <p>Código de orden: <strong>${resultado.codOT}</strong></p>
                <p>${resultado.detallesGuardados} servicio(s) guardado(s) exitosamente.</p>
              `,
              icon: 'success',
              timer: 2000,
              showConfirmButton: false
            });
          }

          // Actualizar estado local (para mantener compatibilidad con mock data)
          const payload: OrdenTrabajo = {
            id: this.orden?.id || 0,
            numeroOrden: this.orden?.numeroOrden || 0,
            fechaCreacion: this.orden?.fechaCreacion || new Date().toISOString().split('T')[0],
            fechaServicio: raw.fechaServicio || '',
            suplidor: raw.suplidor || '',
            codSuplidor: this.selectedSupplierId || undefined,
            ruta: raw.rutaCodigo || '',
            conexion: raw.conexion || '',
            observaciones: raw.observaciones || '',
            kmInicial: raw.kmInicial ?? undefined,
            kmFinal: raw.kmFinal ?? undefined,
            rotulacion: !!raw.rotulacion,
            codVehiculo: this.selectedVehiculoId || undefined,
            codChofer: this.selectedChoferId || undefined,
            estado: estadoFinal,
            detalles: this.detallesOrden,
            totalPax: this.totalPax,
            totalPagar: raw.totalPagar || this.totalPagarSugerido
          };

          if (this.isEdit && this.orden) {
            payload.id = this.orden.id;
            payload.numeroOrden = this.orden.numeroOrden;
            payload.fechaCreacion = this.orden.fechaCreacion;
            this.ordenesService.updateOrden(payload);
          } else {
            this.ordenesService.createOrden(payload);
          }

          // Si es guardarYAsignar (estado ASI), imprimir automáticamente
          if (estadoFinal === 'ASI' && resultado.codOT) {
            setTimeout(() => {
              this.imprimirOrdenPDF(resultado.codOT);
            }, 2200);
          }

          // Navegar de vuelta al listado
          setTimeout(() => {
            this.router.navigate(['/operaciones/ordenes-trabajo']);
          }, 2100);
        },
        error: (error) => {
          Swal.close();
          this.form.enable();
          this.updateFormDisabledState();

          Swal.fire({
            title: 'Error al guardar',
            text: error.message || 'No se pudo guardar la orden. Por favor, intente nuevamente.',
            icon: 'error',
            confirmButtonText: 'Aceptar'
          });

          console.error('Error guardando orden:', error);
        }
      });
  }

  guardarYAsignar(): void {
    this.guardar('ASI');
  }

  finalizar(): void {
    this.guardar('COM');
  }

  cancelar(): void {
    this.router.navigate(['/operaciones/ordenes-trabajo']);
  }

  /**
   * @deprecated Usar getEstadoBadgeClass() en su lugar
   */
  getEstadoBadge(estado?: EstadoOrden | null): string {
    // Delegar al nuevo método
    return this.getEstadoBadgeClass(estado || undefined);
  }

  // Métodos UI/UX
  selectSuplidor(suplidorId: string): void {
    if (this.estadoBloqueado) return;
    this.selectedSupplierId = this.selectedSupplierId === suplidorId ? null : suplidorId;
    // Limpiar selecciones de vehículo y chofer si se cambia de suplidor
    if (this.selectedSupplierId !== suplidorId) {
      this.selectedVehiculoId = null;
      this.selectedChoferId = null;
    }
    // Actualizar formulario
    if (this.selectedSupplierId) {
      const suplidor = this.suplidoresDisponibles.find(s => s.codigo === suplidorId);
      if (suplidor) {
        this.form.patchValue({ suplidor: suplidor.nombre });
      }
    }
  }

  selectVehiculo(vehiculoId: string): void {
    if (this.estadoBloqueado) return;
    this.selectedVehiculoId = this.selectedVehiculoId === vehiculoId ? null : vehiculoId;
  }

  selectChofer(choferId: string): void {
    if (this.estadoBloqueado) return;
    this.selectedChoferId = this.selectedChoferId === choferId ? null : choferId;
  }

  selectTime(time: string | null): void {
    this.selectedTime = this.selectedTime === time ? null : time;
    // Filtrar servicios por horario (lógica futura)
  }

  clearFilters(): void {
    this.searchText = '';
    this.selectedTime = null;
    this.form.patchValue({ estado: 'PEN' });
    this.refreshDisponibles();
  }

  getSuplidorEstadoBadge(estado: 'sin-asignar' | 'parcial' | 'completo'): string {
    const badges = {
      'sin-asignar': 'badge-secondary',
      'parcial': 'badge-warning',
      'completo': 'badge-success'
    };
    return badges[estado] || 'badge-secondary';
  }

  getSuplidorEstadoTexto(estado: 'sin-asignar' | 'parcial' | 'completo'): string {
    const textos = {
      'sin-asignar': 'Sin asignar',
      'parcial': 'Parcial',
      'completo': 'Completo'
    };
    return textos[estado] || 'Sin asignar';
  }

  getVacantes(suplidor: SuplidorDisponibilidadUI): number {
    return suplidor.capacidadDisponible;
  }

  /**
   * Actualiza el origen de la OT para un detalle seleccionado.
   * El cambio se almacena temporalmente hasta que se ejecute "Agregar Seleccionados".
   */
  updateOrigenOT(detalle: DetalleDisponibleUI, nuevoOrigen: string): void {
    if (!this.origenDestinoEditados.has(detalle.key)) {
      // Primera edición, inicializar con valores originales
      this.origenDestinoEditados.set(detalle.key, {
        origenOT: detalle.origen,
        destinoOT: detalle.destino
      });
    }
    const editado = this.origenDestinoEditados.get(detalle.key)!;
    editado.origenOT = nuevoOrigen;
  }

  /**
   * Actualiza el destino de la OT para un detalle seleccionado.
   * El cambio se almacena temporalmente hasta que se ejecute "Agregar Seleccionados".
   */
  updateDestinoOT(detalle: DetalleDisponibleUI, nuevoDestino: string): void {
    if (!this.origenDestinoEditados.has(detalle.key)) {
      // Primera edición, inicializar con valores originales
      this.origenDestinoEditados.set(detalle.key, {
        origenOT: detalle.origen,
        destinoOT: detalle.destino
      });
    }
    const editado = this.origenDestinoEditados.get(detalle.key)!;
    editado.destinoOT = nuevoDestino;
  }

  /**
   * Obtiene el origen de la OT (editado o original) para mostrar en el input.
   */
  getOrigenOT(detalle: DetalleDisponibleUI): string {
    return this.origenDestinoEditados.get(detalle.key)?.origenOT || detalle.origen;
  }

  /**
   * Obtiene el destino de la OT (editado o original) para mostrar en el input.
   */
  getDestinoOT(detalle: DetalleDisponibleUI): string {
    return this.origenDestinoEditados.get(detalle.key)?.destinoOT || detalle.destino;
  }

  moverDetalle(index: number, direccion: 'up' | 'down'): void {
    if (this.estadoBloqueado) return;
    const newIndex = direccion === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= this.detallesOrden.length) return;
    
    const temp = this.detallesOrden[index];
    this.detallesOrden[index] = this.detallesOrden[newIndex];
    this.detallesOrden[newIndex] = temp;
  }

  /**
   * Carga una orden existente por su código OT desde la API
   */
  private loadOrdenPorCodigo(codOT: string): void {
    console.log('🔍 Cargando orden para edición:', codOT);
    
    // Primero buscar en el servicio local
    const ordenLocal = this.ordenesService.getOrdenByCodOT(codOT);
    
    if (ordenLocal) {
      console.log('✅ Orden encontrada localmente');
      this.cargarDatosOrden(ordenLocal, codOT);
      return;
    }
    
    // Si no está local, cargar desde la API
    console.log('🌐 Cargando orden desde API...');
    this.subs.add(
      this.ordenesService.getOrdenCompletaPorCodOT(codOT).subscribe({
        next: (orden) => {
          console.log('✅ Orden cargada desde API:', orden);
          this.cargarDatosOrden(orden, codOT);
        },
        error: (err) => {
          console.error('❌ Error cargando orden:', err);
          Swal.fire({
            title: 'Error',
            text: 'No se pudo cargar la orden de trabajo para edición.',
            icon: 'error'
          });
          this.router.navigate(['/operaciones/ordenes-trabajo']);
        }
      })
    );
  }

  /**
   * Carga los datos de una orden en el formulario
   */
  private cargarDatosOrden(orden: OrdenTrabajo, codOT: string): void {
    // Validar que la orden no esté anulada antes de permitir edición
    if (this.esOrdenAnulada(orden)) {
      Swal.fire({
        title: 'Orden Anulada',
        html: `
          <div style="text-align: left;">
            <p>Esta orden de trabajo ha sido <strong>anulada</strong> y no puede ser modificada.</p>
            <p><strong>Código OT:</strong> ${codOT}</p>
            <p class="text-muted">Será redirigido a la vista de detalle.</p>
          </div>
        `,
        icon: 'warning',
        confirmButtonText: 'Ver Detalle'
      }).then(() => {
        this.router.navigate(['/operaciones/ordenes-trabajo', codOT, 'detalle']);
      });
      return;
    }
    
    this.orden = orden;
    this.isEdit = true;
    this.titulo = `Editar Orden #${codOT}`;
    this.detallesOrden = [...orden.detalles];
    // Guardar snapshot de detalles originales para diff posterior
    this.detallesOriginales = JSON.parse(JSON.stringify(orden.detalles));
    this.pruneRemanentesAsignados();
    this.estadoBloqueado = orden.estado === 'COM';
    
    // Cargar suplidor, vehículo y chofer si existen
    this.selectedSupplierId = orden.codSuplidor || null;
    this.selectedVehiculoId = orden.codVehiculo || null;
    this.selectedChoferId = orden.codChofer || null;
    
    this.updateFormDisabledState();

    this.form.patchValue({
      numeroOrden: codOT,
      fechaCreacion: orden.fechaCreacion,
      fechaServicio: orden.fechaServicio,
      estado: orden.estado,
      suplidor: orden.suplidor,
      observaciones: orden.observaciones,
      totalPagar: orden.totalPagar,
      rutaCodigo: orden.ruta,
      conexion: orden.conexion,
      kmInicial: orden.kmInicial,
      kmFinal: orden.kmFinal,
      rotulacion: orden.rotulacion ? 'Sí' : '',
      moneda: orden.moneda || 'USD',
      tCambio: 500
    });
    
    // Cargar suplidores disponibles para la fecha de la orden
    if (orden.fechaServicio) {
      this.loadSuplidoresDisponibilidad(orden.fechaServicio);
    }
  }

  /**
   * Carga una orden existente por su ID numérico (retrocompatibilidad)
   * @deprecated Usar loadOrdenPorCodigo en su lugar
   */
  private loadOrden(id: number): void {
    const orden = this.ordenesService.getOrdenById(id);
    if (!orden) {
      this.router.navigate(['/operaciones/ordenes-trabajo']);
      return;
    }
    this.orden = orden;
    this.isEdit = true;
    this.titulo = `Editar Orden #${orden.numeroOrden}`;
    this.detallesOrden = [...orden.detalles];
    this.pruneRemanentesAsignados();
    this.estadoBloqueado = orden.estado === 'COM';
    
    // Cargar suplidor, vehículo y chofer si existen
    this.selectedSupplierId = orden.codSuplidor || null;
    this.selectedVehiculoId = orden.codVehiculo || null;
    this.selectedChoferId = orden.codChofer || null;
    
    this.updateFormDisabledState();

    this.form.patchValue({
      numeroOrden: String(orden.numeroOrden),
      fechaCreacion: orden.fechaCreacion,
      fechaServicio: orden.fechaServicio,
      estado: orden.estado,
      suplidor: orden.suplidor,
      observaciones: orden.observaciones,
      totalPagar: orden.totalPagar,
      rutaCodigo: orden.ruta,
      conexion: orden.conexion,
      kmInicial: orden.kmInicial,
      kmFinal: orden.kmFinal,
      rotulacion: orden.rotulacion ? 'Sí' : ''
    });
    
    // Cargar suplidores disponibles para la fecha de la orden
    this.loadSuplidoresDisponibilidad(orden.fechaServicio);
  }

  private getNextDetalleId(): number {
    return this.detallesOrden.length ? Math.max(...this.detallesOrden.map(d => d.id)) + 1 : 1;
  }

  refreshDisponibles(): void {
    const fecha = this.form.get('fechaServicio')?.value;
    if (fecha) {
      this.loadServiciosDisponibles(fecha);
    }
  }

  getSuplidorSeleccionado(): string {
    if (!this.selectedSupplierId) return '-';
    const suplidor = this.suplidoresDisponibles.find(s => s.codigo === this.selectedSupplierId);
    return suplidor?.nombre || '-';
  }

  getVehiculoSeleccionado(): string {
    if (!this.selectedVehiculoId || !this.selectedSupplierId) return '-';
    const suplidor = this.suplidoresDisponibles.find(s => s.codigo === this.selectedSupplierId);
    const vehiculo = suplidor?.vehiculos.find(v => v.codigo === this.selectedVehiculoId);
    return vehiculo?.nombre || '-';
  }

  getChoferSeleccionado(): string {
    if (!this.selectedChoferId || !this.selectedSupplierId) return '-';
    const suplidor = this.suplidoresDisponibles.find(s => s.codigo === this.selectedSupplierId);
    const chofer = suplidor?.choferes.find(c => c.codigo === this.selectedChoferId);
    return chofer?.nombre || '-';
  }

  private recalcularTotales(): void {
    if (!this.detallesOrden.length) {
      this.form.patchValue({ totalPagar: 0 }, { emitEvent: false });
      return;
    }
    if (!this.form.get('totalPagar')?.value) {
      this.form.patchValue({ totalPagar: this.totalPagarSugerido }, { emitEvent: false });
    }
  }

  private imprimirOrdenPDF(codOT: string): void {
    if (!codOT) return;

    const baseApiUrl = environment.apiUrl.replace(/\/+$/, '');
    const url = `${baseApiUrl}/ordentrabajo/${encodeURIComponent(codOT)}/reporte-pdf`;

    this.http.get(url, { responseType: 'blob' })
      .pipe(finalize(() => {}))
      .subscribe({
        next: (data) => {
          try {
            const pdfBlob = new Blob([data], { type: 'application/pdf' });
            const objectUrl = URL.createObjectURL(pdfBlob);

            const link = document.createElement('a');
            link.href = objectUrl;
            link.download = `Orden_Trabajo_${codOT}.pdf`;
            link.rel = 'noopener';

            document.body.appendChild(link);
            link.click();
            link.remove();

            setTimeout(() => URL.revokeObjectURL(objectUrl), 0);

            Swal.fire({
              title: 'PDF Generado',
              text: 'La orden de trabajo se ha descargado correctamente.',
              icon: 'success',
              timer: 2000,
              showConfirmButton: false
            });
          } catch (e) {
            console.error('Error descargando orden PDF', e);
            Swal.fire({
              title: 'Error',
              text: 'No se pudo descargar la orden en PDF.',
              icon: 'error'
            });
          }
        },
        error: (err) => {
          console.error('Error obteniendo orden PDF', err);
          Swal.fire({
            title: 'Error',
            text: 'No se pudo generar el PDF de la orden.',
            icon: 'error'
          });
        }
      });
  }

  private loadCurrentUser(): void {
    const currentUser = this.authService.getCurrentUser();
    if (currentUser) {
      // Asignar el nombre de usuario al formControl operador
      this.form.patchValue({
        operador: currentUser.usuario || currentUser.nombre || 'Admin'
      });
    }
  }

  private loadMonedas(): void {
    this.subs.add(
      this.monedaService.getAll().subscribe({
        next: (monedas) => {
          // Filtrar solo las monedas activas
          this.monedas = monedas.filter(m => m.activo === 1);
        },
        error: (err) => {
          console.error('Error al cargar monedas:', err);
          // Fallback a monedas por defecto
          this.monedas = [];
        }
      })
    );
  }

  private loadSuplidoresDisponibilidad(fecha: string): void {
    if (!fecha) return;
    
    this.loadingSuplidores = true;
    // Convertir fecha de YYYY-MM-DD a DD/MM/YYYY para la API
    const [year, month, day] = fecha.split('-');
    const fechaAPI = `${day}/${month}/${year}`;
    
    this.subs.add(
      this.suplidorService.getDisponibilidad(fechaAPI).subscribe({
        next: (suplidores) => {
          this.suplidoresDisponibles = suplidores;
          this.loadingSuplidores = false;
        },
        error: (err) => {
          console.error('Error al cargar disponibilidad de suplidores:', err);
          this.suplidoresDisponibles = [];
          this.loadingSuplidores = false;
        }
      })
    );
  }

  private iniciarNueva(): void {
    this.isEdit = false;
    this.titulo = 'Nueva Orden de Trabajo';
    const hoy = new Date().toISOString().split('T')[0];
    const currentUser = this.authService.getCurrentUser();
    const operadorActual = currentUser ? (currentUser.usuario || currentUser.nombre || 'Admin') : 'Admin';
    
    this.form.patchValue({
      numeroOrden: 'Auto',
      fechaCreacion: hoy,
      fechaServicio: hoy,
      estado: 'PEN',
      totalPagar: 0,
      tipo: 0,
      moneda: 'USD',
      tCambio: 500,
      operador: operadorActual
    });
    this.detallesOrden = [];
    this.estadoBloqueado = false;
    
    // Cargar datos iniciales
    this.loadSuplidoresDisponibilidad(hoy);
    this.loadServiciosDisponibles(hoy);
  }

  private loadServiciosDisponibles(fecha: string): void {
    if (!fecha) return;
    
    this.loadingServicios = true;
    // Convertir fecha de YYYY-MM-DD a DD/MM/YYYY para la API
    const [year, month, day] = fecha.split('-');
    const fechaAPI = `${day}/${month}/${year}`;
    
    this.subs.add(
      this.reservasService.getDetallesPendientes(fechaAPI).subscribe({
        next: (detalles) => {
          // Filtrar los que ya están en la orden actual
          const idsAsignados = new Set(this.detallesOrden.map(d => d.detalleReservaId));
          const baseDisponibles = detalles
            .filter(d => !idsAsignados.has(d.id))
            .map(det => ({ ...det, esRemanente: false } as DetalleDisponibleUI));

          const remanentesFecha = this.getRemanentesParaFecha(fecha)
            .filter(rem => !this.isRemanenteAsignado(rem));

          this.detallesDisponibles = [...baseDisponibles, ...remanentesFecha];
          this.updateHorariosDisponibles(this.detallesDisponibles);
          this.loadingServicios = false;
        },
        error: (err) => {
          console.error('Error al cargar servicios disponibles:', err);
          const remanentesFecha = this.getRemanentesParaFecha(fecha)
            .filter(rem => !this.isRemanenteAsignado(rem));
          this.detallesDisponibles = remanentesFecha;
          this.updateHorariosDisponibles(this.detallesDisponibles);
          this.loadingServicios = false;
        }
      })
    );
  }

  private updateHorariosDisponibles(detalles: DetalleDisponibleUI[]): void {
    const horariosUnicos = new Set<string>();
    detalles.forEach((detalle) => {
      const normalizado = this.normalizeHora(detalle.hora);
      if (normalizado) {
        horariosUnicos.add(normalizado);
      }
    });
    this.horariosDisponibles = Array.from(horariosUnicos).sort((a, b) => a.localeCompare(b));
    if (this.selectedTime && !horariosUnicos.has(this.selectedTime)) {
      this.selectedTime = null;
    }
  }

  private buildRemanente(detalle: DetalleDisponibleUI, destinoOT: string): DetalleDisponibleUI | null {
    const destinoBase = detalle.destino || '';
    const destinoNormalizado = this.normalizeTexto(destinoOT);
    const baseNormalizado = this.normalizeTexto(destinoBase);

    if (!destinoNormalizado || destinoNormalizado === baseNormalizado) {
      return null;
    }

    return {
      ...detalle,
      key: this.buildRemanenteKey(detalle, destinoOT, destinoBase),
      origen: destinoOT,
      destino: destinoBase,
      zonaOrigen: '',
      origenPlaceId: '',
      origenLat: 0,
      origenLng: 0,
      esRemanente: true
    };
  }

  private buildRemanenteFromOrdenDetalle(detalle: OrdenTrabajoDetalle): DetalleDisponibleUI | null {
    if (!detalle.detalleReservaId) {
      return null;
    }

    const origen = detalle.origenOT || '';
    const destino = detalle.destinoOT || '';

    if (!origen || !destino) {
      return null;
    }

    return {
      key: this.buildRemanenteKeyFromValues(detalle.detalleReservaId, detalle.hora, origen, destino),
      id: detalle.detalleReservaId,
      codReserva: detalle.reservaId,
      linea: 0,
      cliente: detalle.clienteFinal,
      telefono: detalle.telefonoCliente || '',
      email: detalle.emailCliente || '',
      agencia: detalle.agencia,
      nombreAgencia: detalle.agencia,
      estadoReserva: '',
      folio: detalle.boleta || '',
      tipoServicio: '',
      codServicio: detalle.servicioId || '',
      servicio: detalle.servicio,
      observacion: detalle.observaciones || '',
      fechaServicio: detalle.fechaServicio,
      hora: detalle.hora,
      origen,
      zonaOrigen: '',
      origenPlaceId: detalle.origenPlaceId || '',
      origenLat: detalle.origenLat || 0,
      origenLng: detalle.origenLng || 0,
      destino,
      zonaDestino: '',
      destinoPlaceId: detalle.destinoPlaceId || '',
      destinoLat: detalle.destinoLat || 0,
      destinoLng: detalle.destinoLng || 0,
      adultos: detalle.adultos || 0,
      ninos: detalle.ninos || 0,
      pax: detalle.pax,
      precioAdulto: 0,
      precioNino: 0,
      montoServicio: detalle.montoServicio || 0,
      moneda: detalle.moneda || '',
      distanciaKm: 0,
      tiempoEstimadoMin: 0,
      asignadoOT: false,
      codOrdenTrabajo: null,
      esRemanente: true
    };
  }

  private buildRemanenteKey(detalle: DetalleDisponibleUI, origen: string, destino: string): string {
    return this.buildRemanenteKeyFromValues(detalle.id, detalle.hora, origen, destino);
  }

  private buildRemanenteKeyFromValues(detalleId: number, hora: string, origen: string, destino: string): string {
    const origenKey = this.slugify(origen);
    const destinoKey = this.slugify(destino);
    const horaKey = this.normalizeHora(hora) || 'sin-hora';
    return `rem-${detalleId}-${horaKey}-${origenKey}-${destinoKey}`;
  }

  private slugify(value: string): string {
    const normalized = this.normalizeTexto(value);
    return normalized ? normalized.replace(/\s+/g, '-').slice(0, 80) : 'sin-texto';
  }

  private isSameRemanente(a: DetalleDisponibleUI, b: DetalleDisponibleUI): boolean {
    return (
      a.id === b.id &&
      this.normalizeHora(a.hora) === this.normalizeHora(b.hora) &&
      this.normalizeTexto(a.origen) === this.normalizeTexto(b.origen) &&
      this.normalizeTexto(a.destino) === this.normalizeTexto(b.destino)
    );
  }

  private removeRemanenteSegment(
    detalleReservaId: number | undefined,
    origen: string,
    destino: string,
    hora: string
  ): boolean {
    if (!detalleReservaId) {
      return false;
    }
    const before = this.remanentesPendientes.length;
    this.remanentesPendientes = this.remanentesPendientes.filter(
      (remanente) =>
        !(
          remanente.id === detalleReservaId &&
          this.normalizeHora(remanente.hora) === this.normalizeHora(hora) &&
          this.normalizeTexto(remanente.origen) === this.normalizeTexto(origen) &&
          this.normalizeTexto(remanente.destino) === this.normalizeTexto(destino)
        )
    );
    return this.remanentesPendientes.length !== before;
  }

  private isRemanenteAsignado(remanente: DetalleDisponibleUI): boolean {
    return this.detallesOrden.some((detalle) => this.isSameSegment(remanente, detalle));
  }

  private isSameSegment(remanente: DetalleDisponibleUI, detalle: OrdenTrabajoDetalle): boolean {
    if (!detalle.detalleReservaId) {
      return false;
    }
    if (remanente.id !== detalle.detalleReservaId) {
      return false;
    }
    return (
      this.normalizeTexto(remanente.origen) === this.normalizeTexto(detalle.origenOT) &&
      this.normalizeTexto(remanente.destino) === this.normalizeTexto(detalle.destinoOT)
    );
  }

  private pruneRemanentesAsignados(): void {
    if (!this.remanentesPendientes.length || !this.detallesOrden.length) {
      return;
    }
    this.remanentesPendientes = this.remanentesPendientes.filter(
      (remanente) => !this.isRemanenteAsignado(remanente)
    );
    this.persistRemanentes();
  }

  private getRemanentesParaFecha(fecha: string): DetalleDisponibleUI[] {
    const normalized = this.normalizeFecha(fecha);
    if (!normalized) {
      return [];
    }
    return this.remanentesPendientes.filter(
      (remanente) => this.normalizeFecha(remanente.fechaServicio) === normalized
    );
  }

  private loadRemanentesFromStorage(): void {
    try {
      if (typeof localStorage === 'undefined') {
        this.remanentesPendientes = [];
        return;
      }
      const raw = localStorage.getItem(this.remanentesStorageKey);
      if (!raw) {
        this.remanentesPendientes = [];
        return;
      }
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        this.remanentesPendientes = [];
        return;
      }
      this.remanentesPendientes = parsed.map((item) => ({ ...item, esRemanente: true })) as DetalleDisponibleUI[];
    } catch (error) {
      console.error('Error cargando remanentes locales:', error);
      this.remanentesPendientes = [];
    }
  }

  private persistRemanentes(): void {
    try {
      if (typeof localStorage === 'undefined') {
        return;
      }
      if (!this.remanentesPendientes.length) {
        localStorage.removeItem(this.remanentesStorageKey);
        return;
      }
      const payload = this.remanentesPendientes.map(({ esRemanente, ...rest }) => rest);
      localStorage.setItem(this.remanentesStorageKey, JSON.stringify(payload));
    } catch (error) {
      console.error('Error guardando remanentes locales:', error);
    }
  }

  private normalizeFecha(value: string | null | undefined): string {
    const trimmed = (value ?? '').trim();
    if (!trimmed) {
      return '';
    }
    const datePart = trimmed.split('T')[0];
    if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
      return datePart;
    }
    const slashMatch = datePart.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (slashMatch) {
      const [, day, month, year] = slashMatch;
      return `${year}-${month}-${day}`;
    }
    return datePart;
  }

  private normalizeTexto(value: string | null | undefined): string {
    return (value ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
  }

  private normalizeHora(value: string | null | undefined): string {
    const trimmed = (value ?? '').trim();
    if (!trimmed) {
      return '';
    }
    const match = trimmed.match(/^(\d{1,2}):(\d{2})/);
    if (!match) {
      return trimmed;
    }
    const horas = match[1].padStart(2, '0');
    const minutos = match[2];
    return `${horas}:${minutos}`;
  }
}
