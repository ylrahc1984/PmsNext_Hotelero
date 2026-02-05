import { Component, Input, OnInit, inject, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import Swal from 'sweetalert2';
import { SharedModule } from 'src/app/theme/shared/shared.module';
import { VehiculoSuplidorService, VehiculoSuplidorUI } from './vehiculo-suplidor.service';
import { VehiculoFormComponent } from './vehiculo-form.component';

@Component({
  selector: 'app-vehiculos-suplidor',
  standalone: true,
  imports: [CommonModule, FormsModule, SharedModule, VehiculoFormComponent],
  templateUrl: './vehiculos-suplidor.component.html',
  styleUrls: ['./vehiculos-suplidor.component.scss']
})
export class VehiculosSuplidorComponent implements OnInit {
  private vehiculoService = inject(VehiculoSuplidorService);

  @Input() codSuplidor!: string;
  @Input() descSuplidor!: string;
  @Output() close = new EventEmitter<void>();

  vehiculos: VehiculoSuplidorUI[] = [];
  isLoading = false;

  filterDescripcion = '';
  currentPage = 1;
  pageSize = 10;
  totalPages = 1;
  totalRegistros = 0;
  pageSizeOptions = [10, 20, 50];

  showVehiculoForm = false;
  selectedVehiculo: VehiculoSuplidorUI | null = null;

  ngOnInit(): void {
    if (!this.codSuplidor) {
      console.error('codSuplidor es requerido');
      this.closeModal();
      return;
    }
    this.loadVehiculos();
  }

  loadVehiculos(): void {
    this.isLoading = true;
    const descripcion = this.filterDescripcion.trim() || undefined;
    
    this.vehiculoService.getVehiculos(this.codSuplidor, this.currentPage, this.pageSize, descripcion).subscribe({
      next: (result) => {
        this.vehiculos = result.data ?? [];
        this.totalRegistros = result.totalRegistros ?? this.vehiculos.length;
        this.currentPage = result.paginaActual ?? this.currentPage;
        this.pageSize = result.pageSize ?? this.pageSize;
        this.totalPages = result.totalPages ?? 1;
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error al cargar vehículos:', error);
        Swal.fire({
          title: 'Error',
          text: 'No se pudieron cargar los vehículos.',
          icon: 'error'
        });
        this.isLoading = false;
      }
    });
  }

  onBuscar(): void {
    this.currentPage = 1;
    this.loadVehiculos();
  }

  onLimpiar(): void {
    this.filterDescripcion = '';
    this.currentPage = 1;
    this.loadVehiculos();
  }

  onPageSizeChange(): void {
    this.currentPage = 1;
    this.loadVehiculos();
  }

  goToPageRelative(delta: number): void {
    const nextPage = this.currentPage + delta;
    if (nextPage < 1 || nextPage > this.totalPages) {
      return;
    }
    this.currentPage = nextPage;
    this.loadVehiculos();
  }

  openForm(vehiculo: VehiculoSuplidorUI | null = null): void {
    this.selectedVehiculo = vehiculo;
    this.showVehiculoForm = true;
  }

  closeForm(reload: boolean = false): void {
    this.showVehiculoForm = false;
    this.selectedVehiculo = null;
    if (reload) {
      this.loadVehiculos();
    }
  }

  eliminar(vehiculo: VehiculoSuplidorUI): void {
    Swal.fire({
      title: 'Eliminar vehículo',
      text: `¿Desea eliminar el vehículo ${vehiculo.placa}?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (!result.isConfirmed) {
        return;
      }
      this.isLoading = true;
      this.vehiculoService.eliminarVehiculo(vehiculo.codigo).subscribe({
        next: () => {
          Swal.fire({
            title: 'Eliminado',
            text: 'Vehículo eliminado correctamente.',
            icon: 'success',
            timer: 2000,
            showConfirmButton: false
          });
          this.loadVehiculos();
        },
        error: (error) => {
          console.error('Error al eliminar vehículo:', error);
          Swal.fire({
            title: 'Error',
            text: 'No se pudo eliminar el vehículo.',
            icon: 'error'
          });
          this.isLoading = false;
        }
      });
    });
  }

  closeModal(): void {
    this.close.emit();
  }

  getEstadoBadgeClass(estado: string): string {
    return estado === 'ACT' ? 'badge bg-success' : 'badge bg-danger';
  }

  getEstadoText(estado: string): string {
    return estado === 'ACT' ? 'Activo' : 'Inactivo';
  }
}
