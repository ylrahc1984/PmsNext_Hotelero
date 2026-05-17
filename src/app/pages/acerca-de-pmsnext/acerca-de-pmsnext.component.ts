import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { APP_BRANDING } from 'src/app/core/config/app-branding';
import { environment } from 'src/environments/environment';

@Component({
  selector: 'app-acerca-de-pmsnext',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './acerca-de-pmsnext.component.html',
  styleUrls: ['./acerca-de-pmsnext.component.scss']
})
export class AcercaDePmsnextComponent {
  readonly branding = APP_BRANDING;
  readonly appVersion = environment.appVersion;
  readonly currentYear = new Date().getFullYear();
}
