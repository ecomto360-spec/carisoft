import { db } from '../db/db';

/**
 * Génère le numéro séquentiel de facture selon l'année (ex: 2026/001, 2026/002...).
 * Au 1er janvier de l'année suivante (ex: 2027), le compteur recommence automatiquement à AAAA/001.
 * Ce numéro est strictement attribué par le système et non modifiable manuellement.
 *
 * @param companyId Identifiant société (multi-tenant)
 * @param targetDate Date de la facture pour déterminer l'année fiscale
 * @returns Le prochain numéro officiel formaté 'AAAA/001'
 */
export async function getNextInvoiceNumber(companyId?: string, targetDate?: string): Promise<string> {
  const dateObj = targetDate ? new Date(targetDate) : new Date();
  const year = isNaN(dateObj.getFullYear()) ? new Date().getFullYear() : dateObj.getFullYear();
  const yearStr = String(year);

  try {
    const allInvoices = await db.invoices.toArray();
    const companyInvoices = allInvoices.filter(inv => {
      if (companyId && inv.companyId && inv.companyId !== companyId) {
        return false;
      }
      return true;
    });

    let maxSeq = 0;
    // Regex stricte pour capturer l'année suivie d'un slash ou tiret et de chiffres (ex: 2026/001, 2026/1, FAC-2026-0001)
    const yearPrefixPattern = new RegExp(`(?:FAC-)?${yearStr}[/-](\\d+)`, 'i');

    for (const inv of companyInvoices) {
      if (!inv.number) continue;
      const match = inv.number.trim().match(yearPrefixPattern);
      if (match && match[1]) {
        const seq = parseInt(match[1], 10);
        if (!isNaN(seq) && seq > maxSeq) {
          maxSeq = seq;
        }
      }
    }

    const nextSeq = maxSeq + 1;
    // Format requis : AAAA/001 (minimum 3 chiffres avec zéros de tête)
    const paddedSeq = String(nextSeq).padStart(3, '0');
    return `${yearStr}/${paddedSeq}`;
  } catch (error) {
    console.error("Erreur lors de la génération du numéro de facture:", error);
    return `${yearStr}/001`;
  }
}
