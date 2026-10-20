/**
 * Strict validation and formatting rules for Algerian Administrative and Contact Data
 */

/**
 * Check if the input contains the Algerian country code (213) in any standard notation:
 * +213, 00213, (213), (+213), (0213), or 213 at start
 */
export function hasAlgerianIndicatif(val?: string): boolean {
  if (!val) return false;
  const trimmed = val.trim();
  // +213, 00213, (213), (+213), (0213)
  if (/^(\+213|00213|\(\+?213\)|\(0213\))/i.test(trimmed)) return true;
  // 213 followed by separator or regional digit (e.g. 213 26... or 21326...)
  if (/^213[\s\-\.\/]?[0-9]/.test(trimmed)) return true;
  return false;
}

/**
 * Clean phone numbers by removing spaces, dashes, dots, parentheses, and international prefix
 * Normalizes to standard Algerian local format (02X... or 05X/06X/07X...)
 */
export function sanitizePhoneNumber(phone?: string): string {
  if (!phone) return '';
  let cleaned = phone.replace(/[\s\-\.\(\)\/]/g, '');
  if (cleaned.startsWith('+213')) {
    cleaned = cleaned.substring(4);
  } else if (cleaned.startsWith('00213')) {
    cleaned = cleaned.substring(5);
  } else if (cleaned.startsWith('213')) {
    cleaned = cleaned.substring(3);
  }
  // Ensure single leading zero for local format
  if (!cleaned.startsWith('0') && cleaned.length > 0) {
    cleaned = '0' + cleaned;
  }
  return cleaned;
}

/**
 * Algerian Landline Phone (Fixe)
 * Strict Rule: A fixed number must NOT contain more than 9 digits (unless country code (213) is used).
 * Local format: 9 digits starting with 02, 03, 04, 09 (ex: 026 12 34 56).
 */
export function getAlgerianPhoneValidationError(phone?: string): string | null {
  if (!phone || phone.trim() === '') return null; // Optional field
  const rawDigits = phone.replace(/\D/g, '');
  const hasIndicatif = hasAlgerianIndicatif(phone);

  if (!hasIndicatif) {
    // Without indicatif (213): strictly MAX 9 digits!
    if (rawDigits.length > 9) {
      return 'Un numéro fixe ne doit pas contenir plus de 9 chiffres (sauf si on utilise l\'indicatif (213))';
    }
    if (rawDigits.length < 9) {
      return 'Un numéro fixe doit comporter exactement 9 chiffres (ex: 026 12 34 56)';
    }
    // Must start with 02, 03, 04, or 09
    if (!/^0(2[0-9]|3[0-9]|4[0-9]|9[0-9])/.test(rawDigits)) {
      return 'Le numéro fixe doit commencer par l\'indicatif régional 02X, 03X ou 04X (ex: 026 12 34 56)';
    }
  } else {
    // With indicatif: normalize to local format
    const cleaned = sanitizePhoneNumber(phone);
    if (cleaned.length > 9) {
      return 'Un numéro fixe avec indicatif ne doit pas dépasser 9 chiffres locaux (ex: (213) 26 12 34 56)';
    }
    if (cleaned.length < 9) {
      return 'Le numéro fixe avec indicatif doit comporter 9 chiffres locaux (ex: (213) 26 12 34 56)';
    }
    if (!/^0(2[0-9]|3[0-9]|4[0-9]|9[0-9])/.test(cleaned)) {
      return 'Le numéro fixe doit correspondre à une région algérienne valide (ex: (213) 26 12 34 56)';
    }
  }

  return null;
}

export function validateAlgerianPhone(phone?: string): boolean {
  return getAlgerianPhoneValidationError(phone) === null;
}

/**
 * Algerian Mobile Phone (Mobilis 06, Djezzy 07, Ooredoo 05)
 * Strict Rule: A mobile number must NOT contain more than 10 digits (unless country code (213) is used).
 * Local format: exactly 10 digits starting with 05, 06, or 07 (ex: 0550 12 34 56).
 */
