import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Subscription, finalize } from 'rxjs';
import { Router } from '@angular/router';
import Swal from 'sweetalert2';

import { environment } from 'src/environments/environment';
import { SharedModule } from 'src/app/theme/shared/shared.module';
import { OrdenTrabajoPaginacionUI, OrdenTrabajoService, OrdenTrabajoUI } from './orden-trabajo.service';
import { SuplidorService, SuplidorDisponibilidadUI } from '../catalogos/suplidores/suplidor.service';
import { AuthService } from 'src/app/core/services/auth.service';

@Component({
  selector: 'app-ordenes',
  imports: [CommonModule, SharedModule, FormsModule],
  templateUrl: './ordenes.component.html',
  styleUrls: ['./ordenes.component.scss']
})
export class OrdenesComponent implements OnInit, OnDestroy {
  ordenes: OrdenTrabajoUI[] = [];
  isLoading = false;

  filtros = {
    busqueda: '',
    estado: '',
    fechaInicio: '',
    fechaFin: ''
  };

  estadosDisponibles: { codigo: string; descripcion: string }[] = [];

  pageSizeOptions = [10, 20, 50, 100];
  pageSize = 50;
  currentPage = 1;

  paginacion: OrdenTrabajoPaginacionUI = {
    paginaActual: 1,
    registrosPorPagina: this.pageSize,
    totalRegistros: 0,
    totalPaginas: 1,
    tienePaginaAnterior: false,
    tienePaginaSiguiente: false
  };

  private subscriptions = new Subscription();
  private ordenTrabajoService = inject(OrdenTrabajoService);
  private router = inject(Router);
  private http = inject(HttpClient);
  private suplidorService = inject(SuplidorService);
  private authService = inject(AuthService);

  ngOnInit(): void {
    this.filtros.fechaInicio = this.getCurrentDate();
    this.filtros.fechaFin = this.getLastDayOfMonth();
    this.loadOrdenes();
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  onBuscar(): void {
    this.currentPage = 1;
    this.loadOrdenes();
  }

  onLimpiar(): void {
    this.filtros = {
      busqueda: '',
      estado: '',
      fechaInicio: this.getCurrentDate(),
      fechaFin: this.getLastDayOfMonth()
    };
    this.currentPage = 1;
    this.loadOrdenes();
  }

  onPageSizeChange(): void {
    this.currentPage = 1;
    this.loadOrdenes();
  }

  goToPageRelative(delta: number): void {
    const nextPage = this.currentPage + delta;
    if (nextPage < 1 || nextPage > this.paginacion.totalPaginas) {
      return;
    }
    this.currentPage = nextPage;
    this.loadOrdenes();
  }

  getEstadoBadge(estadoCodigo?: string, estadoDescripcion?: string): string {
    const code = (estadoCodigo ?? '').toUpperCase().trim();
    const desc = (estadoDescripcion ?? '').toLowerCase().trim();

    if (code === 'ANU' || desc.includes('anul')) {
      return 'bg-danger text-white';
    }
    if (code === 'FIN' || desc.includes('final')) {
      return 'bg-success text-white';
    }
    if (code === 'PRO' || desc.includes('proceso')) {
      return 'bg-warning text-dark';
    }
    if (code === 'ASI' || desc.includes('asign')) {
      return 'bg-primary text-white';
    }
    if (code === 'PEN' || desc.includes('pend')) {
      return 'bg-secondary text-white';
    }
    return 'bg-light text-dark';
  }

  esOrdenAnulada(orden: OrdenTrabajoUI): boolean {
    const estadoCodigo = (orden.estado?.codigo ?? '').toUpperCase().trim();
    const estadoDesc = (orden.estado?.descripcion ?? '').toLowerCase().trim();
    return estadoCodigo === 'CAN' || estadoDesc.includes('CAN');
  }

  imprimirOrden(orden: OrdenTrabajoUI): void {
    const cod = orden.codOT;
    if (!cod) {
      Swal.fire({
        title: 'No disponible',
        text: 'No se pudo determinar el código de la OT para imprimir.',
        icon: 'info'
      });
      return;
    }

    const baseApiUrl = environment.apiUrl.replace(/\/+$/, '');
    const url = `${baseApiUrl}/ordentrabajo/${encodeURIComponent(cod)}/reporte-pdf`;

    // Mostrar indicador de carga
    Swal.fire({
      title: 'Generando PDF...',
      text: 'Por favor espere',
      allowOutsideClick: false,
      allowEscapeKey: false,
      didOpen: () => {
        Swal.showLoading();
      }
    });

    this.http.get(url, { responseType: 'blob' })
      .pipe(
        finalize(() => {
          Swal.close();
        })
      )
      .subscribe({
        next: (data) => {
          try {
            const pdfBlob = new Blob([data], { type: 'application/pdf' });
            const objectUrl = URL.createObjectURL(pdfBlob);

            const link = document.createElement('a');
            link.href = objectUrl;
            link.download = `Orden_Trabajo_${cod}.pdf`;
            link.rel = 'noopener';

            document.body.appendChild(link);
            link.click();
            link.remove();

            setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
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
            text: 'No se pudo obtener la orden en PDF.',
            icon: 'error'
          });
        }
      });
  }

