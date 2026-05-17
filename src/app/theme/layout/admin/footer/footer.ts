import { Component } from '@angular/core';
import { APP_BRANDING } from 'src/app/core/config/app-branding';
import { environment } from 'src/environments/environment';

@Component({
  selector: 'app-footer',
  imports: [],
  templateUrl: './footer.html',
  styleUrl: './footer.scss'
})
export class Footer {
  readonly branding = APP_BRANDING;
  readonly appVersion = environment.appVersion;
  readonly currentYear = new Date().getFullYear();
}
