import { Injectable, inject } from '@angular/core';
import type {
  Content,
  TableCell,
  TCreatedPdf,
  TDocumentDefinitions
} from 'pdfmake/interfaces';

import { EmpresaContextService } from 'src/app/core/services/empresa-context.service';
import {
  RoomStatementCharge,
  RoomStatementData,
  RoomStatementTotals
} from './room-statement.model';
import { RoomStatementDataService } from './room-statement-data.service';

type PdfMakeBrowser = {
  addVirtualFileSystem(vfs: Record<string, string>): void;
  createPdf(documentDefinition: TDocumentDefinitions): TCreatedPdf;
};

export type RoomStatementPdfOpenResult = 'opened' | 'downloaded';

@Injectable({ providedIn: 'root' })
export class RoomStatementPdfService {
  private readonly dataService = inject(RoomStatementDataService);
  private readonly empresaContext = inject(EmpresaContextService);
  private pdfMakePromise?: Promise<PdfMakeBrowser>;

  async open(roomNumber: string, reservationNumber = ''): Promise<RoomStatementPdfOpenResult> {
    const previewWindow = this.reservePreviewWindow();

    try {
      const data = await this.dataService.load(roomNumber, reservationNumber);
      const pdfMake = await this.getPdfMake();
      const blob = await pdfMake.createPdf(this.buildDocumentDefinition(data)).getBlob();

      if (previewWindow && !previewWindow.closed) {
        const objectUrl = URL.createObjectURL(blob);
        previewWindow.location.replace(objectUrl);
        window.setTimeout(() => URL.revokeObjectURL(objectUrl), 300_000);
        return 'opened';
      }

      this.downloadBlob(blob, this.filename(data));
      return 'downloaded';
    } catch (error) {
      if (previewWindow && !previewWindow.closed) {
        previewWindow.close();
      }
      throw error;
    }
  }

  private async getPdfMake(): Promise<PdfMakeBrowser> {
    if (!this.pdfMakePromise) {
      this.pdfMakePromise = Promise.all([
        import('pdfmake/build/pdfmake'),
        import('pdfmake/build/vfs_fonts')
      ]).then(([pdfMakeModule, fontsModule]) => {
        const pdfMake =
          (pdfMakeModule as unknown as { default?: PdfMakeBrowser }).default
          ?? (pdfMakeModule as unknown as PdfMakeBrowser);
        const fonts =
          (fontsModule as unknown as { default?: Record<string, string> }).default
          ?? (fontsModule as unknown as Record<string, string>);

        pdfMake.addVirtualFileSystem(fonts);
        return pdfMake;
      });
    }

    return this.pdfMakePromise;
  }

