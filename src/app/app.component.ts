// Angular import
import { Component, OnInit, inject } from '@angular/core';
import { NavigationEnd, Router, RouterModule } from '@angular/router';

// project import
import { SpinnerComponent } from './theme/shared/components/spinner/spinner.component';
import { ToastContainerComponent } from './core/components/toast-container.component';
import { EmpresaContextService } from './core/services/empresa-context.service';

@Component({
  selector: 'app-root',
  imports: [SpinnerComponent, RouterModule, ToastContainerComponent],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit {
  private router = inject(Router);
  private empresaContext = inject(EmpresaContextService);

  title = 'PmsNext_Hotelero';

  // life cycle hook
  ngOnInit() {
    this.empresaContext.restaurarDesdeStorage();
    if (!this.empresaContext.getSnapshot()) {
      this.empresaContext.cargarEmpresaPrincipal();
    }

    this.router.events.subscribe((evt) => {
      if (!(evt instanceof NavigationEnd)) {
        return;
      }
      window.scrollTo(0, 0);
    });
  }
}
