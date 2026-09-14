import { CanvasNode } from '../models/types';

export class CodeGeneratorService {
  static generate(nodes: CanvasNode[]): Record<string, string> {
    const files: Record<string, string> = {};

    // Base config files
    files['package.json'] = this.generatePackageJson();
    files['vite.config.js'] = this.generateViteConfig();
    files['index.html'] = this.generateIndexHtml();
    files['tailwind.config.js'] = this.generateTailwindConfig();
    files['postcss.config.js'] = this.generatePostcssConfig();
    files['src/index.css'] = this.generateIndexCss();

    // Group nodes
    const masterComponents = nodes.filter(n => n.isMasterComponent);
    const masterIds = new Set(masterComponents.map(m => m.id));
    
    // Root frames that are NOT master components and NOT component instances = user's "pages"
    let pages = nodes.filter(n => n.type === 'Frame' && !n.isMasterComponent && !n.parentId && !n.componentId);

    // Collect truly loose root nodes: nodes with no parentId that are NOT page frames AND NOT master components.
    // Master components already get their own component files; they don't need to appear on a virtual page.
    // Component instances at the root level DO need to be on a page though.
    const looseRootNodes = nodes.filter(n => {
      if (n.parentId) return false; // has a parent, not loose
      if (n.type === 'Frame' && !n.isMasterComponent && !n.componentId) return false; // it's a page frame
      if (n.isMasterComponent) return false; // master components get their own files
      return true; // everything else: loose Rects, Circles, Texts, component instances, Lines, etc.
    });

    // If there are any loose items on the canvas, create a virtual page for them
    if (looseRootNodes.length > 0) {
      const virtualPage: CanvasNode = {
        id: 'virtual_root_page',
        type: 'Frame',
        x: 0,
        y: 0,
        width: 1440,
        height: 900,
        fill: '#ffffff',
        isMasterComponent: false
      };
      
      // Normalize coordinates so they are visible near top-left
      let minX = Infinity;
      let minY = Infinity;
      
      looseRootNodes.forEach(n => {
        if (n.type === 'Line' && n.points) {
          for (let i = 0; i < n.points.length; i += 2) {
            if (n.points[i] < minX) minX = n.points[i];
            if (n.points[i + 1] < minY) minY = n.points[i + 1];
          }
        } else {
          if (n.x < minX) minX = n.x;
          if (n.y < minY) minY = n.y;
        }
      });
      
      if (minX === Infinity) minX = 0;
      if (minY === Infinity) minY = 0;
      
      looseRootNodes.forEach(n => {
        n.parentId = virtualPage.id;
        if (n.type === 'Line' && n.points) {
          for (let i = 0; i < n.points.length; i += 2) {
            n.points[i] = (n.points[i] - minX) + 50;
            n.points[i + 1] = (n.points[i + 1] - minY) + 50;
          }
        } else {
          n.x = (n.x - minX) + 50; // 50px padding
          n.y = (n.y - minY) + 50;
        }
      });
      
      nodes.push(virtualPage);
      
      // If there are real page frames, put virtual page at the END (real pages take priority for default route).
      // If there are NO real page frames, put virtual page at the front as the default.
      if (pages.length > 0) {
        pages.push(virtualPage);
      } else {
        pages.unshift(virtualPage);
      }
    }

    // Node lookup dictionary
    const nodesById: Record<string, CanvasNode> = {};
    nodes.forEach(n => { nodesById[n.id] = n; });

    // Pages
    const pageRouteMap: { frameId: string; route: string; componentName: string }[] = [];
    pages.forEach((page, index) => {
      const pageName = `Page${index + 1}`;
      const route = index === 0 ? '/' : `/page${index + 1}`;
      pageRouteMap.push({ frameId: page.id, route, componentName: pageName });
    });

    // Components
    masterComponents.forEach(comp => {
      const componentName = this.getComponentName(comp);
      files[`src/components/${componentName}.jsx`] = this.generateComponentCode(comp, nodes, nodesById, pages, pageRouteMap);
    });

    // Generate page code
    pages.forEach((page, index) => {
      const pageName = `Page${index + 1}`;
      files[`src/pages/${pageName}.jsx`] = this.generatePageCode(page, nodes, nodesById, masterComponents, pages, pageRouteMap);
    });

    // App & Router
    files['src/App.jsx'] = this.generateAppCode(pageRouteMap);
    files['src/main.jsx'] = this.generateMainCode();

    return files;
  }

