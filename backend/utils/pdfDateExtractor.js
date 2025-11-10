const pdfParseModule = require('pdf-parse');
const { createWorker } = require('tesseract.js');
const fs = require('fs');
const path = require('path');
const os = require('os');

/**
 * Extract date from PDF using OCR
 * Looks for patterns like "ISSUED 12-Apr-2025" or similar date formats
 */
async function extractDateFromPDF(pdfPath) {
  try {
    let text = '';
    
    // Try to extract text directly from PDF (if it has text layer)
    try {
      const dataBuffer = fs.readFileSync(pdfPath);
      
      // Try different ways to use pdf-parse
      if (typeof pdfParseModule === 'function') {
        const pdfData = await pdfParseModule(dataBuffer);
        text = pdfData.text || '';
      } else if (pdfParseModule.default && typeof pdfParseModule.default === 'function') {
        const pdfData = await pdfParseModule.default(dataBuffer);
        text = pdfData.text || '';
      } else {
        // pdf-parse might not be working as expected, skip to OCR
        console.log('pdf-parse text extraction not available, using OCR directly...');
        text = '';
      }
    } catch (parseError) {
      console.log('Error with pdf-parse, will use OCR:', parseError.message);
      text = '';
    }

    // Try to find date in the extracted text
    if (text) {
      const extractedDate = extractDateFromText(text);
      if (extractedDate) {
        return extractedDate;
      }
    }

    // If no date found in text layer, use OCR
    // For now, skip PDF to image conversion and just return null
    // OCR on PDFs requires additional setup (ImageMagick or pdfjs-dist with proper Node.js config)
    // This can be enhanced later if needed
    console.log('No date found in PDF text layer. OCR on PDFs requires additional setup.');
    console.log('Date extraction from PDF images is currently disabled. Please ensure PDFs have text layers for date extraction.');
    
    return null;
  } catch (error) {
    console.error('Error extracting date from PDF:', error);
    return null;
  }
}

/**
 * Extract date from text using regex patterns
 * Looks for dates in formats like:
 * - DD-MMM-YYYY (e.g., 12-Apr-2025)
 * - DD/MM/YYYY
 * - DD-MM-YYYY
 * - MMM DD, YYYY
 * - etc.
 */
function extractDateFromText(text) {
  if (!text) return null;

  // Common date patterns
  const datePatterns = [
    // DD-MMM-YYYY (e.g., 12-Apr-2025, 12-Apr-2025)
    /\b(\d{1,2})[-/](\w{3})[-/](\d{4})\b/i,
    // DD/MM/YYYY or DD-MM-YYYY
    /\b(\d{1,2})[-/](\d{1,2})[-/](\d{4})\b/,
    // MMM DD, YYYY (e.g., Apr 12, 2025)
    /\b(\w{3})\s+(\d{1,2}),?\s+(\d{4})\b/i,
    // YYYY-MM-DD
    /\b(\d{4})[-/](\d{1,2})[-/](\d{1,2})\b/,
  ];

  // Look for "ISSUED" keyword followed by date
  const issuedPattern = /ISSUED\s+([^\n\r]+)/i;
  const issuedMatch = text.match(issuedPattern);
  
  if (issuedMatch) {
    const issuedText = issuedMatch[1];
    // Try to find date in the text after "ISSUED"
    for (const pattern of datePatterns) {
      const match = issuedText.match(pattern);
      if (match) {
        const date = parseDateMatch(match, pattern);
        if (date && isValidDate(date)) {
          return date;
        }
      }
    }
  }

  // If no "ISSUED" keyword found, search entire text for dates
  for (const pattern of datePatterns) {
    const matches = text.matchAll(new RegExp(pattern.source, 'gi'));
    for (const match of matches) {
      const date = parseDateMatch(match, pattern);
      if (date && isValidDate(date)) {
        // Prefer dates that are recent (within last 2 years or future)
        const now = new Date();
        const twoYearsAgo = new Date(now.getFullYear() - 2, 0, 1);
        const twoYearsFromNow = new Date(now.getFullYear() + 2, 11, 31);
        
        if (date >= twoYearsAgo && date <= twoYearsFromNow) {
          return date;
        }
      }
    }
  }

  return null;
}

/**
 * Parse a date match into a Date object
 */
function parseDateMatch(match, pattern) {
  try {
    // Pattern 1: DD-MMM-YYYY (e.g., 12-Apr-2025)
    if (match[2] && match[2].length === 3 && isNaN(match[2])) {
      const day = parseInt(match[1]);
      const monthName = match[2].toLowerCase();
      const year = parseInt(match[3]);
      
      const monthMap = {
        'jan': 0, 'feb': 1, 'mar': 2, 'apr': 3, 'may': 4, 'jun': 5,
        'jul': 6, 'aug': 7, 'sep': 8, 'oct': 9, 'nov': 10, 'dec': 11
      };
      
      const month = monthMap[monthName];
      if (month !== undefined) {
        return new Date(year, month, day);
      }
    }
    
    // Pattern 2: DD/MM/YYYY or DD-MM-YYYY
    if (match[2] && !isNaN(match[2]) && match[2].length <= 2) {
      const first = parseInt(match[1]);
      const second = parseInt(match[2]);
      const year = parseInt(match[3]);
      
      // Try both DD/MM/YYYY and MM/DD/YYYY
      let date1 = new Date(year, second - 1, first);
      let date2 = new Date(year, first - 1, second);
      
      // Prefer the one that makes more sense (day <= 31)
      if (first <= 31 && second <= 12) {
        return date1; // DD/MM/YYYY
      } else if (first <= 12 && second <= 31) {
        return date2; // MM/DD/YYYY
      }
      
      return date1; // Default to DD/MM/YYYY
    }
    
    // Pattern 3: MMM DD, YYYY (e.g., Apr 12, 2025)
    if (match[1] && match[1].length === 3 && isNaN(match[1])) {
      const monthName = match[1].toLowerCase();
      const day = parseInt(match[2]);
      const year = parseInt(match[3]);
      
      const monthMap = {
        'jan': 0, 'feb': 1, 'mar': 2, 'apr': 3, 'may': 4, 'jun': 5,
        'jul': 6, 'aug': 7, 'sep': 8, 'oct': 9, 'nov': 10, 'dec': 11
      };
      
      const month = monthMap[monthName];
      if (month !== undefined) {
        return new Date(year, month, day);
      }
    }
    
    // Pattern 4: YYYY-MM-DD
    if (match[1] && match[1].length === 4 && !isNaN(match[1])) {
      const year = parseInt(match[1]);
      const month = parseInt(match[2]) - 1;
      const day = parseInt(match[3]);
      return new Date(year, month, day);
    }
  } catch (error) {
    console.error('Error parsing date match:', error);
  }
  
  return null;
}

/**
 * Validate if a date is valid
 */
function isValidDate(date) {
  return date instanceof Date && !isNaN(date.getTime());
}

/**
 * Calculate due date (45 days after issued date)
 */
function calculateDueDate(issuedDate) {
  if (!issuedDate) return null;
  
  const dueDate = new Date(issuedDate);
  dueDate.setDate(dueDate.getDate() + 45);
  return dueDate;
}

module.exports = {
  extractDateFromPDF,
  calculateDueDate,
  extractDateFromText
};

