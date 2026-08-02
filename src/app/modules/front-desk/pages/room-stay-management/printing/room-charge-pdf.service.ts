import { Injectable, inject } from '@angular/core';
import { firstValueFrom, timer } from 'rxjs';
import { retry } from 'rxjs/operators';
import type {
  Column,
  Content,
  TableCell,
  TDocumentDefinitions,
  TCreatedPdf
} from 'pdfmake/interfaces';

import { EmpresaContextService } from 'src/app/core/services/empresa-context.service';
import { formatPmsDateTimeDDMMYYYY } from 'src/app/core/utils/pms-date.util';
import {
  RoomChargeLookupDetail,
  RoomChargeLookupResponse,
  RoomStayManagementService
} from '../services/room-stay-management.service';

type PdfMakeBrowser = {
  addVirtualFileSystem(vfs: Record<string, string>): void;
  createPdf(documentDefinition: TDocumentDefinitions): TCreatedPdf;
};

export type RoomChargePdfOpenResult = 'opened' | 'downloaded';

@Injectable({
  providedIn: 'root'
})
export class RoomChargePdfService {
  private readonly roomStayService = inject(RoomStayManagementService);
  private readonly empresaContext = inject(EmpresaContextService);
  private pdfMakePromise?: Promise<PdfMakeBrowser>;

