import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, NonNullableFormBuilder } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { catchError, finalize, of } from 'rxjs';

import { SharedModule } from 'src/app/theme/shared/shared.module';
import { CompraCorreo, ComprasCorreoResponse, ComprasCorreoService } from './compras-correo.service';

interface ComprasCorreoFiltroForm {
  fechaInicio: FormControl<string>;
  fechaFin: FormControl<string>;
  proveedor: FormControl<string>;
  numeroFactura: FormControl<string>;
  estado: FormControl<string>;
  formaPago: FormControl<string>;
}

@Component({
  selector: 'app-compras-correo',
  imports: [CommonModule, SharedModule, RouterModule],
  templateUrl: './compras-correo.component.html',
  styleUrls: ['./compras-correo.component.scss']
})
export class ComprasCorreoComponent implements OnInit {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly service = inject(ComprasCorreoService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);

  readonly filtrosForm: FormGroup<ComprasCorreoFiltroForm> = this.fb.group({
    fechaInicio: this.fb.control(''),
    fechaFin: this.fb.control(''),
    proveedor: this.fb.control(''),
    numeroFactura: this.fb.control(''),
    estado: this.fb.control(''),
    formaPago: this.fb.control('')
  });

  readonly compras = signal<CompraCorreo[]>([]);
  readonly loading = signal(false);
  readonly errorMessage = signal('');
  readonly filterTick = signal(0);
  readonly skeletonRows = Array.from({ length: 5 });
  readonly pageSizeOptions = [5, 10, 20, 50];

  pageNumber = 1;
  pageSize = 5;
  totalRecords = 0;
  totalPages = 1;
  pageStart = 0;
  pageEnd = 0;

  readonly comprasFiltradas = computed(() => {
    this.filterTick();
    const raw = this.filtrosForm.getRawValue();
    const proveedor = this.normalize(raw.proveedor);
    const numeroFactura = this.normalize(raw.numeroFactura);
    const estado = this.normalize(raw.estado);
    const formaPago = this.normalize(raw.formaPago);

    return this.compras().filter((item) => {
      const proveedorText = this.normalize(`${item.PAC40_NomProve} ${item.PAC40_RucProve} ${item.PAC40_Correo}`);
      const facturaText = this.normalize(`${item.PAC40_NumFacturaFmt} ${item.PAC40_NumDocu} ${item.PAC40_Clave}`);
      const estadoText = this.normalize(item.PAC40_Estado);
      const pagoText = this.normalize(item.PAC40_FrmPagoDesc);

      return (
        (!proveedor || proveedorText.includes(proveedor)) &&
        (!numeroFactura || facturaText.includes(numeroFactura)) &&
        (!estado || estadoText === estado) &&
        (!formaPago || pagoText === formaPago)
      );
    });
  });

  readonly kpis = computed(() => {
    const rows = this.comprasFiltradas();
    return {
      documentos: rows.length,
      total: rows.reduce((sum, item) => sum + this.toLocalAmount(item.PAC40_TotalDocu, item.PAC40_TCambio), 0),
      impuesto: rows.reduce((sum, item) => sum + this.toLocalAmount(item.PAC40_Impuesto, item.PAC40_TCambio), 0),
      credito: rows.filter((item) => this.normalize(item.PAC40_FrmPagoDesc) === 'CREDITO').length,
      contado: rows.filter((item) => this.normalize(item.PAC40_FrmPagoDesc) === 'CONTADO').length
    };
  });

