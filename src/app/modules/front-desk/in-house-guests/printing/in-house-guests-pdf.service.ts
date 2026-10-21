import { Injectable, inject } from '@angular/core';
import type { Content, TCreatedPdf, TDocumentDefinitions } from 'pdfmake/interfaces';

import { EmpresaContextService } from 'src/app/core/services/empresa-context.service';
import { HotelLogoService } from 'src/app/core/services/hotel-logo.service';
import { InHouseGuest } from '../models/in-house-guest.model';

type PdfMakeBrowser = {
  addVirtualFileSystem(vfs: Record<string, string>): void;
  createPdf(documentDefinition: TDocumentDefinitions): TCreatedPdf;
};

export interface InHouseGuestsPdfFilters {
  fechaIni: string;
  fechaFin: string;
  agencia: string;
  plan: string;
}

@Injectable({ providedIn: 'root' })
export class InHouseGuestsPdfService {
  private readonly empresaContext = inject(EmpresaContextService);
  private readonly hotelLogoService = inject(HotelLogoService);
  private pdfMakePromise?: Promise<PdfMakeBrowser>;

  async open(filters: InHouseGuestsPdfFilters, guests: InHouseGuest[]): Promise<'opened' | 'downloaded'> {
    if (!guests.length) {
      throw new Error('No hay huéspedes In House visibles para exportar.');
    }

    const previewWindow = this.reservePreviewWindow();

    try {
      const [pdfMake, hotelLogo] = await Promise.all([
        this.getPdfMake(),
        this.hotelLogoService.getLogoDataUrl(this.empresaContext.getSnapshot(), this.hotelLogoService.defaultPdfLogo)
      ]);
      const blob = await pdfMake.createPdf(this.buildDocumentDefinition(filters, guests, hotelLogo)).getBlob();
      const validBlob = await this.validatePdfBlob(blob);
      const filename = this.filename(filters);

      if (previewWindow && !previewWindow.closed) {
        this.renderPreview(previewWindow, validBlob, filename);
        return 'opened';
      }

      this.downloadBlob(validBlob, filename);
      return 'downloaded';
    } catch (error) {
      if (previewWindow && !previewWindow.closed) previewWindow.close();
      throw error;
    }
  }

  private async getPdfMake(): Promise<PdfMakeBrowser> {
    if (!this.pdfMakePromise) {
      this.pdfMakePromise = Promise.all([import('pdfmake/build/pdfmake'), import('pdfmake/build/vfs_fonts')]).then(([pdfMakeModule, fontsModule]) => {
        const pdfMake = (pdfMakeModule as unknown as { default?: PdfMakeBrowser }).default ?? (pdfMakeModule as unknown as PdfMakeBrowser);
        const fonts = (fontsModule as unknown as { default?: Record<string, string> }).default ?? (fontsModule as unknown as Record<string, string>);
        pdfMake.addVirtualFileSystem(fonts);
        return pdfMake;
      });
    }
    return this.pdfMakePromise;
  }

