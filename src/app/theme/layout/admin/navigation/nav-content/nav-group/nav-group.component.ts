// angular import
import { Component, input, output } from '@angular/core';

// project import
import { NavigationItem } from '../../navigation';
import { SharedModule } from 'src/app/theme/shared/shared.module';
import { NavItemComponent } from '../nav-item/nav-item.component';
import { NavCollapseComponent } from '../nav-collapse/nav-collapse.component';

@Component({
  selector: 'app-nav-group',
  imports: [SharedModule, NavItemComponent, NavCollapseComponent],
  templateUrl: './nav-group.component.html',
  styleUrls: ['./nav-group.component.scss']
})
export class NavGroupComponent {
  // public props
  readonly item = input<NavigationItem>(undefined);
  readonly expandedRootId = input<string | null>(null);
  readonly rootSectionChange = output<string | null>();
}
