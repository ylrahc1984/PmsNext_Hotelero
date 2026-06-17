import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import {
  MesaEstado,
  MesaVisual,
  SelectedPointOfSale,
  UbicacionMesa
} from '../models/restaurant-operacion.models';
import { RestaurantDashboardService } from './restaurant-dashboard.service';
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
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);

  codPuntoVenta = '';
  descripcionPuntoVenta = '';
  ubicaciones: UbicacionMesa[] = [];
  salonSeleccionado: UbicacionMesa | null = null;
  mesas: MesaVisual[] = [];
  mesaSeleccionada: MesaVisual | null = null;
  kpis: RestaurantKpi[] = [];
  isLoading = false;
  errorMessage = '';

  ngOnInit(): void {
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      this.codPuntoVenta = (params.get('codPuntoVenta') || '').trim();
      if (!this.codPuntoVenta) {
        this.router.navigate(['/restaurant/puntos-venta']);
        return;
      }

      this.loadPointOfSaleContext();
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
    this.generarMesasDelSalon(salon);
    this.rebuildKpis();
    this.cdr.markForCheck();
  }

  generarMesasDelSalon(salon: UbicacionMesa): void {
    if (this.isRoomService(salon)) {
      this.mesas = [];
      return;
    }

    const total = Math.max(0, Number(salon.MPV09_TotMesas ?? 0));
    this.mesas = Array.from({ length: total }, (_, index) => {
      const numero = index + 1;
      const estado = this.obtenerEstadoDemo(numero);
      return {
        numero,
        nombre: `Mesa ${numero}`,
        estado,
        personas: estado === 'OCUPADA' ? this.obtenerPersonasDemo(numero) : undefined,
        horaReserva: estado === 'RESERVADA' ? this.obtenerHoraReservaDemo(numero) : undefined
      };
    });
  }

  abrirMesa(mesa: MesaVisual): void {
    this.mesaSeleccionada = mesa;
    this.router.navigate(['/restaurant/mesa', mesa.numero], {
      queryParams: {
        puntoVenta: this.codPuntoVenta,
        ubicacion: this.salonSeleccionado?.MPV09_CodUbicacion
      }
    });
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

  trackBySalon(_: number, salon: UbicacionMesa): string {
    return `${salon.MPV09_CodPntVenta}-${salon.MPV09_CodUbicacion}`;
  }

  trackByMesa(_: number, mesa: MesaVisual): number {
    return mesa.numero;
  }

  private loadPointOfSaleContext(): void {
    const selected = this.readSelectedPointOfSale();
    if (selected?.codigo === this.codPuntoVenta) {
      this.descripcionPuntoVenta = selected.descripcion || this.codPuntoVenta;
      return;
    }
    this.descripcionPuntoVenta = selected?.descripcion || this.codPuntoVenta;
  }

  private readSelectedPointOfSale(): SelectedPointOfSale | null {
    const raw = sessionStorage.getItem('selectedPointOfSale');
    if (!raw) {
      return null;
    }
    try {
      return JSON.parse(raw) as SelectedPointOfSale;
    } catch {
      return null;
    }
  }

  private rebuildKpis(): void {
    const totalAreas = this.ubicaciones.length;
    const totalMesas = this.ubicaciones.reduce((sum, item) => sum + Number(item.MPV09_TotMesas || 0), 0);
    const mesasOcupadas = Math.min(totalMesas, Math.round(totalMesas * 0.32));
    const mesasLibres = Math.max(totalMesas - mesasOcupadas, 0);
    const pedidosActivos = Math.max(0, Math.round(mesasOcupadas * 1.4));
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
        detail: 'simulado temporal',
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
        detail: 'demo operativo',
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

  private obtenerEstadoDemo(numero: number): MesaEstado {
    if (numero % 17 === 0) {
      return 'LIMPIEZA';
    }
    if (numero % 11 === 0) {
      return 'RESERVADA';
    }
    if (numero % 7 === 0) {
      return 'CUENTA';
    }
    if (numero % 3 === 0) {
      return 'OCUPADA';
    }
    return 'LIBRE';
  }

  private obtenerPersonasDemo(numero: number): number {
    return (numero % 5) + 1;
  }

  private obtenerHoraReservaDemo(numero: number): string {
    const hour = 6 + (numero % 4);
    return `${hour}:00 PM`;
  }
}
