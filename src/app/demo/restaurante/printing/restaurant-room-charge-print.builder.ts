import { Injectable } from '@angular/core';

import { EscPosReceiptComposer } from 'src/app/core/printing/esc-pos-receipt.composer';
import {
  RoomChargeLookupDetail,
  RoomChargeLookupHeader
} from 'src/app/modules/front-desk/pages/room-stay-management/services/room-stay-management.service';

export interface RestaurantRoomChargePrintData {
  empresa: {
    nombre: string;
    ruc?: string;
    direccion?: string;
    telefono?: string;
  };
  encabezado: RoomChargeLookupHeader;
  detalles: RoomChargeLookupDetail[];
  tipoDocumento: RestaurantRoomChargeDocumentType;
  fechaImpresion: Date;
}

export type RestaurantRoomChargeDocumentType = 'ORIGINAL' | 'REIMPRESION';

@Injectable({
  providedIn: 'root'
})
export class RestaurantRoomChargePrintBuilder {
  private readonly paperWidth = 40;

  build(data: RestaurantRoomChargePrintData): string[] {
    const receipt = new EscPosReceiptComposer({ width: this.paperWidth });
    const header = data.encabezado;
    const currency = header.moneda || data.detalles[0]?.moneda || '';
    const operation = [header.tipCrgHab, header.numCrgHab].filter(Boolean).join(' ');
    const firstDetail = data.detalles[0];
    const isReprint = data.tipoDocumento === 'REIMPRESION';
    const isAnnulled = Number(header.estado) === 1;
    const order = [firstDetail?.tipNPedido, firstDetail?.numNPedido].filter(Boolean).join('-');
    const discount = data.detalles.reduce(
      (total, item) => total + receipt.number(item.descuento),
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
      .line('COMPROBANTE DE CARGO')
      .size(1)
      .line('CARGO A HABITACION')
      .bold(false);

    if (isReprint) {
      receipt.bold(true).line('*** REIMPRESION ***').bold(false);
    }
    if (isAnnulled) {
      receipt.bold(true).line('*** CARGO ANULADO ***').bold(false);
    }

    receipt
      .wrapped(operation)
      .separator('=')
      .align('left')
      .columns('Fecha', this.documentDate(header))
      .columns('Punto de venta', header.pntVenta || '-');

    if (firstDetail?.codMozo) receipt.columns('Mesero', firstDetail.codMozo);
    if (order) receipt.columns('Nota pedido', order);

    receipt
      .separator('-')
      .bold(true)
      .line('HABITACION Y HUESPED')
      .bold(false)
      .columns('Habitacion', header.numHab || '-')
      .columns('Reserva', header.codReserva || '-')
      .wrapped(`Huespedes: ${header.nombrePax || 'No indicados'}`);

    if (header.numDocu && header.numDocu !== header.codReserva) {
      receipt.columns('Documento', header.numDocu);
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
      receipt.columns('Descuento', `-${receipt.money(discount, currency)}`);
    }

    receipt
      .align('center')
      .bold(true)
      .size(2)
      .line('TOTAL')
      .line(receipt.money(header.mtoTot, currency))
      .size(1)
      .bold(false)
      .separator('=')
      .wrapped('Cargo aplicado al folio de la habitacion.')
      .feed(2)
      .line('________________________________')
      .line('Firma del huesped')
      .feed()
      .wrapped(`Registrado por: ${header.operador || '-'}`)
      .wrapped(`Impreso: ${this.formatDateTime(data.fechaImpresion)}`)
      .feed(4)
      .cut();

    return receipt.build();
  }

  private appendDetail(
    receipt: EscPosReceiptComposer,
    item: RoomChargeLookupDetail,
    currency: string,
    index: number
  ): void {
    const quantity = receipt.number(item.cantidad);
    const quantityLabel = Number.isInteger(quantity)
      ? quantity.toFixed(0)
      : quantity.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
    const product = item.nomConsumo || item.codConsumo || `Consumo ${index + 1}`;
    const lineCurrency = item.moneda || currency;

    receipt.wrappedColumns(
      `${quantityLabel} x ${product}`,
      receipt.money(item.total, lineCurrency)
    );
  }

  private documentDate(header: RoomChargeLookupHeader): string {
    return [this.formatApiDate(header.fecha), header.hora].filter(Boolean).join(' ') || '-';
  }

  private formatApiDate(value: string): string {
    const normalized = (value || '').trim().split('T')[0].split(' ')[0];
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(normalized)) return normalized;

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
