import { Injectable, inject } from '@angular/core';
import type { Content, TableCell, TCreatedPdf, TDocumentDefinitions } from 'pdfmake/interfaces';

import { EmpresaContextService } from 'src/app/core/services/empresa-context.service';
import { HotelLogoService } from 'src/app/core/services/hotel-logo.service';
import { normalizePmsDateDDMMYYYY } from 'src/app/core/utils/pms-date.util';
import { ReservaConsulta, ReservaFiltro } from '../models/reserva-consulta.model';

type PdfMakeBrowser = {
  addVirtualFileSystem(vfs: Record<string, string>): void;
  createPdf(documentDefinition: TDocumentDefinitions): TCreatedPdf;
};

export interface ConsultaReservasExportFilters extends ReservaFiltro {
  agenciaDescripcion: string;
  estadoDescripcion: string;
}

@Injectable({ providedIn: 'root' })
export class ConsultaReservasExportService {
  private readonly empresaContext = inject(EmpresaContextService);
  private readonly hotelLogoService = inject(HotelLogoService);
  private pdfMakePromise?: Promise<PdfMakeBrowser>;

  async exportExcel(filters: ConsultaReservasExportFilters, reservas: ReservaConsulta[]): Promise<void> {
    if (!reservas.length) throw new Error('No hay reservas para exportar.');

    const XLSX = await import('xlsx-js-style');
    const includeCreationDate = !filters.busqueda.trim() && filters.tipoFecha === 'creacion';
    const headers = [
      'Reserva', 'Descripción', 'Agencia',
      ...(includeCreationDate ? ['Creación'] : []),
      'Ingreso', 'Salida', 'Noches', 'Habitaciones', 'Estado', 'Total', 'Moneda', 'Prepago', 'Operador', 'Etiquetas', 'Alerta'
    ];
    const detailRows = reservas.map((reserva) => [
      reserva.reserva,
      reserva.descripcion || '',
      reserva.agencia || '',
      ...(includeCreationDate ? [this.displayDate(reserva.creacion)] : []),
      this.displayDate(reserva.ingreso),
      this.displayDate(reserva.salida),
      Number(reserva.noches) || 0,
      Number(reserva.habitaciones) || 0,
      this.statusLabel(reserva.estado),
      Number(reserva.total) || 0,
      reserva.moneda || 'USD',
      reserva.prepago === 'S' ? 'Sí' : 'No',
      reserva.operador || '',
      (reserva.tags ?? []).map((tag) => tag.nombre).filter(Boolean).join(' | '),
      reserva.tieneAlertas ? 'Sí' : 'No'
    ]);
    const totals = this.totalsByCurrency(reservas);
    const company = this.empresaContext.empresa();
    const companyName = (company?.MA04_Nombre || company?.MA04_RazonSocial || 'HOTEL').trim();
    const generatedAt = new Intl.DateTimeFormat('es-CR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date());
    const informationRows = [
      ['Consulta de Reservas'],
      [`Hotel: ${companyName}`],
      [`Generado: ${generatedAt}`],
      [`Filtros: ${this.filterDescription(filters)}`],
      [`Registros exportados: ${reservas.length}`],
      [`Totales sin reservas anuladas: ${totals.map((item) => `${item.currency} ${item.total.toLocaleString('es-CR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`).join(' · ') || '0.00'}`],
      []
    ];
    const headerRow = informationRows.length;
    const firstDataRow = headerRow + 1;
    const lastDataRow = headerRow + detailRows.length;
    const worksheet = XLSX.utils.aoa_to_sheet([...informationRows, headers, ...detailRows]);
    const lastColumn = headers.length - 1;

    worksheet['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: lastColumn } }];
    worksheet['!autofilter'] = {
      ref: XLSX.utils.encode_range({ s: { r: headerRow, c: 0 }, e: { r: lastDataRow, c: lastColumn } })
    };
    worksheet['!cols'] = headers.map((header) => ({ wch: this.excelColumnWidth(header) }));
    worksheet['!rows'] = [{ hpt: 30 }, { hpt: 20 }, { hpt: 20 }, { hpt: 28 }, { hpt: 20 }, { hpt: 22 }, { hpt: 8 }];

    const titleCell = worksheet['A1'];
    if (titleCell) titleCell.s = {
      font: { name: 'Aptos Display', bold: true, color: { rgb: 'FFFFFFFF' }, sz: 16 },
      fill: { fgColor: { rgb: 'FF173B61' } },
      alignment: { vertical: 'center' }
    };
    for (let column = 0; column <= lastColumn; column += 1) {
      const cell = worksheet[XLSX.utils.encode_cell({ r: headerRow, c: column })];
      if (cell) cell.s = {
        font: { name: 'Aptos', bold: true, color: { rgb: 'FFFFFFFF' }, sz: 10 },
        fill: { fgColor: { rgb: 'FF27577F' } },
        alignment: { horizontal: column === headers.indexOf('Total') ? 'right' : 'left', vertical: 'center', wrapText: true },
        border: { bottom: { style: 'medium', color: { rgb: 'FF167D8D' } } }
      };
    }
    const totalColumn = headers.indexOf('Total');
    for (let row = firstDataRow; row <= lastDataRow; row += 1) {
      for (let column = 0; column <= lastColumn; column += 1) {
        const cell = worksheet[XLSX.utils.encode_cell({ r: row, c: column })];
        if (!cell) continue;
        cell.s = {
          font: { name: 'Aptos', sz: 10, color: { rgb: 'FF26364A' } },
          fill: { fgColor: { rgb: row % 2 === 0 ? 'FFF3F7FA' : 'FFFFFFFF' } },
          alignment: { vertical: 'center', wrapText: column === 1 || column === headers.indexOf('Etiquetas') },
          border: { bottom: { style: 'hair', color: { rgb: 'FFDCE5EC' } } }
        };
        if (column === 0) cell.s.font = { ...cell.s.font, bold: true, color: { rgb: 'FF173B61' } };
      }
      const amount = worksheet[XLSX.utils.encode_cell({ r: row, c: totalColumn })];
      if (amount?.t === 'n') amount.z = '#,##0.00';
      worksheet['!rows']![row] = { hpt: 24 };
    }

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Reservas');
    XLSX.writeFile(workbook, `consulta-reservas_${this.fileDate(filters.fechaInicio)}_${this.fileDate(filters.fechaFinal)}.xlsx`, { compression: true });
  }

  async openPdf(filters: ConsultaReservasExportFilters, reservas: ReservaConsulta[]): Promise<'opened' | 'downloaded'> {
    if (!reservas.length) throw new Error('No hay reservas para imprimir.');
    const previewWindow = this.reservePreviewWindow();

    try {
      const [pdfMake, logo] = await Promise.all([
        this.getPdfMake(),
        this.hotelLogoService.getLogoDataUrl(this.empresaContext.getSnapshot(), this.hotelLogoService.defaultPdfLogo)
      ]);
      const blob = await pdfMake.createPdf(this.buildPdfDefinition(filters, reservas, logo)).getBlob();
      const validBlob = await this.validatePdfBlob(blob);
      const filename = `consulta-reservas_${this.fileDate(filters.fechaInicio)}_${this.fileDate(filters.fechaFinal)}.pdf`;

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

  private buildPdfDefinition(filters: ConsultaReservasExportFilters, reservas: ReservaConsulta[], logo: string): TDocumentDefinitions {
    const company = this.empresaContext.empresa();
    const hotelName = (company?.MA04_Nombre || company?.MA04_RazonSocial || 'HOTEL').trim();
    const legalName = (company?.MA04_RazonSocial || '').trim();
    const contact = [
      company?.MA04_Direccion,
      [company?.MA04_Ciudad, company?.MA04_Pais].filter(Boolean).join(', '),
      company?.MA04_Telefono1 ? `Tel. ${company.MA04_Telefono1}` : '',
      company?.MA04_Email
    ].filter(Boolean).join('  |  ');
    const includeCreationDate = !filters.busqueda.trim() && filters.tipoFecha === 'creacion';
    const headers = [
      'Reserva', 'Descripción', 'Agencia', ...(includeCreationDate ? ['Creación'] : []), 'Ingreso', 'Salida',
      'Noches', 'Hab.', 'Estado', 'Total', 'Prepago', 'Operador', 'Etiquetas', 'Alerta'
    ];
    const body: TableCell[][] = [
      headers.map((header) => this.headerCell(header)),
      ...reservas.map((reserva) => this.pdfRow(reserva, includeCreationDate))
    ];
    const totals = this.totalsByCurrency(reservas);
    const pageWidths = includeCreationDate
      ? [54, '*', 86, 45, 45, 45, 29, 30, 48, 61, 36, 54, 100, 32]
      : [54, '*', 86, 45, 45, 29, 30, 48, 61, 36, 54, 100, 32];

    return {
      pageSize: 'LEGAL',
      pageOrientation: 'landscape',
      pageMargins: [24, 22, 24, 30],
      info: { title: 'Consulta de Reservas', author: hotelName, subject: 'Reporte de reservas' },
      defaultStyle: { font: 'Roboto', fontSize: 7, color: '#26364A', lineHeight: 1.08 },
      footer: (currentPage: number, pageCount: number): Content => ({
        margin: [24, 7, 24, 0],
        columns: [
          { text: 'PMSNext · Consulta de Reservas', color: '#718096', fontSize: 7 },
          { text: `Página ${currentPage} de ${pageCount}`, alignment: 'right', color: '#718096', fontSize: 7 }
        ]
      }),
      content: [
        this.pdfHeader(hotelName, legalName, contact, logo),
        this.pdfMetadata(filters, reservas.length),
        this.pdfSummary(reservas, totals),
        {
          table: { headerRows: 1, keepWithHeaderRows: 1, dontBreakRows: true, widths: pageWidths, body },
          layout: {
            fillColor: (rowIndex: number) => rowIndex > 0 && rowIndex % 2 === 0 ? '#F4F8FA' : null,
            hLineWidth: (rowIndex: number) => rowIndex === 1 ? 1 : 0.45,
            vLineWidth: () => 0.35,
            hLineColor: () => '#C7D5DE',
            vLineColor: () => '#D7E1E8',
            paddingTop: (rowIndex: number) => rowIndex === 0 ? 5 : 3,
            paddingBottom: (rowIndex: number) => rowIndex === 0 ? 5 : 3,
            paddingLeft: () => 3,
            paddingRight: () => 3
          },
          margin: [0, 10, 0, 0]
        }
      ],
      styles: {
        companyName: { bold: true, fontSize: 13, color: '#17364F' },
        legalName: { fontSize: 7.5, color: '#4C5F73', margin: [0, 2, 0, 0] },
        companyMeta: { fontSize: 6.5, color: '#66758A', margin: [0, 3, 0, 0] },
        documentTitle: { bold: true, fontSize: 14, color: '#17364F', characterSpacing: 0.7 },
        eyebrow: { bold: true, fontSize: 7, color: '#167D8D', characterSpacing: 1.1 },
        metadataLabel: { bold: true, fontSize: 7, color: '#52677A', fillColor: '#EDF3F6' },
        metadataValue: { fontSize: 7, color: '#26364A' },
        summaryLabel: { bold: true, fontSize: 6.3, color: '#66758A', characterSpacing: 0.4 },
        summaryValue: { bold: true, fontSize: 10, color: '#17364F' },
        tableHeader: { bold: true, fontSize: 6.4, color: '#FFFFFF', alignment: 'center' },
        tableCell: { fontSize: 6.5, color: '#26364A' },
        reservationCode: { bold: true, fontSize: 6.6, color: '#15385F' }
      }
    };
  }

  private pdfHeader(hotelName: string, legalName: string, contact: string, logo: string): Content {
    return {
      stack: [
        {
          columns: [
            { width: 74, image: logo, fit: [66, 44] },
            { width: '*', stack: [
              { text: hotelName, style: 'companyName' },
              ...(legalName && legalName !== hotelName ? [{ text: legalName, style: 'legalName' } as Content] : []),
              ...(contact ? [{ text: contact, style: 'companyMeta' } as Content] : [])
            ] },
            { width: 205, stack: [
              { text: 'REPORTE OPERATIVO', style: 'eyebrow', alignment: 'right' },
              { text: 'CONSULTA DE RESERVAS', style: 'documentTitle', alignment: 'right', margin: [0, 4, 0, 0] }
            ] }
          ]
        },
        { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 960, y2: 0, lineWidth: 1.8, lineColor: '#167D8D' }], margin: [0, 7, 0, 0] }
      ],
      margin: [0, 0, 0, 8]
    };
  }

  private pdfMetadata(filters: ConsultaReservasExportFilters, count: number): Content {
    const rows = [
      [this.metadataLabel('FILTROS APLICADOS'), this.metadataValue(this.filterDescription(filters)), this.metadataLabel('REGISTROS'), this.metadataValue(String(count))],
      [this.metadataLabel('GENERADO'), this.metadataValue(new Intl.DateTimeFormat('es-CR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date())), this.metadataLabel('FECHA'), this.metadataValue(this.dateDescription(filters))]
    ];
    return {
      table: { widths: [88, '*', 65, 70], body: rows },
      layout: { hLineWidth: () => 0.5, vLineWidth: () => 0.5, hLineColor: () => '#C7D5DE', vLineColor: () => '#C7D5DE', paddingTop: () => 4, paddingBottom: () => 4, paddingLeft: () => 5, paddingRight: () => 5 },
      margin: [0, 0, 0, 7]
    };
  }

  private pdfSummary(reservas: ReservaConsulta[], totals: Array<{ currency: string; total: number }>): Content {
    const stateCounts = new Map<string, number>();
    for (const reserva of reservas) {
      const label = this.statusLabel(reserva.estado);
      stateCounts.set(label, (stateCounts.get(label) ?? 0) + 1);
    }
    const summaryCells: TableCell[] = [
      this.summaryCell('RESERVAS', String(reservas.length)),
      ...totals.map((item) => this.summaryCell(`TOTAL ${item.currency} · SIN ANULADAS`, item.total.toLocaleString('es-CR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }))),
      this.summaryCell('ESTADOS', Array.from(stateCounts, ([label, count]) => `${label}: ${count}`).join(' · '))
    ];
    return {
      table: { widths: summaryCells.map(() => '*'), body: [summaryCells] },
      layout: { hLineWidth: () => 0.6, vLineWidth: () => 0.6, hLineColor: () => '#D3E0E8', vLineColor: () => '#D3E0E8', paddingTop: () => 4, paddingBottom: () => 4, paddingLeft: () => 7, paddingRight: () => 7 },
      margin: [0, 0, 0, 4]
    };
  }

  private pdfRow(reserva: ReservaConsulta, includeCreationDate: boolean): TableCell[] {
    return [
      { text: reserva.reserva || '-', style: 'reservationCode' },
      { text: reserva.descripcion || '-', style: 'tableCell' },
      { text: reserva.agencia || '-', style: 'tableCell' },
      ...(includeCreationDate ? [{ text: this.displayDate(reserva.creacion), style: 'tableCell' } as TableCell] : []),
      { text: this.displayDate(reserva.ingreso), style: 'tableCell' },
      { text: this.displayDate(reserva.salida), style: 'tableCell' },
      { text: String(reserva.noches), style: 'tableCell', alignment: 'center' },
      { text: String(reserva.habitaciones), style: 'tableCell', alignment: 'center' },
      { text: this.statusLabel(reserva.estado), style: 'tableCell' },
      { text: `${reserva.moneda || 'USD'} ${Number(reserva.total || 0).toLocaleString('es-CR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, style: 'tableCell', alignment: 'right' },
      { text: reserva.prepago === 'S' ? 'Sí' : 'No', style: 'tableCell', alignment: 'center' },
      { text: reserva.operador || '-', style: 'tableCell' },
      { text: (reserva.tags ?? []).map((tag) => tag.nombre).filter(Boolean).join(', ') || '-', style: 'tableCell' },
      { text: reserva.tieneAlertas ? 'Sí' : 'No', style: 'tableCell', alignment: 'center', color: reserva.tieneAlertas ? '#B4233D' : '#16815A', bold: true }
    ];
  }

  private headerCell(text: string): TableCell { return { text, style: 'tableHeader', fillColor: '#173A56' }; }
  private metadataLabel(text: string): TableCell { return { text, style: 'metadataLabel' }; }
  private metadataValue(text: string): TableCell { return { text: text || '-', style: 'metadataValue' }; }
  private summaryCell(label: string, value: string): TableCell { return { stack: [{ text: label, style: 'summaryLabel' }, { text: value, style: 'summaryValue', margin: [0, 2, 0, 0] }], fillColor: '#F4F8FA' }; }

  private totalsByCurrency(reservas: ReservaConsulta[]): Array<{ currency: string; total: number }> {
    const totals = new Map<string, number>();
    for (const reserva of reservas) {
      const currency = reserva.moneda.trim().toUpperCase() || 'USD';
      if (!totals.has(currency)) totals.set(currency, 0);
      if (!this.isCancelled(reserva.estado) && Number.isFinite(reserva.total)) totals.set(currency, totals.get(currency)! + reserva.total);
    }
    return Array.from(totals, ([currency, total]) => ({ currency, total }));
  }

  private filterDescription(filters: ConsultaReservasExportFilters): string {
    if (filters.busqueda.trim()) return `Búsqueda por reserva o descripción: ${filters.busqueda.trim()} (los filtros de fecha, agencia y estado no aplican en esta búsqueda).`;
    return [
      `Fecha ${filters.tipoFecha === 'creacion' ? 'de creación' : 'de ingreso'}: ${this.displayDate(filters.fechaInicio)} al ${this.displayDate(filters.fechaFinal)}`,
      `Agencia: ${filters.agenciaDescripcion || filters.agencia || 'Todas'}`,
      `Estado: ${filters.estadoDescripcion || 'Todos'}`
    ].join(' · ');
  }

  private dateDescription(filters: ConsultaReservasExportFilters): string {
    return filters.busqueda.trim() ? 'Búsqueda rápida' : `${this.displayDate(filters.fechaInicio)} al ${this.displayDate(filters.fechaFinal)}`;
  }

  private statusLabel(value: string): string {
    const normalized = value.trim().toUpperCase();
    const labels: Record<string, string> = { ABI: 'Abierta', CCR: 'Confirmada', CHK: 'Check In', WLT: 'Lista de espera', ANU: 'Cancelada' };
    return labels[normalized] ?? (value || 'Sin estado');
  }

  private isCancelled(value: string): boolean {
    return ['ANU', 'ANULADA', 'CANCELADA'].includes(value.trim().toUpperCase());
  }

  private displayDate(value: string | null | undefined): string {
    return normalizePmsDateDDMMYYYY(value) || 'N/D';
  }

  private excelColumnWidth(header: string): number {
    const widths: Record<string, number> = {
      Reserva: 18, Descripción: 32, Agencia: 28, Creación: 14, Ingreso: 14, Salida: 14,
      Noches: 10, Habitaciones: 14, Estado: 18, Total: 16, Moneda: 10, Prepago: 12,
      Operador: 20, Etiquetas: 38, Alerta: 12
    };
    return widths[header] ?? 16;
  }

  private fileDate(value: string): string { return value.replace(/[^\d-]/g, '-') || 'sin-fecha'; }

  private reservePreviewWindow(): Window | null {
    const preview = window.open('', '_blank');
    if (!preview) return null;
    preview.opener = null;
    preview.document.title = 'Generando reporte de reservas';
    preview.document.body.innerHTML = '<div style="font:600 15px Arial,sans-serif;color:#334155;padding:32px">Generando reporte de reservas...</div>';
    return preview;
  }

  private renderPreview(preview: Window, blob: Blob, filename: string): void {
    const objectUrl = URL.createObjectURL(blob);
    const doc = preview.document;
    doc.open();
    doc.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Consulta de Reservas</title><style>*{box-sizing:border-box}html,body{width:100%;height:100%;margin:0}body{display:grid;grid-template-rows:auto minmax(0,1fr);overflow:hidden;background:#e8eef5;color:#17364f;font-family:Arial,sans-serif}.toolbar{display:flex;align-items:center;justify-content:space-between;gap:18px;min-height:64px;padding:12px 20px;background:#fff;border-bottom:1px solid #ced9e5;box-shadow:0 4px 16px rgba(15,35,55,.08)}.title strong,.title span{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.title strong{font-size:16px}.title span{margin-top:3px;color:#64748b;font-size:12px}.download{display:inline-flex;align-items:center;justify-content:center;min-height:40px;padding:0 18px;border-radius:10px;color:#fff;background:#1554c8;font-size:14px;font-weight:700;text-decoration:none}.viewer{min-height:0;padding:12px}.viewer iframe{width:100%;height:100%;border:0;border-radius:10px;background:#fff;box-shadow:0 12px 34px rgba(15,35,55,.14)}</style></head><body><header class="toolbar"><div class="title"><strong>Consulta de Reservas</strong><span id="filename"></span></div><a id="download" class="download">Descargar PDF</a></header><main class="viewer"><iframe id="pdfViewer" title="Consulta de Reservas PDF"></iframe></main></body></html>`);
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

  private async validatePdfBlob(blob: Blob): Promise<Blob> {
    if (!(blob instanceof Blob) || blob.size < 5) throw new Error('El PDF de reservas está vacío.');
    const signature = String.fromCharCode(...new Uint8Array(await blob.slice(0, 5).arrayBuffer()));
    if (signature !== '%PDF-') throw new Error('El archivo generado no es un PDF válido.');
    return blob.type === 'application/pdf' ? blob : new Blob([blob], { type: 'application/pdf' });
  }

  private downloadBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.rel = 'noopener';
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }
}