export function getAlgerianMobileValidationError(mobile?: string): string | null {
  if (!mobile || mobile.trim() === '') return null; // Optional field
  const rawDigits = mobile.replace(/\D/g, '');
  const hasIndicatif = hasAlgerianIndicatif(mobile);

  if (!hasIndicatif) {
    // Without indicatif (213): strictly MAX 10 digits!
    if (rawDigits.length > 10) {
      return 'Un numéro de portable ne doit pas contenir plus de 10 chiffres (sauf si on utilise l\'indicatif (213))';
    }
    if (rawDigits.length < 10) {
      return 'Un numéro de portable doit comporter exactement 10 chiffres (ex: 0550 12 34 56)';
    }
    // Must start with 05, 06, or 07
    if (!/^0[567]/.test(rawDigits)) {
      return 'Le numéro de portable doit commencer par 05, 06 ou 07 (ex: 0550 12 34 56)';
    }
  } else {
    // With indicatif: normalize to local format
    const cleaned = sanitizePhoneNumber(mobile);
    if (cleaned.length > 10) {
      return 'Un numéro de portable avec indicatif ne doit pas dépasser 10 chiffres locaux (ex: (213) 550 12 34 56)';
    }
    if (cleaned.length < 10) {
      return 'Le numéro de portable avec indicatif doit comporter 10 chiffres locaux (ex: (213) 550 12 34 56)';
    }
    if (!/^0[567]/.test(cleaned)) {
      return 'Le numéro de portable doit commencer par 05, 06 ou 07 après l\'indicatif';
    }
  }

  return null;
}

export function validateAlgerianMobile(mobile?: string): boolean {
  return getAlgerianMobileValidationError(mobile) === null;
}

/**
 * Real-time formatters that prevent entering more digits than allowed
 * (Max 9 digits for Fixe unless indicatif (213) is used; Max 10 digits for Mobile unless indicatif (213) is used)
 */
export function formatAlgerianFixeInput(input: string): string {
  if (!input) return '';
  const trimmed = input.trim();
  const hasIndicatif = hasAlgerianIndicatif(trimmed);

  if (hasIndicatif) {
    let prefix = '';
    let rest = trimmed;
    if (trimmed.startsWith('+213')) {
      prefix = '+213 ';
      rest = trimmed.substring(4);
    } else if (trimmed.startsWith('00213')) {
      prefix = '00213 ';
      rest = trimmed.substring(5);
    } else if (trimmed.startsWith('(213)')) {
      prefix = '(213) ';
      rest = trimmed.substring(5);
    } else if (trimmed.startsWith('(+213)')) {
      prefix = '(+213) ';
      rest = trimmed.substring(6);
    } else if (trimmed.startsWith('213')) {
      prefix = '213 ';
      rest = trimmed.substring(3);
    }
    const restDigits = rest.replace(/\D/g, '').slice(0, 9);
    let formattedRest = restDigits;
    if (restDigits.startsWith('0')) {
      formattedRest = restDigits.replace(/^(\d{3})(\d{2})?(\d{2})?(\d{2})?/, (_, a, b, c, d) => 
        [a, b, c, d].filter(Boolean).join(' ')
      );
    } else {
      formattedRest = restDigits.replace(/^(\d{2})(\d{2})?(\d{2})?(\d{2})?/, (_, a, b, c, d) => 
        [a, b, c, d].filter(Boolean).join(' ')
      );
    }
    return prefix + formattedRest;
  }

  // Without indicatif: strictly cap at 9 digits!
  const digits = input.replace(/\D/g, '').slice(0, 9);
  if (digits.length <= 3) return digits;
  if (digits.length <= 5) return `${digits.slice(0, 3)} ${digits.slice(3)}`;
  if (digits.length <= 7) return `${digits.slice(0, 3)} ${digits.slice(3, 5)} ${digits.slice(5)}`;
  return `${digits.slice(0, 3)} ${digits.slice(3, 5)} ${digits.slice(5, 7)} ${digits.slice(7, 9)}`;
}

