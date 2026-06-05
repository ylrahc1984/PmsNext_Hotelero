import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import Swal from 'sweetalert2';
import { SharedModule } from 'src/app/theme/shared/shared.module';
import { SuplidorService, SuplidorUI } from './suplidor.service';
import { VehiculosSuplidorComponent } from './vehiculos-suplidor.component';
import { ChoferesSuplidorComponent } from './choferes-suplidor.component';

@Component({
  selector: 'app-suplidores',
  imports: [CommonModule, FormsModule, SharedModule, VehiculosSuplidorComponent, ChoferesSuplidorComponent],
  templateUrl: './suplidores.component.html',
  styleUrls: ['./suplidores.component.scss']
})
export class SuplidoresComponent implements OnInit {
  private suplidorService = inject(SuplidorService);
  private router = inject(Router);

  suplidores: SuplidorUI[] = [];
  isLoading = false;

  filterDescripcion = '';

  currentPage = 1;
  pageSize = 20;
  totalPages = 1;
  totalRegistros = 0;
  pageSizeOptions = [10, 20, 50, 100];

  // Control de modales
  showVehiculosModal = false;
  showChoferesModal = false;
  selectedSuplidor: SuplidorUI | null = null;

  ngOnInit(): void {
    this.loadSuplidores();
  }

  loadSuplidores(): void {
    this.isLoading = true;
    const descripcion = this.filterDescripcion.trim() || undefined;
    this.suplidorService.getSuplidores(this.currentPage, this.pageSize, descripcion).subscribe({
      next: (result) => {
        this.suplidores = result.data ?? [];
        this.totalRegistros = result.totalRegistros ?? this.suplidores.length;
        this.currentPage = result.paginaActual ?? this.currentPage;
        this.pageSize = result.pageSize ?? this.pageSize;
        this.totalPages = result.totalPages ?? 1;
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error al cargar suplidores:', error);
        Swal.fire({
          title: 'Error',
          text: 'No se pudieron cargar los suplidores.',
          icon: 'error'
        });
        this.isLoading = false;
      }
    });
  }

  onBuscar(): void {
    this.currentPage = 1;
    this.loadSuplidores();
  }

  onLimpiar(): void {
    this.filterDescripcion = '';
    this.currentPage = 1;
    this.loadSuplidores();
  }

  onPageSizeChange(): void {
    this.currentPage = 1;
    this.loadSuplidores();
  }

  goToPageRelative(delta: number): void {
    const nextPage = this.currentPage + delta;
    if (nextPage < 1 || nextPage > this.totalPages) {
      return;
    }
    this.currentPage = nextPage;
    this.loadSuplidores();
  }

  openForm(): void {
    this.router.navigate(['/catalogos/suplidores/nuevo']);
  }

  editar(suplidor: SuplidorUI): void {
    this.router.navigate(['/catalogos/suplidores/editar', suplidor.codigo]);
  }

  eliminar(suplidor: SuplidorUI): void {
    Swal.fire({
      title: 'Eliminar suplidor',
      text: `¿Desea eliminar el suplidor ${suplidor.descripcion}?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (!result.isConfirmed) {
        return;
      }
      this.isLoading = true;
      this.suplidorService.eliminarSuplidor(suplidor.codigo).subscribe({
        next: () => {
          Swal.fire({
            title: 'Eliminado',
            text: 'Suplidor eliminado correctamente.',
            icon: 'success'
          });
          this.loadSuplidores();
        },
        error: (error) => {
          console.error('Error al eliminar suplidor:', error);
          Swal.fire({
            title: 'Error',
            text: 'No se pudo eliminar el suplidor.',
            icon: 'error'
          });
          this.isLoading = false;
        }
      });
    });
  }

  getEstadoBadgeClass(estado: string): string {
    return estado === 'ACT' ? 'badge bg-success' : 'badge bg-danger';
  }

  getEstadoText(estado: string): string {
    return estado === 'ACT' ? 'Activo' : 'Inactivo';
  }

  // Métodos para gestión de Vehículos
  abrirVehiculos(suplidor: SuplidorUI): void {
    this.selectedSuplidor = suplidor;
    this.showVehiculosModal = true;
  }

  cerrarVehiculos(): void {
    this.showVehiculosModal = false;
    this.selectedSuplidor = null;
  }

  // Métodos para gestión de Choferes
  abrirChoferes(suplidor: SuplidorUI): void {
    this.selectedSuplidor = suplidor;
    this.showChoferesModal = true;
  }

  cerrarChoferes(): void {
    this.showChoferesModal = false;
    this.selectedSuplidor = null;
  }
}
