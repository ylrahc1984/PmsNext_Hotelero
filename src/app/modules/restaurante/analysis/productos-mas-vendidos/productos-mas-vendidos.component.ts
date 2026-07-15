import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CurrencyPipe } from '@angular/common';
import { AnalysisPageHeaderComponent } from '../components/analysis-page-header.component';

interface ProductoVendido {
  producto: string;
  categoria: string;
  cantidad: number;
  monto: number;
  participacion: number;
}

@Component({
  selector: 'app-productos-mas-vendidos',
  standalone: true,
  imports: [FormsModule, CurrencyPipe, AnalysisPageHeaderComponent],
  templateUrl: './productos-mas-vendidos.component.html',
  styleUrl: './productos-mas-vendidos.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProductosMasVendidosComponent {
  readonly fechaInicial = signal('2026-07-01');
  readonly fechaFinal = signal('2026-07-14');
  readonly puntoVenta = signal('');
  readonly categoria = signal('');
  readonly mesero = signal('');

  readonly productos = signal<ProductoVendido[]>([
    { producto: 'Hamburguesa Premium', categoria: 'Platos fuertes', cantidad: 235, monto: 4350, participacion: 18 },
    { producto: 'Pizza Mediterránea', categoria: 'Pizzas', cantidad: 198, monto: 3860, participacion: 16 },
    { producto: 'Filete de Salmón', categoria: 'Platos fuertes', cantidad: 142, monto: 3550, participacion: 14 },
    { producto: 'Cóctel de la Casa', categoria: 'Bebidas', cantidad: 286, monto: 3146, participacion: 13 },
    { producto: 'Pasta Alfredo', categoria: 'Pastas', cantidad: 174, monto: 2784, participacion: 11 },
    { producto: 'Ceviche Tropical', categoria: 'Entradas', cantidad: 151, monto: 2416, participacion: 10 },
    { producto: 'Ensalada César', categoria: 'Ensaladas', cantidad: 126, monto: 1764, participacion: 7 },
    { producto: 'Tiramisú Artesanal', categoria: 'Postres', cantidad: 118, monto: 1298, participacion: 5 },
    { producto: 'Café Especial', categoria: 'Bebidas', cantidad: 214, monto: 1070, participacion: 4 },
    { producto: 'Pan de Ajo', categoria: 'Entradas', cantidad: 132, monto: 528, participacion: 2 }
  ]);

  buscar(): void {
    // Primera etapa: la interacción queda preparada para conectar la fuente de datos.
  }

  limpiar(): void {
    this.fechaInicial.set('');
    this.fechaFinal.set('');
    this.puntoVenta.set('');
    this.categoria.set('');
    this.mesero.set('');
  }
}
