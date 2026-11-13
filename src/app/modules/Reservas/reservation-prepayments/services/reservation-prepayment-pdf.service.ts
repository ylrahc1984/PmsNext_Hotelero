import { Injectable, inject } from '@angular/core';
import type { TCreatedPdf, TDocumentDefinitions } from 'pdfmake/interfaces';

import { EmpresaContextService } from 'src/app/core/services/empresa-context.service';
import { ReservationPrepayment, ReservationPrepaymentSummary } from '../models/reservation-prepayment.model';

type PdfMakeBrowser = {
  addVirtualFileSystem(vfs: Record<string, string>): void;
  createPdf(documentDefinition: TDocumentDefinitions): TCreatedPdf;
};

@Injectable({ providedIn: 'root' })
export class ReservationPrepaymentPdfService {
  private readonly empresaContext = inject(EmpresaContextService);
  private pdfMakePromise?: Promise<PdfMakeBrowser>;

  async print(item: ReservationPrepayment, reserva: ReservationPrepaymentSummary, paymentMethod: string): Promise<void> {
    const pdfMake = await this.getPdfMake();
    const company = this.empresaContext.getSnapshot();
    const definition: TDocumentDefinitions = {
      pageSize: 'LETTER',
      pageMargins: [42, 42, 42, 46],
      content: [
        {
          columns: [
            {
              width: '*',
              stack: [
                { text: (company?.MA04_Nombre || company?.MA04_RazonSocial || 'HOTEL').trim(), style: 'company' },
                {
                  text: [
                    company?.MA04_Ruc ? `Cédula: ${company.MA04_Ruc}` : '',
                    company?.MA04_Telefono1 ? `Tel. ${company.MA04_Telefono1}` : ''
                  ]
                    .filter(Boolean)
                    .join('  |  '),
                  style: 'muted'
                }
              ]
            },
            {
              width: 170,
              stack: [
                { text: 'COMPROBANTE DE PREPAGO', style: 'documentTitle', alignment: 'right' },
                { text: item.numInterno || 'SIN NÚMERO', style: 'documentNumber', alignment: 'right' }
              ]
            }
          ],
          columnGap: 16,
          margin: [0, 0, 0, 22]
        },
        { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 528, y2: 0, lineWidth: 2, lineColor: '#167D8D' }], margin: [0, 0, 0, 18] },
        { text: 'DATOS DE LA RESERVA', style: 'section' },
        {
          table: {
            widths: ['*', '*'],
            body: [
              [this.cell('Reserva', item.codRsv || reserva.codReserva), this.cell('Agencia', item.codAge || reserva.codAgencia)],
              [this.cell('Cliente', reserva.cliente || 'N/D'), this.cell('Fecha de depósito', this.date(item.fechaDepo))]
            ]
          },
          layout: 'noBorders',
          margin: [0, 4, 0, 16]
        },
        { text: 'DETALLE DEL DEPÓSITO', style: 'section' },
        {
          table: {
            widths: ['*', '*'],
            body: [
              [this.cell('Concepto', item.concepto || 'Prepago'), this.cell('Forma de pago', paymentMethod || item.frmPago || 'N/D')],
              [
                this.cell('Banco / cuenta', [item.codBanco, item.ctaBanco].filter(Boolean).join(' / ') || 'N/D'),
                this.cell('Número de operación', item.nOperacion || 'N/D')
              ],
              [
                this.cell('Moneda', item.moneda || 'N/D'),
                this.cell(
                  'Tipo de cambio',
                  Number(item.tCambio || 0).toLocaleString('es-CR', { minimumFractionDigits: 2, maximumFractionDigits: 4 })
                )
              ]
            ]
          },
          layout: 'noBorders',
          margin: [0, 4, 0, 20]
        },
        {
          table: {
            widths: ['*'],
            body: [
              [
                {
                  columns: [
                    { text: 'MONTO RECIBIDO', style: 'amountLabel', alignment: 'left' },
                    {
                      text: `${item.moneda || ''}  ${Number(item.totalPrepa || 0).toLocaleString('es-CR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
                      style: 'amount',
                      alignment: 'right'
                    }
                  ],
                  margin: [14, 13, 14, 13]
                }
              ]
            ]
          },
          layout: { fillColor: () => '#F0F6F8', hLineColor: () => '#D5E2E8', vLineColor: () => '#D5E2E8' },
          margin: [0, 0, 0, 22]
        },
        { text: 'REFERENCIA CONTABLE', style: 'section' },
        { text: `Número de asiento: ${item.numAsiento || 'Pendiente / no asignado'}`, style: 'accounting', margin: [0, 6, 0, 42] },
        {
          columns: [
            {
              width: '*',
              stack: [
                { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 210, y2: 0, lineWidth: 0.7, lineColor: '#8796A5' }] },
                { text: 'Recibido por', style: 'signature' }
              ]
            },
            {
              width: '*',
              stack: [
                { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 210, y2: 0, lineWidth: 0.7, lineColor: '#8796A5' }] },
                { text: 'Firma del cliente', style: 'signature' }
              ]
            }
          ],
          columnGap: 40
        }
      ],
      footer: (page, pages) => ({
        text: `Impreso ${new Intl.DateTimeFormat('es-CR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date())}     ·     Página ${page} de ${pages}`,
        alignment: 'center',
        margin: [0, 0, 0, 18],
        fontSize: 8,
        color: '#718096'
      }),
      defaultStyle: { font: 'Roboto', fontSize: 9, color: '#233447' },
      styles: {
        company: { fontSize: 16, bold: true, color: '#173B61', margin: [0, 0, 0, 4] },
        muted: { fontSize: 8, color: '#64748B' },
        documentTitle: { fontSize: 9, bold: true, color: '#167D8D', margin: [0, 2, 0, 5] },
        documentNumber: { fontSize: 14, bold: true, color: '#173B61' },
        section: { fontSize: 9, bold: true, color: '#173B61', characterSpacing: 0.6 },
        label: { fontSize: 8, color: '#718096', margin: [0, 2, 0, 2] },
        value: { fontSize: 9, bold: true, color: '#26364A', margin: [0, 0, 0, 5] },
        amountLabel: { fontSize: 10, bold: true, color: '#173B61' },
        amount: { fontSize: 18, bold: true, color: '#167D8D' },
        accounting: { fontSize: 11, bold: true, color: '#26364A' },
        signature: { fontSize: 8, color: '#64748B', alignment: 'center', margin: [0, 6, 0, 0] }
      }
    };
    const blob = await pdfMake.createPdf(definition).getBlob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const reference = (item.numInterno || reserva.codReserva || 'prepago').replace(/[^a-zA-Z0-9_-]/g, '_');
    link.href = url;
    link.download = `Comprobante_Prepago_${reference}.pdf`;
    link.rel = 'noopener';
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }

  private cell(label: string, value: string): { stack: Array<{ text: string; style: string }> } {
    return {
      stack: [
        { text: label.toUpperCase(), style: 'label' },
        { text: value || 'N/D', style: 'value' }
      ]
    };
  }

  private date(value: string): string {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value || 'N/D' : new Intl.DateTimeFormat('es-CR').format(date);
  }

  private async getPdfMake(): Promise<PdfMakeBrowser> {
    if (!this.pdfMakePromise) {
      this.pdfMakePromise = Promise.all([import('pdfmake/build/pdfmake'), import('pdfmake/build/vfs_fonts')]).then(
        ([pdfMakeModule, fontsModule]) => {
          const pdfMake =
            (pdfMakeModule as unknown as { default?: PdfMakeBrowser }).default ?? (pdfMakeModule as unknown as PdfMakeBrowser);
          const fonts =
            (fontsModule as unknown as { default?: Record<string, string> }).default ?? (fontsModule as unknown as Record<string, string>);
          pdfMake.addVirtualFileSystem(fonts);
          return pdfMake;
        }
      );
    }
    return this.pdfMakePromise;
  }
}
