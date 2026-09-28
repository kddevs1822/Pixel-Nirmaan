export type NodeType = 
  | 'Rect' 
  | 'Circle' 
  | 'Text' 
  | 'Image' 
  | 'Frame' 
  | 'Triangle' 
  | 'Line'
  | 'TextInput'
  | 'TextArea'
  | 'Checkbox'
  | 'Switch'
  | 'SelectDropdown'
  | 'FormContainer';

export interface StateVariable {
  id: string;
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  defaultValue: any;
}

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
  fontWeight?: string;
  textAlign?: string;
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
  sourceNodeId?: string;

  // Interactive Input properties
  placeholder?: string;
  defaultValue?: any;
  inputType?: 'text' | 'email' | 'password' | 'number';
  checked?: boolean;
  defaultChecked?: boolean;
  options?: string[];
  bindings?: Record<string, string>; // Maps property name (e.g. 'text', 'fill', 'defaultValue') to StateVariable name or item path

  // Data Repeater settings
  excludeFromRepeater?: boolean;
  repeaterBinding?: {
    arrayVariableId: string;
    itemName: string; // e.g. "item"
    direction?: 'vertical' | 'horizontal';
    gap?: number;
  };

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

  // Effects
  opacity?: number;
  boxShadow?: {
    enabled: boolean;
    x: number;
    y: number;
    blur: number;
    spread: number;
    color: string;
  };
  filterBlur?: number;

  // Transitions
  transitionDuration?: number;
  transitionTimingFunction?: 'linear' | 'ease' | 'ease-in' | 'ease-out' | 'ease-in-out';
  hoverEffect?: 'none' | 'scale-up' | 'scale-down' | 'lift' | 'glow' | 'darken' | 'brighten';

  // Animations
  animation?: {
    type: 'none' | 'bounce' | 'pulse' | 'spin' | 'fade-in' | 'slide-up' | 'slide-down' | 'slide-left' | 'slide-right';
    duration: number;
    infinite: boolean;
    distance?: number;
    startDistance?: number;
    endDistance?: number;
    scale?: number;
    degrees?: number;
    startOpacity?: number;
    fromEdge?: boolean;
    initiallyHidden?: boolean;
    bounceCount?: number;
    trigger?: 'auto' | 'click' | 'dblclick' | 'hover' | 'focus' | 'scroll';
    triggerNodeId?: string;
  };

  // Action Sequences
  actionSequences?: NodeActionSequence[];
}

export type ActionType = 
  | 'navigate' 
  | 'setState' 
  | 'triggerAnimation' 
  | 'toggleVisibility' 
  | 'resetForm'
  | 'submitForm';

export interface NodeAction {
  id: string;
  type: ActionType;
  enabled?: boolean;
  
  // Navigate parameters
  targetPageId?: string;
  
  // Set State parameters
  stateVariableId?: string;
  stateOperation?: 'set' | 'toggle' | 'increment' | 'decrement' | 'setInputVal';
  value?: any;
  
  // Animation / Visibility parameters
  targetNodeId?: string;
  animationType?: 'bounce' | 'pulse' | 'spin' | 'fade-in' | 'slide-up' | 'slide-down' | 'slide-left' | 'slide-right';
  visibilityAction?: 'show' | 'hide' | 'toggle';

  // Optional delay (ms)
  delay?: number;
}

export interface NodeActionSequence {
  id: string;
  event: 'onClick' | 'onChange' | 'onSubmit' | 'onHover' | 'onFocus';
  actions: NodeAction[];
}

