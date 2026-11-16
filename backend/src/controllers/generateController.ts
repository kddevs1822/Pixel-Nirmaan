import { Request, Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { CodeGeneratorService } from '../services/codeGeneratorService';
import { FolderPickerService } from '../services/folderPickerService';
import { CanvasNode, StateVariable, DataSource } from '../models/types';

export const generateCode = (req: Request, res: Response) => {
  try {
    const { nodes, stateVariables, dataSources, exportFormat } = req.body as { 
      nodes: CanvasNode[]; 
      stateVariables?: StateVariable[]; 
      dataSources?: DataSource[];
      exportFormat?: 'jsx' | 'tsx';
    };
    
    if (!nodes || !Array.isArray(nodes)) {
      return res.status(400).json({ error: 'Invalid payload: nodes array is required' });
    }

    const hasFrame = nodes.some(n => n.type === 'Frame');
    if (!hasFrame) {
      return res.status(400).json({ error: 'Cannot export: No Frame found on canvas. Please add at least one Frame before exporting.' });
    }

    const format: 'jsx' | 'tsx' = exportFormat === 'tsx' ? 'tsx' : 'jsx';

    // DEBUG: Log what nodes we receive
    console.log('=== CODE GENERATION DEBUG ===');
    console.log(`Format: ${format}`);
    console.log(`Total nodes received: ${nodes.length}`);
    nodes.forEach(n => {
      console.log(`  Node: id=${n.id}, type=${n.type}, parentId=${n.parentId || 'NONE'}, isMaster=${n.isMasterComponent || false}, componentId=${n.componentId || 'NONE'}, componentName=${n.componentName || 'NONE'}`);
    });

    const files = CodeGeneratorService.generate(nodes, stateVariables, dataSources, format);

    // DEBUG: Log generated files
    console.log(`Generated files: ${Object.keys(files).join(', ')}`);
    Object.entries(files).forEach(([filePath, content]) => {
      if (filePath.endsWith('.jsx') || filePath.endsWith('.tsx')) {
        console.log(`\n--- ${filePath} ---`);
        console.log(content);
      }
    });
    console.log('=== END DEBUG ===');

    return res.status(200).json({
      message: 'Code generated successfully',
      files
    });
  } catch (error) {
    console.error('Error generating code:', error);
    return res.status(500).json({ error: 'Internal server error during code generation' });
  }
};

export const generateToFolder = (req: Request, res: Response) => {
  try {
    const { nodes, outputPath, stateVariables, dataSources, exportFormat } = req.body as { 
      nodes: CanvasNode[]; 
      outputPath: string; 
      stateVariables?: StateVariable[]; 
      dataSources?: DataSource[];
      exportFormat?: 'jsx' | 'tsx';
    };

    if (!nodes || !Array.isArray(nodes)) {
      return res.status(400).json({ error: 'Invalid payload: nodes array is required' });
    }

    if (!outputPath || typeof outputPath !== 'string' || outputPath.trim() === '') {
      return res.status(400).json({ error: 'Invalid payload: outputPath must be a non-empty string' });
    }

    const hasFrame = nodes.some(n => n.type === 'Frame');
    if (!hasFrame) {
      return res.status(400).json({ error: 'Cannot export: No Frame found on canvas. Please add at least one Frame before exporting.' });
    }

    const format: 'jsx' | 'tsx' = exportFormat === 'tsx' ? 'tsx' : 'jsx';
    const files = CodeGeneratorService.generate(nodes, stateVariables, dataSources, format);
    const fileEntries = Object.entries(files);

    // Clean up opposite format files from output directory so folder never has mixed tsx and jsx
    const cleanOppositeFiles = (dir: string, oppositeExt: string) => {
      if (!fs.existsSync(dir)) return;
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          cleanOppositeFiles(full, oppositeExt);
        } else if (entry.isFile() && entry.name.endsWith(oppositeExt)) {
          try {
            fs.unlinkSync(full);
          } catch (e) {
            console.warn(`Could not delete opposite file ${full}:`, e);
          }
        }
      }
    };

    const srcDir = path.resolve(outputPath, 'src');
    if (format === 'tsx') {
      cleanOppositeFiles(srcDir, '.jsx');
      const oldViteConfig = path.resolve(outputPath, 'vite.config.js');
      if (fs.existsSync(oldViteConfig)) {
        try { fs.unlinkSync(oldViteConfig); } catch (e) {}
      }
    } else {
      cleanOppositeFiles(srcDir, '.tsx');
      cleanOppositeFiles(srcDir, '.ts');
      const oldTsConfig = path.resolve(outputPath, 'tsconfig.json');
      if (fs.existsSync(oldTsConfig)) {
        try { fs.unlinkSync(oldTsConfig); } catch (e) {}
      }
      const oldViteConfigTs = path.resolve(outputPath, 'vite.config.ts');
      if (fs.existsSync(oldViteConfigTs)) {
        try { fs.unlinkSync(oldViteConfigTs); } catch (e) {}
      }
    }

    for (const [relativePath, content] of fileEntries) {
      const fullPath = path.resolve(outputPath, relativePath);
      const dir = path.dirname(fullPath);
      fs.mkdirSync(dir, { recursive: true });

      if (content.startsWith('data:image/')) {
        const base64Data = content.split(',')[1] || '';
        fs.writeFileSync(fullPath, Buffer.from(base64Data, 'base64'));
      } else {
        fs.writeFileSync(fullPath, content, 'utf-8');
      }
    }

    return res.status(200).json({
      message: `Code exported successfully to ${outputPath}`,
      fileCount: fileEntries.length
    });
  } catch (error) {
    console.error('Error exporting code to folder:', error);
    return res.status(500).json({ error: 'Internal server error during code export' });
  }
};

export const selectFolder = async (req: Request, res: Response) => {
  try {
    const selectedPath = await FolderPickerService.selectFolder();
    if (selectedPath) {
      return res.status(200).json({ path: selectedPath });
    } else {
      return res.status(200).json({ path: null, message: 'Selection cancelled or unavailable' });
    }
  } catch (error) {
    console.error('Error selecting folder:', error);
    return res.status(500).json({ error: 'Failed to open folder picker' });
  }
};

