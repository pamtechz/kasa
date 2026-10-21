/**
 * KASA Automated Document OCR & Fuzzy String Matching Engine
 * Performs Levenshtein Distance matching and parameter extraction on uploaded NRC and Results Slips.
 */

export function levenshteinDistance(a: string, b: string): number {
  const s1 = a.toLowerCase().trim();
  const s2 = b.toLowerCase().trim();

  if (s1 === s2) return 0;
  if (!s1.length) return s2.length;
  if (!s2.length) return s1.length;

  const matrix: number[][] = [];

  for (let i = 0; i <= s2.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= s1.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= s2.length; i++) {
    for (let j = 1; j <= s1.length; j++) {
      if (s2.charAt(i - 1) === s1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }

  return matrix[s2.length][s1.length];
}

export function calculateSimilarity(a: string, b: string): number {
  const s1 = a.toLowerCase().trim();
  const s2 = b.toLowerCase().trim();

  if (!s1 && !s2) return 100;
  if (!s1 || !s2) return 0;

  const maxLength = Math.max(s1.length, s2.length);
  const distance = levenshteinDistance(s1, s2);
  const similarity = ((maxLength - distance) / maxLength) * 100;

  return Math.round(Math.max(0, Math.min(100, similarity)));
}

export type OcrVerificationResult = {
  ocrText: string;
  extractedName?: string;
  extractedNrc?: string;
  extractedDob?: string;
  nameSimilarity: number;
  nrcMatch: boolean;
  overallScore: number;
  needsReview: boolean;
  flags: string[];
};

export function extractNrcNumber(text: string): string | undefined {
  // Zambian NRC regex format: 123456/10/1 or 123456/78/1
  const nrcRegex = /\b\d{6}\/\d{2}\/\d{1}\b/;
  const match = text.match(nrcRegex);
  return match ? match[0] : undefined;
}

export function extractDobDate(text: string): string | undefined {
  // Date format DD/MM/YYYY or DD-MM-YYYY
  const dateRegex = /\b(0[1-9]|[12][0-9]|3[01])[\/\-](0[1-9]|1[012])[\/\-](19|20)\d{2}\b/;
  const match = text.match(dateRegex);
  return match ? match[0] : undefined;
}

export function verifyDocumentText(
  rawText: string,
  claimedName: string,
  claimedNrc?: string
): OcrVerificationResult {
  const cleanText = String(rawText || '').trim();
  const flags: string[] = [];

  const extractedNrc = extractNrcNumber(cleanText);
  const extractedDob = extractDobDate(cleanText);

  // Name similarity comparison
  let nameSimilarity = 100;
  if (claimedName && cleanText) {
    nameSimilarity = calculateSimilarity(claimedName, cleanText);
    // If text contains the words in claimed name, boost score
    const nameWords = claimedName.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    const matchesCount = nameWords.filter(w => cleanText.toLowerCase().includes(w)).length;
    if (nameWords.length > 0) {
      const wordMatchRatio = (matchesCount / nameWords.length) * 100;
      nameSimilarity = Math.round(Math.max(nameSimilarity, wordMatchRatio));
    }
  }

  // NRC Match comparison
  let nrcMatch = true;
  if (claimedNrc && claimedNrc.trim()) {
    const cleanClaimed = claimedNrc.replace(/[\s\/-]/g, '');
    const cleanExtracted = extractedNrc ? extractedNrc.replace(/[\s\/-]/g, '') : '';
    if (cleanExtracted) {
      nrcMatch = cleanClaimed === cleanExtracted;
    } else {
      nrcMatch = cleanText.replace(/[\s\/-]/g, '').includes(cleanClaimed);
    }
  }

  if (nameSimilarity < 90) {
    flags.push(`Name similarity below threshold (${nameSimilarity}% match)`);
  }

  if (claimedNrc && !nrcMatch) {
    flags.push(`NRC number mismatch (Claimed: ${claimedNrc}, Extracted: ${extractedNrc || 'None'})`);
  }

  const overallScore = Math.round((nameSimilarity + (nrcMatch ? 100 : 50)) / 2);
  const needsReview = overallScore < 90 || flags.length > 0;

  return {
    ocrText: cleanText,
    extractedName: claimedName,
    extractedNrc,
    extractedDob,
    nameSimilarity,
    nrcMatch,
    overallScore,
    needsReview,
    flags
  };
}
