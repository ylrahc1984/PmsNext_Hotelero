import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { Router } from '@angular/router';

import { SharedModule } from 'src/app/theme/shared/shared.module';
import { Reserva, ReservasService } from './reservas.service';

@Component({
  selector: 'app-reservas',
  imports: [CommonModule, SharedModule, FormsModule],
  templateUrl: './reservas.component.html',
  styleUrls: ['./reservas.component.scss']
})
export class ReservasComponent implements OnInit, OnDestroy {
    private subscription: Subscription = new Subscription();

    ngOnDestroy(): void {
      this.subscription.unsubscribe();
    }     
    
    reservas: Reserva[] = [];
    totalReservas = 0;
    pageSizeOptions = [5, 10, 20];
    pageSize = 10;
    currentPage = 1;
    loading = false;
    errorMsg = '';

    private reservasService = inject(ReservasService);
    private router = inject(Router);

    ngOnInit(): void {
      this.loadReservas();
    }

    // --- Filtros y paginación para reservas.component.ts ---

  filtros = {
    fechaDesde: '',
    fechaHasta: '',
    estado: '',
    termino: ''
  };

  agencias: string[] = [];
  formasPago: string[] = ['Prepago', 'Crédito', 'Efectivo', 'Transferencia'];

  filteredReservas: Reserva[] = [];
  pagedReservas: Reserva[] = [];

  applyFilters(): void {
    let filtered = this.reservas;
    if (this.filtros.fechaDesde) {
      filtered = filtered.filter(r => r.PRV01_FecCreacion && r.PRV01_FecCreacion >= this.filtros.fechaDesde);
    }
    if (this.filtros.fechaHasta) {
      filtered = filtered.filter(r => r.PRV01_FecCreacion && r.PRV01_FecCreacion <= this.filtros.fechaHasta);
    }
    if (this.filtros.estado) {
      filtered = filtered.filter(r => r.PRV01_Estado === this.filtros.estado);
    }
    if (this.filtros.termino) {
      const term = this.filtros.termino.toLowerCase();
      filtered = filtered.filter(r =>
        r.PRV01_CodReserva?.toString().toLowerCase().includes(term) ||
        r.PRV01_Folio?.toString().toLowerCase().includes(term) ||
        r.PRV01_NomCliente?.toLowerCase().includes(term) ||
        r.PRV01_CodAgencia?.toLowerCase().includes(term) ||
        r.PRV01_FormaPago?.toLowerCase().includes(term)
      );
    }
    this.filteredReservas = filtered;
    this.updatePagedReservas();
  }

  updatePagedReservas(): void {
    const start = (this.currentPage - 1) * this.pageSize;
    const end = start + this.pageSize;
    this.pagedReservas = this.filteredReservas.slice(start, end);
  }

  resetFilters(): void {
    this.filtros = {
      fechaDesde: '',
      fechaHasta: '',
      estado: '',
      termino: ''
    };
    this.applyFilters();
  }

  // Modificar loadReservas para poblar agencias y aplicar filtros
  loadReservas(): void {
    this.loading = true;
    this.errorMsg = '';
    this.reservasService.getReservas(this.currentPage, this.pageSize).subscribe({
      next: (res) => {
        this.reservas = res.data;
        this.totalReservas = res.total;
        // Poblar agencias únicas
        this.agencias = Array.from(new Set(this.reservas.map(r => r.PRV01_CodAgencia).filter(Boolean)));
        this.applyFilters();
        this.loading = false;
      },
      error: (err) => {
        this.errorMsg = 'Error al cargar reservas';
        this.loading = false;
      }
    });
  }

  changePageSize(size: number): void {
    this.pageSize = size;
    this.currentPage = 1;
    this.updatePagedReservas();
  }

  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages) {
      return;
    }
    this.currentPage = page;
    this.updatePagedReservas();
  }

  nextPage(): void {
    this.goToPage(this.currentPage + 1);
  }

  prevPage(): void {
    this.goToPage(this.currentPage - 1);
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.totalReservas / this.pageSize));
  }

  get pageStart(): number {
    return this.reservas.length ? (this.pageSize * (this.currentPage - 1)) + 1 : 0;
  }

  get pageEnd(): number {
    return Math.min(this.pageSize * this.currentPage, this.totalReservas);
  }

  nuevaReserva(): void {
    this.router.navigate(['/operaciones/reservas/nueva']);
  }

  verReserva(reserva: Reserva): void {
    this.router.navigate(['/operaciones/reservas', reserva.PRV01_CodReserva, 'editar']);
  }

  verDetalles(reserva: Reserva): void {
    this.router.navigate(['/operaciones/reservas', reserva.PRV01_CodReserva, 'detalle']);
  }

  cancelarReserva(reserva: Reserva): void {
    if (confirm('¿Está seguro de eliminar la reserva?')) {
      this.loading = true;
      this.reservasService.eliminarReserva(reserva.PRV01_CodReserva).subscribe({
        next: () => this.loadReservas(),
        error: () => {
          this.errorMsg = 'Error al eliminar reserva';
          this.loading = false;
        }
      });
    }
  }

  getEstadoBadge(estado: string): string {
    const badges: any = {
      Pendiente: 'bg-warning text-dark',
      Confirmada: 'bg-success',
      Cancelada: 'bg-danger'
    };
    return badges[estado] || 'bg-light text-dark';
  }

  getServiciosBadge(cantidad: number): string {
    return cantidad > 1 ? 'bg-primary text-white' : 'bg-light text-dark';
  }

  trackByReservaId(index: number, reserva: Reserva): string {
    return reserva.PRV01_CodReserva;
  }

  getCantidadServicios(reserva: Reserva): number {
    // Si el backend no retorna el detalle, este método puede requerir ajuste
    return reserva['detalles']?.length || 0;
  }

}
