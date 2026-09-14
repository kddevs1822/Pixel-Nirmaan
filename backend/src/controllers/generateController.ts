import { Request, Response } from 'express';
import { CodeGeneratorService } from '../services/codeGeneratorService';
import { CanvasNode } from '../models/types';

export const generateCode = (req: Request, res: Response) => {
  try {
    const { nodes } = req.body as { nodes: CanvasNode[] };
    
    if (!nodes || !Array.isArray(nodes)) {
      return res.status(400).json({ error: 'Invalid payload: nodes array is required' });
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
