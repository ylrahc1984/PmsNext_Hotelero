import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';

import { AuthService } from 'src/app/core/services/auth.service';
import { PuntoVentaUsuario } from '../models/restaurant-operacion.models';
import { RestaurantPuntoVentaService } from './restaurant-punto-venta.service';
import { SharedModule } from 'src/app/theme/shared/shared.module';

@Component({
  selector: 'app-restaurant-punto-venta',
  standalone: true,
  imports: [CommonModule, SharedModule],
  templateUrl: './restaurant-punto-venta.component.html',
  styleUrls: ['./restaurant-punto-venta.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RestaurantPuntoVentaComponent implements OnInit {
  private readonly service = inject(RestaurantPuntoVentaService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);

  puntosVenta: PuntoVentaUsuario[] = [];
  isLoading = false;
  errorMessage = '';

  ngOnInit(): void {
    this.cargarPuntosVenta();
  }

  cargarPuntosVenta(): void {
    this.isLoading = true;
    this.errorMessage = '';
    this.service
      .obtenerPuntosVentaPorUsuario(this.usuarioActual)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (items) => {
          this.puntosVenta = items;
          this.isLoading = false;
          this.cdr.markForCheck();
        },
        error: (error) => {
          console.error('Error al cargar puntos de venta del usuario:', error);
          this.puntosVenta = [];
          this.isLoading = false;
          this.errorMessage = 'No se pudieron cargar los puntos de venta asignados.';
          this.cdr.markForCheck();
        }
      });
  }

  seleccionarPuntoVenta(item: PuntoVentaUsuario): void {
    sessionStorage.setItem(
      'selectedPointOfSale',
      JSON.stringify({
        codigo: item.MPV12_PntVenta,
        descripcion: item.MPV12_DesPntventa
      })
    );

    this.router.navigate(['/restaurant/dashboard', item.MPV12_PntVenta]);
  }

  getIconClass(item: PuntoVentaUsuario): string {
    const value = `${item.MPV12_DesPntventa || ''} ${item.MPV12_PntVenta || ''}`.toUpperCase();
    if (value.includes('RESTAURANT') || value.includes('RESTAURANTE')) {
      return 'icon-shopping-cart';
    }
    if (value.includes('BAR')) {
      return 'icon-droplet';
    }
    if (value.includes('SPA')) {
      return 'icon-heart';
    }
    if (value.includes('TOUR')) {
      return 'icon-map';
    }
    if (value.includes('FRONT')) {
      return 'icon-briefcase';
    }
    return 'icon-shopping-bag';
  }

  getTipoPuntoVenta(item: PuntoVentaUsuario): string {
    const value = `${item.MPV12_DesPntventa || ''} ${item.MPV12_PntVenta || ''}`.toUpperCase();
    if (value.includes('BAR')) {
      return 'Bar';
    }
    if (value.includes('SPA')) {
      return 'Spa';
    }
    if (value.includes('TOUR')) {
      return 'Tour Desk';
    }
    if (value.includes('FRONT')) {
      return 'Front Desk';
    }
    if (value.includes('RESTAURANT') || value.includes('RESTAURANTE')) {
      return 'Restaurante';
    }
    return 'Punto de Venta';
  }

  trackByPuntoVenta(_: number, item: PuntoVentaUsuario): string {
    return item.MPV12_PntVenta;
  }

  private get usuarioActual(): string {
    const user = this.auth.getCurrentUser();
    return (user?.usuario || user?.Usuario || user?.MPV12_CodUsuario || 'CHARLY').toString().trim() || 'CHARLY';
  }
}
