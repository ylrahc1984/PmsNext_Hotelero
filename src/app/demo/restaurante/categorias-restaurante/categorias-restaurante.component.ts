import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import Swal from 'sweetalert2';

import { SharedModule } from 'src/app/theme/shared/shared.module';
import {
  CategoriaRestaurante,
  CategoriaRestaurantePayload,
  CategoriasRestauranteService
} from './categorias-restaurante.service';
import { AuthService } from 'src/app/core/services/auth.service';

@Component({
  selector: 'app-categorias-restaurante',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, SharedModule],
  templateUrl: './categorias-restaurante.component.html',
  styleUrls: ['./categorias-restaurante.component.scss']
})
export class CategoriasRestauranteComponent implements OnInit {
  private readonly categoriasService = inject(CategoriasRestauranteService);
  private readonly authService = inject(AuthService);

  categorias: CategoriaRestaurante[] = [];
  filteredCategorias: CategoriaRestaurante[] = [];
  pagedCategorias: CategoriaRestaurante[] = [];

  isLoading = false;
  isSaving = false;
  isDeleting = false;

  filterNombre = '';
  filterVisible = '';

  currentPage = 1;
  pageSize = 10;
  totalPages = 1;
  totalRegistros = 0;
  pageSizeOptions = [10, 20, 50, 100];

  showModal = false;
  isEditing = false;
  editCodOriginal = '';

  formModel: CategoriaRestaurantePayload = this.getDefaultFormModel();

  ngOnInit(): void {
    this.loadCategorias();
  }

  loadCategorias(): void {
    this.isLoading = true;
    this.categoriasService.getCategorias().subscribe({
      next: (data) => {
        this.categorias = (data ?? []).sort((a, b) => {
          if (a.orden !== b.orden) {
            return a.orden - b.orden;
          }
          return a.codCateg.localeCompare(b.codCateg);
        });
        this.applyFilters();
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error al cargar categorias:', error);
        this.isLoading = false;
        Swal.fire({
          title: 'Error',
          text: 'No se pudieron cargar las categorias.',
          icon: 'error'
        });
      }
    });
  }

  onBuscar(): void {
    this.currentPage = 1;
    this.applyFilters();
  }

  onLimpiar(): void {
    this.filterNombre = '';
    this.filterVisible = '';
    this.currentPage = 1;
    this.applyFilters();
  }

  onPageSizeChange(): void {
    this.pageSize = Number(this.pageSize) || 10;
    this.currentPage = 1;
    this.rebuildPagination();
  }

  goToPageRelative(delta: number): void {
    const nextPage = Number(this.currentPage) + delta;
    if (nextPage < 1 || nextPage > this.totalPages) {
      return;
    }
    this.currentPage = nextPage;
    this.rebuildPagination();
  }

  abrirModalCrear(): void {
    this.isEditing = false;
    this.editCodOriginal = '';
    this.formModel = this.getDefaultFormModel();
    this.showModal = true;
  }

  abrirModalEditar(item: CategoriaRestaurante): void {
    this.isEditing = true;
    this.editCodOriginal = item.codCateg;
    this.isLoading = true;

    this.categoriasService.getCategoriaByCodigo(item.codCateg).subscribe({
      next: (categoria) => {
        const source = categoria || item;
        this.formModel = {
          proceso: 0,
          codCateg: source.codCateg,
          nomCateg: source.nomCateg,
          visiblePnt: source.visiblePnt,
          orden: source.orden,
          operador: source.operador || this.getOperador(),
          respuesta: ''
        };
        this.showModal = true;
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error al obtener categoria:', error);
        this.isLoading = false;
        Swal.fire({
          title: 'Error',
          text: 'No se pudo cargar la categoria para editar.',
          icon: 'error'
        });
      }
    });
  }

  cerrarModal(): void {
    if (this.isSaving) {
      return;
    }
    this.showModal = false;
    this.formModel = this.getDefaultFormModel();
    this.isEditing = false;
    this.editCodOriginal = '';
  }

