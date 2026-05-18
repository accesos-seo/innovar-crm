import { format, parseISO, isValid } from 'date-fns';

/**
 * Protected words that should preserve their specific casing.
 * Add new acronyms or proper names here.
 */
export const PROTECTED_WORDS = [
  'ID', 
  'API', 
  'URL', 
  'WhatsApp', 
  'CRM', 
  'INNOVAR', 
  'PDF', 
  'IVA',
  'ASAP',
  'SHORT',
  'LON',
  'UI',
  'UX',
  'SEO'
];

/**
 * Transforms a string to sentence case: First letter uppercase, the rest lowercase.
 * Preserves protected words (acronyms, proper names) as specified in PROTECTED_WORDS.
 * 
 * @param text The static text to format.
 * @returns The formatted string in sentence case.
 */
export function formatSentenceCase(text: string): string {
  if (!text || typeof text !== 'string') return '';

  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const protectedWordsRegex = new RegExp(`\\b(${PROTECTED_WORDS.join('|')})\\b`, 'gi');
  
  // 1. Find and replace emails and protected words with placeholders
  const placeholders: string[] = [];
  let tempText = text;

  // Use a unique symbol for placeholders
  const getPlaceholder = (index: number) => `__PH_${index}__`;

  // First, find emails (they might contain protected words)
  tempText = tempText.replace(emailRegex, (match) => {
    placeholders.push(match);
    return getPlaceholder(placeholders.length - 1);
  });

  // Then find protected words (case-insensitive)
  tempText = tempText.replace(protectedWordsRegex, (match) => {
    // Determine canonical case
    const canonical = PROTECTED_WORDS.find(w => w.toLowerCase() === match.toLowerCase()) || match;
    placeholders.push(canonical);
    return getPlaceholder(placeholders.length - 1);
  });

  // 2. Apply Sentence Case to the text with placeholders
  // We need to be careful not to lowercase the placeholders like __PH_0__
  // Actually, lowercasing placeholders is fine if we restore them later by case-insensitive matching
  const lowerText = tempText.toLowerCase();
  let result = lowerText.charAt(0).toUpperCase() + lowerText.slice(1);

  // 3. Restore placeholders
  placeholders.forEach((original, index) => {
    const ph = getPlaceholder(index).toLowerCase();
    result = result.replace(ph, original);
  });

  return result;
}

/**
 * Formats a date to DD/MM/YYYY format using local timezone.
 * Returns "—" for invalid inputs.
 */
export function formatDate(date: any): string {
  if (date === null || date === undefined || date === "") return "—";

  // If already formatted, return as is
  if (typeof date === 'string' && /^\d{2}\/\d{2}\/\d{4}$/.test(date)) {
    return date;
  }

  let d: Date;
  if (typeof date === 'number') {
    // Unix epoch: detect if seconds or milliseconds
    d = new Date(date > 1000000000000 ? date : date * 1000);
  } else if (typeof date === 'string') {
    d = new Date(date);
  } else if (date instanceof Date) {
    d = date;
  } else {
    return "—";
  }

  if (!isValid(d)) return "—";

  const day = d.getDate().toString().padStart(2, '0');
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  const year = d.getFullYear();
  
  return `${day}/${month}/${year}`;
}

/**
 * Formats a date to DD/MM/YYYY HH:mm format using local timezone.
 * Returns "—" for invalid inputs.
 */
export function formatDateTime(date: any): string {
  const datePart = formatDate(date);
  if (datePart === "—") return "—";

  let d: Date;
  if (typeof date === 'number') {
    d = new Date(date > 1000000000000 ? date : date * 1000);
  } else if (typeof date === 'string') {
    // If it's already DD/MM/YYYY, it won't have time info in this string
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(date)) {
      return `${date} 00:00`;
    }
    d = new Date(date);
  } else if (date instanceof Date) {
    d = date;
  } else {
    return "—";
  }

  if (!isValid(d)) return "—";

  const hours = d.getHours().toString().padStart(2, '0');
  const minutes = d.getMinutes().toString().padStart(2, '0');

  return `${datePart} ${hours}:${minutes}`;
}

/**
 * Formats a number as COP currency.
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0
  }).format(amount || 0);
}

/**
 * Formats a phone number: +XX XXX XXXXXXX
 */
export function formatPhone(phone: string): string {
  if (!phone) return "—";
  const cleaned = phone.replace(/\D/g, "");
  if (cleaned.length === 12) {
    return `+${cleaned.slice(0, 2)} ${cleaned.slice(2, 5)} ${cleaned.slice(5)}`;
  }
  if (cleaned.length === 10) {
    return `${cleaned.slice(0, 3)} ${cleaned.slice(3, 6)} ${cleaned.slice(6)}`;
  }
  return phone;
}

// formatDate is the standard helper for DD/MM/YYYY
