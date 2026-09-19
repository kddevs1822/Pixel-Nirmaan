export type NodeType = 'Rect' | 'Circle' | 'Text' | 'Image' | 'Frame' | 'Triangle' | 'Line';

export interface ComponentPropDef {
  id: string;
  name: string;
  type: 'string' | 'number' | 'boolean' | 'color' | 'image';
  defaultValue: any;
}

export interface CanvasNode {
  id: string;
  type: NodeType;
  x: number;
  y: number;
  width?: number;
  height?: number;
  radius?: number;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  text?: string;
  fontSize?: number;
  fontFamily?: string;
  cornerRadius?: number;
  src?: string;
  parentId?: string;
  points?: number[];
  tension?: number;
  frameType?: 'desktop' | 'tablet' | 'mobile';
  linkTo?: string;
  scaleX?: number;
  scaleY?: number;
  rotation?: number;
  name?: string;
  variantOf?: string;
  // Component features
  isMasterComponent?: boolean;
  componentName?: string;
  componentId?: string;
  variant?: 'default' | 'hover' | 'active' | 'disabled';
  variants?: {
    hover?: Partial<CanvasNode>;
    active?: Partial<CanvasNode>;
    disabled?: Partial<CanvasNode>;
  };
  propsDefinition?: ComponentPropDef[];
  propOverrides?: Record<string, any>;
  boundProps?: Record<string, string>; // Maps node field (e.g. 'text') to propId
}
