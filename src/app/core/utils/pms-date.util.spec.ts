import {
  formatPmsDateTimeDDMMYYYY,
  normalizePmsDateDDMMYYYY,
  normalizePmsDateInputDDMMYYYY,
  normalizePmsDateKeyboardInputDDMMYYYY
} from './pms-date.util';

describe('PMS date utilities', () => {
  describe('normalizePmsDateInputDDMMYYYY', () => {
    it('accepts one or two digits for day and month and pads the result', () => {
      expect(normalizePmsDateInputDDMMYYYY('2/08/2026')).toBe('02/08/2026');
      expect(normalizePmsDateInputDDMMYYYY('2/8/2026')).toBe('02/08/2026');
      expect(normalizePmsDateInputDDMMYYYY('02/08/2026')).toBe('02/08/2026');
    });

    it('rejects impossible dates and additional content', () => {
      expect(normalizePmsDateInputDDMMYYYY('31/02/2026')).toBe('');
      expect(normalizePmsDateInputDDMMYYYY('02/08/2026 10:30')).toBe('');
      expect(normalizePmsDateInputDDMMYYYY('2026-08-02')).toBe('');
      expect(normalizePmsDateInputDDMMYYYY('20112026')).toBe('');
    });

    it('validates leap years', () => {
      expect(normalizePmsDateInputDDMMYYYY('29/02/2024')).toBe('29/02/2024');
      expect(normalizePmsDateInputDDMMYYYY('29/02/2026')).toBe('');
    });
  });

  describe('normalizePmsDateKeyboardInputDDMMYYYY', () => {
    it('accepts compact dates and separated dates', () => {
      expect(normalizePmsDateKeyboardInputDDMMYYYY('20112026')).toBe('20/11/2026');
      expect(normalizePmsDateKeyboardInputDDMMYYYY('20/11/2026')).toBe('20/11/2026');
      expect(normalizePmsDateKeyboardInputDDMMYYYY('01012027')).toBe('01/01/2027');
      expect(normalizePmsDateKeyboardInputDDMMYYYY('29022028')).toBe('29/02/2028');
    });

    it('rejects incomplete, malformed and nonexistent dates', () => {
      for (const value of ['31112026', '29022027', '201120', '32132026', '20132026', '32112026', 'twenty november 2026']) {
        expect(normalizePmsDateKeyboardInputDDMMYYYY(value)).toBe('');
      }
    });
  });

  it('normalizes supported API dates without accepting arbitrary suffixes', () => {
    expect(normalizePmsDateDDMMYYYY('2026-08-02T14:05:00')).toBe('02/08/2026');
    expect(normalizePmsDateDDMMYYYY('2/08/2026 14:05')).toBe('02/08/2026');
    expect(normalizePmsDateDDMMYYYY('2/08/2026texto')).toBe('');
  });

  it('formats local date time with a four-digit year and leading zeroes', () => {
    expect(formatPmsDateTimeDDMMYYYY(new Date(2026, 7, 2, 14, 5))).toBe('02/08/2026 14:05');
  });
});