  cancelarOrden(orden: OrdenTrabajoUI): void {
    const codOT = orden?.codOT;
    if (!codOT) {
      Swal.fire({
        title: 'Error',
        text: 'No se pudo determinar el código de la orden de trabajo.',
        icon: 'error'
      });
      return;
    }

    // Verificar si la orden ya está anulada
    const estadoCodigo = (orden.estado?.codigo ?? '').toUpperCase().trim();
    const estadoDesc = (orden.estado?.descripcion ?? '').toLowerCase().trim();
    if (estadoCodigo === 'ANU' || estadoDesc.includes('anul')) {
      Swal.fire({
        title: 'Orden ya cancelada',
        text: 'Esta orden de trabajo ya se encuentra anulada.',
        icon: 'warning'
      });
      return;
    }

    // Confirmar cancelación
    Swal.fire({
      title: '¿Cancelar Orden de Trabajo?',
      html: `
        <div style="text-align: left;">
          <p><strong>Código OT:</strong> ${codOT}</p>
          <p><strong>Suplidor:</strong> ${orden.suplidor || 'N/D'}</p>
          <p><strong>Fecha servicio:</strong> ${orden.fechaServicio ? new Date(orden.fechaServicio).toLocaleDateString('es-ES') : 'N/D'}</p>
          <p><strong>Total:</strong> ${orden.total !== null && orden.total !== undefined ? orden.total.toFixed(2) : 'N/D'} ${orden.moneda || ''}</p>
          <hr>
          <p class="text-danger"><strong>⚠️ Esta acción cambiará el estado de la orden a ANULADO.</strong></p>
        </div>
      `,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, cancelar orden',
      cancelButtonText: 'No, mantener',
      confirmButtonColor: '#dc3545',
      cancelButtonColor: '#6c757d',
      reverseButtons: true
    }).then((result) => {
      if (result.isConfirmed) {
        this.ejecutarCancelacion(codOT);
      }
    });
  }

  private ejecutarCancelacion(codOT: string): void {
    // Mostrar loading
    Swal.fire({
      title: 'Cancelando orden...',
      text: 'Por favor espere',
      allowOutsideClick: false,
      didOpen: () => {
        Swal.showLoading();
      }
    });

    // Llamar al servicio
    this.ordenTrabajoService.cancelarOrden(codOT).subscribe({
      next: () => {
        Swal.close();
        Swal.fire({
          title: '¡Cancelada!',
          text: 'La orden de trabajo ha sido cancelada exitosamente.',
          icon: 'success',
          timer: 2000,
          showConfirmButton: false
        });
        // Recargar lista
        this.loadOrdenes();
      },
      error: (error) => {
        Swal.close();
        console.error('Error al cancelar orden:', error);
        Swal.fire({
          title: 'Error',
          text: error.error?.message || error.message || 'No se pudo cancelar la orden de trabajo.',
          icon: 'error'
        });
      }
    });
  }

