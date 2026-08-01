import { Injectable } from '@angular/core';

import { EscPosReceiptComposer } from 'src/app/core/printing/esc-pos-receipt.composer';
import {
  CierreCajaDenominacionReporte,
  CierreCajaFormaPagoReporte,
  CierreCajaPosDocumento,
  CierreCajaPosReporte,
  CierreCajaResumenFormaPago
} from '../models/cierre-caja.model';

interface CurrencyTotals {
  cantidad: number;
  subtotal: number;
  descuento: number;
  impuesto: number;
  propinas: number;
  total: number;
  pagado: number;
}

@Injectable({ providedIn: 'root' })
export class CierreCajaPosPrintBuilder {
  private readonly paperWidth = 40;

  build(data: CierreCajaPosReporte, fechaImpresion = new Date()): string[] {
    const receipt = new EscPosReceiptComposer({ width: this.paperWidth });
    const header = data.encabezado;

    receipt
      .initialize()
      .align('center')
      .bold(true)
      .size(1, 2)
      .wrapped(data.datosEmpresa.nombreEmpresa || 'PUNTO DE VENTA')
      .size(1)
      .bold(false);

    if (data.datosEmpresa.cedula) receipt.wrapped(`CEDULA: ${data.datosEmpresa.cedula}`);

    receipt
      .feed()
      .separator('=')
      .bold(true)
      .size(1, 2)
      .line(header.tipoCierre || 'CIERRE DE CAJA')
      .size(1)
      .wrapped(header.numCierre)
      .bold(false)
      .separator('=')
      .align('left')
      .columns('Punto de venta', header.puntoVenta || '-')
      .columns('Usuario', header.usuario || '-')
      .columns('Apertura', this.dateTime(header.fechaApertura, header.horaApertura))
      .columns('Cierre', header.fechaCierre || '-')
      .columns('Fondo de caja', receipt.money(header.fondoCaja))
      .separator('=');

    this.appendDocuments(receipt, 'DOCUMENTOS DE VENTA', data.documentosVenta);
    this.appendDocuments(receipt, 'NOTAS DE CREDITO', data.notasCredito);
    this.appendPaymentMethods(receipt, data.formasPagoPorDocumento);
    this.appendDenominations(receipt, data.denominaciones);
    this.appendPaymentSummary(receipt, data.resumenFormasPago);
    this.appendCollaboratorCharges(receipt, data);
    this.appendDeletedDishes(receipt, data);

    receipt
      .separator('=')
      .align('center')
      .bold(true)
      .line('FIN DEL CIERRE')
      .bold(false)
      .wrapped(`Impreso: ${this.formatDateTime(fechaImpresion)}`)
      .feed(4)
      .cut();

    return receipt.build();
  }

