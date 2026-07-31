import { Injectable } from '@angular/core';

import {
  DocumentoDetalleItem,
  DocumentoEncabezado,
  DocumentoPago
} from 'src/app/finanzas/pages-factura/documento-detalle/documento-detalle.interface';

export interface DocumentoPosResumen {
  subtotal: number;
  descuento: number;
  impuesto: number;
  total: number;
}

export interface DocumentoPosImpuesto {
  codigo         : string;
  descripcion    : string;
  porcentaje     : number;
  baseImponible  : number;
  monto          : number;
}

export interface DocumentoPosPrintData {
  empresaNombre: string;
  empresaRuc: string;
  empresaRazonSocial?: string;
  empresaDireccion?: string;
  empresaTelefono?: string;
  empresaEmail?: string;
  empresaWeb?: string;
  encabezado: DocumentoEncabezado;
  detalle: DocumentoDetalleItem[];
  impuestos?: DocumentoPosImpuesto[];
  pagos: DocumentoPago[];
  resumen: DocumentoPosResumen;
}

@Injectable({
  providedIn: 'root'
})
export class PosDocumentPrintBuilder {
  private readonly width = 40;
  private readonly separator = '-'.repeat(this.width);
  private readonly fiscalFooter =
    'AUTORIZADO MEDIANTE RESOLUCION MH-DGT-RES-0027-2024 DEL 13-11-2024 Factura Electrónica Versión 4.4';

  build(data: DocumentoPosPrintData): string[] {
    const h = data.encabezado;
    const moneda = this.clean(h.moneda || '');
    const empresaNombre = this.clean(data.empresaNombre || 'EMPRESA');
    const empresaRazonSocial = this.clean(data.empresaRazonSocial || '');
    const tituloDocumento = this.resolveTituloDocumento(h);
    const codigoDocumento = this.buildDocumentoCodigo(h);

    const commands: string[] = [
      '\x1B\x40',
      '\x1B\x61\x01',
      '\x1B\x45\x01',
      '\x1D\x21\x01',
      ...this.wrap(empresaNombre),
      '\x1D\x21\x00',
      '\x1B\x45\x00'
    ];

    if (empresaRazonSocial && empresaRazonSocial.toUpperCase() !== empresaNombre.toUpperCase()) {
      commands.push(...this.wrap(empresaRazonSocial));
    }

    if (data.empresaRuc) {
      commands.push(...this.wrap(`CEDULA: ${data.empresaRuc}`));
    }
    if (data.empresaDireccion) commands.push(...this.wrap(data.empresaDireccion));
    if (data.empresaTelefono) commands.push(...this.wrap(`TEL: ${data.empresaTelefono}`));
    if (data.empresaEmail) commands.push(...this.wrap(data.empresaEmail));
    if (data.empresaWeb) commands.push(...this.wrap(data.empresaWeb));

    commands.push(
      '\n',
      `${'='.repeat(this.width)}\n`,
      '\x1B\x45\x01',
      '\x1D\x21\x01',
      ...this.wrap(tituloDocumento),
      '\x1D\x21\x00',
      '\x1B\x45\x00',
      ...(codigoDocumento ? this.wrap(codigoDocumento) : []),
      `${'='.repeat(this.width)}\n`,
      '\x1B\x61\x00',
      ...this.wrap(`Consecutivo: ${h.numeroConsecutivo || '-'}`),
      ...this.wrap(`Clave: ${h.clave || '-'}`),
      this.leftRight('Fecha', h.fechaDocu || '-'),
      `${this.separator}\n`,
      '\x1B\x45\x01',
      'CLIENTE\n',
      '\x1B\x45\x00',
      ...this.wrap(h.nomCliente || 'Cliente no indicado'),
      ...this.wrap(`Cedula: ${h.rucCliente || h.codCliente || '-'}`),
      `${this.separator}\n`,
      '\x1B\x45\x01',
      'DETALLE\n',
      this.leftRight('Descripcion', 'Precio'),
      '\x1B\x45\x00',
      `${this.separator}\n`
    );

    data.detalle.forEach((item) => {
      commands.push(...this.buildLineaDetalle(item, moneda));
    });

    commands.push(
      `${this.separator}\n`,
      this.leftRight('Subtotal', this.money(data.resumen.subtotal, moneda)),
      this.leftRight('Descuento', this.money(data.resumen.descuento, moneda))
    );

    const taxes = (data.impuestos || []).filter((item) => this.number(item.monto) !== 0);
    if (taxes.length) {
      taxes.forEach((tax) => {
        commands.push(this.leftRight(this.taxLabel(tax), this.money(tax.monto, moneda)));
      });
      if (taxes.length > 1) {
        commands.push(this.leftRight('Total impuestos', this.money(data.resumen.impuesto, moneda)));
      }
    } else {
      commands.push(this.leftRight('Impuesto', this.money(data.resumen.impuesto, moneda)));
    }

    commands.push(
      '\x1B\x45\x01',
      this.leftRight('TOTAL', this.money(data.resumen.total, moneda)),
      '\x1B\x45\x00',
      `${this.separator}\n`,
      '\x1B\x45\x01',
      'PAGOS\n',
      '\x1B\x45\x00'
    );

    if (data.pagos.length) {
      data.pagos.forEach((pago) => {
        commands.push(this.leftRight(pago.frmPago || 'Pago', this.money(pago.monto ?? 0, pago.moneda || moneda)));
        if (pago.referencia) {
          commands.push(...this.wrap(`Ref: ${pago.referencia}`));
        }
      });
    } else {
      commands.push('Sin pagos registrados\n');
    }

    commands.push(
      `${this.separator}\n`,
      ...this.wrap(this.fiscalFooter).map((line) => this.center(line.trim()) + '\n'),
      '\n',
      `${this.center('Gracias por su preferencia')}\n`,
      '\n\n\n\n',
      '\x1D\x56\x41\x00'
    );

    return commands;
  }

