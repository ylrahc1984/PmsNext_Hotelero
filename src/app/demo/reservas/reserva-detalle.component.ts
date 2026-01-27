import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';

import { SharedModule } from 'src/app/theme/shared/shared.module';
import { ReservasService } from './reservas.service';

@Component({
  selector: 'app-reserva-detalle',
  standalone: true,
  imports: [CommonModule, SharedModule, RouterModule],
  templateUrl: './reserva-detalle.component.html',
  styleUrls: ['./reserva-detalle.component.scss']
})
export class ReservaDetalleComponent {
  reservaId: number | null = null;

  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private reservasService = inject(ReservasService);

  constructor() {
    const paramId = this.route.snapshot.paramMap.get('id');
    this.reservaId = paramId ? Number(paramId) : null;

    if (this.reservaId) {
      this.reservasService.getReservaByCod(this.reservaId.toString()).subscribe({
        next: (res) => {
          if (!res) {
            this.router.navigate(['/operaciones/reservas']);
          }
        },
        error: () => {
          this.router.navigate(['/operaciones/reservas']);
        }
      });
    }
  }
}
