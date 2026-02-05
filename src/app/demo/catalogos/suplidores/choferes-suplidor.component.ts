import { Component, Input, OnInit, inject, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import Swal from 'sweetalert2';
import { SharedModule } from 'src/app/theme/shared/shared.module';
import { ChoferSuplidorService, ChoferSuplidorUI } from './chofer-suplidor.service';
import { ChoferFormComponent } from './chofer-form.component';

@Component({
  selector: 'app-choferes-suplidor',
  standalone: true,
  imports: [CommonModule, FormsModule, SharedModule, ChoferFormComponent],
  templateUrl: './choferes-suplidor.component.html',
  styleUrls: ['./choferes-suplidor.component.scss']
})
export class ChoferesSuplidorComponent implements OnInit {
  private choferService = inject(ChoferSuplidorService);

  @Input() codSuplidor!: string;
  @Input() descSuplidor!: string;
  @Output() close = new EventEmitter<void>();

  choferes: ChoferSuplidorUI[] = [];
  isLoading = false;

  filterNombre = '';
  currentPage = 1;
  pageSize = 10;
  totalPages = 1;
  totalRegistros = 0;
  pageSizeOptions = [10, 20, 50];

  showChoferForm = false;
  selectedChofer: ChoferSuplidorUI | null = null;

  ngOnInit(): void {
    if (!this.codSuplidor) {
      console.error('codSuplidor es requerido');
      this.closeModal();
      return;
    }
    this.loadChoferes();
  }

  loadChoferes(): void {
    this.isLoading = true;
    const descripcion = this.filterNombre.trim() || undefined;
    
    this.choferService.getChoferes(this.codSuplidor, this.currentPage, this.pageSize, descripcion).subscribe({
      next: (result) => {
        this.choferes = result.data ?? [];
        this.totalRegistros = result.totalRegistros ?? this.choferes.length;
        this.currentPage = result.paginaActual ?? this.currentPage;
        this.pageSize = result.pageSize ?? this.pageSize;
        this.totalPages = result.totalPages ?? 1;
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error al cargar choferes:', error);
        Swal.fire({
          title: 'Error',
          text: 'No se pudieron cargar los choferes.',
          icon: 'error'
        });
        this.isLoading = false;
      }
    });
  }

  onBuscar(): void {
    this.currentPage = 1;
    this.loadChoferes();
  }

  onLimpiar(): void {
    this.filterNombre = '';
    this.currentPage = 1;
    this.loadChoferes();
  }

  onPageSizeChange(): void {
    this.currentPage = 1;
    this.loadChoferes();
  }

  goToPageRelative(delta: number): void {
    const nextPage = this.currentPage + delta;
    if (nextPage < 1 || nextPage > this.totalPages) {
      return;
    }
    this.currentPage = nextPage;
    this.loadChoferes();
  }

  openForm(chofer: ChoferSuplidorUI | null = null): void {
    this.selectedChofer = chofer;
    this.showChoferForm = true;
  }

  closeForm(reload: boolean = false): void {
    this.showChoferForm = false;
    this.selectedChofer = null;
    if (reload) {
      this.loadChoferes();
    }
  }

  eliminar(chofer: ChoferSuplidorUI): void {
    Swal.fire({
      title: 'Eliminar chofer',
      text: `¿Desea eliminar al chofer ${chofer.nombre}?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (!result.isConfirmed) {
        return;
      }
      this.isLoading = true;
      this.choferService.eliminarChofer(chofer.codigo).subscribe({
        next: () => {
          Swal.fire({
            title: 'Eliminado',
            text: 'Chofer eliminado correctamente.',
            icon: 'success',
            timer: 2000,
            showConfirmButton: false
          });
          this.loadChoferes();
        },
        error: (error) => {
          console.error('Error al eliminar chofer:', error);
          Swal.fire({
            title: 'Error',
            text: 'No se pudo eliminar el chofer.',
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
