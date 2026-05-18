import { describe, it, expect } from 'vitest';
import { formatSentenceCase, formatDate, formatDateTime } from './format-utils';

describe('formatDate', () => {
  it('should handle null and undefined', () => {
    expect(formatDate(null)).toBe('—');
    expect(formatDate(undefined)).toBe('—');
  });

  it('should handle invalid dates', () => {
    expect(formatDate('invalid-date')).toBe('—');
    expect(formatDate(new Date('abc'))).toBe('—');
  });

  it('should handle ISO strings', () => {
    const iso = '2026-04-19T10:00:00Z';
    expect(formatDate(iso)).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
  });

  it('should handle Unix epoch (seconds and milliseconds)', () => {
    const ms = 1713524817000; // 2024-04-19
    expect(formatDate(ms)).toBe('19/04/2024');
    
    const s = 1713524817; 
    expect(formatDate(s)).toBe('19/04/2024');
  });

  it('should return already formatted strings as is', () => {
    expect(formatDate('25/12/2024')).toBe('25/12/2024');
  });
});

describe('formatDateTime', () => {
  it('should include hours and minutes', () => {
    const date = new Date(2024, 3, 19, 14, 30); // 19 April 2024, 14:30
    expect(formatDateTime(date)).toBe('19/04/2024 14:30');
  });

  it('should handle invalid inputs same as formatDate', () => {
    expect(formatDateTime(null)).toBe('—');
    expect(formatDateTime('invalid')).toBe('—');
  });
});

describe('formatSentenceCase', () => {
  it('should handle empty strings', () => {
    expect(formatSentenceCase('')).toBe('');
    expect(formatSentenceCase(null as any)).toBe('');
  });

  it('should transform ALL CAPS to sentence case', () => {
    expect(formatSentenceCase('NUEVA SOLICITUD')).toBe('Nueva solicitud');
  });

  it('should preserve protected acronyms correctly', () => {
    expect(formatSentenceCase('VER INFO DEL ID')).toBe('Ver info del ID');
    expect(formatSentenceCase('configurar la API')).toBe('Configurar la API');
    expect(formatSentenceCase('ENVIA POR WhatsApp')).toBe('Envia por WhatsApp');
  });

  it('should handle mixed text with acronyms', () => {
    expect(formatSentenceCase('CONECTAR CON CRM INNOVAR')).toBe('Conectar con CRM INNOVAR');
  });

  it('should handle emails or technical text (preserving if case matches)', () => {
    // Note: The logic of formatSentenceCase as implemented follows the rule: first upper, rest lower, EXCEPT protected.
    // If "robert@seolabagency.com" is passed, it might become "Robert@seolabagency.com" unless marked protected.
    // But since emails are dynamic data, they shouldn't usually be passed here.
    // However, if a static email label is used:
    expect(formatSentenceCase('CONTACTO: info@innovar.com')).toBe('Contacto: info@innovar.com');
  });

  it('should not break already correct text', () => {
    expect(formatSentenceCase('Esta es una frase correcta')).toBe('Esta es una frase correcta');
  });

  it('should handle acronyms at the start', () => {
    expect(formatSentenceCase('ID DEL CLIENTE')).toBe('ID del cliente');
  });
});