  private taxLabel(tax: DocumentoPosImpuesto): string {
    const code = this.clean(tax.codigo).toUpperCase();
    const description = this.clean(tax.descripcion);
    const name = code === 'IGV' || code === 'IVA'
      ? 'IVA'
      : code === 'SRV' || code === 'SERVICIO'
        ? 'Servicio'
        : description || code || 'Impuesto';
    const rate = this.number(tax.porcentaje);
    const rateLabel = Number.isInteger(rate)
      ? rate.toFixed(0)
      : rate.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');

    return rate > 0 ? `${name} ${rateLabel}%` : name;
  }

  private buildLineaDetalle(item: DocumentoDetalleItem, moneda: string): string[] {
    const cantidad = this.number(item.cantidad);
    const descripcion = this.clean(item.descripcion || item.codProdu || 'Linea');
    const precio = this.number(item.pUndLst);
    const descuento = this.number(item.descuento);
    const impuesto = this.number(item.impuesto);
    const total = this.resolveLineaTotal(item, cantidad, precio, descuento, impuesto);
    const quantityLabel = Number.isInteger(cantidad)
      ? cantidad.toFixed(0)
      : cantidad.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');

    return this.wrappedColumns(
      `${quantityLabel} x ${descripcion}`,
      this.money(total, moneda)
    );
  }

  private resolveTituloDocumento(encabezado: DocumentoEncabezado): string {
    const tipo = this.clean(encabezado.tipDocu || '').toUpperCase();
    if (tipo.includes('NC')) return 'NOTA DE CREDITO ELECTRONICA';
    if (tipo.includes('ND')) return 'NOTA DE DEBITO ELECTRONICA';
    if (tipo.startsWith('T')) return 'TIQUETE ELECTRONICO';
    return 'FACTURA ELECTRONICA';
  }

  private buildDocumentoCodigo(encabezado: DocumentoEncabezado): string {
    const tipo = this.clean(encabezado.tipDocu || '');
    const serie = this.clean(encabezado.serie || '');
    const numero = this.clean(encabezado.numero || '');
    const consecutivo = [serie, numero].filter(Boolean).join('-');

    return [tipo, consecutivo].filter(Boolean).join(' ');
  }

  private resolveLineaTotal(
    item: DocumentoDetalleItem,
    cantidad: number,
    precio: number,
    descuento: number,
    impuesto: number
  ): number {
    const explicitTotal = this.number(item.total);
    if (explicitTotal) {
      return explicitTotal;
    }

    return cantidad * precio - descuento + impuesto + this.number(item.mtoImpVarios);
  }

  private leftRight(left: string, right: string): string {
    const cleanLeft = this.clean(left);
    const cleanRight = this.clean(right);
    const available = this.width - cleanRight.length;
    const safeLeft = cleanLeft.length > available ? cleanLeft.slice(0, Math.max(0, available - 1)) : cleanLeft;
    const spaces = Math.max(1, this.width - safeLeft.length - cleanRight.length);
    return `${safeLeft}${' '.repeat(spaces)}${cleanRight}\n`;
  }

  private center(value: string): string {
    const text = this.clean(value).slice(0, this.width);
    const spaces = Math.max(0, Math.floor((this.width - text.length) / 2));
    return `${' '.repeat(spaces)}${text}`;
  }

  private wrappedColumns(left: string, right: string): string[] {
    const cleanRight = this.clean(right).slice(-(this.width - 1));
    const leftWidth = Math.max(1, this.width - cleanRight.length - 1);
    const leftLines = this.wrap(left, leftWidth);

    return leftLines.map((line, index) => {
      const cleanLine = line.replace(/\n$/, '');
      if (index === 0 && cleanRight) {
        const spaces = Math.max(1, this.width - cleanLine.length - cleanRight.length);
        return `${cleanLine}${' '.repeat(spaces)}${cleanRight}\n`;
      }

      return `${cleanLine}\n`;
    });
  }

  private wrap(value: string, maxWidth = this.width): string[] {
    const safeWidth = Math.max(1, Math.min(this.width, Math.floor(maxWidth)));
    const words = this.clean(value).split(/\s+/).filter(Boolean);
    const lines: string[] = [];
    let current = '';

    words.forEach((word) => {
      if (!current) {
        current = word.slice(0, safeWidth);
        return;
      }

      if (`${current} ${word}`.length <= safeWidth) {
        current = `${current} ${word}`;
      } else {
        lines.push(`${current}\n`);
        current = word.slice(0, safeWidth);
      }
    });

    if (current) {
      lines.push(`${current}\n`);
    }

    return lines.length ? lines : ['\n'];
  }

  private money(value: number, moneda = ''): string {
    const amount = this.number(value).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
    return moneda ? `${amount} ${this.clean(moneda)}` : amount;
  }

  private number(value: unknown): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private clean(value: string | number | null | undefined): string {
    return (value ?? '')
      .toString()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\x20-\x7E]/g, '')
      .trim();
  }
}
