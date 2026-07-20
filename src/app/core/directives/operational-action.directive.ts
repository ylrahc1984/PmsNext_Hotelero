import { Directive, ElementRef, HostListener, Renderer2, effect, inject, input } from '@angular/core';

import { OperationalAction } from '../models/operational-context.model';
import { OperationalDecision } from '../models/operational-policy.model';
import { OperationalPolicyService } from '../services/operational-policy.service';

/**
 * Capa visual para futuros controles protegidos por el contexto operativo.
 * No reemplaza la validación `policy.require(...)` dentro de una escritura sensible.
 */
@Directive({
  selector: '[appOperationalAction]',
  standalone: true
})
export class OperationalActionDirective {
  private readonly elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly renderer = inject(Renderer2);
  private readonly policy = inject(OperationalPolicyService);
  private currentDecision: OperationalDecision | null = null;
  private appliedTitle = '';
  private previousTitle: string | null = null;

  readonly appOperationalAction = input.required<OperationalAction | string>();

  constructor() {
    effect(() => this.applyDecision(this.policy.decision(this.appOperationalAction())));
  }

  @HostListener('click', ['$event'])
  handleClick(event: Event): void {
    const decision = this.currentDecision ?? this.policy.decision(this.appOperationalAction());
    if (decision.allowed) return;

    event.preventDefault();
    event.stopImmediatePropagation();
    event.stopPropagation();
    void this.policy.notifyDenied(decision);
  }

  private applyDecision(decision: OperationalDecision): void {
    const wasBlocked = this.currentDecision?.allowed === false;
    this.currentDecision = decision;
    const element = this.elementRef.nativeElement;

    if (decision.allowed) {
      this.renderer.removeClass(element, 'operational-action--blocked');
      this.renderer.setAttribute(element, 'aria-disabled', 'false');
      if (this.appliedTitle && element.getAttribute('title') === this.appliedTitle) {
        if (this.previousTitle) {
          this.renderer.setAttribute(element, 'title', this.previousTitle);
        } else {
          this.renderer.removeAttribute(element, 'title');
        }
      }
      this.appliedTitle = '';
      this.previousTitle = null;
      return;
    }

    if (!wasBlocked) this.previousTitle = element.getAttribute('title');
    this.appliedTitle = decision.reason;
    this.renderer.addClass(element, 'operational-action--blocked');
    this.renderer.setAttribute(element, 'aria-disabled', 'true');
    this.renderer.setAttribute(element, 'title', decision.reason);
  }
}
