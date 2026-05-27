import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { catchError, finalize, map, of, switchMap } from 'rxjs';
import {
  LiquidacionCabecera,
  LiquidacionDetalleLinea,
  LiquidacionDetalleResponse
} from '../../interfaces/liquidacion-comision.interface';
import { LiquidacionComisionService } from '../../services/liquidacion-comision.service';

type DetailAction = 'cerrar' | 'pagar' | 'anular';

@Component({
  selector: 'app-liquidacion-detalle',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './liquidacion-detalle.component.html',
  styleUrl: './liquidacion-detalle.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LiquidacionDetalleComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly service = inject(LiquidacionComisionService);

  readonly response = signal<LiquidacionDetalleResponse | null>(null);
  readonly loading = signal(false);
  readonly actionLoading = signal('');
  readonly errorMessage = signal('');
  readonly actionMessage = signal('');
  readonly skeletonRows = Array.from({ length: 5 });
  readonly cabecera = computed(() => this.response()?.cabecera ?? null);
  readonly detalle = computed(() => this.response()?.detalle ?? []);
  readonly metrics = computed(() => {
    const cabecera = this.cabecera();
    const detalle = this.detalle();
    return {
      facturado: Number(cabecera?.AD19_TotalFacturado ?? this.sum(detalle, 'AD20_MontoBase')),
      comision: Number(cabecera?.AD19_TotalComision ?? this.sum(detalle, 'AD20_MontoComision')),
      documentos: new Set(detalle.map((item) => this.documentLabel(item)).filter(Boolean)).size,
      reservas: new Set(detalle.map((item) => item.AD20_CodReserva).filter(Boolean)).size,
      pax: this.sum(detalle, 'AD20_CantidadPax')
    };
  });
  readonly timeline = computed(() => {
    const cabecera = this.cabecera();
    const estado = this.normalize(cabecera?.AD19_Estado ?? 'BORRADOR');
    return [
      { label: 'Creada', detail: this.formatDateTime(cabecera?.AD19_FechaLiquidacion), active: true },
      { label: 'Cerrada', detail: 'Aprobacion financiera', active: ['CERRADO', 'PAGADO'].includes(estado) },
      { label: 'Pagada', detail: 'Salida bancaria aplicada', active: estado === 'PAGADO' },
      { label: 'Anulada', detail: 'Reversion administrativa', active: estado.includes('ANUL') }
    ];
  });

  ngOnInit(): void {
    this.route.paramMap
      .pipe(
        switchMap((params) => {
          const id = params.get('id') ?? '';
          this.loading.set(true);
          this.errorMessage.set('');
          this.actionMessage.set('');
          return this.service.obtenerLiquidacion(id).pipe(
            catchError(() => {
              this.errorMessage.set('No se pudo cargar el detalle de la liquidacion.');
              return of(null);
            }),
            finalize(() => this.loading.set(false))
          );
        })
      )
      .subscribe((data) => this.response.set(data));
  }

  ejecutarAccion(action: DetailAction): void {
    const id = this.cabecera()?.AD19_Id;
    if (!id || this.actionLoading()) {
      return;
    }

    if (action === 'anular' && !window.confirm(`Desea anular la liquidacion ${id}?`)) {
      return;
    }

    this.actionLoading.set(action);
    this.errorMessage.set('');
    this.actionMessage.set('');

    const request =
      action === 'cerrar'
        ? this.service.cerrarLiquidacion(id)
        : action === 'pagar'
          ? this.service.pagarLiquidacion(id)
          : this.service.anularLiquidacion(id);

    request
      .pipe(
        map(() => true),
        catchError(() => {
          this.errorMessage.set(`No se pudo ${this.actionLabel(action).toLowerCase()} la liquidacion ${id}.`);
          return of(false);
        }),
        finalize(() => this.actionLoading.set(''))
      )
      .subscribe((success) => {
        if (!success) {
          return;
        }
        this.actionMessage.set(`Liquidacion ${id} actualizada correctamente.`);
        this.reload(id);
      });
  }

  imprimir(): void {
    const id = this.cabecera()?.AD19_Id ?? '';
    this.actionMessage.set(`La impresion PDF para ${id} queda pendiente de conectar.`);
  }

  documentLabel(item: LiquidacionDetalleLinea): string {
    return [item.AD20_TipoDocumento, item.AD20_SerieDocumento, item.AD20_NumeroDocumento].filter(Boolean).join('-');
  }

  statusClass(estado: string | undefined): string {
    const value = this.normalize(estado ?? '');
    if (value.includes('PAG')) return 'paid';
    if (value.includes('CERR')) return 'closed';
    if (value.includes('ANUL')) return 'void';
    return 'draft';
  }

  commissionClass(tipo: string): string {
    return this.normalize(tipo).includes('PORC') ? 'percentage' : 'fixed';
  }

  actionLabel(action: DetailAction): string {
    return action === 'cerrar' ? 'Cerrar' : action === 'pagar' ? 'Pagar' : 'Anular';
  }

  formatMoney(value: unknown): string {
    return new Intl.NumberFormat('es-CR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(Number(value ?? 0));
  }

  formatNumber(value: unknown): string {
    return new Intl.NumberFormat('es-CR', { maximumFractionDigits: 0 }).format(Number(value ?? 0));
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

  formatDateTime(value: unknown): string {
    const text = String(value ?? '').trim();
    if (!text) return 'Pendiente';
    const date = new Date(text);
    if (Number.isNaN(date.getTime())) return text;
    return new Intl.DateTimeFormat('es-CR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  }

  private reload(id: string): void {
    this.service
      .obtenerLiquidacion(id)
      .pipe(catchError(() => of(null)))
      .subscribe((data) => this.response.set(data));
  }

  private sum(rows: LiquidacionDetalleLinea[], key: keyof Pick<LiquidacionDetalleLinea, 'AD20_MontoBase' | 'AD20_MontoComision' | 'AD20_CantidadPax'>): number {
    return rows.reduce((total, row) => total + Number(row[key] ?? 0), 0);
  }

  private normalize(value: string): string {
    return value.toString().trim().toUpperCase();
  }
}
