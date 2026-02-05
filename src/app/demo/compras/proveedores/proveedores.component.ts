import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import Swal from 'sweetalert2';
import { SharedModule } from 'src/app/theme/shared/shared.module';
import { ProveedorService, ProveedorUI } from './proveedor.service';

@Component({
  selector: 'app-proveedores',
  imports: [CommonModule, FormsModule, SharedModule],
  templateUrl: './proveedores.component.html',
  styleUrls: ['./proveedores.component.scss']
})
export class ProveedoresComponent implements OnInit {
  private proveedorService = inject(ProveedorService);
  private router = inject(Router);

  proveedores: ProveedorUI[] = [];
  isLoading = false;

  filterCodigo = '';
  filterDescripcion = '';

  currentPage = 1;
  pageSize = 20;
  totalPages = 1;
  totalRegistros = 0;
  pageSizeOptions = [10, 20, 50, 100];

  ngOnInit(): void {
    this.loadProveedores();
  }

  loadProveedores(): void {
    this.isLoading = true;
    const codigo = this.filterCodigo.trim() || undefined;
    const descripcion = this.filterDescripcion.trim() || undefined;
    this.proveedorService.getProveedores(this.currentPage, this.pageSize, codigo, descripcion).subscribe({
      next: (result) => {
        this.proveedores = result.data ?? [];
        this.totalRegistros = result.totalRegistros ?? this.proveedores.length;
        this.currentPage = result.paginaActual ?? this.currentPage;
        this.pageSize = result.pageSize ?? this.pageSize;
        this.totalPages = result.totalPages ?? 1;
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error al cargar proveedores:', error);
        Swal.fire({
          title: 'Error',
          text: 'No se pudieron cargar los proveedores.',
          icon: 'error'
        });
        this.isLoading = false;
      }
    });
  }

  onBuscar(): void {
    this.currentPage = 1;
    this.loadProveedores();
  }

  onLimpiar(): void {
    this.filterCodigo = '';
    this.filterDescripcion = '';
    this.currentPage = 1;
    this.loadProveedores();
  }

  onPageSizeChange(): void {
    this.currentPage = 1;
    this.loadProveedores();
  }

  goToPageRelative(delta: number): void {
    const nextPage = this.currentPage + delta;
    if (nextPage < 1 || nextPage > this.totalPages) {
      return;
    }
    this.currentPage = nextPage;
    this.loadProveedores();
  }

  openForm(): void {
    this.router.navigate(['/compras/proveedores/nuevo']);
  }

  editar(proveedor: ProveedorUI): void {
    this.router.navigate(['/compras/proveedores/editar', proveedor.codigo]);
  }

  eliminar(proveedor: ProveedorUI): void {
    Swal.fire({
      title: 'Eliminar proveedor',
      text: `Desea eliminar el proveedor ${proveedor.codigo}?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Si, eliminar',
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (!result.isConfirmed) {
        return;
      }
      this.isLoading = true;
      this.proveedorService.eliminarProveedor(proveedor.codigo).subscribe({
        next: () => {
          Swal.fire({
            title: 'Eliminado',
            text: 'Proveedor eliminado correctamente.',
            icon: 'success'
          });
          this.loadProveedores();
        },
        error: (error) => {
          console.error('Error al eliminar proveedor:', error);
          Swal.fire({
            title: 'Error',
            text: 'No se pudo eliminar el proveedor.',
            icon: 'error'
          });
          this.isLoading = false;
        }
      });
    });
  }
}
