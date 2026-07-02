import { computed, Injectable, signal } from '@angular/core';
import { RestaurantePedidoItem } from '../interfaces/restaurante-pedido-item.interface';

@Injectable({
  providedIn: 'root'
})
export class RestaurantCartStore {
  private readonly _items = signal<RestaurantePedidoItem[]>([]);
  private secuencia = 1;

  readonly items = this._items.asReadonly();

  readonly subtotalPedido = computed(() => this.items().reduce((sum, item) => sum + item.total, 0));
  readonly totalPedido = computed(() => this.subtotalPedido() + this.totalImpuestos());
  readonly totalProductos = computed(() => this.items().reduce((sum, item) => sum + item.cantidad, 0));
  readonly totalImpuestos = computed(() =>
    this.items().reduce((sum, item) => sum + Number(item.impuesto ?? 0) * item.cantidad, 0)
  );

  agregarItem(item: RestaurantePedidoItem): void {
    const nextItem = this.recalcularItem({
      ...item,
      orden: this.secuencia++
    });
    this._items.update((items) => [...items, nextItem]);
  }

  eliminarItem(orden: number): void {
    this._items.update((items) => items.filter((item) => item.orden !== orden));
  }

  incrementarCantidad(orden: number): void {
    this._items.update((items) =>
      items.map((item) => (item.orden === orden ? this.recalcularItem({ ...item, cantidad: item.cantidad + 1 }) : item))
    );
  }

  disminuirCantidad(orden: number): void {
    const current = this._items().find((item) => item.orden === orden);
    if (current && current.cantidad <= 1) {
      this.eliminarItem(orden);
      return;
    }

    this._items.update((items) =>
      items.map((item) => (item.orden === orden ? this.recalcularItem({ ...item, cantidad: item.cantidad - 1 }) : item))
    );
  }

  actualizarComentario(orden: number, comentario: string): void {
    this._items.update((items) => items.map((item) => (item.orden === orden ? { ...item, comentario } : item)));
  }

  limpiar(): void {
    this._items.set([]);
    this.secuencia = 1;
  }

  private recalcularItem(item: RestaurantePedidoItem): RestaurantePedidoItem {
    const cantidad = Math.max(1, Number(item.cantidad || 1));
    const precio = Number(item.precio || 0);
    return {
      ...item,
      cantidad,
      precio,
      total: cantidad * precio
    };
  }
}
