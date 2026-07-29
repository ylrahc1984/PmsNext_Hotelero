declare module 'pdfmake/build/pdfmake' {
  import type { TCreatedPdf, TDocumentDefinitions } from 'pdfmake/interfaces';

  interface PdfMakeBrowser {
    addVirtualFileSystem(vfs: Record<string, string>): void;
    createPdf(documentDefinition: TDocumentDefinitions): TCreatedPdf;
  }

  const pdfMake: PdfMakeBrowser;
  export = pdfMake;
}

declare module 'pdfmake/build/vfs_fonts' {
  const vfs: Record<string, string>;
  export = vfs;
}