  cambiarSuplidorVehiculo(orden: OrdenTrabajoUI): void {
    const codOT = orden.codOT;
    if (!codOT) {
      Swal.fire({
        title: 'No disponible',
        text: 'No se pudo determinar el código de la OT.',
        icon: 'info'
      });
      return;
    }

    // Validar que la orden no esté anulada
    if (this.esOrdenAnulada(orden)) {
      Swal.fire({
        title: 'Orden Anulada',
        text: 'No se puede modificar el suplidor/vehículo de una orden anulada.',
        icon: 'warning'
      });
      return;
    }

    if (!orden.fechaServicio) {
      Swal.fire({
        title: 'Fecha no disponible',
        text: 'No se puede cambiar el suplidor sin fecha de servicio.',
        icon: 'warning'
      });
      return;
    }

    // Mostrar loading mientras cargamos suplidores
    Swal.fire({
      title: 'Cargando suplidores...',
      text: 'Obteniendo disponibilidad',
      allowOutsideClick: false,
      didOpen: () => {
        Swal.showLoading();
      }
    });

    // Convertir fecha para API (de YYYY-MM-DD o YYYY-MM-DDTHH:mm:ss a DD/MM/YYYY)
    let fechaAPI = orden.fechaServicio;
    // Si tiene formato ISO con hora, extraer solo la fecha
    if (fechaAPI.includes('T')) {
      fechaAPI = fechaAPI.split('T')[0];
    }
    // Convertir de YYYY-MM-DD a DD/MM/YYYY
    const fechaParts = fechaAPI.split('-');
    if (fechaParts.length === 3) {
      fechaAPI = `${fechaParts[2]}/${fechaParts[1]}/${fechaParts[0]}`;
    }

    // Cargar suplidores disponibles
    this.suplidorService.getDisponibilidad(fechaAPI).subscribe({
      next: (suplidores) => {
        Swal.close();
        this.mostrarDialogoSeleccionSuplidor(codOT, orden, suplidores);
      },
      error: (err) => {
        console.error('Error cargando suplidores:', err);
        Swal.fire({
          title: 'Error',
          text: 'No se pudieron cargar los suplidores disponibles.',
          icon: 'error'
        });
      }
    });
  }

