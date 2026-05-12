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

export interface DocumentoPosPrintData {
  empresaNombre: string;
  empresaRuc: string;
  encabezado: DocumentoEncabezado;
  detalle: DocumentoDetalleItem[];
  pagos: DocumentoPago[];
  resumen: DocumentoPosResumen;
}

@Injectable({
  providedIn: 'root'
})
export class PosDocumentPrintBuilder {
  private readonly width = 42;
  private readonly separator = '-'.repeat(this.width);
  private readonly fiscalFooter =
    'AUTORIZADO MEDIANTE RESOLUCION MH-DGT-RES-0027-2024 DEL 13-11-2024 Factura Electrónica Versión 4.4';

  build(data: DocumentoPosPrintData): string[] {
    const h = data.encabezado;
    const documento = this.buildDocumentoCodigo(h);
    const moneda = this.clean(h.moneda || '');

    const commands: string[] = [
      '\x1B\x40',
      '\x1B\x61\x01',
      '\x1B\x45\x01',
      '\x1D\x21\x01',
      `${this.center(data.empresaNombre || 'EMPRESA')}\n`,
      '\x1D\x21\x00',
      '\x1B\x45\x00'
    ];

    if (data.empresaRuc) {
      commands.push(`${this.center(`CEDULA: ${data.empresaRuc}`)}\n`);
    }

    commands.push(
      '\n',
      '\x1B\x45\x01',
      `${this.center(this.resolveTituloDocumento(h))}\n`,
      '\x1B\x45\x00',
      `${this.separator}\n`,
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
      '\x1B\x45\x00'
    );

    data.detalle.forEach((item) => {
      commands.push(...this.buildLineaDetalle(item));
    });

    commands.push(
      `${this.separator}\n`,
      this.leftRight('Subtotal', this.money(data.resumen.subtotal, moneda)),
      this.leftRight('Descuento', this.money(data.resumen.descuento, moneda)),
      this.leftRight('Impuesto', this.money(data.resumen.impuesto, moneda)),
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

  private buildLineaDetalle(item: DocumentoDetalleItem): string[] {
    const cantidad = this.number(item.cantidad);
    const descripcion = this.clean(item.descripcion || item.codProdu || 'Linea');
    const precio = this.number(item.pUndLst);
    const descuento = this.number(item.descuento);
    const impuesto = this.number(item.impuesto);
    const total = this.resolveLineaTotal(item, cantidad, precio, descuento, impuesto);
    const lines = this.wrap(`${cantidad.toFixed(2)} ${descripcion}`);

    return [
      ...lines,
      this.leftRight('Precio', this.money(precio)),
      this.leftRight('Desc', this.money(descuento)),
      this.leftRight('Imp', this.money(impuesto)),
      this.leftRight('Linea', this.money(total)),
      '\n'
    ];
  }

  private resolveTituloDocumento(encabezado: DocumentoEncabezado): string {
    const tipo = this.clean(encabezado.tipDocu || '').toUpperCase();
    if (tipo.includes('NC')) return 'NOTA DE CREDITO ELECTRONICA';
    if (tipo.includes('ND')) return 'NOTA DE DEBITO ELECTRONICA';
    if (tipo.includes('TFD')) return 'TIQUETE ELECTRONICO';
    return 'FACTURA ELECTRONICA';
  }

  private buildDocumentoCodigo(encabezado: DocumentoEncabezado): string {
    const serie = this.clean(encabezado.serie || '');
    const numero = this.clean(encabezado.numero || '');
    return serie ? `${serie}-${numero}` : numero;
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

  private wrap(value: string): string[] {
    const words = this.clean(value).split(/\s+/).filter(Boolean);
    const lines: string[] = [];
    let current = '';

    words.forEach((word) => {
      if (!current) {
        current = word.slice(0, this.width);
        return;
      }

      if (`${current} ${word}`.length <= this.width) {
        current = `${current} ${word}`;
      } else {
        lines.push(`${current}\n`);
        current = word.slice(0, this.width);
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
