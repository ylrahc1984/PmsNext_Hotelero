// angular import
import { Component, inject } from '@angular/core';

// project import
import { EmpresaContextService } from 'src/app/core/services/empresa-context.service';
import { HotelLogoService } from 'src/app/core/services/hotel-logo.service';
import { SharedModule } from 'src/app/theme/shared/shared.module';

@Component({
  selector: 'app-nav-search',
  imports: [SharedModule],
  templateUrl: './nav-search.component.html',
  styleUrls: ['./nav-search.component.scss']
})
export class NavSearchComponent {
  private readonly empresaContext = inject(EmpresaContextService);
  private readonly hotelLogoService = inject(HotelLogoService);
  private hotelLogoAttempt = 0;
  private hotelLogoKey = '';

  readonly empresa = this.empresaContext.empresa;

  get hotelLogoUrl(): string {
    const candidates = this.hotelLogoService.getLogoAssetCandidates(this.empresa(), this.hotelLogoService.defaultHeaderLogo);
    if (candidates[0] !== this.hotelLogoKey) {
      this.hotelLogoKey = candidates[0];
      this.hotelLogoAttempt = 0;
    }
    return candidates[Math.min(this.hotelLogoAttempt, candidates.length - 1)];
  }

  onHotelLogoError(): void {
    const candidates = this.hotelLogoService.getLogoAssetCandidates(this.empresa(), this.hotelLogoService.defaultHeaderLogo);
    if (this.hotelLogoAttempt < candidates.length - 1) {
      this.hotelLogoAttempt++;
    }
  }

  get hotelNombre(): string {
    const empresa = this.empresa();
    return (empresa?.MA04_Nombre || empresa?.MA04_RazonSocial || 'PMSNext Hospitality').trim();
  }

  get hotelUnidad(): string {
    const empresa = this.empresa();
    return (empresa?.MA04_Unidad || '').trim();
  }
}
