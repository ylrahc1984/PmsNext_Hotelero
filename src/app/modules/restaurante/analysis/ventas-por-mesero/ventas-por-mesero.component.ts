import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AnalysisPageHeaderComponent } from '../components/analysis-page-header.component';

interface VentaMesero {
  mesero: string;
  facturas: number;
  clientes: number;
  subtotal: number;
  impuestos: number;
  total: number;
  ticketPromedio: number;
}

@Component({
  selector: 'app-ventas-por-mesero',
  standalone: true,
  imports: [CurrencyPipe, FormsModule, AnalysisPageHeaderComponent],
  templateUrl: './ventas-por-mesero.component.html',
  styleUrl: './ventas-por-mesero.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class VentasPorMeseroComponent {
  readonly fechaInicial = signal('2026-07-01');
  readonly fechaFinal = signal('2026-07-14');
  readonly puntoVenta = signal('');
  readonly mesero = signal('');
  readonly estado = signal('activo');

  readonly ventas = signal<VentaMesero[]>([
    { mesero: 'Carlos Pérez', facturas: 58, clientes: 122, subtotal: 4500, impuestos: 585, total: 5085, ticketPromedio: 87.67 },
    { mesero: 'María Rodríguez', facturas: 54, clientes: 116, subtotal: 4210, impuestos: 547.3, total: 4757.3, ticketPromedio: 88.1 },
    { mesero: 'Andrés Vargas', facturas: 49, clientes: 103, subtotal: 3890, impuestos: 505.7, total: 4395.7, ticketPromedio: 89.71 },
    { mesero: 'Sofía Jiménez', facturas: 46, clientes: 98, subtotal: 3540, impuestos: 460.2, total: 4000.2, ticketPromedio: 86.96 },
    { mesero: 'Daniel Mora', facturas: 43, clientes: 91, subtotal: 3275, impuestos: 425.75, total: 3700.75, ticketPromedio: 86.06 },
    { mesero: 'Valeria Castro', facturas: 39, clientes: 84, subtotal: 3050, impuestos: 396.5, total: 3446.5, ticketPromedio: 88.37 },
    { mesero: 'José Ramírez', facturas: 37, clientes: 78, subtotal: 2810, impuestos: 365.3, total: 3175.3, ticketPromedio: 85.82 },
    { mesero: 'Laura Sánchez', facturas: 34, clientes: 72, subtotal: 2590, impuestos: 336.7, total: 2926.7, ticketPromedio: 86.08 },
    { mesero: 'Miguel Herrera', facturas: 31, clientes: 65, subtotal: 2310, impuestos: 300.3, total: 2610.3, ticketPromedio: 84.2 },
    { mesero: 'Natalia Gómez', facturas: 28, clientes: 59, subtotal: 2090, impuestos: 271.7, total: 2361.7, ticketPromedio: 84.35 }
  ]);

  buscar(): void {}

  limpiar(): void {
    this.fechaInicial.set(''); this.fechaFinal.set(''); this.puntoVenta.set(''); this.mesero.set(''); this.estado.set('');
  }
}
