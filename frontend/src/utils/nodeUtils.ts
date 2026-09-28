import type { CanvasNode } from '../store/useCanvasStore';

export const getNodeDescriptiveLabel = (node: CanvasNode, allNodes?: CanvasNode[]): string => {
  if (!node) return 'Element';
  
  // 1. If explicit custom name is set (not generic default type name)
  if (node.name && node.name !== node.type && !node.name.startsWith(node.type + ' ')) {
    return node.name;
  }

  // 2. Specific type previews based on node.type
  let typeLabel: string = node.type;
  if (node.type === 'Text') {
    const preview = (node.text || '').trim();
    if (preview) {
      typeLabel = `Text "${preview.length > 20 ? preview.slice(0, 18) + '...' : preview}"`;
    } else {
      typeLabel = 'Text (empty)';
    }
  } else if (node.type === 'TextInput') {
    typeLabel = `Input "${node.placeholder || node.name || 'Input'}"`;
  } else if (node.type === 'TextArea') {
    typeLabel = `TextArea "${node.placeholder || 'TextArea'}"`;
  } else if (node.type === 'SelectDropdown') {
    typeLabel = `Dropdown "${node.name || 'Select'}"`;
  } else if (node.type === 'Checkbox') {
    typeLabel = `Checkbox "${node.name || 'Checkbox'}"`;
  } else if (node.type === 'Switch') {
    typeLabel = `Switch "${node.name || 'Switch'}"`;
  } else if (node.type === 'FormContainer') {
    typeLabel = `Form "${node.name || 'Form'}"`;
  } else if (node.type === 'Frame') {
    typeLabel = `Frame "${node.name || 'Desktop'}"`;
  } else if (node.type === 'Rect') {
    const fillStr = node.fill && typeof node.fill === 'string' ? node.fill : '';
    typeLabel = fillStr ? `Rectangle (${fillStr})` : 'Rectangle';
  } else if (node.type === 'Circle') {
    const fillStr = node.fill && typeof node.fill === 'string' ? node.fill : '';
    typeLabel = fillStr ? `Circle (${fillStr})` : 'Circle';
  } else if (node.type === 'Triangle') {
    typeLabel = 'Triangle';
  } else if (node.type === 'Image') {
    typeLabel = `Image (${node.name || 'Image'})`;
  } else if (node.type === 'Line') {
    typeLabel = 'Line';
  }

  // 3. Add context (e.g. parent frame name) if allNodes provided
  if (allNodes && node.parentId) {
    const parent = allNodes.find(n => n.id === node.parentId);
    if (parent) {
      return `${typeLabel} · in ${parent.name || parent.type}`;
    }
  }

  return typeLabel;
};
