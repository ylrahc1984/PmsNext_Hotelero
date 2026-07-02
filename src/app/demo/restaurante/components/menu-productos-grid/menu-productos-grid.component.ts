import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { ProductoMenu } from '../../interfaces/menu-restaurante.interface';

@Component({
  selector: 'app-menu-productos-grid',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './menu-productos-grid.component.html',
  styleUrls: ['./menu-productos-grid.component.scss']
})
export class MenuProductosGridComponent {
  @Input() productos: ProductoMenu[] = [];
  @Output() agregar = new EventEmitter<ProductoMenu>();

  trackProducto(_: number, producto: ProductoMenu): string {
    return producto.MPV05_CodProducto;
  }

  precio(producto: ProductoMenu): number {
    return Number(producto.MPV05_PrecioTotal ?? 0);
  }
}