  async openByOperation(numeroOperacion: string): Promise<RoomChargePdfOpenResult> {
    const numCrgHab = (numeroOperacion || '').trim();
    if (!numCrgHab) {
      throw new Error('El cargo no contiene un numero de operacion para generar el PDF.');
    }

    const previewWindow = this.reservePreviewWindow();

    try {
      const response = await firstValueFrom(
        this.roomStayService
          .getRoomChargeDetailByNumber(numCrgHab)
          .pipe(
            retry({
              count: 2,
              delay: (_error, retryCount) => timer(retryCount * 500)
            })
          )
      );
      this.validateResponse(response);

      const pdfMake = await this.getPdfMake();
      const pdf = pdfMake.createPdf(this.buildDocumentDefinition(response));
      const blob = await pdf.getBlob();
      const filename = this.buildFilename(response.encabezado.numCrgHab);

      if (previewWindow && !previewWindow.closed) {
        const objectUrl = URL.createObjectURL(blob);
        previewWindow.location.replace(objectUrl);
        window.setTimeout(() => URL.revokeObjectURL(objectUrl), 300_000);
        return 'opened';
      }

      this.downloadBlob(blob, filename);
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

  private buildDocumentDefinition(response: RoomChargeLookupResponse): TDocumentDefinitions {
    const header = response.encabezado;
    const details = response.detalles.filter(
      (item) => Boolean((item.nomConsumo || item.codConsumo || '').trim())
        && Number(item.cantidad) > 0
    );
    const company = this.empresaContext.empresa();
    const companyName = (company?.MA04_Nombre || company?.MA04_RazonSocial || 'HOTEL').trim();
    const legalName = (company?.MA04_RazonSocial || '').trim();
    const currency = header.moneda || details[0]?.moneda || '';
    const discount = this.roundMoney(details.reduce((sum, item) => sum + this.number(item.descuento), 0));
    const detailTotal = this.roundMoney(details.reduce((sum, item) => sum + this.number(item.total), 0));
    const subtotal = this.roundMoney(detailTotal + discount);
    const total = Number.isFinite(Number(header.mtoTot))
      ? this.roundMoney(Number(header.mtoTot))
      : detailTotal;
    const isAnnulled = this.isAnnulled(header.estado);
    const firstDetail = details[0];
    const order = [firstDetail?.tipNPedido, firstDetail?.numNPedido].filter(Boolean).join('-') || '-';
    const generatedAt = new Date();
    const contact = [
      company?.MA04_Direccion,
      [company?.MA04_Ciudad, company?.MA04_Pais].filter(Boolean).join(', '),
      company?.MA04_Telefono1 ? `Tel. ${company.MA04_Telefono1}` : '',
      company?.MA04_Email
    ].filter(Boolean).join('  |  ');

    return {
      pageSize: 'LETTER',
      pageMargins: [48, 44, 48, 58],
      info: {
        title: `Cargo a habitacion ${header.numCrgHab}`,
        author: companyName,
        subject: 'Comprobante de cargo a habitacion'
      },
      defaultStyle: {
        font: 'Roboto',
        fontSize: 9,
        color: '#26364A',
        lineHeight: 1.15
      },
      footer: (currentPage: number, pageCount: number): Content => ({
        margin: [48, 12, 48, 0],
        columns: [
          {
            text: `Generado ${this.formatDateTime(generatedAt)}  |  Operador: ${header.operador || '-'}`,
            color: '#66758A',
            fontSize: 7.5
          },
          {
            text: `Pagina ${currentPage} de ${pageCount}`,
            alignment: 'right',
            color: '#66758A',
            fontSize: 7.5
          }
        ]
      }),
      content: [
        {
          text: companyName,
          style: 'companyName'
        },
        ...(legalName && legalName.toUpperCase() !== companyName.toUpperCase()
          ? [{ text: legalName, style: 'legalName' } as Content]
          : []),
        ...(company?.MA04_Ruc
          ? [{ text: `Cedula juridica: ${company.MA04_Ruc}`, style: 'companyMeta' } as Content]
          : []),
        ...(contact
          ? [{ text: contact, style: 'companyMeta', margin: [18, 2, 18, 0] } as Content]
          : []),
        {
          canvas: [
            {
              type: 'line',
              x1: 0,
              y1: 0,
              x2: 516,
              y2: 0,
              lineWidth: 1.6,
              lineColor: '#167D8D'
            }
          ],
          margin: [0, 15, 0, 15]
        },
        {
          text: 'COMPROBANTE DE CARGO A HABITACION',
          style: 'documentTitle'
        },
        {
          table: {
            widths: ['*'],
            body: [
              [
                {
                  text: isAnnulled ? 'CARGO ANULADO - COPIA' : 'COPIA / REIMPRESION',
                  alignment: 'center',
                  bold: true,
                  color: isAnnulled ? '#9F2D2D' : '#116878',
                  fillColor: isAnnulled ? '#FDE8E8' : '#E7F5F7',
                  margin: [5, 5, 5, 5]
                }
              ]
            ]
          },
          layout: 'noBorders',
          margin: [160, 7, 160, 8]
        },
        {
          text: [header.tipCrgHab, header.numCrgHab].filter(Boolean).join(' '),
          style: 'operationNumber'
        },
        {
          table: {
            widths: [76, '*', 76, '*'],
            body: [
              this.infoRow('Habitacion', header.numHab, 'Reserva', header.codReserva),
              this.infoRow('Huespedes', header.nombrePax, 'Documento', header.numDocu || header.codReserva),
              this.infoRow('Fecha y hora', [header.fecha, header.hora].filter(Boolean).join(' '), 'Punto de venta', header.pntVenta),
              this.infoRow('Mesero', firstDetail?.codMozo, 'Nota pedido', order)
            ]
          },
          layout: {
            hLineWidth: () => 0.6,
            vLineWidth: () => 0,
            hLineColor: () => '#DCE4EC',
            paddingTop: () => 6,
            paddingBottom: () => 6,
            paddingLeft: () => 5,
            paddingRight: () => 5
          },
          margin: [0, 14, 0, 18]
        },
        {
          text: 'DETALLE DEL CONSUMO',
          style: 'sectionTitle'
        },
        {
          table: {
            headerRows: 1,
            keepWithHeaderRows: 1,
            widths: [38, '*', 76, 68, 78],
            body: [
              [
                this.tableHeader('Cant.', 'center'),
                this.tableHeader('Descripcion', 'left'),
                this.tableHeader('Precio unit.', 'right'),
                this.tableHeader('Descuento', 'right'),
                this.tableHeader('Total', 'right')
              ],
              ...this.detailRows(details, currency)
            ]
          },
          layout: {
            fillColor: (rowIndex: number) => rowIndex > 0 && rowIndex % 2 === 0 ? '#F7F9FC' : null,
            hLineWidth: (rowIndex: number) => rowIndex === 0 ? 0 : 0.5,
            vLineWidth: () => 0,
            hLineColor: () => '#DCE4EC',
            paddingTop: () => 7,
            paddingBottom: () => 7,
            paddingLeft: () => 6,
            paddingRight: () => 6
          }
        },
        {
          columns: [
            {
              width: '*',
              stack: [
                { text: 'Cargo aplicado al folio de la habitacion.', style: 'folioNote' },
                { text: `Moneda: ${currency || '-'}`, style: 'folioMeta' }
              ],
              margin: [0, 18, 25, 0]
            },
            {
              width: 210,
              table: {
                widths: ['*', 92],
                body: [
                  this.totalRow('Subtotal', subtotal, currency),
                  ...(discount > 0 ? [this.totalRow('Descuento', -discount, currency)] : []),
                  [
                    {
                      text: 'TOTAL',
                      bold: true,
                      color: '#FFFFFF',
                      fillColor: '#153A56',
                      margin: [6, 8, 6, 8]
                    },
                    {
                      text: this.money(total, currency),
                      alignment: 'right',
                      bold: true,
                      color: '#FFFFFF',
                      fillColor: '#153A56',
                      margin: [6, 8, 6, 8]
                    }
                  ]
                ]
              },
              layout: {
                hLineWidth: () => 0.5,
                vLineWidth: () => 0,
                hLineColor: () => '#DCE4EC'
              },
              margin: [0, 15, 0, 0]
            }
          ]
        },
        {
          columns: [
            this.signatureBlock('Firma del huesped'),
            { width: 42, text: '' },
            this.signatureBlock('Firma de recepcion')
          ],
          margin: [20, 28, 20, 0],
          unbreakable: true
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
          fontSize: 15,
          color: '#17364F',
          characterSpacing: 0.8
        },
        operationNumber: {
          alignment: 'center',
          bold: true,
          fontSize: 11,
          color: '#41556B'
        },
        sectionTitle: {
          bold: true,
          fontSize: 9,
          color: '#167D8D',
          characterSpacing: 0.7,
          margin: [0, 0, 0, 7]
        },
        folioNote: {
          bold: true,
          fontSize: 8.5,
          color: '#3C5065'
        },
        folioMeta: {
          fontSize: 8,
          color: '#66758A',
          margin: [0, 4, 0, 0]
        }
      }
    };
  }

  private detailRows(details: RoomChargeLookupDetail[], currency: string): TableCell[][] {
    const rows: TableCell[][] = [];

    details.forEach((item, index) => {
      const description = (item.nomConsumo || item.codConsumo || `Consumo ${index + 1}`).trim();
      const comment = this.meaningfulComment(item.comentario);
      const row: TableCell[] = [
        { text: this.quantity(item.cantidad), alignment: 'center' },
        {
          text: [
            { text: description, bold: true, color: '#26364A' },
            ...(item.codConsumo ? [{ text: `\n${item.codConsumo}`, fontSize: 7, color: '#728197' }] : [])
          ]
        },
        { text: this.money(item.precio, item.moneda || currency), alignment: 'right' },
        { text: this.number(item.descuento) > 0 ? this.money(item.descuento, item.moneda || currency) : '-', alignment: 'right' },
        { text: this.money(item.total, item.moneda || currency), alignment: 'right', bold: true }
      ];

      rows.push(row);

      if (comment) {
        rows.push([
          { text: '', colSpan: 1 },
          {
            text: `Comentario: ${comment}`,
            colSpan: 4,
            italics: true,
            fontSize: 7.5,
            color: '#66758A',
            margin: [0, -3, 0, 2]
          },
          { text: '' },
          { text: '' },
          { text: '' }
        ]);
      }
    });

    return rows;
  }

  private infoRow(labelA: string, valueA: unknown, labelB: string, valueB: unknown): TableCell[] {
    return [
      { text: labelA, bold: true, color: '#66758A', fontSize: 8 },
      { text: this.display(valueA), color: '#26364A' },
      { text: labelB, bold: true, color: '#66758A', fontSize: 8 },
      { text: this.display(valueB), color: '#26364A' }
    ];
  }

  private tableHeader(text: string, alignment: 'left' | 'center' | 'right'): TableCell {
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
      { text: label, color: '#536579', margin: [6, 5, 6, 5] },
      { text: this.money(value, currency), alignment: 'right', bold: true, margin: [6, 5, 6, 5] }
    ];
  }

  private signatureBlock(label: string): Column {
    return {
      width: '*',
      stack: [
        {
          canvas: [
            {
              type: 'line',
              x1: 0,
              y1: 0,
              x2: 205,
              y2: 0,
              lineWidth: 0.7,
              lineColor: '#78879A'
            }
          ]
        },
        {
          text: label,
          alignment: 'center',
          fontSize: 8,
          color: '#66758A',
          margin: [0, 5, 0, 0]
        }
      ]
    };
  }

  private validateResponse(response: RoomChargeLookupResponse): void {
    if (!response?.encabezado?.numCrgHab) {
      throw new Error('El encabezado del cargo no esta disponible para generar el PDF.');
    }

    const hasDetails = (response.detalles || []).some(
      (item) => Boolean((item.nomConsumo || item.codConsumo || '').trim())
        && Number(item.cantidad) > 0
    );
    if (!hasDetails) {
      throw new Error('El cargo no contiene lineas validas para generar el PDF.');
    }
  }

  private reservePreviewWindow(): Window | null {
    const preview = window.open('', '_blank');
    if (!preview) {
      return null;
    }

    preview.opener = null;
    preview.document.title = 'Generando comprobante';
    preview.document.body.innerHTML =
      '<div style="font:600 15px Arial,sans-serif;color:#334155;padding:32px">Generando comprobante PDF...</div>';
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

  private buildFilename(operation: string): string {
    const safeOperation = (operation || 'cargo').replace(/[^a-zA-Z0-9_-]+/g, '-');
    return `Cargo_Habitacion_${safeOperation}.pdf`;
  }

  private meaningfulComment(value: string): string {
    const comment = (value || '').trim();
    const normalized = comment.toUpperCase();
    return !comment || normalized === 'SIN COMENTARIO' || normalized === 'N/A' || normalized === 'N/D'
      ? ''
      : comment;
  }

  private quantity(value: unknown): string {
    const quantity = this.number(value);
    return Number.isInteger(quantity)
      ? quantity.toFixed(0)
      : quantity.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
  }

  private money(value: unknown, currency: string): string {
    const amount = this.number(value);
    const formatted = new Intl.NumberFormat('es-CR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
    return [formatted, currency].filter(Boolean).join(' ');
  }

  private formatDateTime(value: Date): string {
    return formatPmsDateTimeDDMMYYYY(value);
  }

  private isAnnulled(value: unknown): boolean {
    const state = String(value ?? '').trim().toUpperCase();
    return state === '1' || state === 'ANU' || state === 'ANULADO';
  }

  private display(value: unknown): string {
    const text = String(value ?? '').trim();
    return text || '-';
  }

  private number(value: unknown): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private roundMoney(value: number): number {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }
}