  private mostrarDialogoSeleccionSuplidor(
    codOT: string, 
    orden: OrdenTrabajoUI, 
    suplidores: SuplidorDisponibilidadUI[]
  ): void {
    if (!suplidores.length) {
      Swal.fire({
        title: 'Sin suplidores',
        text: 'No hay suplidores disponibles para esta fecha.',
        icon: 'warning'
      });
      return;
    }

    // Crear opciones HTML para el select
    const opcionesSuplidor = suplidores.map(s => 
      `<option value="${s.codigo}">${s.nombre} (${s.capacidadDisponible} vacantes)</option>`
    ).join('');

    Swal.fire({
      title: '🚚 Cambiar Suplidor/Vehículo/Chofer',
      html: `
        <div style="text-align: left;">
          <p><strong>Orden:</strong> ${codOT}</p>
          <p><strong>Actual:</strong> ${orden.suplidor || 'N/D'}</p>
          <hr>
          <div class="mb-3">
            <label class="form-label">Seleccione Suplidor:</label>
            <select id="swal-suplidor" class="form-select">
              <option value="">-- Seleccione --</option>
              ${opcionesSuplidor}
            </select>
          </div>
          <div class="mb-3">
            <label class="form-label">Seleccione Vehículo:</label>
            <select id="swal-vehiculo" class="form-select" disabled>
              <option value="">-- Primero seleccione suplidor --</option>
            </select>
          </div>
          <div class="mb-3">
            <label class="form-label">Seleccione Chofer:</label>
            <select id="swal-chofer" class="form-select" disabled>
              <option value="">-- Primero seleccione suplidor --</option>
            </select>
          </div>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: 'Actualizar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#4680ff',
      didOpen: () => {
        const suplidorSelect = document.getElementById('swal-suplidor') as HTMLSelectElement;
        const vehiculoSelect = document.getElementById('swal-vehiculo') as HTMLSelectElement;
        const choferSelect = document.getElementById('swal-chofer') as HTMLSelectElement;

        suplidorSelect?.addEventListener('change', () => {
          const codSuplidor = suplidorSelect.value;
          if (!codSuplidor) {
            vehiculoSelect.disabled = true;
            choferSelect.disabled = true;
            vehiculoSelect.innerHTML = '<option value="">-- Primero seleccione suplidor --</option>';
            choferSelect.innerHTML = '<option value="">-- Primero seleccione suplidor --</option>';
            return;
          }

          const suplidor = suplidores.find(s => s.codigo === codSuplidor);
          if (!suplidor) return;

          // Cargar vehículos
          vehiculoSelect.disabled = false;
          const opcionesVehiculo = suplidor.vehiculos
            .map(v => `<option value="${v.codigo}">${v.nombre} (Cap: ${v.capacidadMax}, Disp: ${v.capacidadDisponible})</option>`)
            .join('');
          vehiculoSelect.innerHTML = `<option value="">-- Seleccione vehículo --</option>${opcionesVehiculo}`;

          // Cargar choferes
          choferSelect.disabled = false;
          const opcionesChofer = suplidor.choferes
            .filter(c => !c.asignado)
            .map(c => `<option value="${c.codigo}">${c.nombre} (${c.tipoLicencia})</option>`)
            .join('');
          choferSelect.innerHTML = `<option value="">-- Seleccione chofer --</option>${opcionesChofer}`;
        });
      },
      preConfirm: () => {
        const suplidorSelect = document.getElementById('swal-suplidor') as HTMLSelectElement;
        const vehiculoSelect = document.getElementById('swal-vehiculo') as HTMLSelectElement;
        const choferSelect = document.getElementById('swal-chofer') as HTMLSelectElement;

        const codSuplidor = suplidorSelect?.value;
        const codVehiculo = vehiculoSelect?.value;
        const codChofer = choferSelect?.value;

        if (!codSuplidor) {
          Swal.showValidationMessage('Debe seleccionar un suplidor');
          return false;
        }

        if (!codVehiculo) {
          Swal.showValidationMessage('Debe seleccionar un vehículo');
          return false;
        }

        if (!codChofer) {
          Swal.showValidationMessage('Debe seleccionar un chofer');
          return false;
        }

        return { codSuplidor, codVehiculo, codChofer };
      }
    }).then((result) => {
      if (result.isConfirmed && result.value) {
        this.ejecutarCambioSuplidorVehiculo(
          codOT,
          result.value.codSuplidor,
          result.value.codVehiculo,
          result.value.codChofer
        );
      }
    });
  }

  private ejecutarCambioSuplidorVehiculo(
    codOT: string,
    codSuplidor: string,
    codVehiculo: string,
    codChofer: string
  ): void {
    // Mostrar loading
    Swal.fire({
      title: 'Actualizando...',
      text: 'Cambiando suplidor, vehículo y chofer',
      allowOutsideClick: false,
      didOpen: () => {
        Swal.showLoading();
      }
    });

    // Llamar al servicio
    this.ordenTrabajoService.actualizarSuplidorVehiculo(
      codOT,
      codSuplidor,
      codVehiculo,
      codChofer
    ).subscribe({
      next: () => {
        Swal.close();
        Swal.fire({
          title: '¡Actualizado!',
          text: 'El suplidor, vehículo y chofer han sido actualizados exitosamente.',
          icon: 'success',
          timer: 2000,
          showConfirmButton: false
        });
        // Recargar lista
        this.loadOrdenes();
      },
      error: (error) => {
        Swal.close();
        Swal.fire({
          title: 'Error',
          text: error.message || 'No se pudo actualizar la orden.',
          icon: 'error'
        });
      }
    });
  }

  verEditar(orden: OrdenTrabajoUI): void {
    const id = orden?.codOT;
    if (id === null || id === undefined || id === '') {
      Swal.fire({
        title: 'No disponible',
        text: 'No se pudo determinar el identificador de la OT para navegar a edición.',
        icon: 'info'
      });
      return;
    }
    
    // Validar que la orden no esté anulada
    if (this.esOrdenAnulada(orden)) {
      Swal.fire({
        title: 'Orden Anulada',
        text: 'No se puede editar una orden de trabajo que ha sido anulada.',
        icon: 'warning'
      });
      return;
    }
    
    this.router.navigate(['/operaciones/ordenes-trabajo', id, 'editar']);
  }

  verDetalle(orden: OrdenTrabajoUI): void {
    const id = orden?.codOT;
    if (id === null || id === undefined || id === '') {
      Swal.fire({
        title: 'No disponible',
        text: 'No se pudo determinar el identificador de la OT para ver el detalle.',
        icon: 'info'
      });
      return;
    }
    this.router.navigate(['/operaciones/ordenes-trabajo', id, 'detalle']);
  }

  nuevaOrden(): void {
    this.router.navigate(['/operaciones/ordenes-trabajo/nueva']);
  }

  trackByOrdenId(index: number, orden: OrdenTrabajoUI): string | number {
    return orden.id ?? orden.codOT ?? index;
  }

  private loadOrdenes(): void {
    this.isLoading = true;

    const query = this.buildQuery();
    this.subscriptions.add(
      this.ordenTrabajoService.getOrdenesTrabajo(query).subscribe({
        next: (result) => {
          this.ordenes = result?.datos ?? [];
          this.paginacion = result?.paginacion ?? this.paginacion;
          this.currentPage = this.paginacion.paginaActual ?? this.currentPage;
          this.pageSize = this.paginacion.registrosPorPagina ?? this.pageSize;
          this.buildEstadosDisponibles(this.ordenes);
          this.isLoading = false;
        },
        error: (error) => {
          console.error('Error al cargar órdenes de trabajo:', error);
          Swal.fire({
            title: 'Error',
            text: 'No se pudieron cargar las órdenes de trabajo.',
            icon: 'error'
          });
          this.ordenes = [];
          this.isLoading = false;
        }
      })
    );
  }

  private buildQuery(): {
    codOT?: string;
    codReserva?: string;
    estado?: string;
    fechaInicio?: string;
    fechaFin?: string;
    nombreSuplidor?: string;
    pageNumber: number;
    pageSize: number;
  } {
    const { codOT, codReserva, nombreSuplidor } = this.mapBusquedaGeneral(this.filtros.busqueda);

    return {
      codOT,
      codReserva,
      nombreSuplidor,
      estado: this.filtros.estado || undefined,
      fechaInicio: this.formatDateForApi(this.filtros.fechaInicio),
      fechaFin: this.formatDateForApi(this.filtros.fechaFin),
      pageNumber: this.currentPage,
      pageSize: this.pageSize
    };
  }

  private mapBusquedaGeneral(texto: string): { codOT?: string; codReserva?: string; nombreSuplidor?: string } {
    const value = (texto ?? '').trim();
    if (!value) {
      return {};
    }
    if (/^\d+$/.test(value)) {
      return { codReserva: value };
    }
    if (/^[a-zA-Z\s]+$/.test(value)) {
      return { nombreSuplidor: value };
    }
    return { codOT: value };
  }

  private formatDateForApi(value: string): string | undefined {
    const normalized = (value ?? '').trim();
    if (!normalized) {
      return undefined;
    }
    if (normalized.includes('/')) {
      return normalized;
    }
    const parts = normalized.split('-');
    if (parts.length === 3) {
      const [yyyy, mm, dd] = parts;
      if (yyyy && mm && dd) {
        return `${dd}/${mm}/${yyyy}`;
      }
    }
    return normalized;
  }

  private buildEstadosDisponibles(ordenes: OrdenTrabajoUI[]): void {
    const mapEstados = new Map<string, { codigo: string; descripcion: string }>();
    ordenes.forEach((o) => {
      const codigo = (o.estado?.codigo ?? '').trim();
      const descripcion = (o.estado?.descripcion ?? '').trim();
      if (!codigo && !descripcion) {
        return;
      }
      const key = codigo || descripcion;
      mapEstados.set(key, {
        codigo: codigo || descripcion,
        descripcion: descripcion || codigo
      });
    });

    this.estadosDisponibles = Array.from(mapEstados.values()).sort((a, b) => a.descripcion.localeCompare(b.descripcion));
  }

  private getCurrentDate(): string {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private getLastDayOfMonth(): string {
    const today = new Date();
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    const year = lastDay.getFullYear();
    const month = String(lastDay.getMonth() + 1).padStart(2, '0');
    const day = String(lastDay.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
