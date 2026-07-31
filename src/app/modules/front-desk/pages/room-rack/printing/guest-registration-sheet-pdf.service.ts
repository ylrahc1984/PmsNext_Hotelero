import { Injectable, inject } from '@angular/core';
import type {
  Content,
  TableCell,
  TCreatedPdf,
  TDocumentDefinitions
} from 'pdfmake/interfaces';

import { EmpresaContextService } from 'src/app/core/services/empresa-context.service';

type PdfMakeBrowser = {
  addVirtualFileSystem(vfs: Record<string, string>): void;
  createPdf(documentDefinition: TDocumentDefinitions): TCreatedPdf;
};

export type GuestRegistrationSheetOpenResult = 'opened' | 'downloaded';

@Injectable({ providedIn: 'root' })
export class GuestRegistrationSheetPdfService {
  private readonly empresaContext = inject(EmpresaContextService);
  private pdfMakePromise?: Promise<PdfMakeBrowser>;
  private lamiaLogoPromise?: Promise<string>;

  async open(operationalDate: string): Promise<GuestRegistrationSheetOpenResult> {
    const previewWindow = this.reservePreviewWindow();

    try {
      const [pdfMake, lamiaLogo] = await Promise.all([
        this.getPdfMake(),
        this.getLamiaLogo()
      ]);
      const blob = await pdfMake
        .createPdf(this.buildDocumentDefinition(operationalDate, lamiaLogo))
        .getBlob();

      if (previewWindow && !previewWindow.closed) {
        const objectUrl = URL.createObjectURL(blob);
        previewWindow.location.replace(objectUrl);
        window.setTimeout(() => URL.revokeObjectURL(objectUrl), 300_000);
        return 'opened';
      }

      this.downloadBlob(blob, this.filename(operationalDate));
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

  private async getLamiaLogo(): Promise<string> {
    if (!this.lamiaLogoPromise) {
      const logoUrl = new URL('assets/images/logo_lamia.jpeg', document.baseURI).toString();
      this.lamiaLogoPromise = fetch(logoUrl)
        .then((response) => {
          if (!response.ok) {
            throw new Error(`No se pudo cargar el logo de Lamia (${response.status}).`);
          }
          return response.blob();
        })
        .then((blob) => this.blobToDataUrl(blob));
    }

    return this.lamiaLogoPromise;
  }

  private blobToDataUrl(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error ?? new Error('No se pudo leer el logo de Lamia.'));
      reader.readAsDataURL(blob);
    });
  }

  private buildDocumentDefinition(operationalDate: string, lamiaLogo: string): TDocumentDefinitions {
    const company = this.empresaContext.empresa();
    const companyName = (company?.MA04_Nombre || company?.MA04_RazonSocial || 'HOTEL').trim();
    const legalName = (company?.MA04_RazonSocial || '').trim();
    const contact = [
      company?.MA04_Direccion,
      [company?.MA04_Ciudad, company?.MA04_Pais].filter(Boolean).join(', '),
      company?.MA04_Telefono1 ? `Tel. ${company.MA04_Telefono1}` : '',
      company?.MA04_Email
    ].filter(Boolean).join('  |  ');
    const guestRows = Array.from({ length: 4 }, (_, index) => this.guestRow(index + 1));

    return {
      pageSize: 'LETTER',
      pageOrientation: 'portrait',
      pageMargins: [36, 28, 36, 38],
      info: {
        title: 'Hoja de Registro de Huéspedes',
        author: companyName,
        subject: 'Registro de huéspedes de la estancia'
      },
      defaultStyle: {
        font: 'Roboto',
        fontSize: 8.2,
        color: '#26364A',
        lineHeight: 1.08
      },
      footer: (currentPage: number, pageCount: number): Content => ({
        margin: [36, 8, 36, 0],
        columns: [
          {
            text: 'Documento para uso interno del hotel',
            color: '#718096',
            fontSize: 7
          },
          {
            text: `Página ${currentPage} de ${pageCount}`,
            alignment: 'right',
            color: '#718096',
            fontSize: 7
          }
        ]
      }),
      content: [
        {
          columns: [
            {
              width: 82,
              image: lamiaLogo,
              fit: [76, 66],
              alignment: 'left',
              margin: [0, -2, 0, 0]
            },
            {
              width: '*',
              stack: [
                { text: companyName, style: 'companyName' },
                ...(legalName && legalName.toUpperCase() !== companyName.toUpperCase()
                  ? [{ text: legalName, style: 'legalName' } as Content]
                  : []),
                ...(contact ? [{ text: contact, style: 'companyMeta' } as Content] : [])
              ]
            },
            {
              width: 170,
              stack: [
                { text: 'HOJA DE REGISTRO', style: 'documentTitle' },
                { text: 'HUÉSPEDES DE LA ESTANCIA', style: 'documentSubtitle' }
              ],
              margin: [12, 4, 0, 0]
            }
          ]
        },
        {
          canvas: [{
            type: 'line',
            x1: 0,
            y1: 0,
            x2: 540,
            y2: 0,
            lineWidth: 1.8,
            lineColor: '#167D8D'
          }],
          margin: [0, 9, 0, 10]
        },
        {
          table: {
            widths: [65, '*', 75, '*'],
            body: [
              this.stayInfoRow('Habitación', '', 'Reserva', ''),
              this.stayInfoRow('Llegada', operationalDate, 'Salida', ''),
              this.stayInfoRow('Titular', '', 'Fecha registro', operationalDate),
              this.stayInfoRow('Adultos', '', 'Niños', ''),
              this.wideInfoRow('Placa del vehículo', ''),
              this.wideInfoRow('Comentarios', '')
            ]
          },
          layout: {
            hLineWidth: () => 0.55,
            vLineWidth: () => 0.55,
            hLineColor: () => '#CCD7E2',
            vLineColor: () => '#CCD7E2',
            paddingTop: () => 5,
            paddingBottom: () => 5,
            paddingLeft: () => 5,
            paddingRight: () => 5
          },
          margin: [0, 0, 0, 9]
        },
        {
          columns: [
            {
              text: 'REGISTRO DE HUÉSPEDES',
              bold: true,
              fontSize: 9,
              color: '#167D8D',
              characterSpacing: 0.65
            },
            {
              text: 'Complete una fila por persona y escriba con letra legible.',
              alignment: 'right',
              fontSize: 7.5,
              color: '#66758A'
            }
          ],
          margin: [0, 0, 0, 5]
        },
        {
          table: {
            headerRows: 1,
            keepWithHeaderRows: 1,
            widths: [16, 54, 95, 54, 62, 105, 104],
            heights: (rowIndex: number) => rowIndex === 0 ? 24 : 44,
            body: [
              [
                this.tableHeader('#', 'center'),
                this.tableHeader('Pasaporte / ID', 'left'),
                this.tableHeader('Nombre completo', 'left'),
                this.tableHeader('Nacionalidad', 'left'),
                this.tableHeader('Teléfono', 'left'),
                this.tableHeader('Correo electrónico', 'left'),
                this.tableHeader('Firma', 'center')
              ],
              ...guestRows
            ]
          },
          layout: {
            fillColor: (rowIndex: number) => rowIndex > 0 && rowIndex % 2 === 0 ? '#F7FAFC' : null,
            hLineWidth: () => 0.65,
            vLineWidth: () => 0.65,
            hLineColor: () => '#BFCBD7',
            vLineColor: () => '#BFCBD7',
            paddingTop: (rowIndex: number) => rowIndex === 0 ? 5 : 6,
            paddingBottom: (rowIndex: number) => rowIndex === 0 ? 5 : 6,
            paddingLeft: () => 3,
            paddingRight: () => 3
          }
        },
        {
          table: {
            widths: ['*'],
            body: [[{
              stack: [
                {
                  text: 'GUEST ACKNOWLEDGEMENT',
                  style: 'acknowledgementTitle'
                },
                {
                  text: "By signing below, I hereby confirm that I have read, understood, and accepted the hotel's terms and conditions stated below.",
                  style: 'acknowledgementBody'
                },
                {
                  columns: [
                    {
                      width: '*',
                      stack: [
                        { text: 'Guest Signature:', bold: true, fontSize: 7.6, color: '#405469' },
                        {
                          canvas: [{
                            type: 'line',
                            x1: 0,
                            y1: 0,
                            x2: 330,
                            y2: 0,
                            lineWidth: 0.7,
                            lineColor: '#6B7D90'
                          }],
                          margin: [0, 15, 0, 0]
                        }
                      ]
                    },
                    { width: 24, text: '' },
                    {
                      width: 130,
                      stack: [
                        { text: 'Date:', bold: true, fontSize: 7.6, color: '#405469' },
                        {
                          canvas: [{
                            type: 'line',
                            x1: 0,
                            y1: 0,
                            x2: 124,
                            y2: 0,
                            lineWidth: 0.7,
                            lineColor: '#6B7D90'
                          }],
                          margin: [0, 15, 0, 0]
                        }
                      ]
                    }
                  ],
                  margin: [0, 10, 0, 13]
                },
                {
                  text: 'IMPORTANT INFORMATION',
                  style: 'importantTitle'
                },
                {
                  text: [
                    { text: '1. ', bold: true },
                    'Guests must present a valid passport or government-issued ID and the credit card used for the reservation upon check-in.'
                  ],
                  style: 'importantBody'
                },
                {
                  text: [
                    { text: '2. ', bold: true },
                    "The total amount of the reservation will be charged upon arrival at the hotel, according to the amount stated above. A copy of the corresponding invoice will be sent to the guest's email address."
                  ],
                  style: 'importantBody',
                  margin: [0, 5, 0, 0]
                }
              ],
              fillColor: '#F4F8FA',
              margin: [10, 9, 10, 9]
            }]]
          },
          layout: {
            hLineWidth: () => 0.7,
            vLineWidth: () => 0.7,
            hLineColor: () => '#C7D5DE',
            vLineColor: () => '#C7D5DE',
            paddingTop: () => 0,
            paddingBottom: () => 0,
            paddingLeft: () => 0,
            paddingRight: () => 0
          },
          margin: [0, 10, 0, 0],
          unbreakable: true
        }
      ],
      styles: {
        companyName: {
          bold: true,
          fontSize: 13,
          color: '#17364F'
        },
        legalName: {
          fontSize: 8.2,
          color: '#4C5F73',
          margin: [0, 2, 0, 0]
        },
        companyMeta: {
          fontSize: 6.8,
          color: '#66758A',
          margin: [0, 3, 0, 0]
        },
        documentTitle: {
          alignment: 'right',
          bold: true,
          fontSize: 13,
          color: '#17364F',
          characterSpacing: 0.7
        },
        documentSubtitle: {
          alignment: 'right',
          bold: true,
          fontSize: 8,
          color: '#167D8D',
          characterSpacing: 0.8,
          margin: [0, 3, 0, 0]
        },
        acknowledgementTitle: {
          bold: true,
          fontSize: 9.2,
          color: '#17364F',
          characterSpacing: 0.65,
          margin: [0, 0, 0, 5]
        },
        acknowledgementBody: {
          fontSize: 7.7,
          color: '#405469',
          lineHeight: 1.15
        },
        importantTitle: {
          bold: true,
          fontSize: 8.7,
          color: '#167D8D',
          characterSpacing: 0.55,
          margin: [0, 0, 0, 5]
        },
        importantBody: {
          fontSize: 7.4,
          color: '#405469',
          lineHeight: 1.18
        }
      }
    };
  }

  private stayInfoRow(labelA: string, valueA: string, labelB: string, valueB: string): TableCell[] {
    return [
      this.infoLabel(labelA), this.infoValue(valueA),
      this.infoLabel(labelB), this.infoValue(valueB)
    ];
  }

  private wideInfoRow(label: string, value: string): TableCell[] {
    return [
      this.infoLabel(label),
      {
        text: value || ' ',
        bold: Boolean(value),
        color: '#26364A',
        colSpan: 3
      },
      { text: '' },
      { text: '' }
    ];
  }

  private infoLabel(text: string): TableCell {
    return {
      text,
      bold: true,
      fontSize: 7.2,
      color: '#52677A',
      fillColor: '#EDF3F6'
    };
  }

  private infoValue(text: string): TableCell {
    return {
      text: text || ' ',
      bold: Boolean(text),
      color: '#26364A'
    };
  }

  private tableHeader(text: string, alignment: 'left' | 'center'): TableCell {
    return {
      text,
      alignment,
      bold: true,
      fontSize: 6.6,
      color: '#FFFFFF',
      fillColor: '#173A56'
    };
  }

  private guestRow(index: number): TableCell[] {
    return [
      { text: String(index), alignment: 'center', bold: true, color: '#718096', margin: [0, 9, 0, 0] },
      { text: '' },
      { text: '' },
      { text: '' },
      { text: '' },
      { text: '' },
      { text: '' }
    ];
  }

  private reservePreviewWindow(): Window | null {
    const preview = window.open('', '_blank');
    if (!preview) {
      return null;
    }

    preview.opener = null;
    preview.document.title = 'Generando hoja de registro';
    preview.document.body.innerHTML =
      '<div style="font:600 15px Arial,sans-serif;color:#334155;padding:32px">Generando hoja de registro PDF...</div>';
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

  private filename(operationalDate: string): string {
    const safeDate = (operationalDate || 'sin-fecha').replace(/[^0-9]+/g, '-');
    return `Hoja_Registro_Huespedes_${safeDate}.pdf`;
  }
}
