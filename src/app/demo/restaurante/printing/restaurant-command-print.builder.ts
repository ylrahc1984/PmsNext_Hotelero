import { Injectable } from '@angular/core';

import { EscPosReceiptComposer } from 'src/app/core/printing/esc-pos-receipt.composer';
import {
  NotaPedidoRestauranteComandaDetalle,
  NotaPedidoRestauranteDocumento
} from '../services/nota-pedido-restaurante.service';

export type RestaurantCommandDestination = 'COCINA' | 'BAR';
export type RestaurantCommandDocumentType = 'ORIGINAL' | 'REIMPRESION';

export interface RestaurantCommandPrintData {
  destino        : RestaurantCommandDestination;
  tipoDocumento  : RestaurantCommandDocumentType;
  documento      : NotaPedidoRestauranteDocumento;
  puntoVenta     : string;
  salon          : string;
  mesa           : string;
  mesero         : string;
  personas       ?: number;
  fechaPedido    : string;
  horaPedido     ?: string;
  detalles       : NotaPedidoRestauranteComandaDetalle[];
  fechaImpresion : Date;
}

@Injectable({
  providedIn: 'root'
})
export class RestaurantCommandPrintBuilder {
  private readonly paperWidth = 40;

  build(data: RestaurantCommandPrintData): string[] {
    const receipt = new EscPosReceiptComposer({ width: this.paperWidth });
    const seller = this.firstText(data.detalles.map((item) => item.ppV07_CodVendedor));
    const waiter = seller || data.mesero || '-';
    const generalComments = this.uniqueTexts(
      data.detalles.map((item) => item.ppV07_Comentario)
    );

    receipt
      .initialize()
      .align('center')
      .bold(true)
      .line(`COMANDA ${data.destino}`);

    if (data.tipoDocumento === 'REIMPRESION') {
      receipt
        .size(2)
        .line('REIMPRESION')
        .size(1)
        .line('*** COPIA ***');
    } else {
      receipt.line('NUEVO PEDIDO');
    }

    receipt
      .bold(false)
      .separator('=')
      .size(2)
      .line(`MESA ${data.mesa || '-'}`)
      .size(1)
      .align('left')
      .columns('Nota', this.documentNumber(data.documento))
      .columns('Fecha', `${data.fechaPedido}${data.horaPedido ? ` ${data.horaPedido}` : ''}`)
      .columns('Punto venta', data.puntoVenta || '-')
      .columns('Salon', data.salon || '-')
      .columns('Mesero', waiter);

    if (data.personas && data.personas > 0) {
      receipt.columns('Personas', data.personas);
    }

    receipt.separator('=');

    data.detalles.forEach((item, index) => {
      if (index > 0) receipt.separator('-');
      this.appendItem(receipt, item, index);
    });

    if (generalComments.length) {
      receipt
        .separator('=')
        .bold(true)
        .line('OBSERVACION GENERAL')
        .bold(false);
      generalComments.forEach((comment) => receipt.wrapped(comment));
    }

    receipt
      .separator('=')
      .align('center')
      .bold(data.tipoDocumento === 'REIMPRESION');

    if (data.tipoDocumento === 'REIMPRESION') {
      receipt
        .line('DOCUMENTO REIMPRESO')
        .line('NO ES EL ORIGINAL');
    }

    receipt
      .bold(false)
      .wrapped(`IMPRESO: ${this.formatDateTime(data.fechaImpresion)}`)
      .feed(4)
      .cut();

    return receipt.build();
  }

  private appendItem(
    receipt: EscPosReceiptComposer,
    item: NotaPedidoRestauranteComandaDetalle,
    index: number
  ): void {
    const quantity = receipt.number(item.ppV08_Cantidad);
    const quantityLabel = Number.isInteger(quantity)
      ? quantity.toFixed(0)
      : quantity.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
    const product = item.ppV08_NomProducto || `PRODUCTO ${index + 1}`;
    const time = (item.ppV08_Tiempo ?? '').toString().trim();

    receipt
      .bold(true)
      .wrapped(`${quantityLabel} x ${product}`)
      .bold(false);

    if (time) {
      receipt.wrapped(`  TIEMPO: ${time}`);
    }

    const itemComment = (item.ppV08_Comentario || '').trim();
    if (itemComment) {
      receipt.bold(true).wrapped(`  NOTA: ${itemComment}`).bold(false);
    }
  }

  private documentNumber(documento: NotaPedidoRestauranteDocumento): string {
    return [documento.TIPO, documento.SERIE, documento.NUMERODOC]
      .filter(Boolean)
      .join('-') || '-';
  }

  private firstText(values: Array<string | null | undefined>): string {
    return values
      .map((value) => (value || '').trim())
      .find(Boolean) || '';
  }

  private uniqueTexts(values: Array<string | null | undefined>): string[] {
    return Array.from(
      new Set(
        values
          .map((value) => (value || '').trim())
          .filter(Boolean)
      )
    );
  }

  private formatDateTime(value: Date): string {
    const day = String(value.getDate()).padStart(2, '0');
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const hours = String(value.getHours()).padStart(2, '0');
    const minutes = String(value.getMinutes()).padStart(2, '0');
    return `${day}/${month}/${value.getFullYear()} ${hours}:${minutes}`;
  }
}
