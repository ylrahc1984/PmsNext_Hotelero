import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { catchError, finalize, of } from 'rxjs';

import { SharedModule } from 'src/app/theme/shared/shared.module';
import { CompraCorreo, CompraCorreoDetalle, ComprasCorreoService } from '../compras-correo.service';

@Component({
  selector: 'app-compras-correo-detalle',
  imports: [CommonModule, SharedModule, RouterModule],
  templateUrl: './compras-correo-detalle.component.html',
  styleUrls: ['./compras-correo-detalle.component.scss']
})
export class ComprasCorreoDetalleComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly service = inject(ComprasCorreoService);

  readonly detalle = signal<CompraCorreoDetalle[]>([]);
  readonly factura = signal<CompraCorreo | null>(null);
  readonly loading = signal(false);
  readonly errorMessage = signal('');
  readonly skeletonRows = Array.from({ length: 4 });

  readonly tipDocu = this.route.snapshot.paramMap.get('tipDocu') || '';
  readonly numDocu = this.route.snapshot.paramMap.get('numDocu') || '';

  readonly totales = computed(() => {
    const rows = this.detalle();
    return {
      lineas: rows.length,
      cantidad: rows.reduce((sum, item) => sum + this.toNumber(item.PAC41_Cantidad), 0),
      neto: rows.reduce((sum, item) => sum + this.toNumber(item.PAC41_Neto), 0),
      impuesto: rows.reduce((sum, item) => sum + this.toNumber(item.PAC41_MtoImpto), 0),
      total: rows.reduce((sum, item) => sum + this.toNumber(item.PAC41_Total), 0),
      totalConvertido: rows.reduce((sum, item) => sum + this.toLocalAmount(item.PAC41_Total, item.PAC41_Tcambio), 0)
    };
  });

  ngOnInit(): void {
    this.loadHeader();
    this.loadDetalle();
  }

  volver(): void {
    this.router.navigate(['/compras/compras-correo']);
  }

  formatNumber(value?: number | null, min = 2, max = 2): string {
    return new Intl.NumberFormat('es-CR', {
      minimumFractionDigits: min,
      maximumFractionDigits: max
    }).format(this.toNumber(value));
  }

  formatExchangeRate(value?: number | null): string {
    return this.formatNumber(this.getExchangeRate(value), 2, 6);
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

  convertedTotal(item: CompraCorreoDetalle): number {
    return this.toLocalAmount(item.PAC41_Total, item.PAC41_Tcambio);
  }

  private loadDetalle(): void {
    if (!this.tipDocu || !this.numDocu) {
      this.errorMessage.set('No se recibieron los parametros necesarios para consultar el detalle.');
      return;
    }

    this.loading.set(true);
    this.errorMessage.set('');
    this.service
      .getDetalle(this.tipDocu, this.numDocu)
      .pipe(
        catchError((error) => {
          console.error('No se pudo cargar el detalle de la compra por correo.', error);
          this.errorMessage.set('No se pudo cargar el detalle de la compra seleccionada.');
          return of([]);
        }),
        finalize(() => this.loading.set(false))
      )
      .subscribe((response) => this.detalle.set(response ?? []));
  }

  private loadHeader(): void {
    const navigationState = history.state?.factura as CompraCorreo | undefined;
    if (navigationState?.PAC40_NumDocu) {
      this.factura.set(navigationState);
      return;
    }

    const stored = sessionStorage.getItem(this.headerStorageKey(this.tipDocu, this.numDocu));
    if (!stored) {
      return;
    }

    try {
      this.factura.set(JSON.parse(stored) as CompraCorreo);
    } catch {
      sessionStorage.removeItem(this.headerStorageKey(this.tipDocu, this.numDocu));
    }
  }

  private headerStorageKey(tipDocu: string, numDocu: string): string {
    return `compras-correo-header:${tipDocu}:${numDocu}`;
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
}
