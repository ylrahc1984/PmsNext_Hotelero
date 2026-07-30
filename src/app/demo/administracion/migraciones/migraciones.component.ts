import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { SharedModule } from 'src/app/theme/shared/shared.module';

@Component({
  selector: 'app-migraciones',
  standalone: true,
  imports: [CommonModule, SharedModule],
  templateUrl: './migraciones.component.html',
  styleUrl: './migraciones.component.scss'
})
export class MigracionesComponent {
  private readonly router = inject(Router);

  openReservationMigration(): void {
    void this.router.navigate(['/administracion/configuracion/migraciones/reservas']);
  }
}