  private static getComponentName(node: CanvasNode): string {
    const rawName = node.componentName || `Component_${node.id.replace(/-/g, '_')}`;
    let safeName = rawName.replace(/[^a-zA-Z0-9_]/g, '_');
    
    // React components must start with an uppercase letter
    if (safeName.length > 0) {
      safeName = safeName.charAt(0).toUpperCase() + safeName.slice(1);
    }
    
    // If it starts with a number (invalid JS identifier), prefix it
    if (/^[0-9]/.test(safeName)) {
      safeName = `Comp_${safeName}`;
    }
    
    return safeName;
  }

  private static generatePackageJson(): string {
    return JSON.stringify({
      name: "generated-app",
      private: true,
      version: "0.0.0",
      type: "module",
      scripts: {
        "dev": "vite",
        "build": "vite build",
        "preview": "vite preview"
      },
      dependencies: {
        "react": "^18.2.0",
        "react-dom": "^18.2.0",
        "react-router-dom": "^6.22.0"
      },
      devDependencies: {
        "@types/react": "^18.2.64",
        "@types/react-dom": "^18.2.21",
        "@vitejs/plugin-react": "^4.2.1",
        "autoprefixer": "^10.4.18",
        "postcss": "^8.4.35",
        "tailwindcss": "^3.4.1",
        "vite": "^5.1.5"
      }
    }, null, 2);
  }

  private static generateTailwindConfig(): string {
    return `/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}`;
  }

  private static generateViteConfig(): string {
    return `import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
})
`;
  }

