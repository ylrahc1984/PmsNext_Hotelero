import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { catchError, finalize, from, map, of } from 'rxjs';
import { LiquidacionListFilters, LiquidacionResumen } from '../../interfaces/liquidacion-comision.interface';
import { LiquidacionComisionService } from '../../services/liquidacion-comision.service';

type LiquidacionAction = 'cerrar' | 'pagar' | 'anular';

@Component({
  selector: 'app-liquidaciones-lista',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './liquidaciones-lista.component.html',
  styleUrl: './liquidaciones-lista.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LiquidacionesListaComponent implements OnInit {
  private readonly liquidacionService = inject(LiquidacionComisionService);

  readonly liquidaciones = signal<LiquidacionResumen[]>([]);
  readonly loading = signal(false);
  readonly actionLoadingId = signal('');
  readonly printingId = signal('');
  readonly errorMessage = signal('');
  readonly actionMessage = signal('');
  readonly skeletonRows = Array.from({ length: 6 });
  readonly filters = signal<Required<LiquidacionListFilters>>({
    empresaId: 1,
    agencia: '',
    estado: '',
    fechaInicio: '',
    fechaFin: '',
    busqueda: ''
  });

  readonly filteredLiquidaciones = computed(() => {
    const filters = this.filters();
    const search = this.normalize(filters.busqueda);
    const agencia = this.normalize(filters.agencia);
    const estado = this.normalize(filters.estado);

    return this.liquidaciones().filter((item) => {
      const liquidationText = this.normalize(`${item.AD19_Id} ${item.AD19_CodAgencia} ${item.AD19_NomAgencia} ${item.AD19_Operador}`);
      return (
        (!agencia || this.normalize(`${item.AD19_CodAgencia} ${item.AD19_NomAgencia}`).includes(agencia)) &&
        (!estado || this.normalize(item.AD19_Estado) === estado) &&
        (!search || liquidationText.includes(search)) &&
        this.matchesDateRange(item)
      );
    });
  });

  readonly kpis = computed(() => {
    const rows = this.filteredLiquidaciones();
    return {
      liquidaciones: rows.length,
      facturado: this.sum(rows, 'AD19_TotalFacturado'),
      comision: this.sum(rows, 'AD19_TotalComision'),
      reservas: this.sum(rows, 'TotalReservas'),
      pax: this.sum(rows, 'TotalPax')
    };
  });

  readonly estadoOptions = computed(() => this.unique(this.liquidaciones().map((item) => item.AD19_Estado)));
  readonly agenciaOptions = computed(() =>
    this.unique(this.liquidaciones().map((item) => [item.AD19_CodAgencia, item.AD19_NomAgencia].filter(Boolean).join(' - ')))
  );

  ngOnInit(): void {
    this.buscar();
  }

  buscar(): void {
    this.loading.set(true);
    this.errorMessage.set('');
    this.actionMessage.set('');

    this.liquidacionService
      .listarLiquidaciones({ empresaId: Number(this.filters().empresaId) })
      .pipe(
        catchError(() => {
          this.errorMessage.set('No se pudieron cargar las liquidaciones de comision.');
          return of([] as LiquidacionResumen[]);
        }),
        finalize(() => this.loading.set(false))
      )
      .subscribe((rows) => this.liquidaciones.set(Array.isArray(rows) ? rows : []));
  }

  updateFilter<K extends keyof Required<LiquidacionListFilters>>(key: K, value: Required<LiquidacionListFilters>[K]): void {
    this.filters.update((current) => ({
      ...current,
      [key]: value
    }));
  }

  limpiar(): void {
    this.filters.set({
      empresaId: 1,
      agencia: '',
      estado: '',
      fechaInicio: '',
      fechaFin: '',
      busqueda: ''
    });
  }

  refrescar(): void {
    this.buscar();
  }

  ejecutarAccion(item: LiquidacionResumen, action: LiquidacionAction): void {
    if (this.actionLoadingId()) {
      return;
    }

    if (action === 'anular' && !window.confirm(`Desea anular la liquidacion ${item.AD19_Id}?`)) {
      return;
    }

    this.actionLoadingId.set(item.AD19_Id);
    this.errorMessage.set('');
    this.actionMessage.set('');

    const request =
      action === 'cerrar'
        ? this.liquidacionService.cerrarLiquidacion(item.AD19_Id)
        : action === 'pagar'
          ? this.liquidacionService.pagarLiquidacion(item.AD19_Id)
          : this.liquidacionService.anularLiquidacion(item.AD19_Id);

    request
      .pipe(
        map(() => true),
        catchError(() => {
          this.errorMessage.set(`No se pudo ${this.actionLabel(action).toLowerCase()} la liquidacion ${item.AD19_Id}.`);
          return of(false);
        }),
        finalize(() => this.actionLoadingId.set(''))
      )
      .subscribe((success) => {
        if (!success) {
          return;
        }
        this.actionMessage.set(`Liquidacion ${item.AD19_Id} actualizada correctamente.`);
        this.buscar();
      });
  }

  imprimir(item: LiquidacionResumen): void {
    if (this.printingId()) {
      return;
    }

    const voucherWindow = window.open('', '_blank');
    if (!voucherWindow) {
      this.errorMessage.set('El navegador bloqueo la apertura del voucher. Permita ventanas emergentes para esta pagina.');
      return;
    }

    voucherWindow.opener = null;
    voucherWindow.document.write('<!doctype html><html><head><title>Generando voucher...</title></head><body>Generando voucher...</body></html>');

    this.printingId.set(item.AD19_Id);
    this.errorMessage.set('');
    this.actionMessage.set('');

    this.liquidacionService
      .obtenerVoucher(item.AD19_Id)
      .pipe(
        catchError((error) =>
          from(this.resolveVoucherError(error)).pipe(
            map((message) => {
              this.errorMessage.set(`No se pudo generar el voucher de la liquidacion ${item.AD19_Id}. ${message}`);
              voucherWindow.close();
              return null;
            })
          )
        ),
        finalize(() => this.printingId.set(''))
      )
      .subscribe((voucher) => {
        if (!voucher) {
          return;
        }

        const pdfBlob = voucher.type === 'application/pdf' ? voucher : new Blob([voucher], { type: 'application/pdf' });
        const url = URL.createObjectURL(pdfBlob);
        voucherWindow.location.href = url;

        this.actionMessage.set(`Voucher de ${item.AD19_Id} generado correctamente.`);
        window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
      });
  }

  actionLabel(action: LiquidacionAction): string {
    return action === 'cerrar' ? 'Cerrar' : action === 'pagar' ? 'Pagar' : 'Anular';
  }

  statusClass(estado: string): string {
    const value = this.normalize(estado);
    if (value.includes('PAG')) return 'paid';
    if (value.includes('CERR')) return 'closed';
    if (value.includes('ANUL')) return 'void';
    return 'draft';
  }

  formatMoney(value: unknown): string {
    return new Intl.NumberFormat('es-CR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(Number(value ?? 0));
  }

  formatDate(value: unknown): string {
    const text = String(value ?? '').trim();
    if (!text) return 'N/D';
    const date = new Date(text);
    if (Number.isNaN(date.getTime())) return text;
    return new Intl.DateTimeFormat('es-CR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }).format(date);
  }

  private matchesDateRange(item: LiquidacionResumen): boolean {
    const filters = this.filters();
    const date = this.toDateKey(item.AD19_FechaLiquidacion);
    return (!filters.fechaInicio || date >= filters.fechaInicio) && (!filters.fechaFin || date <= filters.fechaFin);
  }

  private toDateKey(value: string): string {
    return String(value ?? '').slice(0, 10);
  }

  private sum(rows: LiquidacionResumen[], key: keyof Pick<LiquidacionResumen, 'AD19_TotalFacturado' | 'AD19_TotalComision' | 'TotalReservas' | 'TotalPax'>): number {
    return rows.reduce((total, row) => total + Number(row[key] ?? 0), 0);
  }

  private unique(values: string[]): string[] {
    return [...new Set(values.map((value) => value.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  }

  private normalize(value: string): string {
    return value.toString().trim().toUpperCase();
  }

  private async resolveVoucherError(error: unknown): Promise<string> {
    if (error instanceof HttpErrorResponse && error.error instanceof Blob) {
      const text = (await error.error.text()).trim();
      return text || `HTTP ${error.status}`;
    }

    if (error instanceof HttpErrorResponse) {
      const backendMessage =
        typeof error.error === 'string'
          ? error.error
          : typeof error.error?.message === 'string'
            ? error.error.message
            : '';
      return backendMessage.trim() || `HTTP ${error.status}`;
    }

    return 'Intente nuevamente o contacte al administrador.';
  }
}
