import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';

import { SharedModule } from 'src/app/theme/shared/shared.module';

type RecibosFiltersForm = {
  busqueda: FormControl<string>;
  fechaInicio: FormControl<string>;
  fechaFin: FormControl<string>;
  estado: FormControl<string>;
};

interface ReciboResumen {
  numero: string;
  fecha: string;
  cliente: string;
  referencia: string;
  moneda: string;
  monto: number;
  estado: 'Aplicado' | 'Pendiente' | 'Anulado';
}

const DEFAULT_RECIBOS: ReciboResumen[] = [];

@Component({
  selector: 'app-recibos',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule, SharedModule],
  templateUrl: './recibos.component.html',
  styleUrl: './recibos.component.scss'
})
export class RecibosComponent {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly router = inject(Router);
  private readonly defaultDateRange = this.getDefaultDateRange();

  readonly filtersForm: FormGroup<RecibosFiltersForm> = this.fb.group({
    busqueda: this.fb.control(''),
    fechaInicio: this.fb.control(this.defaultDateRange.fechaInicio),
    fechaFin: this.fb.control(this.defaultDateRange.fechaFin),
    estado: this.fb.control('')
  });

  readonly recibos = signal<ReciboResumen[]>(DEFAULT_RECIBOS);
  readonly filteredRecibos = computed(() => this.applyLocalFilters(this.recibos()));
  readonly totalRegistros = computed(() => this.filteredRecibos().length);
  readonly montoTotal = computed(() => this.filteredRecibos().reduce((total, item) => total + item.monto, 0));
  readonly recibosPendientes = computed(() => this.filteredRecibos().filter((item) => item.estado === 'Pendiente').length);

  buscar(): void {
    this.filtersForm.updateValueAndValidity();
  }

  limpiar(): void {
    this.filtersForm.reset({
      busqueda: '',
      fechaInicio: this.defaultDateRange.fechaInicio,
      fechaFin: this.defaultDateRange.fechaFin,
      estado: ''
    });
  }

  nuevoRecibo(): void {
    this.router.navigate(['/finanzas/cuentas-cobrar']);
  }

  verDepositos(): void {
    this.router.navigate(['/finanzas/bancos/depositos-cxc']);
  }

  trackByRecibo(index: number, recibo: ReciboResumen): string {
    return recibo.numero || `recibo-${index}`;
  }

  getEstadoClass(estado: ReciboResumen['estado']): string {
    switch (estado) {
      case 'Aplicado':
        return 'badge-success';
      case 'Pendiente':
        return 'badge-warning';
      case 'Anulado':
        return 'badge-danger';
      default:
        return 'badge-neutral';
    }
  }

  private applyLocalFilters(source: ReciboResumen[]): ReciboResumen[] {
    const filters = this.filtersForm.getRawValue();
    const search = filters.busqueda.trim().toLowerCase();
    const estado = filters.estado.trim();
    const start = filters.fechaInicio ? new Date(`${filters.fechaInicio}T00:00:00`) : null;
    const end = filters.fechaFin ? new Date(`${filters.fechaFin}T23:59:59`) : null;

    return source.filter((recibo) => {
      const reciboDate = new Date(`${recibo.fecha}T12:00:00`);
      const matchesSearch =
        !search ||
        recibo.numero.toLowerCase().includes(search) ||
        recibo.cliente.toLowerCase().includes(search) ||
        recibo.referencia.toLowerCase().includes(search);
      const matchesEstado = !estado || recibo.estado === estado;
      const matchesStart = !start || reciboDate >= start;
      const matchesEnd = !end || reciboDate <= end;

      return matchesSearch && matchesEstado && matchesStart && matchesEnd;
    });
  }

  private getDefaultDateRange(): { fechaInicio: string; fechaFin: string } {
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);

    return {
      fechaInicio: this.toDateInput(firstDay),
      fechaFin: this.toDateInput(today)
    };
  }

  private toDateInput(date: Date): string {
    const yyyy = date.getFullYear().toString().padStart(4, '0');
    const mm = (date.getMonth() + 1).toString().padStart(2, '0');
    const dd = date.getDate().toString().padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }
}
