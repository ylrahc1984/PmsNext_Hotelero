import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { finalize } from 'rxjs/operators';

import { SharedModule } from 'src/app/theme/shared/shared.module';
import { OrdenPedidoListadoItem } from '../../interfaces/orden-pedido.interface';
import { OrdenPedidoService } from '../../services/orden-pedido.service';

@Component({
  selector: 'app-orden-pedido-list',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule, SharedModule],
  templateUrl: './orden-pedido-list.component.html',
  styleUrls: ['./orden-pedido-list.component.scss']
})
export class OrdenPedidoListComponent implements OnInit {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly router = inject(Router);
  private readonly ordenPedidoService = inject(OrdenPedidoService);

  readonly tiposOrden = [
    { value: 'NDP', label: 'Orden de Pedido' },
    { value: 'COT', label: 'Proforma' },
    { value: '', label: 'Todos' }
  ];

  readonly filtrosForm = this.fb.group({
    tipOrden: this.fb.control(this.tiposOrden[0].value),
    fechaDesde: this.fb.control(this.getFirstDayOfMonth()),
    fechaHasta: this.fb.control(this.getTodayIsoDate()),
    nomCliente: this.fb.control('')
  });

  readonly pageSizeOptions = [10, 20, 50];

  ordenes: OrdenPedidoListadoItem[] = [];
  isLoading = false;
  errorMessage = '';

  pageNumber = 1;
  pageSize = 10;
  totalRecords = 0;
  totalPages = 1;
  pageStart = 0;
  pageEnd = 0;

  ngOnInit(): void {
    this.loadOrdenes();
  }

  applyFilters(): void {
    this.pageNumber = 1;
    this.loadOrdenes();
  }

  resetFilters(): void {
    this.filtrosForm.reset({
      tipOrden: this.tiposOrden[0].value,
      fechaDesde: this.getFirstDayOfMonth(),
      fechaHasta: this.getTodayIsoDate(),
      nomCliente: ''
    });
    this.pageNumber = 1;
    this.loadOrdenes();
  }

  onPageSizeChange(size: string): void {
    const nextSize = Number(size);
    if (!Number.isFinite(nextSize) || nextSize <= 0) {
      return;
    }
    this.pageSize = nextSize;
    this.pageNumber = 1;
    this.loadOrdenes();
  }

  goToPageRelative(delta: number): void {
    const nextPage = this.pageNumber + delta;
    if (nextPage < 1 || nextPage > this.totalPages || this.isLoading) {
      return;
    }
    this.pageNumber = nextPage;
    this.loadOrdenes();
  }

  nuevaOrden(): void {
    void this.router.navigate(['/demo/ordenes-pedido/nuevo'], {
      queryParams: {
        origen: 'orden-pedido-list'
      }
    });
  }

  verDetalle(item: OrdenPedidoListadoItem): void {
    const tipOrden = (item.tipOrden ?? '').toString().trim();
    const serie = (item.serie ?? '').toString().trim() || '000';
    const numero = (item.numero ?? '').toString().trim();

    if (!tipOrden || !numero) {
      return;
    }

    void this.router.navigate(['/demo/ordenes-pedido/detalle', tipOrden, serie, numero]);
  }

  getEstadoBadgeClass(item: OrdenPedidoListadoItem): string {
    const estado = (item.estado || '').toUpperCase();
    if (estado.includes('ANU') || estado.includes('CANCEL')) {
      return 'badge bg-danger-subtle text-danger border border-danger-subtle';
    }
    if (estado.includes('APR') || estado.includes('CONF') || estado.includes('EMI')) {
      return 'badge bg-success-subtle text-success border border-success-subtle';
    }
    if (estado.includes('PEN') || estado.includes('BOR')) {
      return 'badge bg-warning-subtle text-warning border border-warning-subtle';
    }
    return 'badge bg-primary-subtle text-primary border border-primary-subtle';
  }

  readonly trackByOrden = (_index: number, item: OrdenPedidoListadoItem): string => this.getRowKey(item);

  formatFecha(value: string): string {
    const raw = String(value ?? '').trim();
    if (!raw) {
      return 'N/D';
    }
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(raw)) {
      return raw;
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
      const [year, month, day] = raw.split('-');
      return `${day}/${month}/${year}`;
    }
    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) {
      const day = String(parsed.getDate()).padStart(2, '0');
      const month = String(parsed.getMonth() + 1).padStart(2, '0');
      const year = parsed.getFullYear();
      return `${day}/${month}/${year}`;
    }
    return raw;
  }

  private loadOrdenes(): void {
    this.isLoading = true;
    this.errorMessage = '';

    const filters = {
      ...this.filtrosForm.getRawValue(),
      pageNumber: this.pageNumber,
      pageSize: this.pageSize
    };

    this.ordenPedidoService
      .getOrdenes(filters)
      .pipe(finalize(() => (this.isLoading = false)))
      .subscribe({
        next: (response) => {
          this.ordenes = response.datos;
          this.totalRecords = response.paginacion.totalRegistros;
          this.pageNumber = response.paginacion.paginaActual || this.pageNumber;
          this.pageSize = response.paginacion.pageSize || this.pageSize;
          this.totalPages = Math.max(1, response.paginacion.totalPaginas || Math.ceil(this.totalRecords / this.pageSize) || 1);
          this.pageStart = this.totalRecords === 0 ? 0 : (this.pageNumber - 1) * this.pageSize + 1;
          this.pageEnd = this.totalRecords === 0 ? 0 : Math.min(this.pageNumber * this.pageSize, this.totalRecords);
        },
        error: (error: Error) => {
          this.ordenes = [];
          this.totalRecords = 0;
          this.totalPages = 1;
          this.pageStart = 0;
          this.pageEnd = 0;
          this.errorMessage = error.message || 'No se pudieron cargar las ordenes de pedido.';
        }
      });
  }

  private getRowKey(item: OrdenPedidoListadoItem): string {
    return [item.tipOrden, item.serie, item.numero, item.fecha].join('|');
  }

  private getTodayIsoDate(): string {
    const now = new Date();
    return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  }

  private getFirstDayOfMonth(): string {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    return new Date(firstDay.getTime() - firstDay.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  }
}
