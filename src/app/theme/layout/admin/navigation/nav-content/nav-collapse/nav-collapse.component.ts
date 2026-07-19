// angular import
import { Component, inject, input, output } from '@angular/core';
import { animate, style, transition, trigger } from '@angular/animations';
import { Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';

// project import
import { NavigationItem } from '../../navigation';
import { navigationItemMatchesUrl } from '../../navigation-route.util';
import { SharedModule } from 'src/app/theme/shared/shared.module';
import { NavItemComponent } from '../nav-item/nav-item.component';

@Component({
  selector: 'app-nav-collapse',
  imports: [SharedModule, NavItemComponent, RouterModule, CommonModule],
  templateUrl: './nav-collapse.component.html',
  styleUrls: ['./nav-collapse.component.scss'],
  animations: [
    trigger('slideInOut', [
      transition(':enter', [
        style({ transform: 'translateY(-100%)', display: 'block' }),
        animate('250ms ease-in', style({ transform: 'translateY(0%)' }))
      ]),
      transition(':leave', [animate('250ms ease-in', style({ transform: 'translateY(-100%)' }))])
    ])
  ]
})
export class NavCollapseComponent {
  private readonly router = inject(Router);

  // public props
  item = input<NavigationItem>();
  expandedRootId = input<string | null>(null);
  rootSectionId = input<string | null>(null);
  rootSectionChange = output<string | null>();
  visible = false;

  get isExpanded(): boolean {
    if (this.isTopLevelSection()) {
      return this.expandedRootId() === this.item().id;
    }

    return this.visible || navigationItemMatchesUrl(this.item(), this.router.url);
  }

  get currentRootSectionId(): string {
    return this.rootSectionId() ?? this.item().id;
  }

  // public method
  navCollapse(e: MouseEvent) {
    e.preventDefault();

    if (this.item().locked) {
      return;
    }

    if (this.isTopLevelSection()) {
      this.rootSectionChange.emit(this.isExpanded ? null : this.item().id);
      return;
    }

    this.visible = !this.visible;
  }

  private isTopLevelSection(): boolean {
    return this.rootSectionId() === null;
  }

}
