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
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error ?? new Error('No se pudo leer el logo del hotel.'));
      reader.readAsDataURL(blob);
    });
  }
}
