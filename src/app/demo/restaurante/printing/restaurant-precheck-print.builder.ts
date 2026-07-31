import { Injectable } from '@angular/core';

import { EscPosReceiptComposer } from 'src/app/core/printing/esc-pos-receipt.composer';
import {
  NotaPedidoRestauranteDetalle,
  NotaPedidoRestauranteTotales
} from '../services/nota-pedido-restaurante.service';

export interface RestaurantPrecheckPrintData {
  empresa: {
    nombre      : string;
    ruc         ?: string;
    direccion   ?: string;
    telefono    ?: string;
  };
  puntoVenta    : string;
  salon         : string;
  mesa          : string;
  mesero        : string;
  cliente       ?: string;
  habitacion    ?: string;
  personas      ?: number;
  nota: {
    tipo      : string;
    serie     : string;
    numero    : string;
    fecha     : string;
    hora      ?: string;
  };
  cuenta            : number;
  moneda            : string;
  tipoCambio        ?: {
    monedaBase       : string;
    monedaReferencia : string;
    compra           : number;
    venta            : number;
  };
  detalles          : NotaPedidoRestauranteDetalle[];
  totales           : NotaPedidoRestauranteTotales;
  totalPropina      : number;
  impresoPor        : string;
  fechaImpresion    : Date;
}

@Injectable({
  providedIn: 'root'
})
export class RestaurantPrecheckPrintBuilder {
  private readonly paperWidth = 40;

  build(data: RestaurantPrecheckPrintData): string[] {
    const receipt             = new EscPosReceiptComposer({ width: this.paperWidth });
    const currency            = data.moneda || data.detalles[0]?.ppV08_Moneda || '';
    const discount            = data.detalles.reduce((total, item) => total + receipt.number(item.ppV08_Descuento), 0);
    const consumptionTotal    = receipt.number(data.totales?.total);
    const tip                 = receipt.number(data.totalPropina);
    const totalToPay          = consumptionTotal + tip;
    const currencyConversion  = this.buildCurrencyConversion(data, totalToPay);

    receipt
      .initialize()
      .align('center')
      .bold(true)
      .wrapped(data.empresa.nombre || 'RESTAURANTE')
      .bold(false);

    if (data.empresa.ruc) receipt.wrapped(`CEDULA: ${data.empresa.ruc}`);
    if (data.empresa.direccion) receipt.wrapped(data.empresa.direccion);
    if (data.empresa.telefono) receipt.wrapped(`TEL: ${data.empresa.telefono}`);
    if (data.puntoVenta) receipt.wrapped(data.puntoVenta);

    receipt
      .feed()
      .bold(true)
      .size(2)
      .line('PRE-CUENTA')
      .size(1)
      .line('NO ES DOCUMENTO FISCAL')
      .bold(false)
      .separator('=')
      .align('left')
      .columns('Nota', this.documentNumber(data))
      .columns('Fecha apertura', `${data.nota.fecha}${data.nota.hora ? ` ${data.nota.hora}` : ''}`)
      .columns('Mesa', data.mesa || '-')
      .columns('Salon', data.salon || '-')
      .columns('Mesero', data.mesero || '-');

    if (data.personas && data.personas > 0) receipt.columns('Personas', data.personas);
    if (data.cliente) receipt.wrapped(`Cliente: ${data.cliente}`);
    if (data.habitacion && data.habitacion !== '000') receipt.columns('Habitacion', data.habitacion);

    receipt
      .bold(true)
      .columns('Cuenta impresa', data.cuenta > 0 ? `CUENTA ${data.cuenta}` : 'TODAS')
      .bold(false)
      .separator('=')
      .bold(true)
      .line('DETALLE DE CONSUMO')
      .columns('Descripcion', 'Precio')
      .bold(false)
      .separator('-');

    data.detalles.forEach((item, index) => this.appendDetail(receipt, item, currency, index));

    /*
    receipt
      .separator('=')
      .columns('Subtotal bruto', receipt.money(data.totales?.subtotal, currency));

    if (discount > 0) {
      receipt.columns('Descuento', `-${receipt.money(discount, currency)}`);
    }

    receipt
      .columns('Subtotal neto', receipt.money(data.totales?.subtotalneto, currency))
      .columns('IVA', receipt.money(data.totales?.impuestos, currency))
      .columns('Total consumo', receipt.money(consumptionTotal, currency));
*/
    if (tip > 0) {
      receipt.columns('Propina', receipt.money(tip, currency));
    }

    receipt
      .separator('=')
      .align('center')
      .bold(true)
      .size(2)
      .line('TOTAL')
      .line(receipt.money(totalToPay, currency))
      .size(1)
      .bold(false);

    if (currencyConversion) {
      receipt
        .align('left')
        .line(
          `T.C. ${currencyConversion.rateType}: 1 ${currencyConversion.referenceCurrency} = ` +
          receipt.money(currencyConversion.rate, currencyConversion.baseCurrency)
        )
        .bold(true)
        .columns(
          `TOTAL ${currencyConversion.targetCurrency}`,
          receipt.money(currencyConversion.total, currencyConversion.targetCurrency)
        )
        .bold(false);
    }

    receipt
      .separator('=')
      .align('center')
      .wrapped(`Atendido por ${data.mesero || data.impresoPor || 'nuestro equipo'}`)
      .wrapped('Gracias por su preferencia')
      .wrapped('Este documento es informativo y no sustituye la factura.')
      .feed(4)
      .cut();

    return receipt.build();
  }

