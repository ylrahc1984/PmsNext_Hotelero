import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';

export type IdentityDocumentVisualState = 'empty' | 'ready' | 'preparing-rooming' | 'uploading' | 'stored' | 'replacing' | 'deleting' | 'error';

@Component({
  selector: 'app-identity-document-card',
  standalone: true,
  templateUrl: './identity-document-card.component.html',
  styleUrls: ['./identity-document-card.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class IdentityDocumentCardComponent {
  @Input() state: IdentityDocumentVisualState = 'empty';
  @Input() documentLabel = '';
  @Input() fileName = '';
  @Input() fileSizeLabel = '';
  @Input() storedAtLabel = '';
  @Input() storedByLabel = '';
  @Input() localPreviewUrl = '';
  @Input() errorMessage = '';
  @Input() disabled = false;

  @Output() takePhoto = new EventEmitter<void>();
  @Output() chooseFile = new EventEmitter<void>();
  @Output() viewDocument = new EventEmitter<void>();
  @Output() replaceDocument = new EventEmitter<void>();
  @Output() deleteDocument = new EventEmitter<void>();
  @Output() retry = new EventEmitter<void>();
  @Output() removeLocal = new EventEmitter<void>();

  get isBusy(): boolean {
    return this.state === 'preparing-rooming' || this.state === 'uploading' || this.state === 'replacing' || this.state === 'deleting';
  }

  get actionsDisabled(): boolean {
    return this.disabled || this.isBusy;
  }
}