  private static generateIndexHtml(): string {
    return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>PixelNirmaan Export</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
`;
  }

  private static generatePostcssConfig(): string {
    return `export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}`;
  }

  private static generateIndexCss(): string {
    return `@tailwind base;
@tailwind components;
@tailwind utilities;

body {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

.clip-path-triangle {
  clip-path: polygon(50% 0%, 0% 100%, 100% 100%);
}
`;
  }

  private static generateMainCode(): string {
    return `import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
`;
  }

  private static generateAppCode(routes: { frameId: string; route: string; componentName: string }[]): string {
    const uniqueImports = Array.from(new Set(routes.map(r => r.componentName)));
    const imports = uniqueImports.map(name => `import ${name} from './pages/${name}';`).join('\n');
    
    const routeElements: string[] = [];
    routes.forEach((r, idx) => {
      routeElements.push(`        <Route path="${r.route}" element={<${r.componentName} />} />`);
      if (idx === 0) {
        routeElements.push(`        <Route path="/page1" element={<${r.componentName} />} />`);
      }
      if (r.frameId && r.frameId !== r.route.replace('/', '')) {
        routeElements.push(`        <Route path="/${r.frameId}" element={<${r.componentName} />} />`);
      }
    });

    return `import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
${imports}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
${routeElements.join('\n')}
      </Routes>
    </BrowserRouter>
  );
}
`;
  }

  private static generateNodeTailwindClasses(node: CanvasNode, isRoot: boolean = false, parentNode?: CanvasNode): string {
    const classes = [];
    const round = (val: number) => Math.round(val);
    
    const scaleX = node.scaleX || 1;
    const scaleY = node.scaleY || 1;
    
    let isFullWidth = false;
    let isFullHeight = false;
    let isTouchBottom = false;
    let isTouchRight = false;
    let isCenterX = false;
    let isCenterY = false;
    
    let cssX = node.x;
    let cssY = node.y;
    let nodeW = node.width;
    let nodeH = node.height;

    if ((node.type === 'Circle' || node.type === 'Triangle') && node.radius) {
      nodeW = node.radius * 2 * scaleX;
      nodeH = node.radius * 2 * scaleY;
      cssX -= node.radius * scaleX;
      cssY -= node.radius * scaleY;
    }

    if (!isRoot && parentNode) {
      if (nodeW && parentNode.width && Math.abs(nodeW - parentNode.width) < 5) {
        isFullWidth = true;
      } else if (nodeW && parentNode.width) {
        if (Math.abs(cssX + nodeW/2 - parentNode.width/2) < 5) {
          isCenterX = true;
        } else if (Math.abs(cssX + nodeW - parentNode.width) < 5) {
          isTouchRight = true;
        }
      }
      
      if (nodeH && parentNode.height && Math.abs(nodeH - parentNode.height) < 5) {
        isFullHeight = true;
      } else if (nodeH && parentNode.height) {
        if (Math.abs(cssY + nodeH/2 - parentNode.height/2) < 5) {
          isCenterY = true;
        } else if (Math.abs(cssY + nodeH - parentNode.height) < 5) {
          isTouchBottom = true;
        }
      }
    }
    
    if (!isRoot) {
      classes.push('absolute');
      if (isFullWidth) {
        classes.push('left-0');
      } else if (isCenterX) {
        classes.push('left-1/2');
        classes.push('-translate-x-1/2');
      } else if (isTouchRight) {
        classes.push('right-0');
      } else {
        classes.push(`left-[${round(cssX)}px]`);
      }
      
      if (isFullHeight) {
        classes.push('top-0');
      } else if (isCenterY) {
        classes.push('top-1/2');
        classes.push('-translate-y-1/2');
      } else if (isTouchBottom) {
        classes.push('bottom-0');
      } else {
        classes.push(`top-[${round(cssY)}px]`);
      }
    } else {
      classes.push('relative');
      if (node.isMasterComponent) {
        if (node.width) classes.push(`w-[${round(node.width)}px]`);
        if (node.height) classes.push(`h-[${round(node.height)}px]`);
      } else {
        classes.push('w-full');
        classes.push('min-h-screen');
      }
    }
    
    if (node.rotation) {
      classes.push(`rotate-[${round(node.rotation)}deg]`);
      if (node.type !== 'Circle' && node.type !== 'Triangle') {
        classes.push('origin-top-left');
      }
    }
    
    if (node.type !== 'Circle' && node.type !== 'Triangle') {
      if (!isRoot) {
        if (isFullWidth) {
          classes.push('w-full');
        } else if (node.width) {
          classes.push(`w-[${round(node.width)}px]`);
        }
        
        if (isFullHeight) {
          classes.push('h-full');
        } else if (node.height) {
          classes.push(`h-[${round(node.height)}px]`);
        }
      }
    }
    
    if (node.fill) classes.push(`bg-[${node.fill}]`);
    
    if (node.stroke && node.type !== 'Line') {
      classes.push(`border-[${node.stroke}]`);
      if (node.strokeWidth) {
        classes.push(`border-[${round(node.strokeWidth)}px]`);
      } else {
        classes.push('border-[1px]');
      }
    }
    
    if (node.type === 'Line') {
      let lineW = node.width;
      let lineRot = node.rotation;
      let lineLeft = cssX;
      let lineTop = cssY;
      
      if (node.points && node.points.length >= 4) {
        const p1x = node.points[0];
        const p1y = node.points[1];
        const p2x = node.points[2];
        const p2y = node.points[3];
        const dx = p2x - p1x;
        const dy = p2y - p1y;
        lineW = Math.sqrt(dx * dx + dy * dy);
        lineRot = Math.atan2(dy, dx) * (180 / Math.PI);
        lineLeft = p1x;
        lineTop = p1y;
      }
      
      classes.push(`border-t-[${round(node.strokeWidth || 1)}px]`);
      classes.push(`border-[${node.stroke || '#000000'}]`);
      classes.push(`w-[${round(lineW || 0)}px]`);
      classes.push('origin-top-left');
      
      cssX = lineLeft;
      cssY = lineTop;
      
      if (lineRot) {
        classes.push(`rotate-[${round(lineRot)}deg]`);
      }
    }
    
    if (node.type === 'Circle') {
      classes.push('rounded-full');
      if (node.radius) {
        classes.push(`w-[${round(node.radius * 2 * scaleX)}px]`);
        classes.push(`h-[${round(node.radius * 2 * scaleY)}px]`);
      }
    } else if (node.type === 'Triangle') {
      if (node.radius) {
        classes.push(`w-[${round(node.radius * 2 * scaleX)}px]`);
        classes.push(`h-[${round(node.radius * 2 * scaleY)}px]`);
        classes.push('clip-path-triangle');
      }
    } else if (node.cornerRadius) {
      classes.push(`rounded-[${round(node.cornerRadius)}px]`);
    }

    if (node.type === 'Text') {
      if (node.fontSize) classes.push(`text-[${round(node.fontSize)}px]`);
      if (node.fill) {
        const bgIndex = classes.findIndex(c => c.startsWith('bg-['));
        if (bgIndex !== -1) {
          classes.splice(bgIndex, 1);
        }
        classes.push(`text-[${node.fill}]`);
      }
      classes.push('leading-none');
      classes.push('whitespace-nowrap');
    }

    return classes.join(' ');
  }

  private static resolveBoundProps(node: CanvasNode, isMasterComponentDef: boolean): Record<string, { expression: string; defaultValue: string }> {
    const dynamicProps: Record<string, { expression: string; defaultValue: string }> = {};
    if (isMasterComponentDef && node.boundProps) {
      Object.keys(node.boundProps).forEach(field => {
        const propId = node.boundProps![field];
        // Get the node's current value as a default fallback
        let defaultVal = '';
        if (field === 'fill') defaultVal = node.fill || '#000000';
        else if (field === 'text') defaultVal = node.text || '';
        else if (field === 'fontSize') defaultVal = String(node.fontSize || 16);
        else if (field === 'src') defaultVal = node.src || '';
        else defaultVal = String((node as any)[field] || '');
        
        dynamicProps[field] = {
          expression: `props['${propId}']`,
          defaultValue: defaultVal
        };
      });
    }
    return dynamicProps;
  }

  private static getRouteForTarget(targetId: string, pageRouteMap: { frameId: string; route: string; componentName: string }[]): string {
    const match = pageRouteMap.find(p => p.frameId === targetId);
    if (match) return match.route;
    if (targetId === 'virtual_root_page') return '/';
    return `/${targetId}`;
  }

  private static generateJsxForNode(
    node: CanvasNode, 
    allNodes: CanvasNode[], 
    nodesById: Record<string, CanvasNode>, 
    masterComponents: CanvasNode[], 
    isMasterComponentDef: boolean = false, 
    parentNode?: CanvasNode,
    pages: CanvasNode[] = [],
    pageRouteMap: { frameId: string; route: string; componentName: string }[] = []
  ): string {
    const round = (val: number) => Math.round(val);

    // Resolve target route if this node (or for components, any child) has a linkTo
    let targetLinkId = '';
    if (!isMasterComponentDef) {
      targetLinkId = node.linkTo || '';
      if (!targetLinkId && (node.componentId || node.isMasterComponent)) {
        // Check if any direct child has linkTo
        const childWithLink = allNodes.find(c => c.parentId === node.id && c.linkTo);
        if (childWithLink && childWithLink.linkTo) {
          targetLinkId = childWithLink.linkTo;
        }
        // If it was placed on a page and master's child has linkTo, only link if the target is not this page
        if (!targetLinkId && node.componentId) {
          const master = masterComponents.find(m => m.id === node.componentId);
          if (master?.linkTo) {
            targetLinkId = master.linkTo;
          } else if (master) {
            const masterChild = allNodes.find(c => c.parentId === master.id && c.linkTo);
            if (masterChild && masterChild.linkTo) {
              targetLinkId = masterChild.linkTo;
            }
          }
        }
      }

      // If the target is the page we are already inside, do not link to self
      if (targetLinkId && parentNode && parentNode.id === targetLinkId) {
        targetLinkId = '';
      }
    }

    const targetRoute = targetLinkId ? this.getRouteForTarget(targetLinkId, pageRouteMap) : '';

    // If it's an instance of a component
    if (node.componentId) {
      const master = masterComponents.find(m => m.id === node.componentId);
      if (master) {
        const compName = this.getComponentName(master);
        
        let propsStr = '';
        if (node.propOverrides) {
          Object.keys(node.propOverrides).forEach(propId => {
            const val = node.propOverrides![propId];
            if (typeof val === 'string') {
              propsStr += ` {...{'${propId}': "${val}"}}`;
            } else {
              propsStr += ` {...{'${propId}': ${JSON.stringify(val)}}}`;
            }
          });
        }
        
        const positioningClasses = `absolute left-[${round(node.x)}px] top-[${round(node.y)}px]`;
        
        if (targetRoute) {
          return `<Link to="${targetRoute}" className="${positioningClasses} block cursor-pointer">
      <${compName}${propsStr} />
    </Link>`;
        }
        
        return `<div className="${positioningClasses}">
      <${compName}${propsStr} />
    </div>`;
      }
    }

    if (node.isMasterComponent && !isMasterComponentDef) {
      // If the user placed the Master Component directly inside a layout frame, render it as an instance!
      const compName = this.getComponentName(node);
      const positioningClasses = `absolute left-[${round(node.x)}px] top-[${round(node.y)}px]`;
      
      if (targetRoute) {
        return `<Link to="${targetRoute}" className="${positioningClasses} block cursor-pointer">
      <${compName} />
    </Link>`;
      }
      
      return `<div className="${positioningClasses}">
      <${compName} />
    </div>`;
    }

    let twClasses = this.generateNodeTailwindClasses(node, false, parentNode);
    const dynamicProps = this.resolveBoundProps(node, isMasterComponentDef);
    
    // For bound fill props, use inline style with fallback instead of Tailwind dynamic classes.
    let fillStyle = '';
    if (dynamicProps.fill && node.type !== 'Text') {
      twClasses = twClasses.replace(/bg-\[[^\]]+\]/g, '');
      fillStyle = ` style={{ backgroundColor: ${dynamicProps.fill.expression} || '${dynamicProps.fill.defaultValue}' }}`;
    }
    let textColorStyle = '';
    if (dynamicProps.fill && node.type === 'Text') {
      twClasses = twClasses.replace(/text-\[#[^\]]+\]/g, '');
      textColorStyle = ` style={{ color: ${dynamicProps.fill.expression} || '${dynamicProps.fill.defaultValue}' }}`;
    }

    let jsx = '';
    const cursorClass = targetRoute ? ' cursor-pointer' : '';

    if (node.type === 'Frame') {
      const children = allNodes.filter(n => n.parentId === node.id);
      const childrenJsx = children.map(child => this.generateJsxForNode(child, allNodes, nodesById, masterComponents, isMasterComponentDef, node, pages, pageRouteMap)).join('\n      ');
      
      if (targetRoute) {
        jsx = `<Link to="${targetRoute}" className="${twClasses}${cursorClass} block"${fillStyle}>
      ${childrenJsx}
    </Link>`;
      } else {
        jsx = `<div className="${twClasses}"${fillStyle}>
      ${childrenJsx}
    </div>`;
      }
    } else if (node.type === 'Text') {
      const textContent = dynamicProps.text 
        ? `{${dynamicProps.text.expression} || "${dynamicProps.text.defaultValue}"}` 
        : (node.text || '');
      
      if (targetRoute) {
        jsx = `<Link to="${targetRoute}" className="${twClasses}${cursorClass} block"${textColorStyle}>${textContent}</Link>`;
      } else {
        jsx = `<div className="${twClasses}"${textColorStyle}>${textContent}</div>`;
      }
    } else if (node.type === 'Image') {
      const imgSrc = dynamicProps.src 
        ? `{${dynamicProps.src.expression} || "${dynamicProps.src.defaultValue}"}`
        : `"${node.src || ''}"`;
      if (targetRoute) {
        jsx = `<Link to="${targetRoute}" className="block cursor-pointer"><img src=${imgSrc} className="${twClasses}" alt="image" /></Link>`;
      } else {
        jsx = `<img src=${imgSrc} className="${twClasses}" alt="image" />`;
      }
    } else {
      // Rect, Circle, etc
      if (targetRoute) {
        jsx = `<Link to="${targetRoute}" className="${twClasses}${cursorClass} block"${fillStyle}></Link>`;
      } else {
        jsx = `<div className="${twClasses}"${fillStyle}></div>`;
      }
    }

    return jsx;
  }

  private static generateComponentCode(
    comp: CanvasNode, 
    allNodes: CanvasNode[], 
    nodesById: Record<string, CanvasNode>,
    pages: CanvasNode[] = [],
    pageRouteMap: { frameId: string; route: string; componentName: string }[] = []
  ): string {
    const componentName = this.getComponentName(comp);
    
    const children = allNodes.filter(n => n.parentId === comp.id);
    const hasAnyLink = children.some(c => c.linkTo);
    const linkImport = hasAnyLink ? "import { Link } from 'react-router-dom';\n" : '';
    
    const childrenJsx = children.map(child => this.generateJsxForNode(child, allNodes, nodesById, [], true, comp, pages, pageRouteMap)).join('\n      ');
    
    const rootClasses = this.generateNodeTailwindClasses(comp, true);
    
    return `import React from 'react';
