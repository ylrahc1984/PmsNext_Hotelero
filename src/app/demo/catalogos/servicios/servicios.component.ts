import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import Swal from 'sweetalert2';

import { SharedModule } from 'src/app/theme/shared/shared.module';
import { ServiciosService, ServicioUI } from './servicios.service';

@Component({
  selector: 'app-servicios',
  imports: [CommonModule, SharedModule, FormsModule, RouterModule],
  templateUrl: './servicios.component.html',
  styleUrls: ['./servicios.component.scss']
})
export class ServiciosComponent implements OnInit {
  servicios: ServicioUI[] = [];
  filteredServicios: ServicioUI[] = [];
  isLoading = false;

  filterNombre = '';
  filterCategoria = '';
  filterGrupo = '';
  filterVisible = '';

  categoriaOptions: string[] = [];
  grupoOptions: string[] = [];

  currentPage = 1;
  pageSize = 20;
  totalPages = 1;
  totalRegistros = 0;
  pageSizeOptions = [10, 20, 50, 100];

  private serviciosService = inject(ServiciosService);

  ngOnInit() {
    this.loadServicios();
  }

  loadServicios(): void {
    this.isLoading = true;
    const visible = this.filterVisible === '' ? undefined : Number(this.filterVisible);
    const codGrupo = this.filterGrupo.trim() || undefined;
    const codCateg = this.filterCategoria.trim() || undefined;
    const nombre = this.filterNombre.trim();

    const request = nombre
      ? this.serviciosService.buscarServicios(nombre, visible, this.currentPage, this.pageSize)
      : this.serviciosService.getServicios(visible, this.currentPage, this.pageSize, codGrupo, codCateg);

    request.subscribe({
      next: (result) => {
        this.servicios = result.data ?? [];
        this.totalRegistros = Number(result.totalRegistros ?? this.servicios.length) || this.servicios.length;
        this.currentPage = Number(result.paginaActual ?? this.currentPage) || this.currentPage;
        this.pageSize = Number(result.pageSize ?? this.pageSize) || this.pageSize;
        this.totalPages = Number(result.totalPages ?? 1) || 1;
        this.updateFilterOptions();
        this.applyLocalFilters();
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error al cargar servicios:', error);
        Swal.fire({
          title: 'Error',
          text: 'No se pudieron cargar los servicios.',
          icon: 'error'
        });
        this.isLoading = false;
      }
    });
  }

  private updateFilterOptions(): void {
    const categorias = new Set(this.servicios.map((item) => item.codCateg).filter(Boolean));
    const grupos = new Set(this.servicios.map((item) => item.codGrupo).filter(Boolean));
    this.categoriaOptions = Array.from(categorias).sort();
    this.grupoOptions = Array.from(grupos).sort();
  }

  applyLocalFilters(): void {
    const categoria = this.filterCategoria.trim();
    const grupo = this.filterGrupo.trim();
    const visible = this.filterVisible === '' ? null : Number(this.filterVisible);

    this.filteredServicios = this.servicios.filter((item) => {
      const matchesCategoria = !categoria || item.codCateg === categoria;
      const matchesGrupo = !grupo || item.codGrupo === grupo;
      const matchesVisible = visible === null || item.visible === visible;
      return matchesCategoria && matchesGrupo && matchesVisible;
    });
  }

  onBuscar(): void {
    this.currentPage = 1;
    this.loadServicios();
  }

  onLimpiar(): void {
    this.filterNombre = '';
    this.filterCategoria = '';
    this.filterGrupo = '';
    this.filterVisible = '';
    this.currentPage = 1;
    this.loadServicios();
  }

  onPageSizeChange(): void {
    this.currentPage = 1;
    this.pageSize = Number(this.pageSize) || 20;
    this.loadServicios();
  }

  goToPageRelative(delta: number): void {
    const nextPage = Number(this.currentPage) + delta;
    if (nextPage < 1 || nextPage > this.totalPages) {
      return;
    }
    this.currentPage = nextPage;
    this.loadServicios();
  }

  deleteServicio(servicio: ServicioUI): void {
    Swal.fire({
      title: 'Eliminar servicio',
      text: `Desea eliminar el servicio ${servicio.codReceta}?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Si, eliminar',
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (!result.isConfirmed) {
        return;
      }
      this.isLoading = true;
      this.serviciosService.eliminarServicio(servicio.codReceta).subscribe({
        next: () => {
          Swal.fire({
            title: 'Eliminado',
            text: 'Servicio eliminado correctamente.',
            icon: 'success'
          });
          this.loadServicios();
        },
        error: (error) => {
          console.error('Error al eliminar servicio:', error);
          Swal.fire({
            title: 'Error',
            text: 'No se pudo eliminar el servicio.',
            icon: 'error'
          });
          this.isLoading = false;
        }
      });
    });
  }

  getVisibleBadge(visible: number): string {
    return visible === 1 ? 'badge-success' : 'badge-secondary';
  }
}
