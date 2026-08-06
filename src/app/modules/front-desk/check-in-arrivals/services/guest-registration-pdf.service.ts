import { Injectable, inject } from '@angular/core';
import type { Content, TableCell, TCreatedPdf, TDocumentDefinitions } from 'pdfmake/interfaces';

import { AuthService } from 'src/app/core/services/auth.service';
import { EmpresaContextService } from 'src/app/core/services/empresa-context.service';
import { environment } from 'src/environments/environment';

import { CheckInArrival, RoomingListGuest } from '../models/check-in-arrival.model';

type PdfMakeBrowser = {
  addVirtualFileSystem(vfs: Record<string, string>): void;
  createPdf(documentDefinition: TDocumentDefinitions): TCreatedPdf;
};

export interface GuestRegistrationPdfOptions {
  generationDate?: Date;
  operator?: string;
  printWindow?: Window | null;
}

@Injectable({ providedIn: 'root' })
export class GuestRegistrationPdfService {
  private readonly empresaContext = inject(EmpresaContextService);
  private readonly authService = inject(AuthService);
  private pdfMakePromise?: Promise<PdfMakeBrowser>;
  private readonly assetPromises = new Map<string, Promise<string>>();

  reservePrintWindow(): Window | null {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return null;

    printWindow.opener = null;
    printWindow.document.title = 'Preparing Guest Registration Form';
    printWindow.document.body.innerHTML =
      '<div style="font:600 15px Arial,sans-serif;color:#334155;padding:32px">Preparing Guest Registration Form...</div>';
    return printWindow;
  }

