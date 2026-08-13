import { CurrencyPipe, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';
import { MonedaService, MonedaUI } from 'src/app/demo/administracion/monedas/moneda.service';
import { MozoPuntoVenta } from 'src/app/demo/restaurante/models/restaurant-operacion.models';
import {
  PuntoVentaRestaurante,
  PuntosVentaRestauranteService
} from 'src/app/demo/restaurante/puntos-venta-restaurante/puntos-venta-restaurante.service';
import { RestaurantDashboardService } from 'src/app/demo/restaurante/restaurant-dashboard/restaurant-dashboard.service';
import { AnalysisPageHeaderComponent } from '../components/analysis-page-header.component';
import { DetalleFinanciero, VentasPorMeseroService } from './ventas-por-mesero.service';

@Component({
  selector: 'app-ventas-por-mesero',
  standalone: true,
  imports: [CurrencyPipe, DatePipe, FormsModule, AnalysisPageHeaderComponent],
  templateUrl: './ventas-por-mesero.component.html',
  styleUrl: './ventas-por-mesero.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class VentasPorMeseroComponent implements OnInit {
  private readonly reporteService = inject(VentasPorMeseroService);
  private readonly puntosVentaService = inject(PuntosVentaRestauranteService);
  private readonly dashboardService = inject(RestaurantDashboardService);
  private readonly monedaService = inject(MonedaService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly fechaActual = this.obtenerFechaActual();

  readonly fechaInicial = signal(this.obtenerPrimerDiaMes(this.fechaActual));
  readonly fechaFinal = signal(this.fechaActual);
  readonly puntoVenta = signal('');
  readonly mesero = signal('');
  readonly moneda = signal('COL');
  readonly tipoCambio = signal('V');
  readonly tamanoPagina = signal(10);
  readonly paginaActual = signal(1);
  readonly cargando = signal(false);
  readonly cargandoMozos = signal(false);
  readonly exportando = signal(false);
  readonly error = signal('');
  readonly puntosVenta = signal<PuntoVentaRestaurante[]>([]);
  readonly mozos = signal<MozoPuntoVenta[]>([]);
  readonly monedas = signal<MonedaUI[]>([]);
  readonly detalles = signal<DetalleFinanciero[]>([]);
  readonly opcionesTamanoPagina = [10, 15, 20];

  readonly totalPaginas = computed(() => Math.max(1, Math.ceil(this.detalles().length / this.tamanoPagina())));
  readonly detallesPaginados = computed(() => {
    const inicio = (this.paginaActual() - 1) * this.tamanoPagina();
    return this.detalles().slice(inicio, inicio + this.tamanoPagina());
  });
  readonly totales = computed(() => this.detalles().reduce(
    (acumulado, item) => ({
      subtotal: acumulado.subtotal + item.subtotal,
      iva: acumulado.iva + item.iva,
      servicio: acumulado.servicio + item.servicio,
      totalImpuestos: acumulado.totalImpuestos + item.totalImpuestos,
      propina: acumulado.propina + item.propina,
      totalVenta: acumulado.totalVenta + item.totalVenta,
      totalGeneral: acumulado.totalGeneral + item.totalGeneral,
      cantidadLineas: acumulado.cantidadLineas + item.cantidadLineas
    }),
    { subtotal: 0, iva: 0, servicio: 0, totalImpuestos: 0, propina: 0, totalVenta: 0, totalGeneral: 0, cantidadLineas: 0 }
  ));
  readonly registroInicial = computed(() => (this.detalles().length ? (this.paginaActual() - 1) * this.tamanoPagina() + 1 : 0));
  readonly registroFinal = computed(() => Math.min(this.paginaActual() * this.tamanoPagina(), this.detalles().length));

  ngOnInit(): void {
    this.cargarPuntosVenta();
    this.cargarMonedas();
    this.buscar();
  }

  buscar(): void {
    if (!this.fechasValidas()) return;

    this.cargando.set(true);
    this.error.set('');
    this.paginaActual.set(1);

    this.reporteService
      .obtenerDetalle({
        fechaInicial: this.fechaInicial(),
        fechaFinal: this.fechaFinal(),
        moneda: this.moneda(),
        tipoCambio: this.tipoCambio(),
        codMozo: this.mesero(),
        puntoVenta: this.puntoVenta()
      })
      .pipe(
        finalize(() => this.cargando.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (detalles) => this.detalles.set(detalles),
        error: () => {
          this.detalles.set([]);
          this.error.set('No fue posible cargar el detalle financiero. Verifique los filtros e intente nuevamente.');
        }
      });
  }

  limpiar(): void {
    this.fechaInicial.set(this.obtenerPrimerDiaMes(this.fechaActual));
    this.fechaFinal.set(this.fechaActual);
    this.puntoVenta.set('');
    this.mesero.set('');
    this.moneda.set('COL');
    this.tamanoPagina.set(10);
    this.paginaActual.set(1);
    this.mozos.set([]);
    this.error.set('');
    this.buscar();
  }

  actualizarPuntoVenta(valor: string): void {
    this.puntoVenta.set(valor);
    this.mesero.set('');
    this.mozos.set([]);
    if (valor) this.cargarMozos(valor);
  }

  actualizarTamanoPagina(valor: number | string): void {
    this.tamanoPagina.set(Number(valor) || 10);
    this.paginaActual.set(1);
  }

  irPagina(pagina: number): void {
    if (pagina >= 1 && pagina <= this.totalPaginas()) this.paginaActual.set(pagina);
  }

  async exportarExcel(): Promise<void> {
    const detalles = this.detalles();
    if (!detalles.length || this.exportando()) return;

    this.exportando.set(true);
    this.error.set('');

    try {
      const XLSX = await import('xlsx');
      const encabezados = [
        'Tipo documento', 'Serie', 'Número documento', 'Fecha documento', 'Cliente', 'Mozo', 'Punto de venta',
        'Subtotal', 'IVA', 'Servicio', 'Total impuestos', 'Propina', 'Total venta', 'Total general', 'Cant. líneas'
      ];
      const filas = detalles.map((item) => [
        item.tipoDocumento, item.serie, item.numeroDocumento, this.convertirFechaExcel(item.fechaDocumento), item.cliente, item.mozo,
        item.puntoVenta, item.subtotal, item.iva, item.servicio, item.totalImpuestos, item.propina,
        item.totalVenta, item.totalGeneral, item.cantidadLineas
      ]);
      const totales = this.totales();
      const filaTotales = [
        'TOTALES', '', '', '', '', '', '', totales.subtotal, totales.iva, totales.servicio,
        totales.totalImpuestos, totales.propina, totales.totalVenta, totales.totalGeneral, totales.cantidadLineas
      ];
      const hoja = XLSX.utils.aoa_to_sheet([
        ['Ventas por mesero'],
        [`Periodo: ${this.fechaInicial()} al ${this.fechaFinal()}`, `Moneda: ${this.moneda()}`],
        [],
        encabezados,
        ...filas,
        filaTotales
      ], { cellDates: true });
      const indiceFilaTotales = 4 + filas.length;
      hoja['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: encabezados.length - 1 } },
        { s: { r: indiceFilaTotales, c: 0 }, e: { r: indiceFilaTotales, c: 6 } }
      ];
      hoja['!autofilter'] = {
        ref: XLSX.utils.encode_range({ s: { r: 3, c: 0 }, e: { r: 3 + filas.length, c: encabezados.length - 1 } })
      };
      hoja['!cols'] = encabezados.map((encabezado, indice) => ({ wch: indice === 4 ? 32 : Math.max(12, encabezado.length + 2) }));

      filas.forEach((_, indiceFila) => {
        const filaHoja = indiceFila + 4;
        [0, 1, 2, 6].forEach((indiceColumna) => {
          const celda = hoja[XLSX.utils.encode_cell({ r: filaHoja, c: indiceColumna })];
          if (celda) celda.z = '@';
        });
        const celdaFecha = hoja[XLSX.utils.encode_cell({ r: filaHoja, c: 3 })];
        if (celdaFecha?.t === 'd') celdaFecha.z = 'dd/mm/yyyy';
        for (let indiceColumna = 7; indiceColumna <= 13; indiceColumna += 1) {
          const celdaImporte = hoja[XLSX.utils.encode_cell({ r: filaHoja, c: indiceColumna })];
          if (celdaImporte) celdaImporte.z = '#,##0.00';
        }
      });
      for (let indiceColumna = 7; indiceColumna <= 13; indiceColumna += 1) {
        const celdaImporte = hoja[XLSX.utils.encode_cell({ r: indiceFilaTotales, c: indiceColumna })];
        if (celdaImporte) celdaImporte.z = '#,##0.00';
      }

      const libro = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(libro, hoja, 'Detalle financiero');
      const nombre = `ventas-por-mesero-${this.fechaInicial()}-${this.fechaFinal()}-${this.moneda()}.xlsx`;
      XLSX.writeFile(libro, nombre, { compression: true });
    } catch {
      this.error.set('No fue posible generar el archivo Excel. Intente nuevamente.');
    } finally {
      this.exportando.set(false);
    }
  }

  private cargarPuntosVenta(): void {
    this.puntosVentaService
      .getPuntosVenta()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (puntos) => this.puntosVenta.set(puntos),
        error: () => this.puntosVenta.set([])
      });
  }

  private cargarMozos(puntoVenta: string): void {
    this.cargandoMozos.set(true);
    this.dashboardService
      .obtenerMozosPorPuntoVenta(puntoVenta)
      .pipe(
        finalize(() => this.cargandoMozos.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (mozos) => this.mozos.set(mozos),
        error: () => this.mozos.set([])
      });
  }

  private cargarMonedas(): void {
    this.monedaService
      .getAll()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (monedas) => this.monedas.set(monedas.filter((item) => item.activo !== 0)),
        error: () => this.monedas.set([])
      });
  }

  private fechasValidas(): boolean {
    if (!this.fechaInicial() || !this.fechaFinal()) {
      this.error.set('Seleccione la fecha inicial y la fecha final.');
      return false;
    }
    if (this.fechaInicial() > this.fechaFinal()) {
      this.error.set('La fecha inicial no puede ser posterior a la fecha final.');
      return false;
    }
    return true;
  }

  private obtenerFechaActual(): string {
    const hoy = new Date();
    const anio = hoy.getFullYear();
    const mes = String(hoy.getMonth() + 1).padStart(2, '0');
    const dia = String(hoy.getDate()).padStart(2, '0');
    return `${anio}-${mes}-${dia}`;
  }

  private obtenerPrimerDiaMes(fecha: string): string {
    return `${fecha.slice(0, 7)}-01`;
  }

  private convertirFechaExcel(valor: string): Date | string {
    const coincidencia = valor.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!coincidencia) return valor;
    return new Date(Number(coincidencia[1]), Number(coincidencia[2]) - 1, Number(coincidencia[3]));
  }
}