  private appendDocuments(receipt: EscPosReceiptComposer, title: string, documents: CierreCajaPosDocumento[]): void {
    this.sectionHeader(receipt, `${title} (${documents.length})`);
    if (!documents.length) {
      receipt.line('Sin registros.');
      return;
    }

    documents.forEach((item, index) => {
      if (index > 0) receipt.separator('-');
      const reference = [item.tipoDocumento, item.serie, item.numeroDocumento].filter(Boolean).join(' ');
      receipt
        .bold(true)
        .wrapped(reference || `Documento ${index + 1}`)
        .bold(false)
        .columns(this.dateTime(item.fechaDocumento, item.hora), `Estado: ${item.estado || '-'}`)
        .wrapped(`Cliente: ${item.nombreCliente || item.codCliente || '-'}`);

      if (item.codMozo) receipt.columns('Salonero', item.codMozo);
      if (item.numMesa && item.numMesa !== '0') receipt.columns('Mesa / Pax', `${item.numMesa} / ${item.numPax || '-'}`);

      receipt
        .columns('Subtotal', receipt.money(item.subTotal, item.moneda))
        .columns('Descuento', receipt.money(item.descuento, item.moneda))
        .columns('Impuesto', receipt.money(item.impuesto, item.moneda));

      if (item.exonerado) receipt.columns('Exonerado', receipt.money(item.exonerado, item.moneda));
      if (item.propinas) receipt.columns('Propina', receipt.money(item.propinas, item.moneda));

      receipt
        .bold(true)
        .columns('Total documento', receipt.money(item.totalDocumento, item.moneda))
        .bold(false)
        .columns('Total pagado', receipt.money(item.totalPago, item.moneda));
    });

    receipt.separator('-').bold(true).line('TOTALES POR MONEDA').bold(false);
    this.documentTotals(documents).forEach(([currency, total]) => {
      receipt
        .bold(true)
        .columns(`${currency || 'SIN MONEDA'} (${total.cantidad})`, receipt.money(total.total, currency))
        .bold(false)
        .columns('  Subtotal', receipt.money(total.subtotal, currency))
        .columns('  Descuentos', receipt.money(total.descuento, currency))
        .columns('  Impuestos', receipt.money(total.impuesto, currency));
      if (total.propinas) receipt.columns('  Propinas', receipt.money(total.propinas, currency));
      receipt.columns('  Pagado', receipt.money(total.pagado, currency));
    });

    const states = this.countBy(documents.map((item) => item.estado || 'SIN ESTADO'));
    receipt.wrapped(`Estados: ${Object.entries(states).map(([state, count]) => `${state}=${count}`).join(', ')}`);
  }

  private appendPaymentMethods(receipt: EscPosReceiptComposer, items: CierreCajaFormaPagoReporte[]): void {
    this.sectionHeader(receipt, `FORMAS DE PAGO (${items.length})`);
    if (!items.length) {
      receipt.line('Sin registros.');
      return;
    }

    items.forEach((item) => {
      receipt.wrappedColumns(item.descFormaPago || item.codFormaPago, receipt.money(item.monto, item.moneda));
    });
    this.appendAmountTotals(receipt, items.map((item) => ({ currency: item.moneda, amount: item.monto })));
  }

  private appendDenominations(receipt: EscPosReceiptComposer, items: CierreCajaDenominacionReporte[]): void {
    this.sectionHeader(receipt, `DENOMINACIONES (${items.length})`);
    if (!items.length) {
      receipt.line('Sin registros.');
      return;
    }

    items.forEach((item) => {
      const total = item.totalMonedaNacional || item.totalMonedaExtranjera;
      receipt.wrappedColumns(
        `${item.cantidad} x ${item.denominacion || item.codDenominacion}`,
        receipt.money(total, item.moneda)
      );
    });
  }

  private appendPaymentSummary(receipt: EscPosReceiptComposer, items: CierreCajaResumenFormaPago[]): void {
    this.sectionHeader(receipt, `RESUMEN FORMAS DE PAGO (${items.length})`);
    if (!items.length) {
      receipt.line('Sin registros.');
      return;
    }

    items.forEach((item) => {
      receipt.wrappedColumns(item.descFormaPago || item.codFormaPago, receipt.money(item.total, item.moneda));
      if (item.detalles) receipt.wrapped(item.detalles, '  ');
    });
    this.appendAmountTotals(receipt, items.map((item) => ({ currency: item.moneda, amount: item.total })));
  }

  private appendCollaboratorCharges(receipt: EscPosReceiptComposer, data: CierreCajaPosReporte): void {
    const items = data.consumosColaborador;
    this.sectionHeader(receipt, `CONSUMOS COLABORADOR (${items.length})`);
    if (!items.length) {
      receipt.line('Sin registros.');
      return;
    }

    items.forEach((item, index) => {
      if (index > 0) receipt.separator('-');
      receipt
        .bold(true)
        .columns([item.tipo, item.numero].filter(Boolean).join(' '), receipt.money(item.total, item.moneda))
        .bold(false)
        .columns(this.dateTime(item.fecha, item.hora), `Estado: ${item.estado || '-'}`)
        .wrapped(`Colaborador: ${item.nombre || '-'}`)
        .columns('Salonero', item.salonero || '-');
      if (item.comentarios) receipt.wrapped(`Motivo: ${item.comentarios}`);
    });
    this.appendAmountTotals(receipt, items.map((item) => ({ currency: item.moneda, amount: item.total })));
  }