  async printRegistrationForm(
    reservation: CheckInArrival,
    guests: RoomingListGuest[],
    options: GuestRegistrationPdfOptions = {}
  ): Promise<void> {
    const printWindow = options.printWindow ?? null;

    try {
      const [pdfMake, hotelLogo, pmsNextLogo] = await Promise.all([
        this.getPdfMake(),
        this.getAssetDataUrl('assets/images/logo_lamia.jpeg'),
        this.getAssetDataUrl('assets/images/next_logo_web_exact_icon.png')
      ]);
      const generationDate = options.generationDate ?? new Date();
      const operator = options.operator?.trim()
        || this.authService.getCurrentUser()?.usuario?.trim()
        || 'PMSNext User';
      const definition = this.buildDocumentDefinition(
        reservation,
        guests,
        hotelLogo,
        pmsNextLogo,
        generationDate,
        operator
      );
      const createdPdf = pdfMake.createPdf(definition);
      const blob = await createdPdf.getBlob();
      const validatedBlob = await this.validatePdfBlob(blob);

      if (printWindow && !printWindow.closed) {
        this.renderPrintPreview(printWindow, validatedBlob, this.filename(reservation));
      } else {
        this.printFromHiddenFrame(validatedBlob);
      }
    } catch (error) {
      if (printWindow && !printWindow.closed) printWindow.close();
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

  private getAssetDataUrl(path: string): Promise<string> {
    const existing = this.assetPromises.get(path);
    if (existing) return existing;

    const assetUrl = new URL(path, document.baseURI).toString();
    const request = fetch(assetUrl)
      .then((response) => {
        if (!response.ok) throw new Error(`Could not load PDF asset (${response.status}).`);
        return response.blob();
      })
      .then((blob) => this.blobToDataUrl(blob));
    this.assetPromises.set(path, request);
    return request;
  }

  private blobToDataUrl(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error ?? new Error('Could not read PDF asset.'));
      reader.readAsDataURL(blob);
    });
  }

  private buildDocumentDefinition(
    reservation: CheckInArrival,
    guests: RoomingListGuest[],
    hotelLogo: string,
    pmsNextLogo: string,
    generationDate: Date,
    operator: string
  ): TDocumentDefinitions {
    const company = this.empresaContext.getSnapshot();
    const hotelName = (company?.MA04_Nombre || company?.MA04_RazonSocial || 'Hotel').trim();
    const generatedAt = this.formatDateTime(generationDate);
    const orderedGuests = [...guests].sort((left, right) => Number(left.orden) - Number(right.orden));

    return {
      pageSize: 'A4',
      pageOrientation: 'portrait',
      pageMargins: [30, 28, 30, 48],
      info: {
        title: `Guest Registration Form - ${reservation.codReserva}`,
        author: hotelName,
        subject: 'Official guest registration document',
        keywords: 'guest registration, self check-in, hotel'
      },
      defaultStyle: {
        font: 'Roboto',
        fontSize: 8.3,
        color: '#26364A',
        lineHeight: 1.12
      },
      footer: (currentPage: number, pageCount: number): Content => ({
        margin: [30, 7, 30, 0],
        table: {
          widths: [62, '*', 128],
          body: [[
            { image: pmsNextLogo, fit: [52, 16], margin: [5, 3, 0, 0] },
            {
              stack: [
                { text: 'Generated automatically by PMSNext', bold: true, fontSize: 6.8, color: '#52647A' },
                { text: `${generatedAt}  |  Operator: ${operator}`, fontSize: 6.2, color: '#7A889A', margin: [0, 2, 0, 0] }
              ]
            },
            {
              text: `Version ${environment.appVersion}  |  Page ${currentPage} of ${pageCount}`,
              alignment: 'right',
              fontSize: 6.2,
              color: '#7A889A',
              margin: [0, 7, 5, 0]
            }
          ]]
        },
        layout: {
          fillColor: () => '#F4F7FB',
          hLineWidth: () => 0,
          vLineWidth: () => 0,
          paddingTop: () => 3,
          paddingBottom: () => 3,
          paddingLeft: () => 3,
          paddingRight: () => 3
        }
      }),
      content: [
        this.buildHeader(hotelLogo, hotelName),
        this.sectionTitle('RESERVATION SUMMARY', 'Your stay at a glance'),
        this.buildReservationSummary(reservation),
        this.sectionTitle('GUEST INFORMATION', `${orderedGuests.length} registered guest${orderedGuests.length === 1 ? '' : 's'}`),
        this.buildGuestTable(orderedGuests),
        this.sectionTitle('RESERVATION NOTES', 'For guest or front desk use'),
        this.buildReservationNotes(reservation),
        this.buildAcknowledgement(),
        this.buildReceptionVerification()
      ],
      styles: {
        hotelName: { bold: true, fontSize: 13.5, color: '#14213D' },
        documentTitle: { bold: true, fontSize: 17, color: '#14213D', alignment: 'right', characterSpacing: 0.25 },
        welcome: { fontSize: 7.6, color: '#66758A', lineHeight: 1.2 },
        sectionTitle: { bold: true, fontSize: 8.2, color: '#1E4ED8', characterSpacing: 0.85 },
        sectionHint: { fontSize: 6.8, color: '#8491A3', alignment: 'right' },
        acknowledgementTitle: { bold: true, fontSize: 10.2, color: '#14213D' },
        legalBody: { fontSize: 7.25, color: '#405469', lineHeight: 1.2 }
      }
    };
  }

  private buildHeader(hotelLogo: string, hotelName: string): Content {
    return {
      stack: [
        {
          columns: [
            { width: 66, image: hotelLogo, fit: [58, 50], margin: [0, -2, 0, 0] },
            {
              width: '*',
              stack: [
                { text: hotelName, style: 'hotelName', margin: [0, 4, 0, 0] },
                {
                  text: 'Welcome. We are delighted to have you with us and wish you a memorable stay.',
                  style: 'welcome',
                  margin: [0, 4, 12, 0]
                }
              ]
            },
            {
              width: 192,
              stack: [
                { text: 'GUEST REGISTRATION', style: 'documentTitle' },
                { text: 'FORM', alignment: 'right', bold: true, fontSize: 8.2, color: '#1E4ED8', characterSpacing: 2, margin: [0, 3, 0, 0] }
              ],
              margin: [8, 4, 0, 0]
            }
          ]
        },
        {
          canvas: [{ type: 'line', x1: 0, y1: 0, x2: 535, y2: 0, lineWidth: 2, lineColor: '#1E4ED8' }],
          margin: [0, 10, 0, 12]
        }
      ]
    };
  }

  private sectionTitle(title: string, hint: string): Content {
    return {
      columns: [
        { text: title, style: 'sectionTitle' },
        { text: hint, style: 'sectionHint' }
      ],
      margin: [1, 9, 1, 5]
    };
  }

  private buildReservationSummary(reservation: CheckInArrival): Content {
    return {
      table: {
        widths: [60, '*', 60, '*', 56, '*'],
        body: [
          this.summaryRow('Reservation', reservation.codReserva, 'Room', reservation.numHabita || 'To be assigned', 'Nights', String(reservation.totNoches || '')),
          this.summaryRow('Check-in', reservation.fechaIng, 'Check-out', reservation.fechaSal, 'Agency', reservation.nomAgencia || reservation.codAgencia),
          this.summaryRow('Rate', reservation.codTarifa, 'Meal plan', reservation.codPlan, 'Currency', '-'),
          this.summaryRow('Adults', String(reservation.numPax ?? ''), 'Children', String(reservation.numChild ?? ''), 'Room type', reservation.tipHabita || reservation.catHabita),
          [
            this.summaryLabel('Reservation holder'),
            { text: reservation.descripcion || ' ', bold: true, color: '#26364A', colSpan: 5, margin: [0, 2, 0, 0] },
            { text: '' }, { text: '' }, { text: '' }, { text: '' }
          ]
        ]
      },
      layout: this.cardLayout(),
      margin: [0, 0, 0, 3]
    };
  }

  private buildGuestTable(guests: RoomingListGuest[]): Content {
    const rows: TableCell[][] = guests.length
      ? guests.map((guest, index) => [
          { text: String(index + 1), alignment: 'center', bold: true, color: '#6B7C91' },
          { text: `${guest.nombre} ${guest.apellidos}`.trim() || '-' },
          { text: guest.tipDocu || '-' },
          { text: guest.numDocu || '-' },
          { text: guest.nacionalidad || '-' },
          { text: guest.email || '-' },
          { text: guest.motivo || '-' }
        ])
      : [[
          { text: '1', alignment: 'center', color: '#94A0AF' },
          { text: 'No guests registered', italics: true, color: '#7A889A', colSpan: 6, margin: [0, 7, 0, 7] },
          { text: '' }, { text: '' }, { text: '' }, { text: '' }, { text: '' }
        ]];

    return {
      table: {
        headerRows: 1,
        dontBreakRows: true,
        widths: [15, 92, 54, 62, 58, 104, 72],
        body: [
          ['#', 'Full Name', 'Document Type', 'Document Number', 'Nationality', 'Email', 'Phone Number']
            .map((text, index) => this.guestHeader(text, index === 0 ? 'center' : 'left')),
          ...rows
        ]
      },
      layout: {
        fillColor: (rowIndex: number) => rowIndex === 0 ? '#14213D' : rowIndex % 2 === 0 ? '#F7F9FC' : '#FFFFFF',
        hLineWidth: (rowIndex: number) => rowIndex === 0 ? 0 : 0.45,
        vLineWidth: () => 0,
        hLineColor: () => '#DCE3EC',
        paddingTop: (rowIndex: number) => rowIndex === 0 ? 6 : 7,
        paddingBottom: (rowIndex: number) => rowIndex === 0 ? 6 : 7,
        paddingLeft: () => 4,
        paddingRight: () => 4
      }
    };
  }

  private buildReservationNotes(reservation: CheckInArrival): Content {
    return {
      table: {
        widths: [96, '*'],
        heights: [26, 34, 26],
        body: [
          [this.noteLabel('Vehicle License Plate'), { text: ' ' }],
          [this.noteLabel('Comments'), { text: reservation.observacion || ' ', color: '#405469', margin: [0, 5, 0, 0] }],
          [this.noteLabel('Allergies'), { text: ' ' }]
        ]
      },
      layout: this.cardLayout(),
      margin: [0, 0, 0, 12]
    };
  }

  private buildAcknowledgement(): Content {
    return {
      table: {
        widths: ['*'],
        body: [[{
          stack: [
            { text: 'Guest Acknowledgement', style: 'acknowledgementTitle' },
            {
              text: "By signing below, I hereby confirm that I have read, understood, and accepted the hotel's terms and conditions stated below.",
              style: 'legalBody',
              margin: [0, 5, 0, 0]
            },
            {
              columns: [
                this.signatureLine('Guest Signature', 310),
                { width: 24, text: '' },
                this.signatureLine('Date', 120)
              ],
              margin: [0, 12, 0, 12]
            },
            { text: 'IMPORTANT INFORMATION', bold: true, fontSize: 7.8, color: '#1E4ED8', characterSpacing: 0.6, margin: [0, 0, 0, 5] },
            {
              text: [
                { text: '1.  ', bold: true },
                'Guests must present a valid passport or government-issued ID and the credit card used for the reservation upon check-in.'
              ],
              style: 'legalBody'
            },
            {
              text: [
                { text: '2.  ', bold: true },
                "The total amount of the reservation will be charged upon arrival at the hotel, according to the amount stated above. A copy of the corresponding invoice will be sent to the guest's email address."
              ],
              style: 'legalBody',
              margin: [0, 5, 0, 0]
            }
          ],
          fillColor: '#F5F8FD',
          margin: [11, 10, 11, 10]
        }]]
      },
      layout: {
        hLineWidth: () => 0.7,
        vLineWidth: () => 0.7,
        hLineColor: () => '#C9D7EA',
        vLineColor: () => '#C9D7EA',
        paddingTop: () => 0,
        paddingBottom: () => 0,
        paddingLeft: () => 0,
        paddingRight: () => 0
      },
      unbreakable: true,
      margin: [0, 2, 0, 11]
    };
  }

  private buildReceptionVerification(): Content {
    return {
      stack: [
        { text: 'RECEPTIONIST VERIFICATION', style: 'sectionTitle', margin: [1, 0, 0, 7] },
        {
          table: {
            widths: [64, '*', 42, 110],
            body: [[
              this.summaryLabel('Receptionist'),
              { text: 'Name  ____________________________________', margin: [0, 4, 0, 4] },
              this.summaryLabel('Date'),
              { text: '____________________', margin: [0, 4, 0, 4] }
            ]]
          },
          layout: this.cardLayout()
        }
      ],
      unbreakable: true
    };
  }

  private summaryRow(labelA: string, valueA: string, labelB: string, valueB: string, labelC: string, valueC: string): TableCell[] {
    return [
      this.summaryLabel(labelA), this.summaryValue(valueA),
      this.summaryLabel(labelB), this.summaryValue(valueB),
      this.summaryLabel(labelC), this.summaryValue(valueC)
    ];
  }

  private summaryLabel(text: string): TableCell {
    return { text, bold: true, fontSize: 6.8, color: '#607289', fillColor: '#EFF3F8', margin: [0, 2, 0, 2] };
  }

  private summaryValue(text: string): TableCell {
    return { text: text || '-', bold: true, fontSize: 7.7, color: '#26364A', margin: [0, 2, 0, 2] };
  }

  private noteLabel(text: string): TableCell {
    return { text, bold: true, fontSize: 7, color: '#52677A', fillColor: '#EFF3F8', margin: [0, 5, 0, 0] };
  }

  private guestHeader(text: string, alignment: 'left' | 'center'): TableCell {
    return { text, alignment, bold: true, fontSize: 6.25, color: '#FFFFFF' };
  }

  private signatureLine(label: string, lineWidth: number): Content {
    return {
      stack: [
        { text: `${label}:`, bold: true, fontSize: 7.2, color: '#405469' },
        {
          canvas: [{ type: 'line', x1: 0, y1: 0, x2: lineWidth, y2: 0, lineWidth: 0.65, lineColor: '#718096' }],
          margin: [0, 13, 0, 0]
        }
      ]
    };
  }

  private cardLayout() {
    return {
      fillColor: (rowIndex: number, node: unknown, columnIndex: number) => columnIndex % 2 === 0 ? '#EFF3F8' : '#FFFFFF',
      hLineWidth: () => 0.5,
      vLineWidth: () => 0.5,
      hLineColor: () => '#D7E0EB',
      vLineColor: () => '#D7E0EB',
      paddingTop: () => 4,
      paddingBottom: () => 4,
      paddingLeft: () => 5,
      paddingRight: () => 5
    };
  }

  private async validatePdfBlob(blob: Blob): Promise<Blob> {
    if (!(blob instanceof Blob) || blob.size < 5) throw new Error('The generated registration form is empty.');
    const signature = String.fromCharCode(...new Uint8Array(await blob.slice(0, 5).arrayBuffer()));
    if (signature !== '%PDF-') throw new Error('The generated registration form is not a valid PDF.');
    return blob.type === 'application/pdf' ? blob : new Blob([blob], { type: 'application/pdf' });
  }

  private renderPrintPreview(printWindow: Window, blob: Blob, filename: string): void {
    const objectUrl = URL.createObjectURL(blob);
    const doc = printWindow.document;
    doc.open();
    doc.write(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
      <title>Guest Registration Form</title><style>
      *{box-sizing:border-box}html,body{width:100%;height:100%;margin:0}body{display:grid;grid-template-rows:auto minmax(0,1fr);overflow:hidden;background:#e9eef6;color:#14213d;font-family:Arial,sans-serif}
      header{display:flex;align-items:center;justify-content:space-between;gap:18px;min-height:64px;padding:11px 18px;background:#fff;border-bottom:1px solid #d5deea;box-shadow:0 4px 16px rgba(20,33,61,.08)}
      strong,small{display:block}small{margin-top:3px;color:#6b7c91}.actions{display:flex;gap:9px}.action{display:inline-flex;align-items:center;justify-content:center;min-height:40px;padding:0 16px;border:0;border-radius:10px;font:700 13px Arial,sans-serif;text-decoration:none;cursor:pointer}
      .print{color:#fff;background:#1e4ed8}.download{color:#1e4ed8;background:#edf3ff}.viewer{min-height:0;padding:10px}.viewer iframe{width:100%;height:100%;border:0;border-radius:9px;background:#fff;box-shadow:0 12px 30px rgba(20,33,61,.14)}
      @media(max-width:600px){header{align-items:stretch;flex-direction:column}.actions,.action{width:100%}}</style></head><body>
      <header><div><strong>Guest Registration Form</strong><small id="filename"></small></div><div class="actions"><button id="print" class="action print">Print</button><a id="download" class="action download">Download PDF</a></div></header>
      <main class="viewer"><iframe id="viewer" title="Guest Registration Form PDF"></iframe></main></body></html>`);
    doc.close();

    const filenameNode = doc.getElementById('filename');
    const printButton = doc.getElementById('print') as HTMLButtonElement | null;
    const downloadLink = doc.getElementById('download') as HTMLAnchorElement | null;
    const viewer = doc.getElementById('viewer') as HTMLIFrameElement | null;
    if (!filenameNode || !printButton || !downloadLink || !viewer) {
      URL.revokeObjectURL(objectUrl);
      throw new Error('Could not initialize the registration form print preview.');
    }

    filenameNode.textContent = filename;
    downloadLink.href = objectUrl;
    downloadLink.download = filename;
    downloadLink.rel = 'noopener';
    printButton.addEventListener('click', () => {
      viewer.contentWindow?.focus();
      viewer.contentWindow?.print();
    });
    viewer.addEventListener('load', () => {
      printWindow.setTimeout(() => {
        viewer.contentWindow?.focus();
        viewer.contentWindow?.print();
      }, 350);
    }, { once: true });
    viewer.src = objectUrl;

    let released = false;
    printWindow.addEventListener('beforeunload', () => {
      if (released) return;
      released = true;
      URL.revokeObjectURL(objectUrl);
    }, { once: true });
  }

  private printFromHiddenFrame(blob: Blob): void {
    const objectUrl = URL.createObjectURL(blob);
    const frame = document.createElement('iframe');
    frame.title = 'Guest Registration Form print frame';
    frame.style.position = 'fixed';
    frame.style.width = '1px';
    frame.style.height = '1px';
    frame.style.opacity = '0';
    frame.style.pointerEvents = 'none';
    frame.onload = () => {
      frame.contentWindow?.focus();
      frame.contentWindow?.print();
      window.setTimeout(() => {
        frame.remove();
        URL.revokeObjectURL(objectUrl);
      }, 60_000);
    };
    frame.src = objectUrl;
    document.body.appendChild(frame);
  }

  private formatDateTime(value: Date): string {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
    }).format(value);
  }

  private filename(reservation: CheckInArrival): string {
    const safeReservation = reservation.codReserva.replace(/[^a-zA-Z0-9_-]+/g, '-') || 'reservation';
    return `Guest_Registration_Form_${safeReservation}.pdf`;
  }
}
