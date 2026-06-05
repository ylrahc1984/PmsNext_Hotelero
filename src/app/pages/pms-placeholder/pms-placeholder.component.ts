import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { SharedModule } from 'src/app/theme/shared/shared.module';

@Component({
  selector: 'app-pms-placeholder',
  standalone: true,
  imports: [CommonModule, SharedModule],
  templateUrl: './pms-placeholder.component.html',
  styleUrls: ['./pms-placeholder.component.scss']
})
export class PmsPlaceholderComponent {
  private readonly route = inject(ActivatedRoute);

  readonly moduleName = this.route.snapshot.data['module'] || 'PMS Hotelero';
  readonly pageTitle = this.route.snapshot.data['title'] || 'Módulo en preparación';
}
