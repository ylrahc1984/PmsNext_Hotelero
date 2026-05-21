import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { catchError, of, switchMap } from 'rxjs';
import { LiquidacionComision } from '../../interfaces/liquidacion-comision.interface';
import { LiquidacionComisionService } from '../../services/liquidacion-comision.service';
import { EstadoBadgeComponent } from '../../shared/components/estado-badge.component';
import { readNumber, readText } from '../../shared/models/comisiones-normalizers';

@Component({
  selector: 'app-liquidacion-detalle',
  standalone: true,
  imports: [CommonModule, RouterLink, EstadoBadgeComponent],
  templateUrl: './liquidacion-detalle.component.html',
  styleUrl: './liquidacion-detalle.component.scss'
})
export class LiquidacionDetalleComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly service = inject(LiquidacionComisionService);

  readonly liquidacion = signal<LiquidacionComision | null>(null);

  ngOnInit(): void {
    this.route.paramMap
      .pipe(
        switchMap((params) => this.service.obtener(Number(params.get('id')))),
        catchError(() => of(null))
      )
      .subscribe((data) => this.liquidacion.set(data));
  }

  text(record: Record<string, unknown> | null | undefined, keys: string[], fallback = 'N/D'): string {
    return readText(record, keys, fallback);
  }

  money(record: Record<string, unknown> | null | undefined, keys: string[]): string {
    return new Intl.NumberFormat('es-CR', { style: 'currency', currency: 'USD' }).format(readNumber(record, keys));
  }
}