  private buildDocumentDefinition(filters: InHouseGuestsPdfFilters, guests: InHouseGuest[], hotelLogo: string): TDocumentDefinitions {
    const company = this.empresaContext.empresa();
    const hotelName = (company?.MA04_Nombre || company?.MA04_RazonSocial || 'HOTEL').trim();
    const contact = [company?.MA04_Direccion, [company?.MA04_Ciudad, company?.MA04_Pais].filter(Boolean).join(', '), company?.MA04_Telefono1 ? `Tel. ${company.MA04_Telefono1}` : '', company?.MA04_Email].filter(Boolean).join('  |  ');
    const totalAdults = guests.reduce((sum, guest) => sum + guest.numPax, 0);
    const totalChildren = guests.reduce((sum, guest) => sum + guest.numChild, 0);

    return {
      pageSize: 'LETTER', pageOrientation: 'portrait', pageMargins: [28, 24, 28, 30],
      info: { title: 'Pax In House', author: hotelName, subject: 'Front Desk - Huéspedes In House' },
      defaultStyle: { font: 'Roboto', fontSize: 7.2, color: '#26364A', lineHeight: 1.08 },
      footer: (currentPage: number, pageCount: number): Content => ({ margin: [28, 7, 28, 0], columns: [{ text: 'PMSNext · Front Desk', color: '#718096', fontSize: 7 }, { text: `Página ${currentPage} de ${pageCount}`, alignment: 'right', color: '#718096', fontSize: 7 }] }),
      content: [
        this.header(hotelName, contact, hotelLogo),
        { text: 'PAX IN HOUSE', style: 'documentTitle', margin: [0, 4, 0, 7] },
        { table: { widths: [55, 145, 55, '*'], body: [[this.label('Período'), this.value(`${this.displayDate(filters.fechaIni)} - ${this.displayDate(filters.fechaFin)}`), this.label('Agencia'), this.value(filters.agencia || 'Todas')], [this.label('Plan'), this.value(filters.plan || 'Todos'), this.label('Generado'), this.value(this.generatedAt())]] }, layout: this.infoLayout(), margin: [0, 0, 0, 9] },
        { table: { widths: ['*', '*', '*', '*'], body: [[this.summary('Habitaciones', guests.length), this.summary('Adultos', totalAdults), this.summary('Niños', totalChildren), this.summary('Huéspedes', totalAdults + totalChildren)]] }, layout: this.boxLayout(), margin: [0, 0, 0, 10] },
        { text: 'Listado operativo', style: 'sectionTitle', margin: [0, 0, 0, 5] },
        { table: { headerRows: 1, keepWithHeaderRows: 1, widths: [32, 105, 92, 51, 51, 35, 35, 35, '*'], body: [[this.headerCell('Hab.'), this.headerCell('Huéspedes'), this.headerCell('Agencia'), this.headerCell('Entrada'), this.headerCell('Salida'), this.headerCell('Noches'), this.headerCell('Ad.'), this.headerCell('Ni.'), this.headerCell('Plan')], ...guests.map((guest) => this.guestRow(guest))] }, layout: this.tableLayout() }
      ],
      styles: {
        documentTitle: { bold: true, fontSize: 15, color: '#17364F', characterSpacing: 1 },
        companyName: { bold: true, fontSize: 13, color: '#17364F' },
        companyMeta: { fontSize: 6.3, color: '#66758A', margin: [0, 3, 0, 0] },
        sectionTitle: { bold: true, fontSize: 9, color: '#167D8D', characterSpacing: .4 },
        tableHeader: { bold: true, fontSize: 6.4, color: '#FFFFFF', alignment: 'center' },
        tableCell: { fontSize: 6.7, color: '#26364A' },
        summaryLabel: { bold: true, fontSize: 6.2, color: '#66758A', characterSpacing: .3 },
        summaryValue: { bold: true, fontSize: 11, color: '#17364F', margin: [0, 2, 0, 0] }
      }
    };
  }