export function formatAlgerianMobileInput(input: string): string {
  if (!input) return '';
  const trimmed = input.trim();
  const hasIndicatif = hasAlgerianIndicatif(trimmed);

  if (hasIndicatif) {
    let prefix = '';
    let rest = trimmed;
    if (trimmed.startsWith('+213')) {
      prefix = '+213 ';
      rest = trimmed.substring(4);
    } else if (trimmed.startsWith('00213')) {
      prefix = '00213 ';
      rest = trimmed.substring(5);
    } else if (trimmed.startsWith('(213)')) {
      prefix = '(213) ';
      rest = trimmed.substring(5);
    } else if (trimmed.startsWith('(+213)')) {
      prefix = '(+213) ';
      rest = trimmed.substring(6);
    } else if (trimmed.startsWith('213')) {
      prefix = '213 ';
      rest = trimmed.substring(3);
    }
    const restDigits = rest.replace(/\D/g, '').slice(0, 10);
    let formattedRest = restDigits;
    if (restDigits.startsWith('0')) {
      formattedRest = restDigits.replace(/^(\d{4})(\d{2})?(\d{2})?(\d{2})?/, (_, a, b, c, d) => 
        [a, b, c, d].filter(Boolean).join(' ')
      );
    } else {
      formattedRest = restDigits.replace(/^(\d{3})(\d{2})?(\d{2})?(\d{2})?/, (_, a, b, c, d) => 
        [a, b, c, d].filter(Boolean).join(' ')
      );
    }
    return prefix + formattedRest;
  }

  // Without indicatif: strictly cap at 10 digits!
  const digits = input.replace(/\D/g, '').slice(0, 10);
  if (digits.length <= 4) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 4)} ${digits.slice(4)}`;
  if (digits.length <= 8) return `${digits.slice(0, 4)} ${digits.slice(4, 6)} ${digits.slice(6)}`;
  return `${digits.slice(0, 4)} ${digits.slice(4, 6)} ${digits.slice(6, 8)} ${digits.slice(8, 10)}`;
}

/**
 * Algerian NIF (Numéro d'Identification Fiscale)
 * Strict Rule: Exactly 15 numeric digits.
 */
export function validateAlgerianNIF(nif?: string): boolean {
  if (!nif || nif.trim() === '') return true; // Optional field
  const cleaned = nif.replace(/[\s\-\.]/g, '');
  return /^[0-9]{15}$/.test(cleaned);
}

/**
 * Algerian NIS (Numéro d'Identification Statistique)
 * Strict Rule: Exactly 13 or 15 numeric digits.
 */
export function validateAlgerianNIS(nis?: string): boolean {
  if (!nis || nis.trim() === '') return true; // Optional field
  const cleaned = nis.replace(/[\s\-\.]/g, '');
  return /^[0-9]{13}$|^[0-9]{15}$/.test(cleaned);
}

/**
 * Algerian Article d'Imposition (AI)
 * Strict Rule: Exactly 11 numeric digits.
 */
export function validateAlgerianArticle(article?: string): boolean {
  if (!article || article.trim() === '') return true; // Optional field
  const cleaned = article.replace(/[\s\-\.\/]/g, '');
  return /^[0-9]{11}$/.test(cleaned);
}

/**
 * Algerian Registre de Commerce (RC)
 * Strict Rule: Ex: 16/00-0123456B08, 1412999 A 98, 10 B 0123456
 * Minimum 7 alphanumeric chars with valid separators.
 */
export function validateAlgerianRC(rc?: string): boolean {
  if (!rc || rc.trim() === '') return true; // Optional field
  const trimmed = rc.trim();
  if (trimmed.length < 6 || trimmed.length > 25) return false;
  // Must not contain invalid special characters
  return /^[0-9]{1,2}[\s\/\-0-9A-Za-z]{4,23}$/.test(trimmed);
}

/**
 * Algerian Bank RIB (Relevé d'Identité Bancaire)
 * Strict Rule: If digits-only, exactly 20 digits (Bank 3 + Branch 3 + Account 12 + Key 2),
 * or alphanumeric string with bank name and account numbers (min 8 chars).
 */
export function validateAlgerianBank(bank?: string): boolean {
  if (!bank || bank.trim() === '') return true; // Optional field
  const cleaned = bank.replace(/[\s\-]/g, '');
  // If user typed only numbers: must be 20 digits
  if (/^[0-9]+$/.test(cleaned)) {
    return cleaned.length === 20;
  }
  // If user typed bank acronym (e.g. BNA / CPA / BEA + numbers)
  return bank.trim().length >= 6;
}

/**
 * Auto-format phone numbers as 0X XX XX XX XX or 0XX XX XX XX for clean display
 */
export function formatAlgerianPhoneDisplay(val: string): string {
  const cleaned = sanitizePhoneNumber(val);
  if (cleaned.length === 10) {
    // 05 50 12 34 56
    return cleaned.replace(/(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/, '$1 $2 $3 $4 $5');
  }
  if (cleaned.length === 9) {
    // 026 12 34 56
    return cleaned.replace(/(\d{3})(\d{2})(\d{2})(\d{2})/, '$1 $2 $3 $4');
  }
  return val;
}
