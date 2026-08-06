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
      const validatedBlob = await this.validatePdfBlob(blob);
      const filename = this.filename(operationalDate);

      if (previewWindow && !previewWindow.closed) {
        this.renderPreview(previewWindow, validatedBlob, filename);
        return 'opened';
      }

      this.downloadBlob(validatedBlob, filename);
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
        title: 'Guest Registration Form',
        author: companyName,
        subject: 'Guest registration for the stay'
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
            text: 'For hotel use only',
            color: '#718096',
            fontSize: 7
          },
          {
            text: `Page ${currentPage} of ${pageCount}`,
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
                { text: 'GUEST REGISTRATION', style: 'documentTitle' },
                { text: 'ALL OCCUPANTS', style: 'documentSubtitle' }
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
              this.stayInfoRow('Room', '', 'Reservation', ''),
              this.stayInfoRow('Arrival', operationalDate, 'Departure', ''),
              this.stayInfoRow('Primary guest', '', 'Registration date', operationalDate),
              this.stayInfoRow('Adults', '', 'Children', ''),
              this.wideInfoRow('Vehicle license plate', ''),
              this.wideInfoRow('Comments', ''),
              this.wideInfoRow('Allergies', '')
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
              text: 'GUEST DETAILS',
              bold: true,
              fontSize: 9,
              color: '#167D8D',
              characterSpacing: 0.65
            },
            {
              text: 'Complete one row per guest. Please print clearly.',
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
            widths: [16, 66, 95, 48, 62, 105, 98],
            heights: (rowIndex: number) => rowIndex === 0 ? 22 : 36,
            body: [
              [
                this.tableHeader('#', 'center'),
                this.tableHeader('Passport / ID', 'left'),
                this.tableHeader('Full name', 'left'),
                this.tableHeader('Nationality', 'left'),
                this.tableHeader('Phone', 'left'),
                this.tableHeader('Email address', 'left'),
                this.tableHeader('Signature', 'center')
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
      { text: String(index), alignment: 'center', bold: true, color: '#718096', margin: [0, 6, 0, 0] },
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
    preview.document.title = 'Generating guest registration form';
    preview.document.body.innerHTML =
      '<div style="font:600 15px Arial,sans-serif;color:#334155;padding:32px">Generating guest registration PDF...</div>';
    return preview;
  }

  private async validatePdfBlob(blob: Blob): Promise<Blob> {
    if (!(blob instanceof Blob) || blob.size < 5) {
      throw new Error('The generated guest registration PDF is empty.');
    }

    const signatureBytes = new Uint8Array(await blob.slice(0, 5).arrayBuffer());
    const signature = String.fromCharCode(...signatureBytes);
    if (signature !== '%PDF-') {
      throw new Error('The generated guest registration file is not a valid PDF.');
    }

    return blob.type === 'application/pdf'
      ? blob
      : new Blob([blob], { type: 'application/pdf' });
  }

  private renderPreview(preview: Window, blob: Blob, filename: string): void {
    const objectUrl = URL.createObjectURL(blob);
    const doc = preview.document;

    doc.open();
    doc.write(`<!doctype html>
      <html lang="en">
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>Guest Registration Form</title>
          <style>
            * { box-sizing: border-box; }
            html, body { width: 100%; height: 100%; margin: 0; }
            body { display: grid; grid-template-rows: auto minmax(0, 1fr); overflow: hidden; background: #e8eef5; color: #17364f; font-family: Arial, sans-serif; }
            .toolbar { display: flex; align-items: center; justify-content: space-between; gap: 18px; min-height: 68px; padding: 12px 20px; background: #fff; border-bottom: 1px solid #ced9e5; box-shadow: 0 4px 16px rgba(15, 35, 55, .08); }
            .title { min-width: 0; }
            .title strong, .title span { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
            .title strong { font-size: 16px; }
            .title span { margin-top: 3px; color: #64748b; font-size: 12px; }
            .download { display: inline-flex; align-items: center; justify-content: center; min-height: 42px; padding: 0 18px; border-radius: 10px; color: #fff; background: #1554c8; box-shadow: 0 8px 18px rgba(21, 84, 200, .22); font-size: 14px; font-weight: 700; text-decoration: none; white-space: nowrap; }
            .viewer { position: relative; min-height: 0; padding: 12px; }
            .viewer iframe { position: relative; z-index: 1; width: 100%; height: 100%; border: 0; border-radius: 10px; background: #fff; box-shadow: 0 12px 34px rgba(15, 35, 55, .14); }
            .fallback { position: absolute; inset: 12px; display: grid; place-items: center; padding: 32px; color: #5f7084; background: #fff; text-align: center; }
            @media (max-width: 640px) { .toolbar { align-items: stretch; flex-direction: column; } .download { width: 100%; } }
          </style>
        </head>
        <body>
          <header class="toolbar">
            <div class="title"><strong>Guest Registration Form</strong><span id="filename"></span></div>
            <a id="download" class="download">Download PDF</a>
          </header>
          <main class="viewer">
            <div class="fallback">If the preview remains blank, use the Download PDF button above.</div>
            <iframe id="pdfViewer" title="Guest Registration Form PDF"></iframe>
          </main>
        </body>
      </html>`);
    doc.close();

    const filenameNode = doc.getElementById('filename');
    const downloadLink = doc.getElementById('download') as HTMLAnchorElement | null;
    const viewer = doc.getElementById('pdfViewer') as HTMLIFrameElement | null;
    if (!filenameNode || !downloadLink || !viewer) {
      URL.revokeObjectURL(objectUrl);
      throw new Error('The PDF preview could not be initialized.');
    }

    filenameNode.textContent = filename;
    downloadLink.href = objectUrl;
    downloadLink.download = filename;
    downloadLink.rel = 'noopener';
    viewer.src = objectUrl;

    let released = false;
    const releaseObjectUrl = (): void => {
      if (released) return;
      released = true;
      URL.revokeObjectURL(objectUrl);
    };
    preview.addEventListener('beforeunload', releaseObjectUrl, { once: true });
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
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
  }

  private filename(operationalDate: string): string {
    const safeDate = operationalDate.replace(/[^0-9]+/g, '-') || 'undated';
    return `Guest_Registration_Form_${safeDate}.pdf`;
  }
}
