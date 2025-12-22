/**
 * ISBN Utility Functions
 * Handles ISBN-10 and ISBN-13 normalization and formatting
 * 
 * Note: Full ISBN hyphenation requires official range tables from the 
 * International ISBN Agency. This utility provides basic formatting
 * that improves readability while storing normalized (unhyphenated) ISBNs.
 */

/**
 * Normalize an ISBN by removing all non-alphanumeric characters
 * and converting to uppercase (for ISBN-10 check digit X)
 */
export function normalizeIsbn(isbn: string): string {
  return isbn.replace(/[^0-9Xx]/g, '').toUpperCase();
}

/**
 * Validate an ISBN-10 check digit
 */
export function validateIsbn10(isbn: string): boolean {
  const normalized = normalizeIsbn(isbn);
  if (normalized.length !== 10) return false;
  
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    const digit = parseInt(normalized[i], 10);
    if (isNaN(digit)) return false;
    sum += digit * (10 - i);
  }
  
  const lastChar = normalized[9];
  const checkDigit = lastChar === 'X' ? 10 : parseInt(lastChar, 10);
  if (isNaN(checkDigit) && lastChar !== 'X') return false;
  
  sum += checkDigit;
  return sum % 11 === 0;
}

/**
 * Validate an ISBN-13 check digit
 */
export function validateIsbn13(isbn: string): boolean {
  const normalized = normalizeIsbn(isbn);
  if (normalized.length !== 13) return false;
  
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const digit = parseInt(normalized[i], 10);
    if (isNaN(digit)) return false;
    sum += digit * (i % 2 === 0 ? 1 : 3);
  }
  
  const checkDigit = (10 - (sum % 10)) % 10;
  return checkDigit === parseInt(normalized[12], 10);
}

/**
 * Validate any ISBN (10 or 13)
 */
export function validateIsbn(isbn: string): boolean {
  const normalized = normalizeIsbn(isbn);
  if (normalized.length === 10) return validateIsbn10(normalized);
  if (normalized.length === 13) return validateIsbn13(normalized);
  return false;
}

/**
 * Format an ISBN-13 with visual grouping for readability.
 * Uses a consistent 3-1-4-5-1 pattern (XXX-X-XXXX-XXXXX-X) which is 
 * visually clear and commonly seen format, though may not match 
 * official hyphenation for all publishers.
 */
export function formatIsbn13(isbn: string): string {
  const normalized = normalizeIsbn(isbn);
  if (normalized.length !== 13) return isbn;
  
  // Format: XXX-X-XXXX-XXXXX-X (prefix-group-publisher-title-check)
  // This provides a clean, readable format
  return `${normalized.slice(0, 3)}-${normalized.slice(3, 4)}-${normalized.slice(4, 8)}-${normalized.slice(8, 12)}-${normalized.slice(12)}`;
}

/**
 * Format an ISBN-10 with visual grouping for readability.
 * Uses a consistent 1-4-4-1 pattern (X-XXXX-XXXX-X)
 */
export function formatIsbn10(isbn: string): string {
  const normalized = normalizeIsbn(isbn);
  if (normalized.length !== 10) return isbn;
  
  // Format: X-XXXX-XXXX-X (group-publisher-title-check)
  return `${normalized.slice(0, 1)}-${normalized.slice(1, 5)}-${normalized.slice(5, 9)}-${normalized.slice(9)}`;
}

/**
 * Format any ISBN (10 or 13) with visual grouping hyphens
 */
export function formatIsbn(isbn: string): string {
  const normalized = normalizeIsbn(isbn);
  
  if (normalized.length === 10) {
    return formatIsbn10(normalized);
  }
  if (normalized.length === 13) {
    return formatIsbn13(normalized);
  }
  
  // Return original if not a valid length
  return isbn;
}

/**
 * Convert ISBN-10 to ISBN-13
 */
export function isbn10to13(isbn10: string): string | null {
  const normalized = normalizeIsbn(isbn10);
  if (normalized.length !== 10) return null;
  
  const isbn13Base = '978' + normalized.slice(0, 9);
  
  // Calculate ISBN-13 check digit
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += parseInt(isbn13Base[i], 10) * (i % 2 === 0 ? 1 : 3);
  }
  const checkDigit = (10 - (sum % 10)) % 10;
  
  return isbn13Base + checkDigit;
}

/**
 * Convert ISBN-13 to ISBN-10 (only works for 978 prefix)
 */
export function isbn13to10(isbn13: string): string | null {
  const normalized = normalizeIsbn(isbn13);
  if (normalized.length !== 13 || !normalized.startsWith('978')) return null;
  
  const isbn10Base = normalized.slice(3, 12);
  
  // Calculate ISBN-10 check digit
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(isbn10Base[i], 10) * (10 - i);
  }
  const checkDigit = (11 - (sum % 11)) % 11;
  const checkChar = checkDigit === 10 ? 'X' : checkDigit.toString();
  
  return isbn10Base + checkChar;
}