  private appendDetail(
    receipt     : EscPosReceiptComposer,
    item        : NotaPedidoRestauranteDetalle,
    currency    : string,
    index       : number
  ): void {
    const quantity = receipt.number(item.ppV08_Cantidad);
    const product = item.ppV08_NomProducto || item.ppV08_CodProducto || `Producto ${index + 1}`;
    const lineCurrency = item.ppV08_Moneda || currency;
    const quantityLabel = Number.isInteger(quantity)
      ? quantity.toFixed(0)
      : quantity.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');

    receipt.wrappedColumns(
      `${quantityLabel} x ${product}`,
      receipt.money(item.ppV08_Precio, lineCurrency)
    );

    if (item.ppV08_Comentario) {
      receipt.wrappedColumns(`  Nota: ${item.ppV08_Comentario}`, '');
    }
  }

  private documentNumber(data: RestaurantPrecheckPrintData): string {
    return [data.nota.tipo, data.nota.numero].filter(Boolean).join('-') || '-';
  }

  private buildCurrencyConversion(
    data: RestaurantPrecheckPrintData,
    total: number
  ): {
    total             : number;
    rate              : number;
    rateType          : 'compra' | 'venta';
    baseCurrency      : string;
    referenceCurrency : string;
    targetCurrency    : string;
  } | null {
    const exchangeRate = data.tipoCambio;
    if (!exchangeRate) {
      return null;
    }

    const sourceCurrency = this.normalizeCurrency(data.moneda);
    const baseCurrency = this.normalizeCurrency(exchangeRate.monedaBase || 'COL');
    const referenceCurrency = this.normalizeCurrency(exchangeRate.monedaReferencia || 'USD');

    if (!sourceCurrency || !baseCurrency || !referenceCurrency || this.sameCurrency(baseCurrency, referenceCurrency)) {
      return null;
    }

    const compra = Number(exchangeRate.compra);
    const venta = Number(exchangeRate.venta);

    if (this.sameCurrency(sourceCurrency, baseCurrency) && Number.isFinite(compra) && compra > 0) {
      return {
        total: this.roundMoney(total / compra),
        rate: compra,
        rateType: 'compra',
        baseCurrency,
        referenceCurrency,
        targetCurrency: referenceCurrency
      };
    }

    if (this.sameCurrency(sourceCurrency, referenceCurrency) && Number.isFinite(venta) && venta > 0) {
      return {
        total: this.roundMoney(total * venta),
        rate: venta,
        rateType: 'venta',
        baseCurrency,
        referenceCurrency,
        targetCurrency: baseCurrency
      };
    }

    return null;
  }

  private normalizeCurrency(value: string | null | undefined): string {
    return (value || '').trim().toUpperCase();
  }

  private sameCurrency(first: string, second: string): boolean {
    return first === second || (this.isCostaRicanColon(first) && this.isCostaRicanColon(second));
  }

  private isCostaRicanColon(currency: string): boolean {
    return currency === 'COL' || currency === 'CRC';
  }

  private roundMoney(value: number): number {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }

  private formatDateTime(value: Date): string {
    const day = String(value.getDate()).padStart(2, '0');
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const hours = String(value.getHours()).padStart(2, '0');
    const minutes = String(value.getMinutes()).padStart(2, '0');
    return `${day}/${month}/${value.getFullYear()} ${hours}:${minutes}`;
  }
}
