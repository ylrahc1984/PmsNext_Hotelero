import { Injectable } from '@angular/core';

import { EscPosReceiptComposer } from 'src/app/core/printing/esc-pos-receipt.composer';
import {
  CargoColaborador,
  CargoColaboradorDetalle
} from '../services/restaurant-collaborator-charge.service';

export interface RestaurantCollaboratorChargePrintData {
  empresa: {
    nombre: string;
    ruc?: string;
    direccion?: string;
    telefono?: string;
  };
  encabezado: CargoColaborador;
  detalles: CargoColaboradorDetalle[];
  fechaImpresion: Date;
}

@Injectable({
  providedIn: 'root'
})
export class RestaurantCollaboratorChargePrintBuilder {
  private readonly paperWidth = 40;
  private readonly printedAmount = 0;

  build(data: RestaurantCollaboratorChargePrintData): string[] {
    const receipt = new EscPosReceiptComposer({ width: this.paperWidth });
    const header = data.encabezado;
    const currency = header.PPV10_Moneda || data.detalles[0]?.PPV11_Moneda || '';
    const operation = [header.PPV10_TipOpe, header.PPV10_NumOpe].filter(Boolean).join(' ');
    const order = [
      header.PPV10_TipoNDP,
      header.PPV10_SerieNDP,
      header.PPV10_NumeroNDP
    ].filter(Boolean).join('-');
    const discount = data.detalles.reduce(
      (total, item) => total + receipt.number(item.PPV11_Descuento),
      0
    );

    receipt
      .initialize()
      .align('center')
      .bold(true)
      .size(1, 2)
      .wrapped(data.empresa.nombre || 'RESTAURANTE')
      .size(1)
      .bold(false);

    if (data.empresa.ruc) receipt.wrapped(`CEDULA: ${data.empresa.ruc}`);
    if (data.empresa.direccion) receipt.wrapped(data.empresa.direccion);
    if (data.empresa.telefono) receipt.wrapped(`TEL: ${data.empresa.telefono}`);

    receipt
      .feed()
      .separator('=')
      .bold(true)
      .size(1, 2)
      .line('COMPROBANTE DE CONSUMO')
      .size(1)
      .line('CARGO A COLABORADOR')
      .bold(false)
      .wrapped(operation)
      .separator('=')
      .align('left')
      .columns('Fecha', this.documentDate(header))
      .columns('Punto de venta', header.PPV10_PntVenta || '-')
      .columns('Vendedor', header.PPV10_CodVendedor || '-');

    if (order) receipt.columns('Nota pedido', order);

    receipt
      .separator('-')
      .bold(true)
      .line('COLABORADOR')
      .bold(false)
      .wrapped(header.PPV10_NomColabora || 'Colaborador no indicado')
      .columns('Codigo', header.PPV10_CodCola || '-')
      .columns('Cedula', header.PPV10_RucCola || '-');

    if (header.PPV10_Direccion) {
      receipt.wrapped(`Observacion: ${header.PPV10_Direccion}`);
    }

    receipt
      .separator('=')
      .bold(true)
      .line('DETALLE DE CONSUMO')
      .columns('Descripcion', 'Precio')
      .bold(false)
      .separator('-');

    data.detalles.forEach((item, index) => {
      this.appendDetail(receipt, item, currency, index);
    });

    receipt.separator('=');

    if (discount > 0) {
      receipt.columns('Descuento', receipt.money(this.printedAmount, currency));
    }

    receipt
      .align('center')
      .bold(true)
      .size(2)
      .line('TOTAL')
      .line(receipt.money(this.printedAmount, currency))
      .size(1)
      .bold(false)
      .separator('=')
      .wrapped('Consumo cargado a la cuenta del colaborador.')
      .feed(2)
      .line('________________________________')
      .line('Firma del colaborador')
      .feed()
      .wrapped(`Registrado por: ${header.PPV10_Operador || '-'}`)
      .wrapped(`Impreso: ${this.formatDateTime(data.fechaImpresion)}`)
      .feed(4)
      .cut();

    return receipt.build();
  }

  private appendDetail(
    receipt: EscPosReceiptComposer,
    item: CargoColaboradorDetalle,
    currency: string,
    index: number
  ): void {
    const quantity = receipt.number(item.PPV11_Cantidad);
    const quantityLabel = Number.isInteger(quantity)
      ? quantity.toFixed(0)
      : quantity.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
    const product = item.PPV11_NomProducto || item.PPV11_CodProducto || `Producto ${index + 1}`;
    const lineCurrency = item.PPV11_Moneda || currency;

    receipt.wrappedColumns(
      `${quantityLabel} x ${product}`,
      receipt.money(this.printedAmount, lineCurrency)
    );
  }

  private documentDate(header: CargoColaborador): string {
    const date = this.formatApiDate(header.PPV10_Fecha);
    return [date, header.PPV10_Hora].filter(Boolean).join(' ') || '-';
  }

  private formatApiDate(value: string): string {
    const normalized = (value || '').trim().split('T')[0].split(' ')[0];
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(normalized);
    return match ? `${match[3]}/${match[2]}/${match[1]}` : normalized;
  }

  private formatDateTime(value: Date): string {
    const day = String(value.getDate()).padStart(2, '0');
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const hours = String(value.getHours()).padStart(2, '0');
    const minutes = String(value.getMinutes()).padStart(2, '0');
    return `${day}/${month}/${value.getFullYear()} ${hours}:${minutes}`;
  }
}
