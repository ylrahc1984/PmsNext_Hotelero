import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { OperationalAction } from 'src/app/core/models/operational-context.model';
import { OperationalPolicyService } from 'src/app/core/services/operational-policy.service';
import { TipoCambio, TipoCambioService } from 'src/app/demo/administracion/tipo-cambio/tipo-cambio.service';

import {
  MesaEstado,
  MesaVisual,
  MozoPuntoVenta,
  RestauranteMesaOperacion,
  SelectedRestaurantTableContext,
  SelectedPointOfSale,
  UbicacionMesa
} from '../models/restaurant-operacion.models';
import { RestaurantDashboardService } from './restaurant-dashboard.service';
import { RestaurantOperationContextService } from '../services/restaurant-operation-context.service';
import { SharedModule } from 'src/app/theme/shared/shared.module';

interface RestaurantKpi {
  id: string;
  label: string;
  value: string;
  detail: string;
  icon: string;
  accent: 'cyan' | 'green' | 'blue' | 'purple' | 'magenta' | 'orange';
}

@Component({
  selector: 'app-restaurant-dashboard',
  standalone: true,
  imports: [CommonModule, SharedModule],
  templateUrl: './restaurant-dashboard.component.html',
  styleUrls: ['./restaurant-dashboard.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RestaurantDashboardComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly service = inject(RestaurantDashboardService);
  private readonly operationContext = inject(RestaurantOperationContextService);
  private readonly operationalPolicy = inject(OperationalPolicyService);
  private readonly tipoCambioService = inject(TipoCambioService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);

  codPuntoVenta = '';
  descripcionPuntoVenta = '';
  puntoVentaSeleccionado: SelectedPointOfSale | null = null;
  ubicaciones: UbicacionMesa[] = [];
  salonSeleccionado: UbicacionMesa | null = null;
  mesas: MesaVisual[] = [];
  mesaSeleccionada: MesaVisual | null = null;
  mesaPendienteMozo: MesaVisual | null = null;
  mozos: MozoPuntoVenta[] = [];
  kpis: RestaurantKpi[] = [];
  isLoading = false;
  isLoadingMesas = false;
  isLoadingMozos = false;
  errorMessage = '';
  mesasErrorMessage = '';
  mozosErrorMessage = '';
  tipoCambio: TipoCambio | null = null;
  tipoCambioLoading = false;
  tipoCambioError = '';

  ngOnInit(): void {
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      this.codPuntoVenta = (params.get('codPuntoVenta') || '').trim();
      if (!this.codPuntoVenta) {
        this.router.navigate(['/restaurant/puntos-venta']);
        return;
      }

      if (!this.loadPointOfSaleContext()) {
        this.router.navigate(['/restaurant/puntos-venta']);
        return;
      }
      this.cargarTipoCambio();
      this.cargarUbicaciones();
    });
  }

  cargarUbicaciones(): void {
    this.isLoading = true;
    this.errorMessage = '';
    this.ubicaciones = [];
    this.salonSeleccionado = null;
    this.mesas = [];
    this.mesaSeleccionada = null;
    this.mesaPendienteMozo = null;
    this.mozos = [];
    this.isLoadingMesas = false;
    this.mesasErrorMessage = '';
    this.mozosErrorMessage = '';
    this.rebuildKpis();

    this.service
      .obtenerUbicacionesMesas(this.codPuntoVenta)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.ubicaciones = response.datos ?? [];
          const firstActive = this.ubicaciones.find((item) => this.isUbicacionActiva(item)) ?? this.ubicaciones[0] ?? null;
          this.isLoading = false;
          if (firstActive) {
            this.seleccionarSalon(firstActive);
          } else {
            this.rebuildKpis();
          }
          this.cdr.markForCheck();
        },
        error: (error) => {
          console.error('Error al cargar ubicaciones de mesas:', error);
          this.isLoading = false;
          this.errorMessage = 'No se pudieron cargar las areas operativas del punto de venta.';
          this.rebuildKpis();
          this.cdr.markForCheck();
        }
      });
  }

  volverSeleccionPuntoVenta(): void {
    this.router.navigate(['/restaurant/puntos-venta']);
  }

  seleccionarSalon(salon: UbicacionMesa): void {
    this.salonSeleccionado = salon;
    this.mesaSeleccionada = null;
    this.cerrarSelectorMozo();
    this.cargarMesasDelSalon(salon);
    this.rebuildKpis();
    this.cdr.markForCheck();
  }

  cargarMesasDelSalon(salon: UbicacionMesa): void {
    this.mesas = [];
    this.mesasErrorMessage = '';

    if (this.isRoomService(salon)) {
      this.isLoadingMesas = false;
      this.rebuildKpis();
      return;
    }

    this.isLoadingMesas = true;
    this.service
      .obtenerMesasPorUbicacion(this.codPuntoVenta, salon.MPV09_CodUbicacion)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (items) => {
          if (this.salonSeleccionado?.MPV09_CodUbicacion !== salon.MPV09_CodUbicacion) {
            return;
          }
          this.mesas = items.map((item) => this.mapMesaOperacion(item));
          this.isLoadingMesas = false;
          this.rebuildKpis();
          this.cdr.markForCheck();
        },
        error: (error) => {
          console.error('Error al cargar mesas del salon:', error);
          if (this.salonSeleccionado?.MPV09_CodUbicacion !== salon.MPV09_CodUbicacion) {
            return;
          }
          this.mesas = [];
          this.isLoadingMesas = false;
          this.mesasErrorMessage = 'No se pudieron cargar las mesas de esta area.';
          this.rebuildKpis();
          this.cdr.markForCheck();
        }
      });
  }

  async abrirMesa(mesa: MesaVisual): Promise<void> {
    this.mesaSeleccionada = mesa;
    if (mesa.estado === 'OCUPADA') {
      this.abrirMesaOcupada(mesa);
      return;
    }

    const allowed = await this.operationalPolicy.require(OperationalAction.CreateOperation);
    if (!allowed) {
      this.mesaSeleccionada = null;
      this.cdr.markForCheck();
      return;
    }

    this.mesaPendienteMozo = mesa;
    this.mozosErrorMessage = '';
    this.cargarMozos();
  }

  async seleccionarMozo(mozo: MozoPuntoVenta): Promise<void> {
    const mesaPendiente = this.mesaPendienteMozo;
    if (!this.puntoVentaSeleccionado || !this.salonSeleccionado || !mesaPendiente) {
      return;
    }

    const allowed = await this.operationalPolicy.require(OperationalAction.CreateOperation, {
      refresh: true
    });
    if (!allowed || this.mesaPendienteMozo?.numero !== mesaPendiente.numero) return;

    const context: SelectedRestaurantTableContext = {
      puntoVenta: this.puntoVentaSeleccionado,
      areaOperativa: this.salonSeleccionado,
      mesa: mesaPendiente,
      mozo
    };

    this.operationContext.setSelectedTableContext(context);

    await this.router.navigate(['/restaurant/mesa', mesaPendiente.numero], {
      queryParams: {
        puntoVenta: this.codPuntoVenta,
        ubicacion: this.salonSeleccionado.MPV09_CodUbicacion,
        mozo: mozo.MPV11_CodUsuario
      }
    });
  }

  cerrarSelectorMozo(): void {
    this.mesaPendienteMozo = null;
    this.isLoadingMozos = false;
    this.mozosErrorMessage = '';
  }

  isRoomService(salon: UbicacionMesa | null): boolean {
    return (salon?.MPV09_Descripcion || '').toUpperCase().includes('ROOM SERVICE');
  }

  isUbicacionActiva(salon: UbicacionMesa): boolean {
    return (salon.MPV09_Activo || '').toUpperCase() === 'S';
  }

  getMesaClass(mesa: MesaVisual): string {
    return `table-card--${mesa.estado.toLowerCase()}`;
  }

  get compraTipoCambio(): number | null {
    return this.tipoCambio?.compra ?? null;
  }

  get ventaTipoCambio(): number | null {
    return this.tipoCambio?.venta ?? null;
  }

  trackBySalon(_: number, salon: UbicacionMesa): string {
    return `${salon.MPV09_CodPntVenta}-${salon.MPV09_CodUbicacion}`;
  }

  trackByMesa(_: number, mesa: MesaVisual): number {
    return mesa.idMesa ?? mesa.numero;
  }

  trackByMozo(_: number, mozo: MozoPuntoVenta): string {
    return `${mozo.MPV12_PntVenta}-${mozo.MPV11_CodUsuario}`;
  }

  cargarMozos(): void {
    if (this.mozos.length > 0) {
      this.cdr.markForCheck();
      return;
    }

    this.isLoadingMozos = true;
    this.service
      .obtenerMozosPorPuntoVenta(this.codPuntoVenta)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (items) => {
          this.mozos = items;
          this.isLoadingMozos = false;
          this.mozosErrorMessage = items.length === 0 ? 'No hay mozos configurados para este punto de venta.' : '';
          this.cdr.markForCheck();
        },
        error: (error) => {
          console.error('Error al cargar mozos del punto de venta:', error);
          this.mozos = [];
          this.isLoadingMozos = false;
          this.mozosErrorMessage = 'No se pudieron cargar los mozos del punto de venta.';
          this.cdr.markForCheck();
        }
      });
  }

  private loadPointOfSaleContext(): boolean {
    const selected = this.operationContext.getSelectedPointOfSale(this.codPuntoVenta);
    this.puntoVentaSeleccionado = selected;
    this.descripcionPuntoVenta = selected?.descripcion || this.codPuntoVenta;
    return !!selected;
  }

  private cargarTipoCambio(): void {
    this.tipoCambioLoading = true;
    this.tipoCambioError = '';

    this.tipoCambioService
      .fetchTipoCambio(this.getTodayDisplayDate(), 'usd')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (items) => {
          this.tipoCambio = items[0] ?? this.tipoCambioService.getActual() ?? null;
          this.tipoCambioLoading = false;
          this.cdr.markForCheck();
        },
        error: () => {
          this.tipoCambio = this.tipoCambioService.getActual() ?? null;
          this.tipoCambioLoading = false;
          this.tipoCambioError = 'Referencia no actualizada';
          this.cdr.markForCheck();
        }
      });
  }

  private rebuildKpis(): void {
    const totalAreas = this.ubicaciones.length;
    const totalMesas = this.mesas.length || this.ubicaciones.reduce((sum, item) => sum + Number(item.MPV09_TotMesas || 0), 0);
    const mesasOcupadas = this.mesas.filter((mesa) => mesa.estado === 'OCUPADA').length;
    const mesasLibres = Math.max(totalMesas - mesasOcupadas, 0);
    const pedidosActivos = this.mesas.filter((mesa) => mesa.notaPedido).length;
    const roomService = this.ubicaciones.some((item) => this.isRoomService(item)) ? 'Activo' : 'No configurado';

    this.kpis = [
      {
        id: 'total-areas',
        label: 'Total Areas',
        value: String(totalAreas),
        detail: 'areas operativas',
        icon: 'icon-layout',
        accent: 'cyan'
      },
      {
        id: 'total-mesas',
        label: 'Total Mesas',
        value: String(totalMesas),
        detail: `en ${this.codPuntoVenta || 'P/V'}`,
        icon: 'icon-grid',
        accent: 'blue'
      },
      {
        id: 'mesas-ocupadas',
        label: 'Mesas Ocupadas',
        value: String(mesasOcupadas),
        detail: this.salonSeleccionado?.MPV09_Descripcion || 'area actual',
        icon: 'icon-users',
        accent: 'purple'
      },
      {
        id: 'mesas-libres',
        label: 'Mesas Libres',
        value: String(mesasLibres),
        detail: 'disponibles',
        icon: 'icon-check-circle',
        accent: 'green'
      },
      {
        id: 'pedidos-activos',
        label: 'Pedidos Activos',
        value: String(pedidosActivos),
        detail: 'notas abiertas',
        icon: 'icon-clipboard',
        accent: 'magenta'
      },
      {
        id: 'room-service',
        label: 'Room Service',
        value: roomService,
        detail: 'segun areas',
        icon: 'icon-phone-call',
        accent: 'orange'
      }
    ];
  }

  private mapMesaOperacion(item: RestauranteMesaOperacion): MesaVisual {
    const estado = this.mapEstadoMesa(item);
    const tipNp = this.normalizeText(item.ppV07_TipNDP);
    const serieNp = this.normalizeText(item.ppV07_SerieNDP);
    const numNp = this.normalizeText(item.ppV07_NumNDP);
    const fecha = this.normalizeDateDDMMYYYY(item.ppV07_FecDocu);
    const hora = this.normalizeText(item.ppV07_HorDocu) || '';

    return {
      idMesa: Number(item.cpV05_IdMesa || 0),
      numero: Number(item.cpV05_NumMesa || 0),
      nombre: this.normalizeText(item.cpV05_Descripcion) || `Mesa ${item.cpV05_NumMesa}`,
      estado,
      consumo: item.ppV07_TotalDocu == null ? undefined : Number(item.ppV07_TotalDocu),
      notaPedido:
        tipNp && serieNp && numNp && fecha
          ? {
              tipNp,
              serieNp,
              numNp,
              fecha,
              hora,
              codVendedor: this.normalizeText(item.ppV07_CodVendedor)
            }
          : undefined
    };
  }

  private mapEstadoMesa(item: RestauranteMesaOperacion): MesaEstado {
    const estado = this.normalizeText(item.estadoMesa).toUpperCase();
    if (estado === 'CUENTA' || estado === 'RESERVADA' || estado === 'LIMPIEZA') {
      return estado;
    }
    if (estado === 'OCUPADA' || item.ocupada) {
      return 'OCUPADA';
    }
    return 'LIBRE';
  }

  private abrirMesaOcupada(mesa: MesaVisual): void {
    if (!this.puntoVentaSeleccionado || !this.salonSeleccionado) {
      return;
    }

    const codVendedor = mesa.notaPedido?.codVendedor || '';
    const context: SelectedRestaurantTableContext = {
      puntoVenta: this.puntoVentaSeleccionado,
      areaOperativa: this.salonSeleccionado,
      mesa,
      mozo: {
        MPV11_CodUsuario: codVendedor,
        MPV11_NomMozo: codVendedor || 'Sin asignar',
        MPV12_PntVenta: this.codPuntoVenta
      }
    };
    this.operationContext.setSelectedTableContext(context);

    //console.log(mesa.notaPedido?.tipNp, mesa.notaPedido?.serieNp, mesa.notaPedido?.numNp, mesa.notaPedido?.fecha, mesa.notaPedido?.hora);

    this.router.navigate(['/restaurant/mesa', mesa.numero], {
      queryParams: {
        puntoVenta: this.codPuntoVenta,
        ubicacion: this.salonSeleccionado.MPV09_CodUbicacion,
        mozo: codVendedor || null,
        tipNp: mesa.notaPedido?.tipNp || null,
        serieNp: mesa.notaPedido?.serieNp || null,
        numNp: mesa.notaPedido?.numNp || null,
        fecha: mesa.notaPedido?.fecha || null,
        hora: mesa.notaPedido?.hora || null
      }
    });
  }

  private normalizeText(value: unknown): string {
    return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
  }

  private normalizeDateDDMMYYYY(value: unknown): string {
    const normalized = this.normalizeText(value);
    const slashDate = normalized.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (slashDate) {
      return `${slashDate[1].padStart(2, '0')}/${slashDate[2].padStart(2, '0')}/${slashDate[3]}`;
    }

    const isoDate = normalized.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (isoDate) {
      return `${isoDate[3].padStart(2, '0')}/${isoDate[2].padStart(2, '0')}/${isoDate[1]}`;
    }

    return normalized;
  }

  private getTodayDisplayDate(): string {
    const today = new Date();
    const day = String(today.getDate()).padStart(2, '0');
    const month = String(today.getMonth() + 1).padStart(2, '0');
    return `${day}/${month}/${today.getFullYear()}`;
  }
}