  private appendDeletedDishes(receipt: EscPosReceiptComposer, data: CierreCajaPosReporte): void {
    const items = data.platosEliminados;
    this.sectionHeader(receipt, `PLATOS ELIMINADOS (${items.length})`);
    if (!items.length) {
      receipt.line('Sin registros.');
      return;
    }

    items.forEach((item, index) => {
      if (index > 0) receipt.separator('-');
      receipt
        .bold(true)
        .wrapped([item.tipNdp, item.numNdp].filter(Boolean).join(' ') || `Registro ${index + 1}`)
        .bold(false)
        .columns('Fecha', this.formatApiDate(item.fecha) || '-');
      if (item.desProducto || item.codProducto) {
        receipt.wrapped(`${this.quantity(item.cantidad)} x ${item.desProducto || item.codProducto}`);
      } else {
        receipt.line('Producto: sin detalle');
      }
      if (item.total || item.precio) receipt.columns('Total', receipt.money(item.total));
      if (item.motivo) receipt.wrapped(`Motivo: ${item.motivo}`);
      if (item.operador) receipt.columns('Operador', item.operador);
    });
  }

  private sectionHeader(receipt: EscPosReceiptComposer, title: string): void {
    receipt.separator('=').align('center').bold(true).wrapped(title).bold(false).align('left').separator('-');
  }

  private documentTotals(documents: CierreCajaPosDocumento[]): Array<[string, CurrencyTotals]> {
    const totals = new Map<string, CurrencyTotals>();
    documents.forEach((item) => {
      const currency = item.moneda || '';
      const current = totals.get(currency) ?? {
        cantidad: 0,
        subtotal: 0,
        descuento: 0,
        impuesto: 0,
        propinas: 0,
        total: 0,
        pagado: 0
      };
      current.cantidad += 1;
      current.subtotal += this.number(item.subTotal);
      current.descuento += this.number(item.descuento);
      current.impuesto += this.number(item.impuesto);
      current.propinas += this.number(item.propinas);
      current.total += this.number(item.totalDocumento);
      current.pagado += this.number(item.totalPago);
      totals.set(currency, current);
    });
    return [...totals.entries()];
  }

  private appendAmountTotals(
    receipt: EscPosReceiptComposer,
    values: Array<{ currency: string; amount: number }>
  ): void {
    const totals = new Map<string, number>();
    values.forEach((item) => totals.set(item.currency || '', (totals.get(item.currency || '') ?? 0) + this.number(item.amount)));
    receipt.separator('-').bold(true);
    totals.forEach((total, currency) => receipt.columns(`TOTAL ${currency || ''}`.trim(), receipt.money(total, currency)));
    receipt.bold(false);
  }

  private countBy(values: string[]): Record<string, number> {
    return values.reduce<Record<string, number>>((result, value) => {
      result[value] = (result[value] ?? 0) + 1;
      return result;
    }, {});
  }

  private dateTime(date: string, time: string): string {
    return [this.formatApiDate(date), time].filter(Boolean).join(' ') || '-';
  }

  private formatApiDate(value: string): string {
    const normalized = (value || '').trim().split('T')[0].split(' ')[0];
    const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(normalized);
    if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;

    const slash = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(normalized);
    if (slash && Number(slash[2]) > 12) {
      return `${slash[2].padStart(2, '0')}/${slash[1].padStart(2, '0')}/${slash[3]}`;
    }
    return normalized;
  }

  private formatDateTime(value: Date): string {
    const day = String(value.getDate()).padStart(2, '0');
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const hours = String(value.getHours()).padStart(2, '0');
    const minutes = String(value.getMinutes()).padStart(2, '0');
    return `${day}/${month}/${value.getFullYear()} ${hours}:${minutes}`;
  }

  private quantity(value: number): string {
    const amount = this.number(value);
    return Number.isInteger(amount) ? amount.toFixed(0) : amount.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
  }

  private number(value: unknown): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
}
