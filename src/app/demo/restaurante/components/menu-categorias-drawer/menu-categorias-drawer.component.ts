import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { catchError, finalize, of } from 'rxjs';
import { CategoriaVisible, ProductoMenu } from '../../interfaces/menu-restaurante.interface';
import { MenuRestauranteService } from '../../services/menu-restaurante.service';
import { MenuProductosGridComponent } from '../menu-productos-grid/menu-productos-grid.component';

@Component({
  selector: 'app-menu-categorias-drawer',
  standalone: true,
  imports: [CommonModule, FormsModule, MenuProductosGridComponent],
  templateUrl: './menu-categorias-drawer.component.html',
  styleUrls: ['./menu-categorias-drawer.component.scss']
})
export class MenuCategoriasDrawerComponent implements OnChanges {
  private readonly service = inject(MenuRestauranteService);

  @Input() open = false;
  @Input() lista = 'LSTLG';
  @Input() mesa = '';
  @Input() salon = '';
  @Output() close = new EventEmitter<void>();

  readonly categorias = signal<CategoriaVisible[]>([]);
  readonly categoriaActiva = signal<CategoriaVisible | null>(null);
  readonly productos = signal<ProductoMenu[]>([]);
  readonly loadingCategorias = signal(false);
  readonly loadingProductos = signal(false);
  readonly error = signal('');

  busqueda = '';

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['open'] && this.open) {
      this.cargarCategorias();
    }
  }

  seleccionarCategoria(categoria: CategoriaVisible): void {
    this.categoriaActiva.set(categoria);
    this.productos.set([]);
    this.loadingProductos.set(true);
    this.error.set('');

    this.service
      .obtenerProductosPorCategoria(this.lista, categoria.MPV00_CodCategoria)
      .pipe(
        catchError(() => {
          this.error.set('No fue posible consultar los productos.');
          return of([]);
        }),
        finalize(() => this.loadingProductos.set(false))
      )
      .subscribe((productos) => this.productos.set(productos));
  }

  productosFiltrados(): ProductoMenu[] {
    const term = this.busqueda.trim().toLowerCase();
    if (!term) {
      return this.productos();
    }
    return this.productos().filter((producto) =>
      `${producto.MPV05_DesProducto ?? ''} ${producto.MPV05_NomCorto ?? ''}`.toLowerCase().includes(term)
    );
  }

  iconoCategoria(nombre: string): string {
    const value = this.normalizar(nombre);
    const icons: Record<string, string> = {
      AGUAS: 'icon-droplet',
      BEBIDAS: 'icon-coffee',
      VINOS: 'icon-award',
      POSTRES: 'icon-gift',
      CARNES: 'icon-slack',
      MARISCOS: 'icon-anchor',
      DESAYUNOS: 'icon-sun',
      PASTAS: 'icon-disc',
      COCTELES: 'icon-coffee'
    };
    return icons[value] ?? 'icon-menu';
  }

  trackCategoria(_: number, categoria: CategoriaVisible): string {
    return categoria.MPV00_CodCategoria;
  }

  cerrar(): void {
    this.close.emit();
  }

  private cargarCategorias(): void {
    this.loadingCategorias.set(true);
    this.error.set('');

    this.service
      .obtenerCategoriasVisibles(this.lista)
      .pipe(
        catchError(() => {
          this.error.set('No fue posible consultar las categorias.');
          return of([]);
        }),
        finalize(() => this.loadingCategorias.set(false))
      )
      .subscribe((categorias) => {
        this.categorias.set(categorias);
        if (categorias.length && !this.categoriaActiva()) {
          this.seleccionarCategoria(categorias[0]);
        }
      });
  }

  private normalizar(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toUpperCase();
  }
}
