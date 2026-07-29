export type EscPosAlignment = 'left' | 'center' | 'right';

export interface EscPosReceiptOptions {
  width?: number;
}

/**
 * Compositor base para documentos ESC/POS de texto.
 * Cada formato de negocio crea una instancia nueva y solo decide su contenido.
 */
export class EscPosReceiptComposer {
  private readonly output: string[] = [];
  readonly width: number;

  constructor(options: EscPosReceiptOptions = {}) {
    this.width = Math.max(24, Math.floor(options.width ?? 42));
  }

  initialize(): this {
    this.output.push('\x1B\x40');
    return this;
  }

  align(alignment: EscPosAlignment): this {
    const value = alignment === 'center' ? 1 : alignment === 'right' ? 2 : 0;
    this.output.push(`\x1B\x61${String.fromCharCode(value)}`);
    return this;
  }

  bold(enabled: boolean): this {
    this.output.push(enabled ? '\x1B\x45\x01' : '\x1B\x45\x00');
    return this;
  }

  size(widthMultiplier = 1, heightMultiplier = widthMultiplier): this {
    const width = Math.min(8, Math.max(1, Math.floor(widthMultiplier)));
    const height = Math.min(8, Math.max(1, Math.floor(heightMultiplier)));
    this.output.push(`\x1D\x21${String.fromCharCode(((width - 1) << 4) | (height - 1))}`);
    return this;
  }

  line(value = ''): this {
    this.output.push(`${this.clean(value)}\n`);
    return this;
  }

  wrapped(value: string | number | null | undefined, indent = ''): this {
    const safeIndent = this.clean(indent).slice(0, Math.max(0, this.width - 1));
    const contentWidth = Math.max(1, this.width - safeIndent.length);
    this.wrap(value, contentWidth).forEach((text) => this.output.push(`${safeIndent}${text}\n`));
    return this;
  }

  columns(left: string | number | null | undefined, right: string | number | null | undefined): this {
    const cleanLeft = this.clean(left);
    const cleanRight = this.clean(right);
    const availableLeft = Math.max(0, this.width - cleanRight.length - 1);
    const safeLeft = cleanLeft.slice(0, availableLeft);
    const safeRight = cleanRight.slice(-Math.max(0, this.width - safeLeft.length - 1));
    const spaces = Math.max(1, this.width - safeLeft.length - safeRight.length);
    this.output.push(`${safeLeft}${' '.repeat(spaces)}${safeRight}\n`);
    return this;
  }

  wrappedColumns(
    left: string | number | null | undefined,
    right: string | number | null | undefined
  ): this {
    const cleanRight = this.clean(right).slice(-(this.width - 1));
    const leftWidth = Math.max(1, this.width - cleanRight.length - 1);
    const leftLines = this.wrap(left, leftWidth);

    leftLines.forEach((line, index) => {
      if (index === 0 && cleanRight) {
        const spaces = Math.max(1, this.width - line.length - cleanRight.length);
        this.output.push(`${line}${' '.repeat(spaces)}${cleanRight}\n`);
        return;
      }

      this.output.push(`${line}\n`);
    });

    return this;
  }

  separator(character = '-'): this {
    const safeCharacter = this.clean(character).charAt(0) || '-';
    this.output.push(`${safeCharacter.repeat(this.width)}\n`);
    return this;
  }

  feed(lines = 1): this {
    this.output.push('\n'.repeat(Math.max(1, Math.floor(lines))));
    return this;
  }

  cut(): this {
    this.output.push('\x1D\x56\x41\x00');
    return this;
  }

  build(): string[] {
    return [...this.output];
  }

  money(value: unknown, currency = ''): string {
    const amount = this.number(value).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
    const normalizedCurrency = this.clean(currency);
    return normalizedCurrency ? `${amount} ${normalizedCurrency}` : amount;
  }

  number(value: unknown): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  clean(value: string | number | null | undefined): string {
    return (value ?? '')
      .toString()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\x20-\x7E]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private wrap(value: string | number | null | undefined, width: number): string[] {
    const text = this.clean(value);
    if (!text) {
      return [''];
    }

    const lines: string[] = [];
    let remaining = text;
    while (remaining.length > width) {
      const candidate = remaining.slice(0, width + 1);
      const breakAt = candidate.lastIndexOf(' ');
      const lineLength = breakAt > 0 ? breakAt : width;
      lines.push(remaining.slice(0, lineLength).trim());
      remaining = remaining.slice(lineLength).trim();
    }
    if (remaining) {
      lines.push(remaining);
    }
    return lines;
  }
}
