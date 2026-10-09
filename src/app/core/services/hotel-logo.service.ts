import { Injectable } from '@angular/core';

import { Empresa } from '../models/empresa.model';

@Injectable({ providedIn: 'root' })
export class HotelLogoService {
  readonly defaultHeaderLogo = 'assets/images/logo_lamia_head.png';
  readonly defaultSelfCheckinLogo = 'assets/images/logo_lamia_head_tight.png';
  readonly defaultPdfLogo = 'assets/images/logo_lamia.jpeg';

  getLogoAssetCandidates(empresa: Empresa | null | undefined, fallback = this.defaultHeaderLogo): string[] {
    const cedula = this.normalizeCedula(empresa?.MA04_Ruc);
    if (!cedula) {
      return [fallback];
    }

    return Array.from(new Set([
      `assets/images/${cedula}.jpg`,
      `assets/images/${cedula}.png`,
      fallback
    ]));
  }

  getLogoAssetPath(empresa: Empresa | null | undefined, fallback = this.defaultHeaderLogo): string {
    return this.getLogoAssetCandidates(empresa, fallback)[0];
  }

  async getLogoDataUrl(empresa: Empresa | null | undefined, fallback = this.defaultPdfLogo): Promise<string> {
    let lastError: unknown;
    for (const candidate of this.getLogoAssetCandidates(empresa, fallback)) {
      try {
        return await this.fetchAsDataUrl(candidate);
      } catch (error) {
        lastError = error;
      }
    }

    throw lastError ?? new Error('No se pudo cargar el logo del hotel.');
  }

  /**
   * Loads an image asset in the format required by pdfmake.
   * Some SPA hosts return index.html with HTTP 200 for missing assets, so an
   * HTTP status check alone is not enough here.
   */
  async getImageDataUrl(path: string): Promise<string> {
    return this.fetchAsDataUrl(path);
  }

  private normalizeCedula(value: string | number | null | undefined): string {
    return String(value ?? '').replace(/\D/g, '');
  }

  private async fetchAsDataUrl(path: string): Promise<string> {
    const assetUrl = new URL(path, document.baseURI).toString();
    const response = await fetch(assetUrl);

    if (!response.ok) {
      throw new Error(`No se pudo cargar el logo del hotel (${response.status}).`);
    }

    const blob = await response.blob();
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const image = this.detectSupportedImage(bytes);
    if (!image) {
      throw new Error(`El recurso del logo no es una imagen compatible: ${path}.`);
    }

    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = String(reader.result);
        const payload = dataUrl.substring(dataUrl.indexOf(',') + 1);
        resolve(`data:${image};base64,${payload}`);
      };
      reader.onerror = () => reject(reader.error ?? new Error('No se pudo leer el logo del hotel.'));
      reader.readAsDataURL(blob);
    });
  }

  private detectSupportedImage(bytes: Uint8Array): 'image/png' | 'image/jpeg' {
    const isPng = bytes.length >= 8
      && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47
      && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a;
    if (isPng) return 'image/png';

    const isJpeg = bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    if (isJpeg) return 'image/jpeg';

    throw new Error('El logo no tiene un formato PNG o JPEG válido.');
  }
}
