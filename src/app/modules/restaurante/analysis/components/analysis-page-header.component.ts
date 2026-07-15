import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-analysis-page-header',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="analysis-header">
      <div>
        <span class="analysis-header__eyebrow"><i class="feather icon-bar-chart-2"></i> Centro de Análisis</span>
        <h1>{{ title() }}</h1>
        <p>{{ description() }}</p>
      </div>
      <a routerLink="/restaurant/puntos-venta" class="analysis-header__back">
        <i class="feather icon-arrow-left"></i>
        <span>Restaurante</span>
      </a>
    </header>
  `,
  styles: `
    :host { display: block; }
    .analysis-header { display:flex; align-items:center; justify-content:space-between; gap:1rem; padding:1.25rem 1.5rem; border-radius:20px; color:#fff; background:radial-gradient(circle at 84% 8%, rgba(23,212,224,.25), transparent 30%), linear-gradient(135deg,#132235 0%,#1f6bff 62%,#0b1724 100%); box-shadow:0 20px 48px rgba(11,23,36,.14); }
    .analysis-header__eyebrow { display:inline-flex; align-items:center; gap:.45rem; color:#8cf4fa; font-size:.7rem; font-weight:800; letter-spacing:.08em; text-transform:uppercase; }
    h1 { margin:.35rem 0 .2rem; color:#fff; font-size:1.55rem; font-weight:850; line-height:1.15; }
    p { margin:0; color:rgba(255,255,255,.75); font-size:.88rem; }
    .analysis-header__back { display:inline-flex; align-items:center; gap:.45rem; min-height:38px; padding:.55rem .85rem; border:1px solid rgba(255,255,255,.28); border-radius:11px; color:#fff; background:rgba(255,255,255,.1); font-size:.78rem; font-weight:750; white-space:nowrap; transition:background .16s ease,transform .16s ease; }
    .analysis-header__back:hover { color:#fff; background:rgba(255,255,255,.18); transform:translateY(-1px); }
    @media(max-width:575px) { .analysis-header { align-items:flex-start; flex-direction:column; padding:1rem; border-radius:16px; } h1 { font-size:1.3rem; } }
  `
})
export class AnalysisPageHeaderComponent {
  readonly title = input.required<string>();
  readonly description = input.required<string>();
}
