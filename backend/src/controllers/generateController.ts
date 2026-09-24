import { Request, Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { CodeGeneratorService } from '../services/codeGeneratorService';
import { FolderPickerService } from '../services/folderPickerService';
import { CanvasNode } from '../models/types';

export const generateCode = (req: Request, res: Response) => {
  try {
    const { nodes } = req.body as { nodes: CanvasNode[] };
    
    if (!nodes || !Array.isArray(nodes)) {
      return res.status(400).json({ error: 'Invalid payload: nodes array is required' });
    }

    const hasFrame = nodes.some(n => n.type === 'Frame');
    if (!hasFrame) {
      return res.status(400).json({ error: 'Cannot export: No Frame found on canvas. Please add at least one Frame before exporting.' });
    }

    // DEBUG: Log what nodes we receive
    console.log('=== CODE GENERATION DEBUG ===');
    console.log(`Total nodes received: ${nodes.length}`);
    nodes.forEach(n => {
      console.log(`  Node: id=${n.id}, type=${n.type}, parentId=${n.parentId || 'NONE'}, isMaster=${n.isMasterComponent || false}, componentId=${n.componentId || 'NONE'}, componentName=${n.componentName || 'NONE'}`);
    });

    const files = CodeGeneratorService.generate(nodes);

    // DEBUG: Log generated files
    console.log(`Generated files: ${Object.keys(files).join(', ')}`);
    Object.entries(files).forEach(([path, content]) => {
      if (path.endsWith('.jsx')) {
        console.log(`\n--- ${path} ---`);
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
    const { nodes, outputPath } = req.body as { nodes: CanvasNode[]; outputPath: string };

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

    const files = CodeGeneratorService.generate(nodes);
    const fileEntries = Object.entries(files);

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

