import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, Input, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { DashboardService } from '../../dashboard.service';
import { Weather } from '../../models/weather.model';

@Component({
  selector: 'app-weather-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './weather-card.component.html',
  styleUrls: ['./weather-card.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class WeatherCardComponent implements OnInit {
  private readonly dashboardService = inject(DashboardService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);

  @Input() weather: Weather | null = null;
  @Input() loading = false;
  @Input() error: string | null = null;

  readonly cities = ['San Jose', 'Puntarenas', 'Monteverde', 'Liberia', 'Cartago'];
  selectedCity = 'San Jose';

  ngOnInit(): void {
    this.dashboardService.city$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((city) => {
      this.selectedCity = city || 'San Jose';
      this.cdr.markForCheck();
    });
  }

  changeCity(event: Event): void {
    const target = event.target as HTMLSelectElement | null;
    const nextCity = target?.value?.trim() || 'San Jose';
    if (nextCity === this.selectedCity) {
      return;
    }
    this.selectedCity = nextCity;
    this.dashboardService.changeCity(nextCity);
  }

  reload(): void {
    this.dashboardService.reload();
  }
}
