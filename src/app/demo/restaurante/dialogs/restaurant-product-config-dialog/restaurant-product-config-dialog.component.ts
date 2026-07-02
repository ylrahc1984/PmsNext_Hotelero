import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ProductoMenu } from '../../interfaces/producto-menu.interface';
import { RestaurantePedidoItem } from '../../interfaces/restaurante-pedido-item.interface';

interface ProductConfigContext {
  pntVenta    : string;
  codMozo     : string;
  pax         : number;
  operador    : string;
}

@Component({
  selector: 'app-restaurant-product-config-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './restaurant-product-config-dialog.component.html',
  styleUrls: ['./restaurant-product-config-dialog.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RestaurantProductConfigDialogComponent {
  @Input({ required: true }) producto!: ProductoMenu;
  @Input() categoriaNombre = '';
  @Input() context: ProductConfigContext = {
    pntVenta    : '',
    codMozo     : '',
    pax         : 10,
    operador    : ''
  };

  @Output() cancelado = new EventEmitter<void>();
  @Output() confirmado = new EventEmitter<RestaurantePedidoItem>();

  cantidad       = 1;
  puestoMesa     = 1;
  tiempo         = 2;
  comentario     = '';
  submitted      = false;

  readonly tiempos = [
    { value: 1, title: 'Entrada' },
    { value: 2, title: 'Plato Fuerte' },
    { value: 3, title: 'Postre' }
  ];

  puestosMesa(): number[] {
    return Array.from({ length: 10 }, (_, index) => index + 1);
  }

  incrementar(): void {
    this.cantidad += 1;
  }

  disminuir(): void {
    this.cantidad = Math.max(1, this.cantidad - 1);
  }

  seleccionarPuesto(puesto: number): void {
    this.puestoMesa = puesto;
  }

  seleccionarTiempo(tiempo: number): void {
    this.tiempo = tiempo;
  }

  confirmar(): void {
    this.submitted = true;
    if (!this.cantidad || !this.puestoMesa || !this.tiempo) {
      return;
    }

    const fecha = new Date();
    const precio = Number(this.producto.MPV05_PrecioTotal ?? 0);
    const item: RestaurantePedidoItem = {
      codRsv          : '',
      numHab          : '',
      pntVenta        : this.context.pntVenta,
      fecha           ,
      hora            : fecha.toLocaleTimeString('es-CR', { hour: '2-digit', minute: '2-digit', hour12: false }),
      grupo           : this.producto.MPV01_CodGrupo,
      categoria       : this.producto.MPV01_CodCategoria,
      codConsumo      : this.producto.MPV05_CodProducto,
      nomConsumo      : this.producto.MPV05_DesProducto,
      cantidad        : this.cantidad,
      precio          ,
      total           : this.cantidad * precio,
      moneda          : this.producto.MPV05_Moneda,
      tipNPedido      : '',
      numNPedido      : '',
      codMozo         : this.context.codMozo,
      pax             : this.puestoMesa,
      modificar       : '',
      tiempo          : this.tiempo,
      incluido        : precio === 0 ? 1 : 0,
      exonerado       : 0,
      orden           : 0,
      comentario      : this.comentario.trim(),
      operador        : this.context.operador,
      puestoMesa      : this.puestoMesa,
      impuesto        : Number(this.producto.MPV05_Impuesto ?? 0)
    };

    this.confirmado.emit(item);
  }

  cancelar(): void {
    this.cancelado.emit();
  }
}
