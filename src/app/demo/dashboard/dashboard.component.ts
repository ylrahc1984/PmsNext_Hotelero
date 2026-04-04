import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { SharedModule } from 'src/app/theme/shared/shared.module';
import { AuthService } from 'src/app/core/services/auth.service';
import { ReservasService } from '../reservas/services/reservas.service';
import { OrdenesService } from '../ordenes/ordenes.service';
import { DashboardService } from './dashboard.service';
import { Weather } from './models/weather.model';
import { WelcomeCardComponent } from './components/welcome-card/welcome-card.component';
import { WeatherCardComponent } from './components/weather-card/weather-card.component';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, SharedModule, WelcomeCardComponent, WeatherCardComponent],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DashboardComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  private readonly authService = inject(AuthService);
  readonly defaultCity = 'San Jose';
  readonly userName = this.resolveUserName();

  reservasDia           = 0;
  reservasPendientes    = 0;
  ordenesActivas        = 0;
  ingresosEstimados     = 0;
  weather               : Weather | null = null;
  loading               = false;
  weatherError          : string | null = null;

  sales = [
    {
      title         : 'Reservas del Dia',
      amount        : '0',
      percentage    : '+0%',
      progress      : 0,
      progress_bg   : 'bg-c-blue',
      icon          : 'icon-calendar',
      design        : 'col-xl-3 col-md-6'
    },
    {
      title         : 'Reservas Pendientes',
      amount        : '0',
      percentage    : '0%',
      progress      : 0,
      progress_bg   : 'bg-c-green',
      icon          : 'icon-clock',
      design        : 'col-xl-3 col-md-6'
    },
    {
      title         : 'Ordenes Activas',
      amount        : '0',
      percentage    : '0%',
      progress      : 0,
      progress_bg   : 'bg-c-yellow',
      icon          : 'icon-clipboard',
      design        : 'col-xl-3 col-md-6'
    },
    {
      title         : 'Ingresos Estimados',
      amount        : 'CRC 0',
      percentage    : '+0%',
      progress      : 0,
      progress_bg   : 'bg-c-red',
      icon          : 'icon-dollar-sign',
      design        : 'col-xl-3 col-md-6'
    }
  ];

  private reservasService = inject(ReservasService);
  private ordenesService = inject(OrdenesService);
  private dashboardService = inject(DashboardService);

  ngOnInit() {
    this.calculateMetrics();
    this.bindWeatherState();
    this.dashboardService.loadWeather(this.defaultCity);
  }

  calculateMetrics() {
    // Usar la API correctamente y procesar los datos en el callback
    this.reservasService.getReservas(1, 100).subscribe({
      next: (res) => {
        const reservas = res.data;
        const today = new Date().toISOString().split('T')[0];
        this.reservasDia = reservas.filter(r => r.PRV01_FecCreacion?.split('T')[0] === today).length;
        this.reservasPendientes = reservas.filter(r => r.PRV01_Estado === 'Pendiente' || r.PRV01_Estado === 'Confirmada').length;
        this.ingresosEstimados = reservas.filter(r => r.PRV01_Estado !== 'Cancelada').reduce((sum, r) => sum + (r.PRV01_TotalRsv || 0), 0);
        this.sales[0].amount = this.reservasDia.toString();
        this.sales[1].amount = this.reservasPendientes.toString();
        this.sales[3].amount = `CRC ${this.ingresosEstimados.toLocaleString()}`;
      },
      error: () => {
        this.reservasDia = 0;
        this.reservasPendientes = 0;
        this.ingresosEstimados = 0;
        this.sales[0].amount = '0';
        this.sales[1].amount = '0';
        this.sales[3].amount = 'CRC 0';
      }
    });
    // Ordenes activas (mock local)
    const ordenes = this.ordenesService.getOrdenes();
    this.ordenesActivas = ordenes.filter(o => o.estado !== 'COM' && o.estado !== 'CAN').length;
    this.sales[2].amount = this.ordenesActivas.toString();
  }

  private bindWeatherState(): void {
    this.dashboardService.weather$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((weather) => {
      this.weather = weather;
    });

    this.dashboardService.loading$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((loading) => {
      this.loading = loading;
    });

    this.dashboardService.error$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((error) => {
      this.weatherError = error;
    });
  }

  private resolveUserName(): string {
    const user = this.authService.getCurrentUser();
    return String(user?.nombreUsu ?? user?.usuario ?? 'Usuario').trim() || 'Usuario';
  }
}
