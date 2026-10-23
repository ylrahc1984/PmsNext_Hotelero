import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { CompraIvaConsolidado } from '../../models/compras-iva.models';

@Component({
  selector: 'app-compras-iva-resumen',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './compras-iva-resumen.component.html',
  styleUrl: './compras-iva-resumen.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ComprasIvaResumenComponent {
  readonly rows = input<CompraIvaConsolidado[]>([]);
  readonly bienes = computed(() => this.sumFor('BIENES'));
  readonly servicios = computed(() => this.sumFor('SERVICIOS'));
  readonly sinClasificar = computed(() => this.rows().filter((row) => !['BIENES', 'SERVICIOS'].includes(this.normalizeType(row.tipoCompra))));
  readonly totalGeneral = computed(() => this.sumRows(this.rows()));
  readonly totalSinClasificar = computed(() => this.sumRows(this.sinClasificar()));
  readonly hasUnclassified = computed(() => this.sinClasificar().length > 0);

  formatMoney(value: number): string {
    return new Intl.NumberFormat('es-CR', { style: 'currency', currency: 'CRC', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value) || 0);
  }

  normalizeType(value: string): string {
    return (value ?? '').trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
  }

  private sumFor(type: string): CompraIvaConsolidado {
    return this.sumRows(this.rows().filter((row) => this.normalizeType(row.tipoCompra) === type));
  }

  private sumRows(rows: CompraIvaConsolidado[]): CompraIvaConsolidado {
    return rows.reduce((total, row) => ({
      tipoCompra: total.tipoCompra,
      base0: total.base0 + this.number(row.base0), base1: total.base1 + this.number(row.base1),
      base2: total.base2 + this.number(row.base2), base4: total.base4 + this.number(row.base4), base13: total.base13 + this.number(row.base13),
      ivA1: total.ivA1 + this.number(row.ivA1), ivA2: total.ivA2 + this.number(row.ivA2),
      ivA4: total.ivA4 + this.number(row.ivA4), ivA13: total.ivA13 + this.number(row.ivA13),
      totalBase: total.totalBase + this.number(row.totalBase), totalIVA: total.totalIVA + this.number(row.totalIVA),
      totalExoneracion: total.totalExoneracion + this.number(row.totalExoneracion), totalCompra: total.totalCompra + this.number(row.totalCompra)
    }), this.emptyTotal());
  }

  private emptyTotal(): CompraIvaConsolidado {
    return { tipoCompra: 'TOTAL GENERAL', base0: 0, base1: 0, base2: 0, base4: 0, base13: 0, ivA1: 0, ivA2: 0, ivA4: 0, ivA13: 0, totalBase: 0, totalIVA: 0, totalExoneracion: 0, totalCompra: 0 };
  }

  private number(value: number): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
}