  private header(hotelName: string, contact: string, logo: string): Content { return { stack: [{ columns: [{ width: 68, image: logo, fit: [60, 44] }, { width: '*', stack: [{ text: hotelName, style: 'companyName' }, ...(contact ? [{ text: contact, style: 'companyMeta' } as Content] : [])] }, { width: 150, text: 'FRONT DESK', alignment: 'right', color: '#167D8D', bold: true, fontSize: 10, margin: [0, 5, 0, 0] }] }, { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 540, y2: 0, lineWidth: 1.8, lineColor: '#167D8D' }], margin: [0, 6, 0, 0] }] }; }
  private guestRow(guest: InHouseGuest): Content[] { return [{ text: guest.numHabita || '-', style: 'tableCell', bold: true }, { text: this.guestNames(guest), style: 'tableCell' }, { text: guest.nomAgencia || '-', style: 'tableCell' }, { text: guest.fechaIng || '-', style: 'tableCell' }, { text: guest.fechaSal || '-', style: 'tableCell' }, { text: String(guest.noches), style: 'tableCell', alignment: 'center' }, { text: String(guest.numPax), style: 'tableCell', alignment: 'center' }, { text: String(guest.numChild), style: 'tableCell', alignment: 'center' }, { text: this.planText(guest), style: 'tableCell' }]; }
  private planText(guest: InHouseGuest): string { if (this.isYes(guest.fullPen)) return 'AI · Todo incluido'; if (this.isYes(guest.media)) return 'MAP · Media pensión'; if (this.isYes(guest.desayuno)) return 'CP · Desayuno'; return 'RO · Solo alojamiento'; }
  private guestNames(guest: InHouseGuest): string { return guest.paxIn.split('/').map((name) => name.trim()).filter(Boolean).map((name) => this.toTitleCase(name)).join('\n') || '-'; }
  private headerCell(text: string): Content { return { text, style: 'tableHeader', fillColor: '#173A56', alignment: 'center' }; }
  private label(text: string): Content { return { text, bold: true, fontSize: 6.5, color: '#52677A', fillColor: '#EDF3F6' }; }
  private value(text: string): Content { return { text: text || '-', fontSize: 6.8, color: '#26364A' }; }
  private summary(label: string, value: number): Content { return { stack: [{ text: label.toUpperCase(), style: 'summaryLabel' }, { text: String(value), style: 'summaryValue' }], fillColor: '#F4F8FA', margin: [7, 5, 7, 5] }; }
  private infoLayout(): Record<string, unknown> { return { hLineWidth: () => .6, vLineWidth: () => .6, hLineColor: () => '#C7D5DE', vLineColor: () => '#C7D5DE', paddingTop: () => 4, paddingBottom: () => 4, paddingLeft: () => 5, paddingRight: () => 5 }; }
  private boxLayout(): Record<string, unknown> { return { hLineWidth: () => .6, vLineWidth: () => .6, hLineColor: () => '#C7D5DE', vLineColor: () => '#C7D5DE', paddingTop: () => 0, paddingBottom: () => 0, paddingLeft: () => 0, paddingRight: () => 0 }; }
  private tableLayout(): Record<string, unknown> { return { fillColor: (row: number) => row > 0 && row % 2 === 0 ? '#F7FAFC' : null, hLineWidth: () => .55, vLineWidth: () => .55, hLineColor: () => '#C7D5DE', vLineColor: () => '#C7D5DE', paddingTop: (row: number) => row === 0 ? 4 : 3, paddingBottom: (row: number) => row === 0 ? 4 : 3, paddingLeft: () => 3, paddingRight: () => 3 }; }
  private reservePreviewWindow(): Window | null { const preview = window.open('', '_blank'); if (!preview) return null; preview.opener = null; preview.document.title = 'Generando reporte In House'; preview.document.body.innerHTML = '<div style="font:600 15px Arial,sans-serif;color:#334155;padding:32px">Generando reporte In House...</div>'; return preview; }
  private renderPreview(preview: Window, blob: Blob, filename: string): void {
    const objectUrl = URL.createObjectURL(blob);
    const doc = preview.document;
    doc.open();
    doc.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Pax In House</title><style>*{box-sizing:border-box}html,body{width:100%;height:100%;margin:0}body{display:grid;grid-template-rows:auto minmax(0,1fr);overflow:hidden;background:#e8eef5;color:#17364f;font-family:Arial,sans-serif}.toolbar{display:flex;align-items:center;justify-content:space-between;gap:18px;min-height:64px;padding:12px 20px;background:#fff;border-bottom:1px solid #ced9e5;box-shadow:0 4px 16px rgba(15,35,55,.08)}.title strong,.title span{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.title strong{font-size:16px}.title span{margin-top:3px;color:#64748b;font-size:12px}.download{display:inline-flex;align-items:center;justify-content:center;min-height:40px;padding:0 18px;border-radius:10px;color:#fff;background:#1554c8;font-size:14px;font-weight:700;text-decoration:none}.viewer{position:relative;min-height:0;padding:12px}.viewer iframe{position:relative;z-index:1;width:100%;height:100%;border:0;border-radius:10px;background:#fff;box-shadow:0 12px 34px rgba(15,35,55,.14)}</style></head><body><header class="toolbar"><div class="title"><strong>Pax In House</strong><span id="filename"></span></div><a id="download" class="download">Descargar PDF</a></header><main class="viewer"><iframe id="pdfViewer" title="Pax In House PDF"></iframe></main></body></html>`);
    doc.close();
    const filenameNode = doc.getElementById('filename');
    const downloadLink = doc.getElementById('download') as HTMLAnchorElement | null;
    const viewer = doc.getElementById('pdfViewer') as HTMLIFrameElement | null;
    if (!filenameNode || !downloadLink || !viewer) throw new Error('No se pudo inicializar la vista previa del PDF.');
    filenameNode.textContent = filename;
    downloadLink.href = objectUrl;
    downloadLink.download = filename;
    downloadLink.rel = 'noopener';
    viewer.src = objectUrl;
    preview.addEventListener('beforeunload', () => URL.revokeObjectURL(objectUrl), { once: true });
  }
  private async validatePdfBlob(blob: Blob): Promise<Blob> { if (!(blob instanceof Blob) || blob.size < 5) throw new Error('El PDF de huéspedes In House está vacío.'); const signature = String.fromCharCode(...new Uint8Array(await blob.slice(0, 5).arrayBuffer())); if (signature !== '%PDF-') throw new Error('El archivo generado no es un PDF válido.'); return blob.type === 'application/pdf' ? blob : new Blob([blob], { type: 'application/pdf' }); }
  private downloadBlob(blob: Blob, filename: string): void { const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = filename; link.rel = 'noopener'; document.body.appendChild(link); link.click(); link.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 60_000); }
  private filename(filters: InHouseGuestsPdfFilters): string { return `pax-in-house-${filters.fechaIni.replace(/\//g, '-')}-${filters.fechaFin.replace(/\//g, '-')}.pdf`; }
  private generatedAt(): string { return new Intl.DateTimeFormat('es-CR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date()); }
  private displayDate(value: string): string { const parts = value.split('-'); return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : value || '-'; }
  private isYes(value: string): boolean { return value.trim().toUpperCase() === 'SI'; }
  private toTitleCase(value: string): string { return value.toLocaleLowerCase('es').replace(/\b\p{L}/gu, (letter) => letter.toLocaleUpperCase('es')); }
}