  ngOnInit(): void {
    this.setDefaultDates();
    this.filtrosForm.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.filterTick.update((value) => value + 1);
    });
    this.loadCompras();
  }

  buscar(): void {
    this.pageNumber = 1;
    this.loadCompras();
  }

  limpiar(): void {
    this.filtrosForm.reset({
      fechaInicio: '',
      fechaFin: '',
      proveedor: '',
      numeroFactura: '',
      estado: '',
      formaPago: ''
    });
    this.setDefaultDates();
    this.pageNumber = 1;
    this.loadCompras();
  }

  refrescar(): void {
    this.loadCompras();
  }

  onPageSizeChange(size: string): void {
    this.pageSize = Number(size) || this.pageSize;
    this.pageNumber = 1;
    this.loadCompras();
  }

  goToPageRelative(delta: number): void {
    const nextPage = this.pageNumber + delta;
    if (nextPage < 1 || nextPage > this.totalPages) {
      return;
    }
    this.pageNumber = nextPage;
    this.loadCompras();
  }

  verDetalle(item: CompraCorreo): void {
    const tipDocu = item.PAC40_TipDocu || 'COM';
    const numDocu = item.PAC40_NumDocu;
    if (!numDocu) {
      return;
    }

    const storageKey = this.headerStorageKey(tipDocu, numDocu);
    sessionStorage.setItem(storageKey, JSON.stringify(item));
    this.router.navigate(['/compras/compras-correo', tipDocu, numDocu, 'detalle'], {
      state: { factura: item }
    });
  }

  estadoClass(estado?: string): string {
    const normalized = this.normalize(estado);
    if (normalized === 'ABIERTO' || normalized === 'ABI') {
      return 'open';
    }
    if (normalized === 'PAGADO' || normalized === 'PAG') {
      return 'paid';
    }
    if (normalized === 'ANULADO' || normalized === 'ANU') {
      return 'void';
    }
    return 'draft';
  }

  formatMoney(value?: number | null, currency = 'CRC'): string {
    return new Intl.NumberFormat('es-CR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(this.toNumber(value));
  }

  formatExchangeRate(value?: number | null): string {
    return new Intl.NumberFormat('es-CR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 6
    }).format(this.getExchangeRate(value));
  }

  formatDate(value?: string): string {
    if (!value) {
      return 'N/D';
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return 'N/D';
    }
    return new Intl.DateTimeFormat('es-CR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date);
  }

  private loadCompras(): void {
    this.loading.set(true);
    this.errorMessage.set('');

    const filters = this.buildFilters();
    this.service
      .getCompras(filters)
      .pipe(
        catchError((error) => {
          console.error('No se pudieron cargar las compras por correo.', error);
          this.errorMessage.set('No se pudieron cargar las compras descargadas del correo.');
          const emptyResponse: ComprasCorreoResponse = {
            datos: [],
            paginacion: {
              totalRegistros: 0,
              paginaActual: filters.pageNumber,
              pageSize: filters.pageSize
            }
          };
          return of(emptyResponse);
        }),
        finalize(() => this.loading.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((response) => {
        this.compras.set(response.datos ?? []);
        this.totalRecords = response.paginacion?.totalRegistros ?? 0;
        this.pageNumber = response.paginacion?.paginaActual || filters.pageNumber;
        this.pageSize = response.paginacion?.pageSize || filters.pageSize;
        this.totalPages = Math.max(1, Math.ceil(this.totalRecords / this.pageSize));
        this.updateRange();
      });
  }

  private buildFilters() {
    const raw = this.filtrosForm.getRawValue();
    return {
      fechaInicio: this.toApiDate(raw.fechaInicio),
      fechaFin: this.toApiDate(raw.fechaFin),
      pageNumber: this.pageNumber,
      pageSize: this.pageSize
    };
  }

  private setDefaultDates(): void {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    this.filtrosForm.patchValue({
      fechaInicio: this.toDateInputValue(firstDay),
      fechaFin: this.toDateInputValue(lastDay)
    });
  }

  private updateRange(): void {
    if (this.totalRecords === 0) {
      this.pageStart = 0;
      this.pageEnd = 0;
      return;
    }
    this.pageStart = (this.pageNumber - 1) * this.pageSize + 1;
    this.pageEnd = Math.min(this.pageNumber * this.pageSize, this.totalRecords);
  }

  private toApiDate(value: string): string {
    if (!value) {
      return '';
    }
    const [year, month, day] = value.split('-');
    return `${day}/${month}/${year}`;
  }

  private toDateInputValue(date: Date): string {
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private normalize(value?: string | null): string {
    return (value || '').trim().toUpperCase();
  }

  private toNumber(value?: number | null): number {
    return Number.isFinite(value as number) ? Number(value) : 0;
  }

  private getExchangeRate(value?: number | null): number {
    const exchangeRate = this.toNumber(value);
    return exchangeRate > 0 ? exchangeRate : 1;
  }

  private toLocalAmount(value?: number | null, exchangeRate?: number | null): number {
    return this.toNumber(value) * this.getExchangeRate(exchangeRate);
  }

  private headerStorageKey(tipDocu: string, numDocu: string): string {
    return `compras-correo-header:${tipDocu}:${numDocu}`;
  }
}