${linkImport}
export default function ${componentName}(props) {
  return (
    <div className="${rootClasses}">
      ${childrenJsx}
    </div>
  );
}
`;
  }

  private static generatePageCode(
    page: CanvasNode, 
    allNodes: CanvasNode[], 
    nodesById: Record<string, CanvasNode>, 
    masterComponents: CanvasNode[],
    pages: CanvasNode[] = [],
    pageRouteMap: { frameId: string; route: string; componentName: string }[] = []
  ): string {
    const children = allNodes.filter(n => n.parentId === page.id);
    
    // Find imports for instances used in this page
    const instancesUsed = new Set<string>();
    const findInstances = (nodeId: string) => {
      const nodeChildren = allNodes.filter(n => n.parentId === nodeId);
      nodeChildren.forEach(child => {
        if (child.componentId) {
          const master = masterComponents.find(m => m.id === child.componentId);
          if (master) {
            instancesUsed.add(this.getComponentName(master));
          }
        } else if (child.isMasterComponent) {
          instancesUsed.add(this.getComponentName(child));
        } else {
          findInstances(child.id);
        }
      });
    };
    findInstances(page.id);
    
    const imports = Array.from(instancesUsed).map(name => `import ${name} from '../components/${name}';`).join('\n');
    
    const childrenJsx = children.map(child => this.generateJsxForNode(child, allNodes, nodesById, masterComponents, false, page, pages, pageRouteMap)).join('\n      ');
    
    const pageWidth = Math.round(page.width || 1440);
    const pageHeight = Math.round(page.height || 900);
    const bgColor = page.fill || '#ffffff';

    return `import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
${imports}

export default function Page() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen w-full flex justify-center" style={{ backgroundColor: '${bgColor}' }}>
      <div className="relative w-full overflow-visible" style={{ maxWidth: '${pageWidth}px', minHeight: '${pageHeight}px' }}>
        ${childrenJsx}
      </div>
    </div>
  );
}
`;
  }
}
