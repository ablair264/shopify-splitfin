#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;

/**
 * CSV Cleaner for Supabase Import
 * 
 * This script cleans CSV files to make them compatible with Supabase/PostgreSQL:
 * - Removes commas from numeric values (1,740.00 -> 1740.00)
 * - Handles decimal formatting issues (1.360 -> 1.36)
 * - Normalizes numeric formats
 * - Preserves original file with .backup extension
 */

class CSVCleaner {
  constructor() {
    this.numericPattern = /^-?\d{1,3}(,\d{3})*(\.\d+)?$|^-?\d+(\.\d+)?$|^-?\d+(\.\d+){2,}$/;
    this.commaThousandsPattern = /^-?\d{1,3}(,\d{3})+(\.\d{1,2})?$/;
    this.multiDecimalPattern = /^-?\d+(\.\d+){2,}$/; // Matches patterns like "1.360.00"
  }

  /**
   * Detect if a value is a formatted numeric string
   */
  isNumericString(value) {
    if (typeof value !== 'string' || !value.trim()) return false;
    
    // Remove any surrounding quotes
    const cleaned = value.trim().replace(/^["']|["']$/g, '');
    
    // Check for common numeric patterns
    return this.numericPattern.test(cleaned);
  }

  /**
   * Clean a numeric string for PostgreSQL compatibility
   */
  cleanNumericValue(value) {
    if (!value || typeof value !== 'string') return value;

    let cleaned = value.trim().replace(/^["']|["']$/g, '');
    
    // Handle comma-separated thousands (e.g., "1,740.00" -> "1740.00")
    if (this.commaThousandsPattern.test(cleaned)) {
      cleaned = cleaned.replace(/,/g, '');
    }
    
    // Handle malformed decimals with multiple decimal points (e.g., "1.360.00" -> "1.36")
    if (cleaned.includes('.')) {
      const decimalCount = (cleaned.match(/\./g) || []).length;
      
      if (decimalCount > 1) {
        // Handle cases like "1.360.00" - likely means 1.36
        // Split by decimal points and reconstruct
        const parts = cleaned.split('.');
        if (parts.length === 3 && parts[2] === '00') {
          // Pattern like "1.360.00" -> "1.36"
          cleaned = parts[0] + '.' + parts[1];
        } else {
          // For other multi-decimal cases, take first two parts
          cleaned = parts[0] + '.' + parts[1];
        }
      }
      
      // Parse as float and convert back to remove unnecessary trailing zeros
      const num = parseFloat(cleaned);
      if (!isNaN(num)) {
        // Keep reasonable decimal precision (up to 6 decimal places)
        cleaned = num.toFixed(6).replace(/\.?0+$/, '');
      }
    }
    
    return cleaned;
  }

  /**
   * Analyze CSV headers and data to identify numeric columns
   */
  async analyzeCSV(filePath) {
    return new Promise((resolve, reject) => {
      const results = [];
      const numericColumns = new Set();
      
      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (row) => {
          results.push(row);
          
          // Check each column for numeric patterns
          Object.keys(row).forEach(column => {
            if (this.isNumericString(row[column])) {
              numericColumns.add(column);
            }
          });
        })
        .on('end', () => {
          resolve({
            data: results,
            numericColumns: Array.from(numericColumns),
            headers: results.length > 0 ? Object.keys(results[0]) : []
          });
        })
        .on('error', reject);
    });
  }

  /**
   * Clean the CSV data
   */
  cleanData(data, numericColumns) {
    console.log(`🧹 Cleaning numeric columns: ${numericColumns.join(', ')}`);
    
    return data.map(row => {
      const cleanedRow = { ...row };
      
      numericColumns.forEach(column => {
        if (row[column]) {
          const originalValue = row[column];
          const cleanedValue = this.cleanNumericValue(row[column]);
          
          if (originalValue !== cleanedValue) {
            console.log(`   ${column}: "${originalValue}" → "${cleanedValue}"`);
          }
          
          cleanedRow[column] = cleanedValue;
        }
      });
      
      return cleanedRow;
    });
  }

  /**
   * Create backup of original file
   */
  createBackup(filePath) {
    const backupPath = filePath.replace(/\.csv$/i, '.backup.csv');
    fs.copyFileSync(filePath, backupPath);
    console.log(`💾 Backup created: ${backupPath}`);
    return backupPath;
  }

  /**
   * Write cleaned data to file
   */
  async writeCsvFile(filePath, data, headers) {
    const csvWriter = createCsvWriter({
      path: filePath,
      header: headers.map(header => ({ id: header, title: header }))
    });

    await csvWriter.writeRecords(data);
    console.log(`✅ Cleaned CSV written to: ${filePath}`);
  }

  /**
   * Main cleaning function
   */
  async cleanCSV(inputPath, outputPath = null) {
    try {
      console.log(`🔍 Analyzing CSV file: ${inputPath}`);
      
      if (!fs.existsSync(inputPath)) {
        throw new Error(`File not found: ${inputPath}`);
      }

      // Analyze the CSV
      const { data, numericColumns, headers } = await this.analyzeCSV(inputPath);
      
      if (data.length === 0) {
        throw new Error('CSV file is empty or could not be parsed');
      }

      console.log(`📊 Found ${data.length} rows and ${headers.length} columns`);
      console.log(`🔢 Detected ${numericColumns.length} numeric columns: ${numericColumns.join(', ')}`);

      if (numericColumns.length === 0) {
        console.log('✨ No numeric formatting issues detected. File is already clean!');
        return inputPath;
      }

      // Create backup
      this.createBackup(inputPath);

      // Clean the data
      const cleanedData = this.cleanData(data, numericColumns);

      // Determine output path
      const finalOutputPath = outputPath || inputPath.replace(/\.csv$/i, '_cleaned.csv');

      // Write cleaned file
      await this.writeCsvFile(finalOutputPath, cleanedData, headers);

      console.log(`🎉 CSV cleaning completed successfully!`);
      console.log(`   Original: ${inputPath}`);
      console.log(`   Cleaned:  ${finalOutputPath}`);

      return finalOutputPath;

    } catch (error) {
      console.error('❌ Error cleaning CSV:', error.message);
      throw error;
    }
  }
}

// CLI Usage
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log(`
🧹 CSV Cleaner for Supabase Import

Usage: node csv-cleaner.js <input-file.csv> [output-file.csv]

Examples:
  node csv-cleaner.js data.csv                    # Creates data_cleaned.csv
  node csv-cleaner.js data.csv cleaned-data.csv   # Creates cleaned-data.csv

What it fixes:
  • Removes commas from numbers: "1,740.00" → "1740.00"
  • Normalizes decimals: "1.360" → "1.36"
  • Handles quoted numeric values
  • Creates backup of original file
    `);
    process.exit(1);
  }

  const inputFile = args[0];
  const outputFile = args[1] || null;

  try {
    const cleaner = new CSVCleaner();
    await cleaner.cleanCSV(inputFile, outputFile);
  } catch (error) {
    console.error('Failed to clean CSV:', error.message);
    process.exit(1);
  }
}

// Export for use as module
module.exports = CSVCleaner;

// Run if called directly
if (require.main === module) {
  main();
}