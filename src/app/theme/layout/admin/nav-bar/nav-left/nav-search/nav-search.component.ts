// angular import
import { Component, inject } from '@angular/core';

// project import
import { EmpresaContextService } from 'src/app/core/services/empresa-context.service';
import { SharedModule } from 'src/app/theme/shared/shared.module';

@Component({
  selector: 'app-nav-search',
  imports: [SharedModule],
  templateUrl: './nav-search.component.html',
  styleUrls: ['./nav-search.component.scss']
})
export class NavSearchComponent {
  private readonly empresaContext = inject(EmpresaContextService);

  readonly empresa = this.empresaContext.empresa;

  get hotelNombre(): string {
    const empresa = this.empresa();
    return (empresa?.MA04_Nombre || empresa?.MA04_RazonSocial || 'PMSNext Hospitality').trim();
  }

  get hotelUnidad(): string {
    const empresa = this.empresa();
    return (empresa?.MA04_Unidad || '').trim();
  }
}
