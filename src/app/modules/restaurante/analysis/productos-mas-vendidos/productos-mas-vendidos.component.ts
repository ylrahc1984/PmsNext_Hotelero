import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CurrencyPipe, DecimalPipe } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';
import { AnalysisPageHeaderComponent } from '../components/analysis-page-header.component';
import {
  PuntoVentaRestaurante,
  PuntosVentaRestauranteService
} from 'src/app/demo/restaurante/puntos-venta-restaurante/puntos-venta-restaurante.service';
import { ProductoFacturacion, ProductosMasVendidosService } from './productos-mas-vendidos.service';

@Component({
  selector: 'app-productos-mas-vendidos',
  standalone: true,
  imports: [FormsModule, CurrencyPipe, DecimalPipe, AnalysisPageHeaderComponent],
  templateUrl: './productos-mas-vendidos.component.html',
  styleUrl: './productos-mas-vendidos.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProductosMasVendidosComponent implements OnInit {
  private readonly reporteService = inject(ProductosMasVendidosService);
  private readonly puntosVentaService = inject(PuntosVentaRestauranteService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly fechaActual = this.obtenerFechaActual();

  readonly fechaInicial = signal(this.obtenerPrimerDiaMes(this.fechaActual));
  readonly fechaFinal = signal(this.fechaActual);
  readonly puntoVenta = signal('');
  readonly incluirCargoHabitacion = signal(true);
  readonly incluirCargoIncluido = signal(true);
  readonly incluirCargoColaborador = signal(true);
  readonly filtroProducto = signal('');
  readonly tamanoPagina = signal(10);
  readonly paginaActual = signal(1);
  readonly cargando = signal(false);
  readonly error = signal('');
  readonly puntosVenta = signal<PuntoVentaRestaurante[]>([]);
  readonly productos = signal<ProductoFacturacion[]>([]);
  readonly opcionesTamanoPagina = [10, 20, 50, 100];

  readonly productosFiltrados = computed(() => {
    const termino = this.filtroProducto().trim().toLocaleLowerCase();
    if (!termino) return this.productos();

    return this.productos().filter(
      (item) => item.codigo.toLocaleLowerCase().includes(termino) || item.descripcion.toLocaleLowerCase().includes(termino)
    );
  });

  readonly resumenKpis = computed(() => {
    const productos = this.productos();
    const facturacionTotal = productos.reduce((total, item) => total + item.total, 0);
    const cantidadVendida = productos.reduce((total, item) => total + item.cantidad, 0);
    const gananciaBruta = productos.reduce((total, item) => total + item.total * (item.porcentaje / 100), 0);
    const margenBrutoPonderado = facturacionTotal > 0 ? (gananciaBruta / facturacionTotal) * 100 : 0;

    return {
      facturacionTotal,
      cantidadVendida,
      gananciaBruta,
      margenBrutoPonderado,
      productosConVenta: productos.length
    };
  });

  readonly totalPaginas = computed(() => Math.max(1, Math.ceil(this.productosFiltrados().length / this.tamanoPagina())));

  readonly productosPaginados = computed(() => {
    const inicio = (this.paginaActual() - 1) * this.tamanoPagina();
    return this.productosFiltrados().slice(inicio, inicio + this.tamanoPagina());
  });

  readonly analisisPareto = computed(() => {
    const productosOrdenados = [...this.productos()]
      .filter((item) => item.total > 0)
      .sort((a, b) => b.total - a.total);
    const facturacionTotal = productosOrdenados.reduce((total, item) => total + item.total, 0);
    let porcentajeAcumulado = 0;

    const productosConParticipacion = productosOrdenados.map((item) => {
      const participacionFacturacion = facturacionTotal > 0 ? (item.total / facturacionTotal) * 100 : 0;
      porcentajeAcumulado += participacionFacturacion;
      return { ...item, participacionFacturacion, porcentajeAcumulado };
    });

    const indicePareto = productosConParticipacion.findIndex((item) => item.porcentajeAcumulado >= 80);
    const productosParaOchenta = indicePareto >= 0 ? indicePareto + 1 : productosConParticipacion.length;
    const porcentajeCatalogo = productosConParticipacion.length
      ? (productosParaOchenta / productosConParticipacion.length) * 100
      : 0;

    return {
      facturacionTotal,
      totalProductos: productosConParticipacion.length,
      productosParaOchenta,
      porcentajeCatalogo,
      principales: productosConParticipacion.slice(0, 5)
    };
  });

  readonly registroInicial = computed(() =>
    this.productosFiltrados().length ? (this.paginaActual() - 1) * this.tamanoPagina() + 1 : 0
  );

  readonly registroFinal = computed(() =>
    Math.min(this.paginaActual() * this.tamanoPagina(), this.productosFiltrados().length)
  );

  ngOnInit(): void {
    this.cargarPuntosVenta();
    this.buscar();
  }

  buscar(): void {
    if (!this.fechasValidas()) return;

    this.cargando.set(true);
    this.error.set('');
    this.paginaActual.set(1);

    this.reporteService
      .obtenerReporte({
        proceso: 90,
        fechaInicial: this.fechaInicial(),
        fechaFinal: this.fechaFinal(),
        centroCosto: 'ALIMEN',
        categoria: '',
        puntoVenta: this.puntoVenta(),
        codigoVendedor: '',
        tipoCambio: 500,
        incluirCargoHabitacion: this.incluirCargoHabitacion(),
        incluirCargoIncluido: this.incluirCargoIncluido(),
        incluirCargoColaborador: this.incluirCargoColaborador()
      })
      .pipe(
        finalize(() => this.cargando.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (productos) => this.productos.set(productos),
        error: () => {
          this.productos.set([]);
          this.error.set('No fue posible cargar el reporte. Verifique los filtros e intente nuevamente.');
        }
      });
  }

  limpiar(): void {
    this.fechaInicial.set(this.obtenerPrimerDiaMes(this.fechaActual));
    this.fechaFinal.set(this.fechaActual);
    this.puntoVenta.set('');
    this.incluirCargoHabitacion.set(true);
    this.incluirCargoIncluido.set(true);
    this.incluirCargoColaborador.set(true);
    this.filtroProducto.set('');
    this.tamanoPagina.set(10);
    this.paginaActual.set(1);
    this.error.set('');
    this.buscar();
  }

  actualizarFiltroProducto(valor: string): void {
    this.filtroProducto.set(valor);
    this.paginaActual.set(1);
  }

  actualizarTamanoPagina(valor: number | string): void {
    this.tamanoPagina.set(Number(valor) || 10);
    this.paginaActual.set(1);
  }

  irPagina(pagina: number): void {
    if (pagina >= 1 && pagina <= this.totalPaginas()) this.paginaActual.set(pagina);
  }

  anchoParticipacion(porcentaje: number): number {
    return Math.min(100, Math.max(0, porcentaje));
  }

  anchoBarraPareto(total: number): number {
    const productoLider = this.analisisPareto().principales[0]?.total ?? 0;
    return productoLider > 0 ? (total / productoLider) * 100 : 0;
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
}
