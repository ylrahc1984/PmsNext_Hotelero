import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { SharedModule } from 'src/app/theme/shared/shared.module';
import {
  OrdenPedidoCompletaCliente,
  OrdenPedidoCompletaDetalleItem,
  OrdenPedidoCompletaEncabezado,
  OrdenPedidoCompletaFormaPago
} from '../../interfaces/orden-pedido.interface';
import { OrdenPedidoService } from '../../services/orden-pedido.service';

type TotalesResumen = {
  subtotal: number;
  descuento: number;
  impuesto: number;
  total: number;
};

@Component({
  selector: 'app-orden-pedido-detalle',
  standalone: true,
  imports: [CommonModule, RouterModule, SharedModule],
  templateUrl: './orden-pedido-detalle.component.html',
  styleUrls: ['./orden-pedido-detalle.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OrdenPedidoDetalleComponent implements OnInit {
  tipOrden = '';
  serie = '';
  numero = '';

  encabezado: OrdenPedidoCompletaEncabezado | null = null;
  cliente: OrdenPedidoCompletaCliente | null = null;
  detalle: OrdenPedidoCompletaDetalleItem[] = [];
  formasPago: OrdenPedidoCompletaFormaPago[] = [];

  resumen: TotalesResumen = { subtotal: 0, descuento: 0, impuesto: 0, total: 0 };
  totalFormasPago = 0;

  loading = false;
  errorMsg: string | null = null;

  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly service = inject(OrdenPedidoService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);

  private activeRequest?: Subscription;

  ngOnInit(): void {
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const tip = (params.get('tipOrden') ?? '').toString().trim();
      const serie = (params.get('serie') ?? '').toString().trim() || '000';
      const numero = (params.get('numero') ?? '').toString().trim();

      if (!tip || !numero) {
        void this.router.navigate(['/demo/ordenes-pedido']);
        return;
      }

      this.tipOrden = tip;
      this.serie = serie;
      this.numero = numero;
      this.loadDetalle();
    });
  }

  get documentoCodigo(): string {
    const tip = this.encabezado?.tipNDP || this.tipOrden;
    const serie = this.encabezado?.serieNDP || this.serie;
    const numero = this.encabezado?.numNDP || this.numero;
    return [tip, serie, numero].filter((item) => !!item).join(' / ');
  }

  get estadoDocumentoLabel(): string {
    const raw = (this.encabezado?.estadoDocumento ?? '').toString().trim();
    return raw || 'N/D';
  }

  get estadoBadgeClass(): string {
    const normalized = this.normalizeEstado(this.encabezado?.estadoDocumento);
    if (normalized === 'OPEN') return 'is-open';
    if (normalized === 'CONFIRMED') return 'is-confirmed';
    if (normalized === 'CANCELLED') return 'is-cancelled';
    return 'is-unknown';
  }

  get monedaDocumento(): string {
    return this.encabezado?.moneda || this.detalle[0]?.moneda || this.formasPago[0]?.moneda || 'N/D';
  }

  get subtotalGeneral(): number {
    return this.resumen.subtotal || this.encabezado?.subtotal || 0;
  }

  get descuentoGeneral(): number {
    return this.resumen.descuento || 0;
  }

  get impuestoGeneral(): number {
    return this.resumen.impuesto || this.encabezado?.impuesto || 0;
  }

  get totalGeneral(): number {
    return this.encabezado?.totalDocumento || this.resumen.total || 0;
  }

  get totalPagadoVista(): number {
    if (this.totalFormasPago > 0) return this.totalFormasPago;
    return this.encabezado?.totalPago || 0;
  }

  get isPagoCompleto(): boolean {
    const total = this.totalGeneral;
    if (total <= 0) return false;
    return this.totalPagadoVista + 0.01 >= total;
  }

  reload(): void {
    this.loadDetalle();
  }

  backToList(): void {
    void this.router.navigate(['/demo/ordenes-pedido']);
  }

  trackByDetalle(index: number, item: OrdenPedidoCompletaDetalleItem): string {
    return `${item.orden}-${item.codProducto}-${index}`;
  }

  trackByPago(index: number, item: OrdenPedidoCompletaFormaPago): string {
    return `${item.orden}-${item.formaPago}-${index}`;
  }

  getCategoriaClass(categoria: string): string {
    const raw = (categoria ?? '').toString().trim().toUpperCase();
    if (!raw) return 'op-pill--neutral';
    if (raw.includes('TOUR')) return 'op-pill--tours';
    if (raw.includes('TRANSP')) return 'op-pill--transporte';
    if (raw.includes('SERV')) return 'op-pill--servicios';
    return 'op-pill--neutral';
  }

  formatFecha(value: string): string {
    const raw = String(value ?? '').trim();
    if (!raw) {
      return 'N/D';
    }

    const normalized = raw.replace('T', ' ');
    const parsed = new Date(normalized);
    if (!Number.isNaN(parsed.getTime())) {
      const day = String(parsed.getDate()).padStart(2, '0');
      const month = String(parsed.getMonth() + 1).padStart(2, '0');
      const year = parsed.getFullYear();
      const hours = String(parsed.getHours()).padStart(2, '0');
      const minutes = String(parsed.getMinutes()).padStart(2, '0');
      return `${day}/${month}/${year} ${hours}:${minutes}`;
    }

    return raw;
  }

  private loadDetalle(): void {
    this.activeRequest?.unsubscribe();
    this.loading = true;
    this.errorMsg = null;
    this.cdr.markForCheck();

    this.activeRequest = this.service
      .getOrdenCompleta(this.tipOrden, this.serie, this.numero)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.encabezado = response.encabezado;
          this.cliente = response.cliente;
          this.detalle = response.detalle;
          this.formasPago = response.formasPago;
          this.updateResumen();
          this.loading = false;
          this.cdr.markForCheck();
        },
        error: (error: unknown) => {
          this.encabezado = null;
          this.cliente = null;
          this.detalle = [];
          this.formasPago = [];
          this.resumen = { subtotal: 0, descuento: 0, impuesto: 0, total: 0 };
          this.totalFormasPago = 0;
          this.loading = false;
          this.errorMsg = this.getErrorMessage(error);
          this.cdr.markForCheck();
        }
      });
  }

  private updateResumen(): void {
    this.resumen = this.detalle.reduce<TotalesResumen>(
      (acc, item) => {
        acc.subtotal += item.subtotalSinImpuesto;
        acc.descuento += item.descuento;
        acc.impuesto += item.impuesto;
        acc.total += item.totalLinea;
        return acc;
      },
      { subtotal: 0, descuento: 0, impuesto: 0, total: 0 }
    );

    this.totalFormasPago = this.formasPago.reduce((acc, item) => acc + item.monto, 0);
  }

  private getErrorMessage(error: unknown): string {
    if (error instanceof Error && error.message) {
      return error.message;
    }
    if (typeof error === 'string' && error.trim()) {
      return error;
    }
    return 'No se pudo cargar el detalle de la orden de pedido.';
  }

  private normalizeEstado(estado: string | null | undefined): 'OPEN' | 'CONFIRMED' | 'CANCELLED' | 'UNKNOWN' {
    const value = (estado ?? '').toString().trim().toUpperCase();
    if (!value) return 'UNKNOWN';

    if (
      value === 'ABI' ||
      value === 'ABIERTO' ||
      value === 'PEN' ||
      value === 'PENDIENTE' ||
      value === 'BORRADOR'
    ) {
      return 'OPEN';
    }

    if (
      value === 'CON' ||
      value === 'CONFIRMADO' ||
      value === 'CONFIRMADA' ||
      value === 'CER' ||
      value === 'CERRADO'
    ) {
      return 'CONFIRMED';
    }

    if (
      value === 'CAN' ||
      value === 'ANU' ||
      value === 'ANULADO' ||
      value === 'ANULADA'
    ) {
      return 'CANCELLED';
    }

    return 'UNKNOWN';
  }
}
