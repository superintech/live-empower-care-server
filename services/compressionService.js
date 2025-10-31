// services/compressionService.js
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

class CompressionService {
  constructor() {
    this.ghostscriptPath = this.detectGhostscript();
  }

  detectGhostscript() {
    const possiblePaths = [
      'gs', 
      '/usr/bin/gs',
      '/usr/local/bin/gs',
      'gswin64c', 
      '"C:\\Program Files\\gs\\gs10.05.1\\bin\\gswin64c.exe"'
    ];

    for (const gsPath of possiblePaths) {
      try {
        execSync(`${gsPath} --version`, { stdio: 'ignore' });
        console.log(`✅ Found Ghostscript at: ${gsPath}`);
        return gsPath;
      } catch (error) {
        continue;
      }
    }

    console.log('⚠️ Ghostscript not found, will use alternative compression');
    return null;
  }

  async compressWithGhostscript(inputPath, outputPath, quality = 'ebook') {
    if (!this.ghostscriptPath) {
      throw new Error('Ghostscript not available');
    }

    const qualitySettings = {
      'screen': '/screen',     
      'ebook': '/ebook',       
      'printer': '/printer',   
      'prepress': '/prepress'  
    };

    const qualitySetting = qualitySettings[quality] || '/ebook';

    const command = [
      this.ghostscriptPath,
      '-sDEVICE=pdfwrite',
      '-dCompatibilityLevel=1.4',
      `-dPDFSETTINGS=${qualitySetting}`,
      '-dNOPAUSE',
      '-dQUIET',
      '-dBATCH',
      '-dColorImageDownsampleType=/Bicubic',
      '-dColorImageResolution=150',
      '-dGrayImageDownsampleType=/Bicubic', 
      '-dGrayImageResolution=150',
      '-dMonoImageDownsampleType=/Bicubic',
      '-dMonoImageResolution=150',
      `-sOutputFile="${outputPath}"`,
      `"${inputPath}"`
    ].join(' ');

    try {
      execSync(command, { stdio: 'pipe' });
      
      const originalSize = fs.statSync(inputPath).size;
      const compressedSize = fs.statSync(outputPath).size;
      const compressionRatio = ((originalSize - compressedSize) / originalSize * 100).toFixed(2);
      
      console.log(`✅ Ghostscript compressed: ${path.basename(outputPath)}`);
      console.log(`📊 Size: ${Math.round(originalSize/1024)}KB -> ${Math.round(compressedSize/1024)}KB (${compressionRatio}% reduction)`);
      
      return {
        success: true,
        originalSize,
        compressedSize,
        compressionRatio: parseFloat(compressionRatio)
      };
    } catch (error) {
      console.error('❌ Ghostscript compression failed:', error.message);
      throw error;
    }
  }

  async compressWithImageConversion(inputPath, outputPath, quality = 0.4) {
    const sharp = require('sharp');
    const pdf2pic = require('pdf2pic');
    const { jsPDF } = require('jspdf');

    try {
      console.log(`🔄 Image-based compression: ${path.basename(inputPath)}`);
      
      // Convert PDF to images with lower DPI
      const convert = pdf2pic.fromPath(inputPath, {
        density: 120,           // Lower DPI for smaller size
        saveFilename: "page",
        savePath: path.join('uploads', 'temp'),
        format: "jpg",
        width: 1000,           // Reduced size
        height: 1400
      });
      
      const tempDir = path.join('uploads', 'temp');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      
      const pages = await convert.bulk(-1);
      
      // Create new PDF
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'pt',
        format: 'a4'
      });
      
      let isFirstPage = true;
      
      for (const page of pages) {
        // Heavy compression with Sharp
        const compressedImagePath = path.join(tempDir, `comp_${page.name}`);
        
        await sharp(page.path)
          .jpeg({ 
            quality: Math.round(quality * 100),
            progressive: true,
            mozjpeg: true 
          })
          .resize({ 
            width: 800, 
            height: 1100, 
            fit: 'inside',
            withoutEnlargement: true 
          })
          .toFile(compressedImagePath);
        
        if (!isFirstPage) {
          doc.addPage();
        }
        
        const imgData = fs.readFileSync(compressedImagePath, 'base64');
        doc.addImage(`data:image/jpeg;base64,${imgData}`, 'JPEG', 15, 15, 565, 770);
        
        isFirstPage = false;
        
        // Cleanup
        fs.unlinkSync(page.path);
        fs.unlinkSync(compressedImagePath);
      }
      
      const pdfBuffer = Buffer.from(doc.output('arraybuffer'));
      fs.writeFileSync(outputPath, pdfBuffer);
      
      // Cleanup temp directory
      try {
        fs.rmdirSync(tempDir, { recursive: true });
      } catch (cleanupError) {
        console.error('⚠️ Temp cleanup warning:', cleanupError.message);
      }
      
      const originalSize = fs.statSync(inputPath).size;
      const compressedSize = fs.statSync(outputPath).size;
      const compressionRatio = ((originalSize - compressedSize) / originalSize * 100).toFixed(2);
      
      console.log(`✅ Image-based compressed: ${path.basename(outputPath)}`);
      console.log(`📊 Size: ${Math.round(originalSize/1024)}KB -> ${Math.round(compressedSize/1024)}KB (${compressionRatio}% reduction)`);
      
      return {
        success: true,
        originalSize,
        compressedSize,
        compressionRatio: parseFloat(compressionRatio)
      };
      
    } catch (error) {
      console.error('❌ Image-based compression failed:', error.message);
      throw error;
    }
  }

  async compressPDF(inputPath, outputPath, options = {}) {
    const { 
      preferGhostscript = true, 
      quality = 'ebook',
      imageQuality = 0.4 
    } = options;

    try {
      // Try Ghostscript first if available and preferred
      if (preferGhostscript && this.ghostscriptPath) {
        return await this.compressWithGhostscript(inputPath, outputPath, quality);
      } else {
        // Fallback to image-based compression
        return await this.compressWithImageConversion(inputPath, outputPath, imageQuality);
      }
    } catch (error) {
      console.error('❌ Primary compression failed, trying fallback...');
      
      try {
        // Try the other method
        if (this.ghostscriptPath && !preferGhostscript) {
          return await this.compressWithGhostscript(inputPath, outputPath, quality);
        } else {
          return await this.compressWithImageConversion(inputPath, outputPath, imageQuality);
        }
      } catch (fallbackError) {
        console.error('❌ All compression methods failed');
        
        // Last resort: basic pdf-lib compression
        const { PDFDocument } = require('pdf-lib');
        
        const pdfBytes = fs.readFileSync(inputPath);
        const pdfDoc = await PDFDocument.load(pdfBytes);
        
        const compressedBytes = await pdfDoc.save({
          useObjectStreams: false,
          addDefaultPage: false
        });
        
        fs.writeFileSync(outputPath, compressedBytes);
        
        const originalSize = fs.statSync(inputPath).size;
        const compressedSize = fs.statSync(outputPath).size;
        const compressionRatio = ((originalSize - compressedSize) / originalSize * 100).toFixed(2);
        
        console.log(`📋 Basic compression: ${compressionRatio}% reduction`);
        
        return {
          success: false,
          originalSize,
          compressedSize,
          compressionRatio: parseFloat(compressionRatio),
          method: 'basic'
        };
      }
    }
  }
}

module.exports = new CompressionService();