  guardarCategoria(): void {
    const payload = this.buildPayload();

    if (!payload.codCateg || !payload.nomCateg) {
      Swal.fire({
        title: 'Validacion',
        text: 'Codigo y Nombre son obligatorios.',
        icon: 'warning'
      });
      return;
    }

    this.isSaving = true;

    const request = this.isEditing
      ? this.categoriasService.actualizarCategoria(this.editCodOriginal, payload)
      : this.categoriasService.crearCategoria(payload);

    request.subscribe({
      next: () => {
        this.isSaving = false;
        this.cerrarModal();
        Swal.fire({
          title: 'Exito',
          text: this.isEditing ? 'Categoria actualizada correctamente.' : 'Categoria creada correctamente.',
          icon: 'success'
        });
        this.loadCategorias();
      },
      error: (error) => {
        console.error('Error al guardar categoria:', error);
        this.isSaving = false;
        Swal.fire({
          title: 'Error',
          text: 'No se pudo guardar la categoria.',
          icon: 'error'
        });
      }
    });
  }

  eliminarCategoria(item: CategoriaRestaurante): void {
    Swal.fire({
      title: 'Eliminar categoria',
      text: `Desea eliminar la categoria ${item.codCateg}?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Si, eliminar',
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (!result.isConfirmed) {
        return;
      }

      this.isDeleting = true;
      this.categoriasService.eliminarCategoria(item.codCateg).subscribe({
        next: () => {
          this.isDeleting = false;
          Swal.fire({
            title: 'Eliminado',
            text: 'Categoria eliminada correctamente.',
            icon: 'success'
          });
          this.loadCategorias();
        },
        error: (error) => {
          console.error('Error al eliminar categoria:', error);
          this.isDeleting = false;
          Swal.fire({
            title: 'Error',
            text: 'No se pudo eliminar la categoria.',
            icon: 'error'
          });
        }
      });
    });
  }

  getVisibleBadge(visible: number): string {
    return visible === 1 ? 'badge-success' : 'badge-secondary';
  }

  private applyFilters(): void {
    const nombre = (this.filterNombre || '').trim().toLowerCase();
    const visibleFilter = this.filterVisible === '' ? null : Number(this.filterVisible);

    this.filteredCategorias = this.categorias.filter((item) => {
      const matchesNombre = !nombre || item.nomCateg.toLowerCase().includes(nombre) || item.codCateg.toLowerCase().includes(nombre);
      const matchesVisible = visibleFilter === null || item.visiblePnt === visibleFilter;
      return matchesNombre && matchesVisible;
    });

    this.rebuildPagination();
  }

  private rebuildPagination(): void {
    this.totalRegistros = this.filteredCategorias.length;
    this.totalPages = Math.max(1, Math.ceil(this.totalRegistros / this.pageSize));

    if (this.currentPage > this.totalPages) {
      this.currentPage = this.totalPages;
    }

    const start = (this.currentPage - 1) * this.pageSize;
    const end = start + this.pageSize;
    this.pagedCategorias = this.filteredCategorias.slice(start, end);
  }

  private buildPayload(): CategoriaRestaurantePayload {
    return {
      proceso: 0,
      codCateg: (this.formModel.codCateg || '').trim(),
      nomCateg: (this.formModel.nomCateg || '').trim(),
      visiblePnt: Number(this.formModel.visiblePnt ?? 0),
      orden: Number(this.formModel.orden ?? 0),
      operador: (this.formModel.operador || this.getOperador()).trim(),
      respuesta: ''
    };
  }

  private getDefaultFormModel(): CategoriaRestaurantePayload {
    return {
      proceso: 0,
      codCateg: '',
      nomCateg: '',
      visiblePnt: 1,
      orden: 0,
      operador: this.getOperador(),
      respuesta: ''
    };
  }

  private getOperador(): string {
    return this.authService.getCurrentUser()?.usuario ?? '';
  }
}
