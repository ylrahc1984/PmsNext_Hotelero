import { Injectable } from '@angular/core';

import { EscPosReceiptComposer } from 'src/app/core/printing/esc-pos-receipt.composer';
import {
  RoomStatementCharge,
  RoomStatementData,
  RoomStatementTotals
} from './room-statement.model';

export interface RoomStatementPosPrintData {
  company: {
    name: string;
    ruc?: string;
    address?: string;
    phone?: string;
  };
  statement: RoomStatementData;
}

@Injectable({ providedIn: 'root' })
export class RoomStatementPosBuilder {
  private readonly paperWidth = 40;

  build(data: RoomStatementPosPrintData): string[] {
    const receipt = new EscPosReceiptComposer({ width: this.paperWidth });
    const statement = data.statement;

    receipt
      .initialize()
      .align('center')
      .bold(true)
      .size(1, 2)
      .wrapped(data.company.name || 'HOTEL')
      .size(1)
      .bold(false);

    if (data.company.ruc) receipt.wrapped(`CEDULA: ${data.company.ruc}`);
    if (data.company.address) receipt.wrapped(data.company.address);
    if (data.company.phone) receipt.wrapped(`TEL: ${data.company.phone}`);

    receipt
      .feed()
      .separator('=')
      .bold(true)
      .size(1, 2)
      .line('ESTADO DE CUENTA')
      .size(1)
      .line('NO ES DOCUMENTO FISCAL')
      .bold(false)
      .separator('=')
      .align('left')
      .columns('Habitacion', statement.roomNumber || '-')
      .columns('Reserva', statement.reservationNumber || '-')
      .columns('Folio', statement.masterFolio || '-')
      .columns('Entrada', statement.checkIn || '-')
      .columns('Salida', statement.checkOut || '-')
      .wrapped(`Huespedes: ${statement.guests.join(', ') || '-'}`)
      .separator('=');

    this.appendSection(
      receipt,
      'CARGOS DE LA ESTANCIA',
      statement.charges.filter((charge) => charge.bucket === 'lodging'),
      statement.lodgingTotals,
      statement.currency
    );
    this.appendSection(
      receipt,
      'CARGOS EXTRAS',
      statement.charges.filter((charge) => charge.bucket === 'extras'),
      statement.extraTotals,
      statement.currency
    );

    receipt
      .separator('=')
      .align('center')
      .bold(true)
      .size(2)
      .line('TOTAL CUENTA')
      .line(receipt.money(statement.totals.total, statement.currency))
      .size(1)
      .bold(false)
      .separator('=')
      .wrapped(`Fecha operativa: ${statement.operationalDate}`)
      .wrapped(`Generado por: ${statement.operator || '-'}`)
      .wrapped('Los cargos pueden variar si se registran nuevas operaciones.')
      .feed(4)
      .cut();

    return receipt.build();
  }

  private appendSection(
    receipt: EscPosReceiptComposer,
    title: string,
    charges: RoomStatementCharge[],
    totals: RoomStatementTotals,
    currency: string
  ): void {
    receipt.align('left').bold(true).wrapped(title).bold(false).separator('-');

    if (!charges.length) {
      receipt.line('Sin cargos registrados.').separator('=');
      return;
    }

    charges.forEach((charge) => {
      receipt
        .bold(true)
        .wrapped(`${charge.date || '-'} ${charge.type} ${charge.number}`)
        .bold(false);

      charge.lines.forEach((line) => {
        const quantity = Number.isInteger(line.quantity)
          ? line.quantity.toFixed(0)
          : line.quantity.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
        receipt.wrappedColumns(
          `${quantity} x ${line.description}`,
          receipt.money(line.total, currency)
        );
      });

      receipt.separator('-');
    });

    if (totals.discount > 0) {
      receipt.columns('Descuento', `-${receipt.money(totals.discount, currency)}`);
    }
    receipt
      .columns('Neto', receipt.money(totals.net, currency))
      .columns('Impuestos', receipt.money(totals.taxes, currency))
      .bold(true)
      .columns('Total seccion', receipt.money(totals.total, currency))
      .bold(false)
      .separator('=');
  }
}
