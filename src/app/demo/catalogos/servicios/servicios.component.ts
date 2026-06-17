import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import Swal from 'sweetalert2';

import { SharedModule } from 'src/app/theme/shared/shared.module';
import { ServiciosService, ServicioUI, CentroCostoOption, CategoriaOption } from './servicios.service';

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
  filterVisible = '1';

  categoriaOptions: CategoriaOption[] = [];
  grupoOptions: CentroCostoOption[] = [];

  currentPage = 1;
  pageSize = 10;
  totalPages = 1;
  totalRegistros = 0;
  pageSizeOptions = [10, 20, 50, 100];

  private serviciosService = inject(ServiciosService);
  private router = inject(Router);

  get baseRoute(): string {
    return this.router.url.startsWith('/restaurante/servicios') ? '/restaurante/servicios' : '/catalogos/servicios';
  }

  get parentRoute(): string {
    return this.router.url.startsWith('/restaurante/servicios') ? '/restaurante/dashboard' : '/restaurante/configuracion';
  }

  get parentLabel(): string {
    return this.router.url.startsWith('/restaurante/servicios') ? 'Restaurante' : 'Configuracion Restaurante';
  }

  ngOnInit() {
    this.loadCategoriaOptions();
    this.loadGrupoOptions();
    this.loadServicios();
  }

  loadServicios(): void {
    this.isLoading = true;
    const visible = Number(this.filterVisible);
    const codGrupo = this.filterGrupo.trim() || undefined;
    const codCateg = this.filterCategoria.trim() || undefined;
    const nombre = this.normalizeNombre(this.filterNombre);

    const request = nombre
      ? this.serviciosService.buscarServicios(nombre, visible, this.currentPage, this.pageSize, codGrupo, codCateg)
      : this.serviciosService.getServicios(visible, this.currentPage, this.pageSize, codGrupo, codCateg);

    request.subscribe({
      next: (result) => {
        this.servicios = result.data ?? [];
        this.totalRegistros = Number(result.totalRegistros ?? this.servicios.length) || this.servicios.length;
        this.currentPage = Number(result.paginaActual ?? this.currentPage) || this.currentPage;
        this.pageSize = Number(result.pageSize ?? this.pageSize) || this.pageSize;
        this.totalPages = Number(result.totalPages ?? 1) || 1;
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

  private loadCategoriaOptions(): void {
    this.serviciosService.getCategoriaOptions().subscribe({
      next: (options) => {
        const selected = this.filterCategoria.trim().toUpperCase();
        const normalizedOptions = options.map((item) => ({
          codigo: (item.codigo || '').trim().toUpperCase(),
          nombre: (item.nombre || '').trim() || (item.codigo || '').trim().toUpperCase()
        }));
        const merged = selected && !normalizedOptions.some((item) => item.codigo === selected)
          ? [...normalizedOptions, { codigo: selected, nombre: selected }]
          : normalizedOptions;
        this.categoriaOptions = merged.sort((a, b) => a.codigo.localeCompare(b.codigo));
      },
      error: (error) => {
        console.error('Error al cargar categorias:', error);
        this.categoriaOptions = [];
      }
    });
  }

  private loadGrupoOptions(): void {
    this.serviciosService.getCentroCostoOptions(1, 50).subscribe({
      next: (options) => {
        const selected = this.filterGrupo.trim().toUpperCase();
        const normalizedOptions = options.map((item) => ({
          codigo: (item.codigo || '').trim().toUpperCase(),
          nombre: (item.nombre || '').trim() || (item.codigo || '').trim().toUpperCase()
        }));
        const merged = selected && !normalizedOptions.some((item) => item.codigo === selected)
          ? [...normalizedOptions, { codigo: selected, nombre: selected }]
          : normalizedOptions;
        this.grupoOptions = merged.sort((a, b) => a.codigo.localeCompare(b.codigo));
      },
      error: (error) => {
        console.error('Error al cargar grupos:', error);
        this.grupoOptions = [];
      }
    });
  }

  applyLocalFilters(): void {
    const categoria = this.filterCategoria.trim();
    const grupo = this.filterGrupo.trim();
    const visible = Number(this.filterVisible);

    this.filteredServicios = this.servicios.filter((item) => {
      const matchesCategoria = !categoria || item.codCateg === categoria;
      const matchesGrupo = !grupo || item.codGrupo === grupo;
      const matchesVisible = item.visible === visible;
      return matchesCategoria && matchesGrupo && matchesVisible;
    });
  }

  onBuscar(): void {
    this.filterNombre = this.normalizeNombre(this.filterNombre);
    this.currentPage = 1;
    this.loadServicios();
  }

  onLimpiar(): void {
    this.filterNombre = '';
    this.filterCategoria = '';
    this.filterGrupo = '';
    this.filterVisible = '1';
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

  toggleVisibleFilter(checked: boolean): void {
    this.filterVisible = checked ? '1' : '0';
  }

  private normalizeNombre(value: string): string {
    return (value || '').trim().replace(/\s+/g, ' ');
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
