import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { catchError, finalize, from, map, of } from 'rxjs';
import { AuthService } from 'src/app/core/services/auth.service';
import Swal from 'sweetalert2';
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
  private readonly authService = inject(AuthService);

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
  readonly appliedFilters = signal<Required<LiquidacionListFilters>>({
    empresaId: 1,
    agencia: '',
    estado: '',
    fechaInicio: '',
    fechaFin: '',
    busqueda: ''
  });

  readonly filteredLiquidaciones = computed(() => {
    const filters = this.appliedFilters();
    const search = this.normalize(filters.busqueda);
    const agencia = this.normalize(filters.agencia);
    const estado = this.normalize(filters.estado);

    return this.liquidaciones().filter((item) => {
      const liquidationText = this.normalize(`${item.AD19_Id} ${item.AD19_CodAgencia} ${item.AD19_NomAgencia} ${item.AD19_Operador}`);
      return (
        (!agencia || this.normalize(`${item.AD19_CodAgencia} ${item.AD19_NomAgencia}`).includes(agencia)) &&
        (!estado || this.normalize(item.AD19_Estado) === estado) &&
        (!search || liquidationText.includes(search))
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
    this.loadLiquidaciones(this.filters(), true);
  }

  private loadLiquidaciones(filters: Required<LiquidacionListFilters>, applyFilters: boolean): void {
    if (applyFilters) {
      this.appliedFilters.set({ ...filters });
    }

    this.loading.set(true);
    this.errorMessage.set('');
    this.actionMessage.set('');

    this.liquidacionService
      .listarLiquidaciones({
        empresaId: Number(filters.empresaId),
        fechaInicio: this.toApiDate(filters.fechaInicio),
        fechaFin: this.toApiDate(filters.fechaFin)
      })
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
    this.loadLiquidaciones(this.appliedFilters(), false);
  }

  async ejecutarAccion(item: LiquidacionResumen, action: LiquidacionAction): Promise<void> {
    if (this.actionLoadingId()) {
      return;
    }

    if (!this.canEjecutarAccion(item, action)) {
      return;
    }

    const confirmed = await this.confirmarAccion(item.AD19_Id, action);
    if (!confirmed) {
      return;
    }

    this.actionLoadingId.set(item.AD19_Id);
    this.errorMessage.set('');
    this.actionMessage.set('');

    const operador = this.getOperador();
    const request =
      action === 'cerrar'
        ? this.liquidacionService.cerrarLiquidacion(item.AD19_Id, operador)
        : action === 'pagar'
          ? this.liquidacionService.pagarLiquidacion(item.AD19_Id, operador)
          : this.liquidacionService.anularLiquidacion(item.AD19_Id, {}, operador);

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
        this.loadLiquidaciones(this.appliedFilters(), false);
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

  canEjecutarAccion(item: LiquidacionResumen, action: LiquidacionAction): boolean {
    return action === 'cerrar'
      ? this.canCerrarLiquidacion(item)
      : action === 'pagar'
        ? this.canPagarLiquidacion(item)
        : this.canAnularLiquidacion(item);
  }

  canCerrarLiquidacion(item: LiquidacionResumen): boolean {
    const estado = this.normalize(item.AD19_Estado ?? 'BORRADOR');
    return !estado.includes('CERR') && !estado.includes('PAG') && !estado.includes('ANUL');
  }

  canPagarLiquidacion(item: LiquidacionResumen): boolean {
    const estado = this.normalize(item.AD19_Estado ?? 'BORRADOR');
    return estado.includes('CERR') && !estado.includes('PAG') && !estado.includes('ANUL');
  }

  canAnularLiquidacion(item: LiquidacionResumen): boolean {
    const estado = this.normalize(item.AD19_Estado ?? 'BORRADOR');
    return !estado.includes('PAG') && !estado.includes('ANUL');
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

    const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})/.exec(text);
    const date = dateOnlyMatch
      ? new Date(Number(dateOnlyMatch[1]), Number(dateOnlyMatch[2]) - 1, Number(dateOnlyMatch[3]))
      : new Date(text);

    if (Number.isNaN(date.getTime())) return text;
    return [date.getDate(), date.getMonth() + 1, date.getFullYear()].map((part) => String(part).padStart(2, '0')).join('/');
  }

  private toApiDate(value: string): string {
    const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value ?? '').trim());
    return dateOnlyMatch ? `${dateOnlyMatch[3]}/${dateOnlyMatch[2]}/${dateOnlyMatch[1]}` : String(value ?? '').trim();
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

  private getOperador(): string {
    return this.authService.getCurrentUser()?.usuario ?? 'CHARLY';
  }

  private async confirmarAccion(id: string, action: LiquidacionAction): Promise<boolean> {
    const config =
      action === 'cerrar'
        ? {
            title: 'Cerrar liquidacion',
            text: `Desea cerrar la liquidacion ${id}? Esta accion aplicara el cierre financiero.`,
            confirmButtonText: 'Si, cerrar',
            confirmButtonColor: '#1d4ed8'
          }
        : action === 'pagar'
          ? {
              title: 'Pagar liquidacion',
              text: `Desea marcar como pagada la liquidacion ${id}?`,
              confirmButtonText: 'Si, pagar',
              confirmButtonColor: '#166534'
            }
          : {
              title: 'Anular liquidacion',
              text: `Desea anular la liquidacion ${id}? Esta accion aplicara la reversion administrativa.`,
              confirmButtonText: 'Si, anular',
              confirmButtonColor: '#9f1239'
            };

    const result = await Swal.fire({
      ...config,
      icon: 'warning',
      showCancelButton: true,
      cancelButtonText: 'Cancelar',
      cancelButtonColor: '#667085',
      reverseButtons: true
    });

    return result.isConfirmed;
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