  private buildDocumentDefinition(data: RoomStatementData): TDocumentDefinitions {
    const company = this.empresaContext.empresa();
    const companyName = (company?.MA04_Nombre || company?.MA04_RazonSocial || 'HOTEL').trim();
    const legalName = (company?.MA04_RazonSocial || '').trim();
    const contact = [
      company?.MA04_Direccion,
      [company?.MA04_Ciudad, company?.MA04_Pais].filter(Boolean).join(', '),
      company?.MA04_Telefono1 ? `Tel. ${company.MA04_Telefono1}` : '',
      company?.MA04_Email
    ].filter(Boolean).join('  |  ');

    return {
      pageSize: 'LETTER',
      pageMargins: [44, 42, 44, 58],
      info: {
        title: `Estado de Cuenta - Habitacion ${data.roomNumber}`,
        author: companyName,
        subject: 'Estado de Cuenta de la estancia'
      },
      defaultStyle: {
        font: 'Roboto',
        fontSize: 8.5,
        color: '#26364A',
        lineHeight: 1.15
      },
      footer: (currentPage: number, pageCount: number): Content => ({
        margin: [44, 11, 44, 0],
        columns: [
          {
            text: `Fecha operativa: ${data.operationalDate}  |  Operador: ${data.operator || '-'}`,
            color: '#66758A',
            fontSize: 7.2
          },
          {
            text: `Pagina ${currentPage} de ${pageCount}`,
            alignment: 'right',
            color: '#66758A',
            fontSize: 7.2
          }
        ]
      }),
      content: [
        { text: companyName, style: 'companyName' },
        ...(legalName && legalName.toUpperCase() !== companyName.toUpperCase()
          ? [{ text: legalName, style: 'legalName' } as Content]
          : []),
        ...(company?.MA04_Ruc
          ? [{ text: `Cedula juridica: ${company.MA04_Ruc}`, style: 'companyMeta' } as Content]
          : []),
        ...(contact
          ? [{ text: contact, style: 'companyMeta', margin: [16, 2, 16, 0] } as Content]
          : []),
        {
          canvas: [{
            type: 'line',
            x1: 0,
            y1: 0,
            x2: 524,
            y2: 0,
            lineWidth: 1.6,
            lineColor: '#167D8D'
          }],
          margin: [0, 14, 0, 13]
        },
        { text: 'ESTADO DE CUENTA', style: 'documentTitle' },
        {
          table: {
            widths: ['*'],
            body: [[{
              text: 'DOCUMENTO INFORMATIVO - NO ES DOCUMENTO FISCAL',
              alignment: 'center',
              bold: true,
              color: '#116878',
              fillColor: '#E7F5F7',
              margin: [5, 5, 5, 5]
            }]]
          },
          layout: 'noBorders',
          margin: [115, 7, 115, 12]
        },
        {
          table: {
            widths: [74, '*', 74, '*'],
            body: [
              this.infoRow('Habitacion', data.roomNumber, 'Reserva', data.reservationNumber),
              this.infoRow('Folio master', data.masterFolio, 'Plan', data.plan),
              this.infoRow('Entrada', data.checkIn, 'Salida', data.checkOut),
              this.infoRow('Agencia', data.agency, 'Moneda', data.currency),
              [
                this.infoLabel('Huespedes'),
                {
                  text: data.guests.join(', ') || '-',
                  colSpan: 3,
                  color: '#26364A'
                },
                { text: '' },
                { text: '' }
              ]
            ]
          },
          layout: {
            hLineWidth: () => 0.55,
            vLineWidth: () => 0,
            hLineColor: () => '#DCE4EC',
            paddingTop: () => 5.5,
            paddingBottom: () => 5.5,
            paddingLeft: () => 5,
            paddingRight: () => 5
          },
          margin: [0, 0, 0, 16]
        },
        ...this.section(
          'CARGOS DE LA ESTANCIA',
          data.charges.filter((charge) => charge.bucket === 'lodging'),
          data.lodgingTotals,
          data.currency
        ),
        ...this.section(
          'CARGOS EXTRAS',
          data.charges.filter((charge) => charge.bucket === 'extras'),
          data.extraTotals,
          data.currency
        ),
        {
          columns: [
            {
              width: '*',
              stack: [
                {
                  text: 'Resumen general',
                  bold: true,
                  fontSize: 10,
                  color: '#17364F'
                },
                {
                  text: `Emitido el ${this.formatDateTime(data.generatedAt)} con informacion consultada en tiempo real.`,
                  fontSize: 7.5,
                  color: '#66758A',
                  margin: [0, 4, 28, 0]
                }
              ],
              margin: [0, 18, 0, 0]
            },
            {
              width: 225,
              table: {
                widths: ['*', 96],
                body: this.totalRows(data.totals, data.currency, true)
              },
              layout: this.totalsLayout(),
              margin: [0, 14, 0, 0]
            }
          ],
          unbreakable: true
        },
        {
          text: 'Este estado refleja los cargos disponibles al momento de su generacion y puede variar si se registran nuevas operaciones.',
          alignment: 'center',
          italics: true,
          fontSize: 7.5,
          color: '#66758A',
          margin: [30, 23, 30, 0]
        }
      ],
      styles: {
        companyName: {
          alignment: 'center',
          bold: true,
          fontSize: 18,
          color: '#17364F'
        },
        legalName: {
          alignment: 'center',
          fontSize: 9,
          color: '#4C5F73',
          margin: [0, 3, 0, 0]
        },
        companyMeta: {
          alignment: 'center',
          fontSize: 8,
          color: '#66758A',
          margin: [0, 2, 0, 0]
        },
        documentTitle: {
          alignment: 'center',
          bold: true,
          fontSize: 16,
          color: '#17364F',
          characterSpacing: 0.9
        },
        sectionTitle: {
          bold: true,
          fontSize: 9,
          color: '#167D8D',
          characterSpacing: 0.7,
          margin: [0, 0, 0, 6]
        }
      }
    };
  }

  private section(
    title: string,
    charges: RoomStatementCharge[],
    totals: RoomStatementTotals,
    currency: string
  ): Content[] {
    if (!charges.length) {
      return [
        { text: title, style: 'sectionTitle' },
        {
          text: 'Sin cargos registrados.',
          color: '#718096',
          italics: true,
          fillColor: '#F7F9FC',
          margin: [8, 7, 8, 7]
        },
        { text: '', margin: [0, 0, 0, 10] }
      ];
    }

    const rows: TableCell[][] = [[
      this.tableHeader('Fecha / Documento', 'left'),
      this.tableHeader('Detalle', 'left'),
      this.tableHeader('Total', 'right')
    ]];

    charges.forEach((charge) => {
      rows.push([
        {
          text: [
            { text: `${charge.date || '-'} ${charge.time || ''}`, bold: true },
            { text: `\n${charge.type} ${charge.number}`, fontSize: 7, color: '#6B7B8E' },
            ...(charge.pointOfSale
              ? [{ text: `\n${charge.pointOfSale}`, fontSize: 7, color: '#6B7B8E' }]
              : [])
          ],
          fillColor: '#EFF5F8'
        },
        {
          text: charge.guestName || 'Cargo de habitacion',
          bold: true,
          fillColor: '#EFF5F8'
        },
        {
          text: this.money(charge.total, currency),
          alignment: 'right',
          bold: true,
          fillColor: '#EFF5F8'
        }
      ]);

      charge.lines.forEach((line) => {
        rows.push([
          { text: '' },
          {
            text: [
              { text: `${this.quantity(line.quantity)} x ${line.description}` },
              ...(line.code ? [{ text: `\n${line.code}`, fontSize: 7, color: '#728197' }] : []),
              ...(line.comment ? [{ text: `\n${line.comment}`, fontSize: 7, italics: true, color: '#728197' }] : [])
            ]
          },
          {
            text: this.money(line.total, currency),
            alignment: 'right'
          }
        ]);
      });
    });

    return [
      { text: title, style: 'sectionTitle' },
      {
        table: {
          headerRows: 1,
          keepWithHeaderRows: 1,
          widths: [108, '*', 88],
          body: rows
        },
        layout: {
          hLineWidth: (rowIndex: number) => rowIndex === 0 ? 0 : 0.45,
          vLineWidth: () => 0,
          hLineColor: () => '#DCE4EC',
          paddingTop: () => 6,
          paddingBottom: () => 6,
          paddingLeft: () => 6,
          paddingRight: () => 6
        }
      },
      {
        columns: [
          { width: '*', text: '' },
          {
            width: 225,
            table: {
              widths: ['*', 96],
              body: this.totalRows(totals, currency, false)
            },
            layout: this.totalsLayout(),
            margin: [0, 7, 0, 15]
          }
        ],
        unbreakable: true
      }
    ];
  }

