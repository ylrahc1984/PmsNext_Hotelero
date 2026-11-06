import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import Swal from 'sweetalert2';
import { ToastService } from 'src/app/core/services/toast.service';
import { SolicitudHuespedService } from '../solicitudes-huespedes/solicitudes-huespedes.service';
import { ConciergeCatalogoService } from './concierge-catalogo.service';
import { TipoSolicitudCatalogo } from './concierge-catalogo.models';

const AREA_LABELS: Record<string, string> = { HOUSEKEEPING: 'Ama de llaves', RECEPCION: 'Recepción', MANTENIMIENTO: 'Mantenimiento', ALIMENTOS: 'Alimentos y bebidas' };
@Component({ selector: 'app-concierge-catalogo-list', standalone: true, imports: [CommonModule, ReactiveFormsModule], templateUrl: './concierge-catalogo-list.component.html', styleUrls: ['./concierge-catalogo.scss'] })
export class ConciergeCatalogoListComponent implements OnInit {
  private readonly service = inject(ConciergeCatalogoService);
  private readonly tiposService = inject(SolicitudHuespedService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly fb = inject(FormBuilder);
  readonly filtros = this.fb.nonNullable.group({ busqueda: '', area: '', estado: '' });
  readonly conocidas = ['HOUSEKEEPING', 'RECEPCION', 'MANTENIMIENTO', 'ALIMENTOS'];
  areas: string[] = [...this.conocidas];
  servicios: TipoSolicitudCatalogo[] = [];
  cargando = true;
  error = '';
  readonly ocupadas = new Set<number>();

  ngOnInit(): void {
    this.cargar();
    this.tiposService.consultarTipos().subscribe({ next: (items) => { this.areas = [...new Set([...this.conocidas, ...items.map((item) => item.area).filter(Boolean)])].sort(); } });
  }
  cargar(): void {
    this.cargando = true; this.error = '';
    this.service.listar().subscribe({ next: (data) => { this.servicios = [...data].sort((a, b) => a.orden - b.orden); this.cargando = false; }, error: (err) => { this.error = this.mensajeError(err); this.cargando = false; } });
  }
  get filtrados(): TipoSolicitudCatalogo[] {
    const { busqueda, area, estado } = this.filtros.getRawValue(); const q = busqueda.trim().toLocaleLowerCase();
    return this.servicios.filter((i) => (!q || `${i.nombre} ${i.nombreEN ?? ''}`.toLocaleLowerCase().includes(q)) && (!area || i.area === area) && (!estado || i.activo === (estado === 'activo'))).sort((a,b) => a.orden-b.orden);
  }
  etiquetaArea(area: string): string { return AREA_LABELS[area] ?? area; }
  nuevo(): void { void this.router.navigate(['/administracion/configuracion-general/concierge/nuevo']); }
  editar(id: number): void { void this.router.navigate(['/administracion/configuracion-general/concierge/editar', id]); }
  async cambiarEstado(item: TipoSolicitudCatalogo): Promise<void> {
    if (this.ocupadas.has(item.idTipoSolicitud)) return;
    const activo = !item.activo;
    const result = await Swal.fire({ title: `${activo ? 'Activar' : 'Desactivar'} servicio`, text: `¿Desea ${activo ? 'activar' : 'desactivar'} «${item.nombre}»?`, icon: 'question', showCancelButton: true, confirmButtonText: activo ? 'Activar' : 'Desactivar', cancelButtonText: 'Cancelar' });
    if (!result.isConfirmed) return;
    this.ocupadas.add(item.idTipoSolicitud);
    this.service.cambiarEstado(item.idTipoSolicitud, activo).subscribe({ next: (actualizado) => { this.servicios = this.servicios.map((s) => s.idTipoSolicitud === actualizado.idTipoSolicitud ? actualizado : s); this.toast.success(`Servicio ${activo ? 'activado' : 'desactivado'} correctamente.`); this.ocupadas.delete(item.idTipoSolicitud); }, error: (err) => { this.toast.error(this.mensajeError(err)); this.ocupadas.delete(item.idTipoSolicitud); } });
  }
  private mensajeError(err: unknown): string {
    if (err instanceof HttpErrorResponse) {
      if (err.status === 400) return 'Los datos enviados no son válidos. Revise la información del servicio.';
      if (err.status === 401 || err.status === 403) return 'No tiene autorización para administrar este catálogo.';
      if (err.status === 404) return 'El servicio solicitado ya no existe.';
      if (err.status === 409) return 'Ya existe un servicio con esos datos.';
      return err.status >= 500 ? 'Ocurrió un error técnico. Intente nuevamente.' : 'No fue posible comunicarse con el catálogo.';
    }
    return 'No fue posible consultar el catálogo. Verifique su conexión e intente nuevamente.';
  }
}
