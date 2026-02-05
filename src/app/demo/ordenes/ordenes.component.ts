import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { Router } from '@angular/router';
import Swal from 'sweetalert2';

import { SharedModule } from 'src/app/theme/shared/shared.module';
import { OrdenTrabajoPaginacionUI, OrdenTrabajoService, OrdenTrabajoUI } from './orden-trabajo.service';

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

  ngOnInit(): void {
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
      fechaInicio: '',
      fechaFin: ''
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

  imprimirOrden(orden: OrdenTrabajoUI): void {
    console.log('Imprimir Orden de Trabajo', orden.codOT ?? orden.id);
  }

  verEditar(orden: OrdenTrabajoUI): void {
    const id = orden?.id;
    if (id === null || id === undefined || id === '') {
      Swal.fire({
        title: 'No disponible',
        text: 'No se pudo determinar el identificador de la OT para navegar a edición.',
        icon: 'info'
      });
      return;
    }
    this.router.navigate(['/operaciones/ordenes-trabajo', id, 'editar']);
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
}