  private totalRows(
    totals: RoomStatementTotals,
    currency: string,
    emphasizeTotal: boolean
  ): TableCell[][] {
    const rows: TableCell[][] = [
      this.totalRow('Subtotal', totals.subtotal, currency),
      ...(totals.discount > 0
        ? [this.totalRow('Descuento', -totals.discount, currency)]
        : []),
      this.totalRow('Neto', totals.net, currency),
      this.totalRow('Impuestos', totals.taxes, currency)
    ];

    rows.push([
      {
        text: 'TOTAL',
        bold: true,
        color: '#FFFFFF',
        fillColor: emphasizeTotal ? '#153A56' : '#167D8D',
        margin: [6, 7, 6, 7]
      },
      {
        text: this.money(totals.total, currency),
        alignment: 'right',
        bold: true,
        color: '#FFFFFF',
        fillColor: emphasizeTotal ? '#153A56' : '#167D8D',
        margin: [6, 7, 6, 7]
      }
    ]);

    return rows;
  }

  private totalsLayout(): Record<string, unknown> {
    return {
      hLineWidth: () => 0.45,
      vLineWidth: () => 0,
      hLineColor: () => '#DCE4EC'
    };
  }

  private infoRow(labelA: string, valueA: unknown, labelB: string, valueB: unknown): TableCell[] {
    return [
      this.infoLabel(labelA),
      { text: this.display(valueA), color: '#26364A' },
      this.infoLabel(labelB),
      { text: this.display(valueB), color: '#26364A' }
    ];
  }

  private infoLabel(label: string): TableCell {
    return { text: label, bold: true, color: '#66758A', fontSize: 8 };
  }

  private tableHeader(text: string, alignment: 'left' | 'right'): TableCell {
    return {
      text,
      alignment,
      bold: true,
      color: '#FFFFFF',
      fillColor: '#153A56',
      margin: [0, 3, 0, 3]
    };
  }

  private totalRow(label: string, value: number, currency: string): TableCell[] {
    return [
      { text: label, color: '#536579', margin: [6, 4, 6, 4] },
      {
        text: this.money(value, currency),
        alignment: 'right',
        bold: true,
        margin: [6, 4, 6, 4]
      }
    ];
  }

  private reservePreviewWindow(): Window | null {
    const preview = window.open('', '_blank');
    if (!preview) {
      return null;
    }

    preview.opener = null;
    preview.document.title = 'Generando Estado de Cuenta';
    preview.document.body.innerHTML =
      '<div style="font:600 15px Arial,sans-serif;color:#334155;padding:32px">Generando Estado de Cuenta...</div>';
    return preview;
  }

  private downloadBlob(blob: Blob, filename: string): void {
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = filename;
    link.rel = 'noopener';
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
  }

  private filename(data: RoomStatementData): string {
    const room = (data.roomNumber || 'habitacion').replace(/[^a-zA-Z0-9_-]+/g, '-');
    const reservation = (data.reservationNumber || 'sin-reserva').replace(/[^a-zA-Z0-9_-]+/g, '-');
    return `Estado_Cuenta_${room}_${reservation}.pdf`;
  }

  private money(value: unknown, currency: string): string {
    const amount = Number(value);
    const formatted = new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(Number.isFinite(amount) ? amount : 0);
    return `${formatted} ${currency}`.trim();
  }

  private quantity(value: number): string {
    return Number.isInteger(value)
      ? value.toFixed(0)
      : value.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
  }

  private display(value: unknown): string {
    return String(value ?? '').trim() || '-';
  }

  private formatDateTime(value: Date): string {
    return new Intl.DateTimeFormat('es-CR', {
      dateStyle: 'short',
      timeStyle: 'short'
    }).format(value);
  }
}
