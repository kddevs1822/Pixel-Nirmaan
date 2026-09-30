import { CanvasNode, StateVariable, DataSource } from '../models/types';

export class CodeGeneratorService {
  static generate(nodes: CanvasNode[], stateVariables: StateVariable[] = [], dataSources: DataSource[] = []): Record<string, string> {
    const hasFrame = nodes.some(n => n.type === 'Frame');
    if (!hasFrame) {
      throw new Error('Cannot export: No Frame found on canvas. Please add at least one Frame before exporting.');
    }

    const files: Record<string, string> = {};

    // Base config files
    files['package.json'] = this.generatePackageJson();
    files['vite.config.js'] = this.generateViteConfig();
    files['index.html'] = this.generateIndexHtml();
    files['tailwind.config.js'] = this.generateTailwindConfig();
    files['postcss.config.js'] = this.generatePostcssConfig();
    files['src/index.css'] = this.generateIndexCss();

    // Extract base64 images
    nodes.forEach(node => {
      if (node.type === 'Image' && node.src && node.src.startsWith('data:image/')) {
        let ext = 'png';
        if (node.src.startsWith('data:image/jpeg')) ext = 'jpg';
        if (node.src.startsWith('data:image/svg+xml')) ext = 'svg';
        if (node.src.startsWith('data:image/gif')) ext = 'gif';
        
        const filename = `public/images/img_${node.id}.${ext}`;
        files[filename] = node.src;
        node.src = `/images/img_${node.id}.${ext}`;
      }
    });

    // Normalize FormContainer children: any node visually inside a FormContainer belongs to it
    const forms = nodes.filter(n => n.type === 'FormContainer');
    forms.sort((a, b) => ((a.width || 0) * (a.height || 0)) - ((b.width || 0) * (b.height || 0)));
    if (forms.length > 0) {
      nodes = nodes.map(n => {
        if (n.type === 'FormContainer' || n.type === 'Frame') return n;
        const containingForm = forms.find(f => {
          if (n.parentId && f.parentId && n.parentId !== f.parentId && n.parentId !== f.id) return false;
          if (n.parentId === f.id) return false;
          const fx = f.x, fy = f.y, fw = f.width || 340, fh = f.height || 260;
          return n.x >= fx && n.x <= fx + fw && n.y >= fy && n.y <= fy + fh;
        });
        if (containingForm) {
          return { ...n, parentId: containingForm.id, x: n.x - containingForm.x, y: n.y - containingForm.y };
        }
        return n;
      });
    }

    // Group nodes
    const masterComponents = nodes.filter(n => n.isMasterComponent);
    const masterIds = new Set(masterComponents.map(m => m.id));
    
    // Root frames that are NOT master components, NOT component instances, and NOT variants = user's primary "pages"
    const allRootFrames = nodes.filter(n => n.type === 'Frame' && !n.isMasterComponent && !n.parentId && !n.componentId);
    let pages = allRootFrames.filter(n => !n.variantOf);
    if (pages.length === 0 && allRootFrames.length > 0) {
      pages = [allRootFrames[0]];
    }

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
    const usedNames = new Set<string>();
    const pageRouteMap: { frameId: string; route: string; componentName: string }[] = [];
    pages.forEach((page, index) => {
      const pageName = this.getPageComponentName(page, index, usedNames);
      const route = this.getPageRoute(pageName, index);
      pageRouteMap.push({ frameId: page.id, route, componentName: pageName });
    });

    // Components
    masterComponents.forEach(comp => {
      const componentName = this.getComponentName(comp);
      files[`src/components/${componentName}.jsx`] = this.generateComponentCode(comp, nodes, nodesById, pages, pageRouteMap, stateVariables, masterComponents, dataSources);
    });

    // Generate page code
    pages.forEach((page, index) => {
      const routeInfo = pageRouteMap.find(p => p.frameId === page.id);
      const pageName = routeInfo ? routeInfo.componentName : `Page${index + 1}`;
      files[`src/pages/${pageName}.jsx`] = this.generatePageCode(page, nodes, nodesById, masterComponents, pages, pageRouteMap, pageName, stateVariables, dataSources);
    });

    // App & Router
    files['src/App.jsx'] = this.generateAppCode(pageRouteMap);
    files['src/main.jsx'] = this.generateMainCode();

    return files;
  }

  private static getPageComponentName(page: CanvasNode, index: number, usedNames: Set<string>): string {
    const rawName = page.name || `Page${index + 1}`;
    let pascalName = rawName
      .trim()
      .replace(/[^a-zA-Z0-9_\s-]/g, '')
      .split(/[\s_-]+/)
      .filter(Boolean)
      .map(part => part.charAt(0).toUpperCase() + part.slice(1))
      .join('');

    if (!pascalName || /^[0-9]/.test(pascalName)) {
      pascalName = `Page${pascalName || (index + 1)}`;
    }

    let finalName = pascalName;
    let counter = 1;
    while (usedNames.has(finalName)) {
      finalName = `${pascalName}_${counter}`;
      counter++;
    }
    usedNames.add(finalName);
    return finalName;
  }

  private static getPageRoute(componentName: string, index: number): string {
    if (index === 0) return '/';
    const slug = componentName
      .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
      .toLowerCase();
    return `/${slug}`;
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
    extend: {
      fontFamily: {
        'space-grotesk': ['"Space Grotesk"', 'sans-serif'],
        'jetbrains-mono': ['"JetBrains Mono"', 'monospace'],
        'inter': ['Inter', 'sans-serif'],
      },
    },
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
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&family=Space+Grotesk:wght@400;500;600;700&display=swap" rel="stylesheet">
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

@keyframes fadeIn {
  from { opacity: var(--fade-start, 0); }
  to { opacity: 1; }
}

@keyframes fadeOut {
  from { opacity: 1; }
  to { opacity: 0; }
}

@keyframes slideUp {
  from { transform: translateY(var(--slide-start, 50px)); opacity: var(--fade-start, 0); }
  to { transform: translateY(calc(-1 * var(--slide-end, 0px))); opacity: 1; }
}

@keyframes slideUpReverse {
  from { transform: translateY(calc(-1 * var(--slide-end, 0px))); opacity: 1; }
  to { transform: translateY(var(--slide-start, 50px)); opacity: 0; }
}

@keyframes slideDown {
  from { transform: translateY(calc(-1 * var(--slide-start, 50px))); opacity: var(--fade-start, 0); }
  to { transform: translateY(var(--slide-end, 0px)); opacity: 1; }
}

@keyframes slideDownReverse {
  from { transform: translateY(var(--slide-end, 0px)); opacity: 1; }
  to { transform: translateY(calc(-1 * var(--slide-start, 50px))); opacity: 0; }
}

@keyframes slideLeft {
  from { transform: translateX(var(--slide-start, 50px)); opacity: var(--fade-start, 0); }
  to { transform: translateX(calc(-1 * var(--slide-end, 0px))); opacity: 1; }
}

@keyframes slideLeftReverse {
  from { transform: translateX(calc(-1 * var(--slide-end, 0px))); opacity: 1; }
  to { transform: translateX(var(--slide-start, 50px)); opacity: 0; }
}

@keyframes slideRight {
  from { transform: translateX(calc(-1 * var(--slide-start, 50px))); opacity: var(--fade-start, 0); }
  to { transform: translateX(var(--slide-end, 0px)); opacity: 1; }
}

@keyframes slideRightReverse {
  from { transform: translateX(var(--slide-end, 0px)); opacity: 1; }
  to { transform: translateX(calc(-1 * var(--slide-start, 50px))); opacity: 0; }
}

@keyframes bounceSubtle {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(calc(-1 * var(--slide-dist, 30px))); }
}

@keyframes pulseSubtle {
  0%, 100% { transform: scale(1); opacity: 1; }
  50% { transform: scale(var(--pulse-scale, 1.15)); opacity: 0.85; }
}

@keyframes spinSmooth {
  from { transform: rotate(0deg); }
  to { transform: rotate(var(--spin-deg, 360deg)); }
}

@keyframes scaleUp {
  from { transform: scale(1); }
  to { transform: scale(1.05); }
}

@keyframes scaleDown {
  from { transform: scale(1); }
  to { transform: scale(0.95); }
}

@keyframes lift {
  from { transform: translateY(0); box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
  to { transform: translateY(-6px); box-shadow: 0 10px 25px rgba(0,0,0,0.15); }
}

@keyframes glow {
  from { box-shadow: 0 0 0 rgba(74,58,255,0); }
  to { box-shadow: 0 0 20px rgba(74,58,255,0.6); }
}

@keyframes darken {
  from { filter: brightness(1); }
  to { filter: brightness(0.75); }
}

@keyframes brighten {
  from { filter: brightness(1); }
  to { filter: brightness(1.25); }
}

.animate-fade-in {
  animation: fadeIn 1000ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
  will-change: transform, opacity;
}

.animate-fade-out {
  animation: fadeOut 1000ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
  will-change: transform, opacity;
  pointer-events: none !important;
}

.animate-slide-up {
  animation: slideUp 1000ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
  will-change: transform, opacity;
}

.animate-slide-up-reverse {
  animation: slideUpReverse 1000ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
  will-change: transform, opacity;
  pointer-events: none !important;
}

.animate-slide-down {
  animation: slideDown 1000ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
  will-change: transform, opacity;
}

.animate-slide-down-reverse {
  animation: slideDownReverse 1000ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
  will-change: transform, opacity;
  pointer-events: none !important;
}

.animate-slide-left {
  animation: slideLeft 1000ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
  will-change: transform, opacity;
}

.animate-slide-left-reverse {
  animation: slideLeftReverse 1000ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
  will-change: transform, opacity;
  pointer-events: none !important;
}

.animate-slide-right {
  animation: slideRight 1000ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
  will-change: transform, opacity;
}

.animate-slide-right-reverse {
  animation: slideRightReverse 1000ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
  will-change: transform, opacity;
  pointer-events: none !important;
}

.animate-bounce-subtle {
  animation: bounceSubtle 1000ms ease-in-out infinite;
}

.animate-pulse-subtle {
  animation: pulseSubtle 1000ms ease-in-out infinite;
}

.animate-spin-smooth {
  animation: spinSmooth 1000ms linear infinite;
}

.animate-scale-up {
  animation: scaleUp 1000ms ease-out forwards;
}

.animate-scale-down {
  animation: scaleDown 1000ms ease-out forwards;
}

.animate-lift {
  animation: lift 1000ms ease-out forwards;
}

.animate-glow {
  animation: glow 1000ms ease-out forwards;
}

.animate-darken {
  animation: darken 1000ms ease-out forwards;
}

.animate-brighten {
  animation: brighten 1000ms ease-out forwards;
}

.is-initially-hidden {
  opacity: 0 !important;
  pointer-events: none !important;
}

.is-visible {
  opacity: 1 !important;
  pointer-events: auto !important;
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
    const usedRoutes = new Set<string>();

    routes.forEach((r, idx) => {
      const addRoute = (p: string) => {
        if (!p || usedRoutes.has(p.toLowerCase())) return;
        usedRoutes.add(p.toLowerCase());
        routeElements.push(`        <Route path="${p}" element={<${r.componentName} />} />`);
      };

      addRoute(r.route);
      if (idx === 0) {
        addRoute('/page1');
        addRoute('/page-1');
      }
      if (r.frameId) {
        addRoute(`/${r.frameId}`);
      }
      if (r.componentName) {
        addRoute(`/${r.componentName}`);
        addRoute(`/${r.componentName.toLowerCase()}`);
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

  private static generateNodeAnimationClasses(node: CanvasNode, allNodes: CanvasNode[] = []): string {
    if (node.type === 'Frame' && !node.parentId) return '';

    const isExplicitlyHidden = !!node.animation?.initiallyHidden;

    // Check if any other node triggers an animation or visibility on this node
    const isTargetOfActionSeq = allNodes.some(n => 
      n.actionSequences?.some(seq => 
        seq.actions?.some(act => 
          act.enabled !== false &&
          (act.type === 'triggerAnimation' || act.type === 'toggleVisibility') && 
          (act.targetNodeId === node.id || (node.sourceNodeId && act.targetNodeId === node.sourceNodeId))
        )
      )
    );

    const isExternallyTriggered = isTargetOfActionSeq || 
      (!!node.animation?.triggerNodeId && node.animation.triggerNodeId !== node.id);

    // If externally triggered, it should never auto-animate on page load!
    if (isExternallyTriggered) {
      return isExplicitlyHidden ? 'is-initially-hidden' : '';
    }

    if (!node.animation || node.animation.type === 'none') {
      return isExplicitlyHidden ? 'is-initially-hidden' : '';
    }

    const animType = node.animation.type;
    const trigger = node.animation.trigger || 'auto';

    let baseClass = '';
    switch (animType) {
      case 'bounce':
        baseClass = 'animate-bounce-subtle';
        break;
      case 'pulse':
        baseClass = 'animate-pulse-subtle';
        break;
      case 'spin':
        baseClass = 'animate-spin-smooth';
        break;
      case 'fade-in':
        baseClass = 'animate-fade-in';
        break;
      case 'slide-up':
        baseClass = 'animate-slide-up';
        break;
      case 'slide-down':
        baseClass = 'animate-slide-down';
        break;
      case 'slide-left':
        baseClass = 'animate-slide-left';
        break;
      case 'slide-right':
        baseClass = 'animate-slide-right';
        break;
      default:
        return isExplicitlyHidden ? 'is-initially-hidden' : '';
    }

    if (isExplicitlyHidden) {
      if (trigger === 'hover') return 'is-initially-hidden cursor-pointer';
      if (trigger === 'focus') return 'is-initially-hidden cursor-pointer outline-none';
      if (trigger === 'click' || trigger === 'dblclick') return 'is-initially-hidden cursor-pointer';
      if (trigger === 'scroll') return 'is-initially-hidden transition-all';
      return 'is-initially-hidden';
    }

    if (trigger === 'hover') return `hover:${baseClass} cursor-pointer`;
    if (trigger === 'focus') return `focus:${baseClass} active:${baseClass} cursor-pointer outline-none`;
    if (trigger === 'click' || trigger === 'dblclick') return 'cursor-pointer';
    if (trigger === 'scroll') return 'transition-all';
    return baseClass;
  }

  private static getAnimBaseClass(animType: string): string {
    switch (animType) {
      case 'bounce': return 'animate-bounce-subtle';
      case 'pulse': return 'animate-pulse-subtle';
      case 'spin': return 'animate-spin-smooth';
      case 'fade-in': return 'animate-fade-in';
      case 'slide-up': return 'animate-slide-up';
      case 'slide-down': return 'animate-slide-down';
      case 'slide-left': return 'animate-slide-left';
      case 'slide-right': return 'animate-slide-right';
      default: return '';
    }
  }

  private static getAnimReverseClass(animType: string, isHidden: boolean = false): string {
    switch (animType) {
      case 'slide-up': return 'animate-slide-up-reverse';
      case 'slide-down': return 'animate-slide-down-reverse';
      case 'slide-left': return 'animate-slide-left-reverse';
      case 'slide-right': return 'animate-slide-right-reverse';
      case 'fade-in': return 'animate-fade-out';
      default: return isHidden ? 'animate-fade-out' : '';
    }
  }

  private static cleanDefaultValue(val: any, type?: string): any {
    if (val === undefined || val === null) {
      if (type === 'number') return 0;
      if (type === 'boolean') return false;
      if (type === 'array') return [];
      if (type === 'object') return {};
      return '';
    }
    if (type === 'string' || typeof val === 'string') {
      const s = String(val).trim();
      if (s === '""' || s === "''") return '';
      if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
        return s.slice(1, -1);
      }
      return val;
    }
    return val;
  }

  private static sanitizeVarName(rawName: string): string {
    if (!rawName) return 'varState';
    let clean = rawName.replace(/[^a-zA-Z0-9_$]/g, '_');
    if (/^[0-9]/.test(clean)) clean = 'var_' + clean;
    return clean;
  }

  private static normalizeUrl(rawUrl: string): string {
    let url = (rawUrl || '').trim();
    if (!url) return '';
    if (/^ttps?:\/\//i.test(url)) {
      url = 'h' + url;
    } else if (/^\/\//.test(url)) {
      url = 'https:' + url;
    } else if (!/^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//.test(url)) {
      if (url.startsWith('localhost') || url.startsWith('127.0.0.1')) {
        url = 'http://' + url;
      } else {
        url = 'https://' + url;
      }
    }
    return url;
  }

  private static toSafeJsPath(expr: string, stateVariables: StateVariable[]): string {
    if (!expr) return '';
    const normalized = expr.replace(/\[\s*(['"])?([a-zA-Z0-9_$]+)\1\s*\]/g, '.$2');
    const parts = normalized.split('.');
    const base = parts[0];
    const rest = parts.slice(1);

    let cleanBase = base;
    if (base !== 'item') {
      const sv = (stateVariables || []).find(v => v.id === base || v.name === base);
      cleanBase = sv ? this.sanitizeVarName(sv.name) : this.sanitizeVarName(base);
    }

    if (rest.length === 0) return cleanBase;

    let path = cleanBase;
    for (const part of rest) {
      if (/^\d+$/.test(part)) {
        path += `?.[${part}]`;
      } else {
        path += `?.${part}`;
      }
    }
    return path;
  }

  private static resolveBindingExpr(expr: string, stateVariables: StateVariable[]): string {
    if (!expr) return '';
    return this.toSafeJsPath(expr, stateVariables);
  }

  private static getRelatedNodes(node: CanvasNode, allNodes: CanvasNode[]): CanvasNode[] {
    const primaryId = node.sourceNodeId || node.id;
    return allNodes.filter(n => n.id === primaryId || n.sourceNodeId === primaryId);
  }

  private static getRelatedNodeIds(node: CanvasNode, allNodes: CanvasNode[]): Set<string> {
    const ids = new Set<string>([node.id]);
    const primaryId = node.sourceNodeId || node.id;
    ids.add(primaryId);
    for (const n of allNodes) {
      if (n.sourceNodeId === primaryId || n.id === primaryId) {
        ids.add(n.id);
        if (n.sourceNodeId) ids.add(n.sourceNodeId);
      }
    }
    return ids;
  }

  private static generatePathAccess(base: string, pathStr: string): string {
    const parts = pathStr.split('.').filter(Boolean);
    if (parts.length === 0) return base;
    return base + '?.' + parts.join('?.');
  }

  private static generateNodeEventHandlers(
    node: CanvasNode, 
    allNodes: CanvasNode[],
    pageRouteMap: { frameId: string; route: string; componentName: string }[] = [],
    stateVariables: StateVariable[] = [],
    dataSources: DataSource[] = []
  ): string {
    const onClickStatements: string[] = [];
    const onDblClickStatements: string[] = [];
    const onMouseEnterStatements: string[] = [];
    const onMouseLeaveStatements: string[] = [];
    const onFocusStatements: string[] = [];
    const onBlurStatements: string[] = [];
    const onChangeStatements: string[] = [];
    const onSubmitStatements: string[] = [];
    let refProp = '';

    // 1. Action Sequences (Stage 4) - Check self, related variants, or ancestors for action sequences
    let targetForSequences = node;
    let currSeqNode: CanvasNode | undefined = node;
    while (currSeqNode) {
      const related = this.getRelatedNodes(currSeqNode, allNodes);
      const hasAnyActions = related.some(r => r.actionSequences && r.actionSequences.length > 0);
      if (hasAnyActions) {
        targetForSequences = currSeqNode;
        break;
      }
      if (!currSeqNode.parentId) break;
      const parent = allNodes.find(n => n.id === currSeqNode!.parentId);
      if (!parent || parent.type === 'Frame' || parent.type === 'FormContainer') break;
      currSeqNode = parent;
    }

    let actionSequences = targetForSequences.actionSequences || [];
    if (actionSequences.length === 0) {
      const related = this.getRelatedNodes(targetForSequences, allNodes);
      for (const r of related) {
        if (r.actionSequences && r.actionSequences.length > 0) {
          actionSequences = r.actionSequences;
          break;
        }
      }
    }

    if (actionSequences.length > 0) {
      actionSequences.forEach(seq => {
        const statements: string[] = [];
        seq.actions.forEach(act => {
          if (act.enabled === false) return;
          if (act.type === 'setState') {
            const sv = stateVariables.find(v => v.id === act.stateVariableId || v.name === act.stateVariableId);
            const rawVarName = sv ? sv.name : (act.stateVariableId || 'stateVar');
            const varName = this.sanitizeVarName(rawVarName);
            if (varName) {
              const setter = `set${varName.charAt(0).toUpperCase() + varName.slice(1)}`;
              const op = act.stateOperation || 'set';
              if (op === 'set') {
                let val: string;
                if (sv && sv.type === 'number') {
                  const num = Number(act.value);
                  val = isNaN(num) ? '0' : String(num);
                } else if (sv && sv.type === 'boolean') {
                  val = (act.value === 'true' || act.value === true) ? 'true' : 'false';
                } else if (sv && sv.type === 'string') {
                  let s = String(act.value ?? '').trim();
                  if (s === '""' || s === "''") s = '';
                  else if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) s = s.slice(1, -1);
                  val = `'${s.replace(/'/g, "\\'")}'`;
                } else {
                  if (act.value === 'true' || act.value === true) {
                    val = 'true';
                  } else if (act.value === 'false' || act.value === false) {
                    val = 'false';
                  } else if (!isNaN(Number(act.value)) && String(act.value).trim() !== '') {
                    val = String(Number(act.value));
                  } else if (act.value !== undefined && act.value !== '') {
                    val = `'${String(act.value).replace(/'/g, "\\'")}'`;
                  } else if (node.type === 'TextInput' || node.type === 'TextArea' || node.type === 'SelectDropdown') {
                    val = 'e.target.value';
                  } else {
                    val = 'true';
                  }
                }
                statements.push(`${setter}(${val});`);
              } else if (op === 'toggle') {
                statements.push(`${setter}(prev => !prev);`);
              } else if (op === 'increment') {
                const step = (act.value !== undefined && act.value !== '') ? (Number(act.value) || 1) : 1;
                statements.push(`${setter}(prev => (Number(prev) || 0) + ${step});`);
              } else if (op === 'decrement') {
                const step = (act.value !== undefined && act.value !== '') ? (Number(act.value) || 1) : 1;
                statements.push(`${setter}(prev => (Number(prev) || 0) - ${step});`);
              } else if (op === 'setInputVal') {
                if (node.type === 'Checkbox' || node.type === 'Switch') {
                  statements.push(`${setter}(e.target.checked);`);
                } else {
                  statements.push(`${setter}(e.target.value);`);
                }
              }
            }
          } else if (act.type === 'navigate') {
            const route = act.targetPageId ? this.getRouteForTarget(act.targetPageId, pageRouteMap) : '';
            if (route) {
              statements.push(`navigate('${route}');`);
            }
          } else if (act.type === 'triggerAnimation') {
            const targetId = act.targetNodeId || node.id;
            const targetNode = allNodes.find(n => n.id === targetId || n.sourceNodeId === targetId);
            const primaryTargetId = targetNode?.sourceNodeId || targetNode?.id || targetId;
            const animType = act.animationType || targetNode?.animation?.type || 'bounce';
            const baseClass = this.getAnimBaseClass(animType);
            const isHidden = !!targetNode?.animation?.initiallyHidden;
            const reverseClass = this.getAnimReverseClass(animType, isHidden);
            if (baseClass) {
              const allAnimClasses = [
                'animate-bounce-subtle', 'animate-pulse-subtle', 'animate-spin-smooth',
                'animate-fade-in', 'animate-fade-out',
                'animate-slide-up', 'animate-slide-up-reverse',
                'animate-slide-down', 'animate-slide-down-reverse',
                'animate-slide-left', 'animate-slide-left-reverse',
                'animate-slide-right', 'animate-slide-right-reverse'
              ].map(c => `'${c}'`).join(', ');

              if (reverseClass) {
                statements.push(`const animContainer = document.querySelector('[data-node-id="${primaryTargetId}"]') || document.getElementById('node-${targetId}') || document.getElementById('node-${primaryTargetId}'); if (animContainer) { const animEl = animContainer.querySelector('[data-anim="true"]') || animContainer; animContainer.classList.remove('hidden', 'is-initially-hidden'); animContainer.style.pointerEvents = 'auto'; if (animEl.classList.contains('${baseClass}')) { animEl.classList.remove(${allAnimClasses}); void animEl.offsetWidth; animEl.classList.add('${reverseClass}'); ${isHidden ? "animEl.classList.add('is-initially-hidden');" : ""} } else { animEl.classList.remove(${allAnimClasses}, 'is-initially-hidden', 'hidden'); animEl.style.opacity = '1'; animEl.style.pointerEvents = 'auto'; void animEl.offsetWidth; animEl.classList.add('${baseClass}'); } }`);
              } else {
                statements.push(`const animContainer = document.querySelector('[data-node-id="${primaryTargetId}"]') || document.getElementById('node-${targetId}') || document.getElementById('node-${primaryTargetId}'); if (animContainer) { const animEl = animContainer.querySelector('[data-anim="true"]') || animContainer; animContainer.classList.remove('hidden', 'is-initially-hidden'); animContainer.style.pointerEvents = 'auto'; animEl.classList.remove(${allAnimClasses}, 'is-initially-hidden', 'hidden'); animEl.style.opacity = '1'; animEl.style.pointerEvents = 'auto'; animEl.style.animationIterationCount = '1'; void animEl.offsetWidth; animEl.classList.add('${baseClass}'); setTimeout(() => { animEl.classList.remove('${baseClass}'); animEl.style.animationIterationCount = ''; }, 1000); }`);
              }
            }
          } else if (act.type === 'toggleVisibility') {
            const targetId = act.targetNodeId || (node.type !== 'FormContainer' ? node.id : undefined);
            if (targetId) {
              const targetNode = allNodes.find(n => n.id === targetId);
              const primaryTargetId = targetNode?.sourceNodeId || targetId;
              const visAction = act.visibilityAction || 'toggle';
              if (visAction === 'show') {
                statements.push(`const visEl = document.querySelector('[data-node-id="${primaryTargetId}"]') || document.getElementById('node-${targetId}') || document.getElementById('node-${primaryTargetId}'); if (visEl) { visEl.classList.remove('hidden', 'is-initially-hidden'); visEl.style.opacity = '1'; visEl.style.pointerEvents = 'auto'; }`);
              } else if (visAction === 'hide') {
                statements.push(`const visEl = document.querySelector('[data-node-id="${primaryTargetId}"]') || document.getElementById('node-${targetId}') || document.getElementById('node-${primaryTargetId}'); if (visEl) { visEl.classList.add('hidden'); visEl.style.pointerEvents = 'none'; }`);
              } else {
                statements.push(`const visEl = document.querySelector('[data-node-id="${primaryTargetId}"]') || document.getElementById('node-${targetId}') || document.getElementById('node-${primaryTargetId}'); if (visEl) { if (visEl.classList.contains('hidden') || visEl.classList.contains('is-initially-hidden')) { visEl.classList.remove('hidden', 'is-initially-hidden'); visEl.style.opacity = '1'; visEl.style.pointerEvents = 'auto'; } else { visEl.classList.add('hidden'); visEl.style.pointerEvents = 'none'; } }`);
              }
            }
          } else if (act.type === 'resetForm') {
            const targetFormQuery = act.targetNodeId ? `document.querySelector('[data-node-id="${act.targetNodeId}"]') || document.getElementById('node-${act.targetNodeId}') || ` : '';
            statements.push(`const formEl = ${targetFormQuery}e.currentTarget.closest('form') || document.querySelector('form'); const targetForm = formEl ? (formEl.tagName === 'FORM' ? formEl : formEl.closest('form')) : null; if (targetForm) targetForm.reset();`);
          } else if (act.type === 'submitForm') {
            const targetFormQuery = act.targetNodeId ? `document.querySelector('[data-node-id="${act.targetNodeId}"]') || document.getElementById('node-${act.targetNodeId}') || ` : '';
            statements.push(`const formEl = ${targetFormQuery}e.currentTarget.closest('form') || document.querySelector('form'); const targetForm = formEl ? (formEl.tagName === 'FORM' ? formEl : formEl.closest('form')) : null; if (targetForm) { if (typeof targetForm.requestSubmit === 'function') targetForm.requestSubmit(); else targetForm.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true })); }`);
          } else if (act.type === 'callApi') {
            let url = act.apiUrl || '';
            let method = act.apiMethod || 'GET';
            let headersObj: Record<string, string> = {};
            let body = act.apiBody;
            let targetVarId = act.apiTargetVariableId;
            let responsePath = act.apiResponsePath;

            if (act.dataSourceId && act.dataSourceId !== 'custom') {
              const ds = (dataSources || []).find(d => d.id === act.dataSourceId);
              if (ds) {
                url = ds.url;
                method = ds.method;
                (ds.headers || []).filter(h => h.enabled && h.key).forEach(h => {
                  headersObj[h.key] = h.value;
                });
                if (!body && ds.bodyTemplate) body = ds.bodyTemplate;
                if (!targetVarId && ds.targetVariableId) targetVarId = ds.targetVariableId;
                if (!responsePath && ds.responsePath) responsePath = ds.responsePath;
              }
            } else if (act.apiHeaders) {
              act.apiHeaders.filter(h => h.enabled && h.key).forEach(h => {
                headersObj[h.key] = h.value;
              });
            }

            const finalUrl = this.normalizeUrl(url);
            if (finalUrl) {
              if (act.delay && act.delay > 0) {
                statements.push(`await new Promise(r => setTimeout(r, ${act.delay}));`);
              }

              const sv = targetVarId ? (stateVariables || []).find(v => v.id === targetVarId || v.name === targetVarId) : undefined;
              const rawVarName = sv ? sv.name : targetVarId;
              const cleanVarName = rawVarName ? this.sanitizeVarName(rawVarName) : '';
              const setter = cleanVarName ? `set${cleanVarName.charAt(0).toUpperCase() + cleanVarName.slice(1)}` : '';

              const headersStr = JSON.stringify(headersObj);
              const bodyStr = (['POST', 'PUT', 'PATCH'].includes(method) && body)
                ? `, body: ${JSON.stringify(body)}`
                : '';

              const pathAccess = responsePath ? `result = ${this.generatePathAccess('data', responsePath)};` : '';
              const setterCall = setter ? `${setter}(result);` : '';
              const logCall = cleanVarName ? `console.log('⚡ [PixelNirmaan] API response saved to "${cleanVarName}":', result);` : `console.log('⚡ [PixelNirmaan] API call success:', result);`;

              statements.push(`try { const res = await fetch('${finalUrl}', { method: '${method}', headers: ${headersStr}${bodyStr} }); const data = await res.json(); let result = data; ${pathAccess} ${setterCall} ${logCall} } catch (err) { console.error('API call error:', err); }`);
            }
          }
        });

        if (statements.length > 0) {
          if (seq.event === 'onClick') onClickStatements.push(...statements);
          else if (seq.event === 'onChange') onChangeStatements.push(...statements);
          else if (seq.event === 'onSubmit') {
            if (node.type === 'FormContainer') {
              onSubmitStatements.push(...statements);
            }
          }
          else if (seq.event === 'onHover') onMouseEnterStatements.push(...statements);
          else if (seq.event === 'onFocus') onFocusStatements.push(...statements);
        }
      });
    }

    // 2. Cross-element triggers (matching triggers across variants and ancestors)
    const triggerMatchIds = new Set<string>();
    let currParent: CanvasNode | undefined = node;
    while (currParent) {
      this.getRelatedNodeIds(currParent, allNodes).forEach(id => triggerMatchIds.add(id));
      currParent = currParent.parentId ? allNodes.find(n => n.id === currParent!.parentId) : undefined;
    }

    const selfRelatedIds = this.getRelatedNodeIds(node, allNodes);

    const triggeredNodes = allNodes.filter(n => {
      const anim = n.animation;
      if (!anim || anim.type === 'none' || !anim.triggerNodeId) return false;
      if (selfRelatedIds.has(n.id)) return false;
      return triggerMatchIds.has(anim.triggerNodeId);
    });

    const seenTargetPrimaryIds = new Set<string>();
    const uniqueTriggeredNodes: CanvasNode[] = [];
    triggeredNodes.forEach(tn => {
      const pId = tn.sourceNodeId || tn.id;
      if (!seenTargetPrimaryIds.has(pId)) {
        seenTargetPrimaryIds.add(pId);
        uniqueTriggeredNodes.push(tn);
      }
    });

    uniqueTriggeredNodes.forEach(targetNode => {
      const animType = targetNode.animation!.type;
      const baseClass = this.getAnimBaseClass(animType);
      const isHidden = !!targetNode.animation!.initiallyHidden;
      const reverseClass = this.getAnimReverseClass(animType, isHidden);
      if (!baseClass) return;

      const trigger = targetNode.animation!.trigger || 'click';
      const primaryTargetId = targetNode.sourceNodeId || targetNode.id;
      const targetQuery = `const el = document.querySelector('[data-node-id="${primaryTargetId}"]') || document.getElementById('node-${targetNode.id}') || document.getElementById('node-${primaryTargetId}'); if (el) { const target = el.querySelector('[data-anim="true"]') || el;`;

      if (trigger === 'click' || trigger === 'dblclick') {
        const stmts = trigger === 'click' ? onClickStatements : onDblClickStatements;
        if (isHidden) {
          stmts.push(`${targetQuery} if (target.classList.contains('${baseClass}')) { target.classList.remove('${baseClass}'); void target.offsetWidth; target.classList.add('${reverseClass}'); target.classList.add('is-initially-hidden'); } else { target.classList.remove('${reverseClass}'); target.classList.remove('is-initially-hidden'); void target.offsetWidth; target.classList.add('${baseClass}'); } }`);
        } else if (reverseClass) {
          stmts.push(`${targetQuery} if (target.classList.contains('${baseClass}')) { target.classList.remove('${baseClass}'); void target.offsetWidth; target.classList.add('${reverseClass}'); } else { target.classList.remove('${reverseClass}'); void target.offsetWidth; target.classList.add('${baseClass}'); } }`);
        } else {
          stmts.push(`${targetQuery} if (target.classList.contains('${baseClass}')) { target.classList.remove('${baseClass}'); } else { void target.offsetWidth; target.classList.add('${baseClass}'); } }`);
        }
      } else if (trigger === 'hover') {
        if (isHidden) {
          onMouseEnterStatements.push(`${targetQuery} target.classList.remove('${reverseClass}'); target.classList.remove('is-initially-hidden'); void target.offsetWidth; target.classList.add('${baseClass}'); }`);
          onMouseLeaveStatements.push(`${targetQuery} target.classList.remove('${baseClass}'); void target.offsetWidth; target.classList.add('${reverseClass}'); target.classList.add('is-initially-hidden'); }`);
        } else if (reverseClass) {
          onMouseEnterStatements.push(`${targetQuery} target.classList.remove('${reverseClass}'); void target.offsetWidth; target.classList.add('${baseClass}'); }`);
          onMouseLeaveStatements.push(`${targetQuery} target.classList.remove('${baseClass}'); void target.offsetWidth; target.classList.add('${reverseClass}'); }`);
        } else {
          onMouseEnterStatements.push(`${targetQuery} target.classList.add('${baseClass}'); }`);
          onMouseLeaveStatements.push(`${targetQuery} target.classList.remove('${baseClass}'); }`);
        }
      } else if (trigger === 'focus') {
        if (isHidden) {
          onFocusStatements.push(`${targetQuery} target.classList.remove('${reverseClass}'); target.classList.remove('is-initially-hidden'); void target.offsetWidth; target.classList.add('${baseClass}'); }`);
          onBlurStatements.push(`${targetQuery} target.classList.remove('${baseClass}'); void target.offsetWidth; target.classList.add('${reverseClass}'); target.classList.add('is-initially-hidden'); }`);
        } else if (reverseClass) {
          onFocusStatements.push(`${targetQuery} target.classList.remove('${reverseClass}'); void target.offsetWidth; target.classList.add('${baseClass}'); }`);
          onBlurStatements.push(`${targetQuery} target.classList.remove('${baseClass}'); void target.offsetWidth; target.classList.add('${reverseClass}'); }`);
        } else {
          onFocusStatements.push(`${targetQuery} target.classList.add('${baseClass}'); }`);
          onBlurStatements.push(`${targetQuery} target.classList.remove('${baseClass}'); }`);
        }
      }
    });

    // 3. Self-triggered animation (if node itself has animation and is self-triggered)
    const selfAnim = node.animation && node.animation.type !== 'none' 
      ? node.animation 
      : (this.getRelatedNodes(node, allNodes).find(n => n.animation && n.animation.type !== 'none')?.animation);

    if (selfAnim && selfAnim.type !== 'none' && (!selfAnim.triggerNodeId || selfRelatedIds.has(selfAnim.triggerNodeId))) {
      const animType = selfAnim.type;
      const baseClass = this.getAnimBaseClass(animType);
      const isHidden = !!selfAnim.initiallyHidden;
      const reverseClass = this.getAnimReverseClass(animType, isHidden);
      if (baseClass) {
        const trigger = selfAnim.trigger || 'auto';
        const selfQuery = `const target = e.currentTarget.querySelector('[data-anim="true"]') || e.currentTarget;`;

        if (trigger === 'click' || trigger === 'dblclick') {
          const stmts = trigger === 'click' ? onClickStatements : onDblClickStatements;
          if (isHidden) {
            stmts.push(`${selfQuery} if (target.classList.contains('${baseClass}')) { target.classList.remove('${baseClass}'); void target.offsetWidth; target.classList.add('${reverseClass}'); target.classList.add('is-initially-hidden'); } else { target.classList.remove('${reverseClass}'); target.classList.remove('is-initially-hidden'); void target.offsetWidth; target.classList.add('${baseClass}'); }`);
          } else if (reverseClass) {
            stmts.push(`${selfQuery} if (target.classList.contains('${baseClass}')) { target.classList.remove('${baseClass}'); void target.offsetWidth; target.classList.add('${reverseClass}'); } else { target.classList.remove('${reverseClass}'); void target.offsetWidth; target.classList.add('${baseClass}'); }`);
          } else {
            stmts.push(`${selfQuery} if (target.classList.contains('${baseClass}')) { target.classList.remove('${baseClass}'); } else { void target.offsetWidth; target.classList.add('${baseClass}'); }`);
          }
        } else if (trigger === 'hover') {
          if (isHidden) {
            onMouseEnterStatements.push(`${selfQuery} target.classList.remove('${reverseClass}'); target.classList.remove('is-initially-hidden'); void target.offsetWidth; target.classList.add('${baseClass}');`);
            onMouseLeaveStatements.push(`${selfQuery} target.classList.remove('${baseClass}'); void target.offsetWidth; target.classList.add('${reverseClass}'); target.classList.add('is-initially-hidden');`);
          } else if (reverseClass) {
            onMouseEnterStatements.push(`${selfQuery} target.classList.remove('${reverseClass}'); void target.offsetWidth; target.classList.add('${baseClass}');`);
            onMouseLeaveStatements.push(`${selfQuery} target.classList.remove('${baseClass}'); void target.offsetWidth; target.classList.add('${reverseClass}');`);
          } else {
            onMouseEnterStatements.push(`${selfQuery} target.classList.add('${baseClass}');`);
            onMouseLeaveStatements.push(`${selfQuery} target.classList.remove('${baseClass}');`);
          }
        } else if (trigger === 'focus') {
          if (isHidden) {
            onFocusStatements.push(`${selfQuery} target.classList.remove('${reverseClass}'); target.classList.remove('is-initially-hidden'); void target.offsetWidth; target.classList.add('${baseClass}');`);
            onBlurStatements.push(`${selfQuery} target.classList.remove('${baseClass}'); void target.offsetWidth; target.classList.add('${reverseClass}'); target.classList.add('is-initially-hidden');`);
          } else if (reverseClass) {
            onFocusStatements.push(`${selfQuery} target.classList.remove('${reverseClass}'); void target.offsetWidth; target.classList.add('${baseClass}');`);
            onBlurStatements.push(`${selfQuery} target.classList.remove('${baseClass}'); void target.offsetWidth; target.classList.add('${reverseClass}');`);
          } else {
            onFocusStatements.push(`${selfQuery} target.classList.add('${baseClass}');`);
            onBlurStatements.push(`${selfQuery} target.classList.remove('${baseClass}');`);
          }
        } else if (trigger === 'scroll') {
          refProp = ` ref={(el) => { if (!el) return; const obs = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) { const target = el.querySelector('[data-anim="true"]') || el; target.classList.remove('${baseClass}'); void el.offsetWidth; target.classList.remove('is-initially-hidden'); target.classList.add('${baseClass}'); } }); obs.observe(el); }}`;
        }
      }
    }

    const formatStatements = (stmts: string[]) => stmts.map(s => `{ ${s} }`).join(' ');

    const handlerParts: string[] = [];

    if (onClickStatements.length > 0) {
      const isAsync = onClickStatements.some(s => s.includes('await '));
      handlerParts.push(`onClick={${isAsync ? 'async ' : ''}(e) => { ${formatStatements(onClickStatements)} }}`);
    }
    if (onDblClickStatements.length > 0) {
      const isAsync = onDblClickStatements.some(s => s.includes('await '));
      handlerParts.push(`onDoubleClick={${isAsync ? 'async ' : ''}(e) => { ${formatStatements(onDblClickStatements)} }}`);
    }
    if (onMouseEnterStatements.length > 0) {
      const isAsync = onMouseEnterStatements.some(s => s.includes('await '));
      handlerParts.push(`onMouseEnter={${isAsync ? 'async ' : ''}(e) => { ${formatStatements(onMouseEnterStatements)} }}`);
    }
    if (onMouseLeaveStatements.length > 0) {
      const isAsync = onMouseLeaveStatements.some(s => s.includes('await '));
      handlerParts.push(`onMouseLeave={${isAsync ? 'async ' : ''}(e) => { ${formatStatements(onMouseLeaveStatements)} }}`);
    }
    if (onFocusStatements.length > 0) {
      const isAsync = onFocusStatements.some(s => s.includes('await '));
      handlerParts.push(`tabIndex={0} onFocus={${isAsync ? 'async ' : ''}(e) => { ${formatStatements(onFocusStatements)} }}`);
    }
    if (onBlurStatements.length > 0) {
      const isAsync = onBlurStatements.some(s => s.includes('await '));
      handlerParts.push(`onBlur={${isAsync ? 'async ' : ''}(e) => { ${formatStatements(onBlurStatements)} }}`);
    }
    if (onChangeStatements.length > 0) {
      const isAsync = onChangeStatements.some(s => s.includes('await '));
      handlerParts.push(`onChange={${isAsync ? 'async ' : ''}(e) => { ${formatStatements(onChangeStatements)} }}`);
    }
    if (onSubmitStatements.length > 0) {
      const isAsync = onSubmitStatements.some(s => s.includes('await '));
      handlerParts.push(`onSubmit={${isAsync ? 'async ' : ''}(e) => { e.preventDefault(); ${formatStatements(onSubmitStatements)} }}`);
    } else if (node.type === 'FormContainer') {
      handlerParts.push(`onSubmit={(e) => { e.preventDefault(); }}`);
    }
    if (refProp) {
      handlerParts.push(refProp.trim());
    }

    if (handlerParts.length === 0) return '';
    return ' ' + handlerParts.join(' ');
  }


  private static generateNodeAnimationStyles(node: CanvasNode, parentNode?: CanvasNode): string {
    if (!node.animation || node.animation.type === 'none') return '';
    const animDur = node.animation.duration || 1000;
    const animType = node.animation.type;
    const isContinuous = animType === 'spin' || animType === 'pulse' || animType === 'bounce';
    const isInf = !!node.animation.infinite;

    const styleProps: string[] = [];
    styleProps.push(`animationDuration: '${animDur}ms'`);

    const x = node.x || 0;
    const y = node.y || 0;
    const startDist = node.animation.startDistance ?? node.animation.distance ?? 50;
    const endDist = node.animation.endDistance ?? 0;

    const parentW = parentNode?.width || 393;
    const parentH = parentNode?.height || 852;
    const width = node.width || 0;
    const height = node.height || 0;

    const isOutsideBottom = y >= parentH - height || y >= parentH - 20;
    const isOutsideTop = y < 0;
    const isOutsideRight = x >= parentW - width || x >= parentW - 20;
    const isOutsideLeft = x < 0;

    const fromEdge = node.animation.fromEdge ?? false;
    let slideStart = startDist;
    let slideEnd = endDist;

    if (fromEdge) {
      if (animType === 'slide-up') slideStart = Math.max(startDist, parentH - y + 20);
      else if (animType === 'slide-down') slideStart = Math.max(startDist, y + height + 20);
      else if (animType === 'slide-left') slideStart = Math.max(startDist, parentW - x + 20);
      else if (animType === 'slide-right') slideStart = Math.max(startDist, x + width + 20);
    } else {
      if (animType === 'slide-up' && isOutsideBottom) {
        slideEnd = Math.round(y - (parentH - height - endDist));
      } else if (animType === 'slide-down' && isOutsideTop) {
        slideEnd = Math.round((0 + endDist) - y);
      } else if (animType === 'slide-left' && isOutsideRight) {
        slideEnd = Math.round(x - (parentW - width - endDist));
      } else if (animType === 'slide-right' && isOutsideLeft) {
        slideEnd = Math.round((0 + endDist) - x);
      }
    }

    styleProps.push(`'--slide-start': '${slideStart}px'`);
    styleProps.push(`'--slide-dist': '${slideStart}px'`);
    styleProps.push(`'--slide-end': '${slideEnd}px'`);
    if (node.animation.scale !== undefined) {
      styleProps.push(`'--pulse-scale': '${node.animation.scale}'`);
    }
    if (node.animation.degrees !== undefined) {
      styleProps.push(`'--spin-deg': '${node.animation.degrees}deg'`);
    }
    if (node.animation.startOpacity !== undefined) {
      styleProps.push(`'--fade-start': '${node.animation.startOpacity / 100}'`);
    } else if (!node.animation.initiallyHidden) {
      styleProps.push(`'--fade-start': '1'`);
    }

    if (isInf) {
      styleProps.push(`animationIterationCount: 'infinite'`);
    } else {
      const count = (animType === 'bounce' && node.animation.bounceCount) ? node.animation.bounceCount : 1;
      styleProps.push(`animationIterationCount: ${count}`);
      styleProps.push(`animationFillMode: 'forwards'`);
    }

    return ` style={{ ${styleProps.join(', ')} }}`;
  }

  private static generateNodePositionStyles(node: CanvasNode, isRoot: boolean = false, parentNode?: CanvasNode, extraStyles: string[] = [], offset?: { x: number; y: number }): string {
    if (isRoot) return '';
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

    if (offset) {
      cssX -= offset.x;
      cssY -= offset.y;
    } else if (parentNode) {
      if (cssX >= (parentNode.width || 0) && cssX >= (parentNode.x || 0)) {
        cssX -= (parentNode.x || 0);
      }
      if (cssY >= (parentNode.height || 0) && cssY >= (parentNode.y || 0)) {
        cssY -= (parentNode.y || 0);
      }
    }

    let nodeW = node.width;
    let nodeH = node.height;

    if ((node.type === 'Circle' || node.type === 'Triangle') && node.radius) {
      nodeW = node.radius * 2 * scaleX;
      nodeH = node.radius * 2 * scaleY;
      cssX -= node.radius * scaleX;
      cssY -= node.radius * scaleY;
    }

    if (parentNode && !offset) {
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

    const styles: string[] = ["position: 'absolute'"];
    const transforms: string[] = [];

    // Horizontal position
    if (isFullWidth) {
      styles.push("left: '0px'");
    } else if (isCenterX) {
      styles.push("left: '50%'");
      transforms.push('translateX(-50%)');
    } else if (isTouchRight) {
      styles.push("right: '0px'");
    } else {
      styles.push(`left: '${round(cssX)}px'`);
    }

    // Vertical position
    if (isFullHeight) {
      styles.push("top: '0px'");
    } else if (isCenterY) {
      styles.push("top: '50%'");
      transforms.push('translateY(-50%)');
    } else if (isTouchBottom) {
      styles.push("bottom: '0px'");
    } else {
      styles.push(`top: '${round(cssY)}px'`);
    }

    // Width & Height
    if (node.type === 'Circle' || node.type === 'Triangle') {
      if (node.radius) {
        styles.push(`width: '${round(node.radius * 2 * scaleX)}px'`);
        styles.push(`height: '${round(node.radius * 2 * scaleY)}px'`);
      }
    } else if (node.type === 'Line') {
      let lineW = node.width;
      if (node.points && node.points.length >= 4) {
        const dx = node.points[2] - node.points[0];
        const dy = node.points[3] - node.points[1];
        lineW = Math.sqrt(dx * dx + dy * dy);
      }
      styles.push(`width: '${round(lineW || 0)}px'`);
    } else {
      if (isFullWidth) {
        styles.push("width: '100%'");
      } else if (node.width) {
        if (node.repeaterBinding && node.repeaterBinding.direction === 'horizontal') {
          styles.push("width: 'auto'");
          styles.push(`minWidth: '${round(node.width)}px'`);
        } else {
          styles.push(`width: '${round(node.width)}px'`);
        }
      }
      
      if (isFullHeight) {
        styles.push("height: '100%'");
      } else if (node.height) {
        if (node.repeaterBinding && (node.repeaterBinding.direction || 'vertical') === 'vertical') {
          styles.push("height: 'auto'");
          styles.push(`minHeight: '${round(node.height)}px'`);
        } else {
          styles.push(`height: '${round(node.height)}px'`);
        }
      }
    }

    // Rotation
    let lineRot = 0;
    if (node.type === 'Line' && node.points && node.points.length >= 4) {
      const dx = node.points[2] - node.points[0];
      const dy = node.points[3] - node.points[1];
      lineRot = Math.atan2(dy, dx) * (180 / Math.PI);
    }
    const rot = node.rotation || lineRot;
    if (rot) {
      transforms.push(`rotate(${round(rot)}deg)`);
      if (node.type !== 'Circle' && node.type !== 'Triangle') {
        styles.push("transformOrigin: 'top left'");
      }
    }

    if (transforms.length > 0) {
      styles.push(`transform: '${transforms.join(' ')}'`);
    }

    // Frame overflow clipping
    if (node.type === 'Frame') {
      if (node.repeaterBinding) {
        styles.push("overflow: 'visible'");
      } else {
        styles.push("overflow: 'hidden'");
      }
    }

    if (extraStyles.length > 0) {
      styles.push(...extraStyles);
    }

    return ` style={{ ${styles.join(', ')} }}`;
  }

  private static generateNodePositionClasses(node: CanvasNode, isRoot: boolean = false, parentNode?: CanvasNode): string {
    return '';
  }

  private static generateNodeStyleClasses(node: CanvasNode, isRoot: boolean = false, parentNode?: CanvasNode): string {
    const classes: string[] = [];
    const round = (val: number) => Math.round(val);
    
    if (node.fill) classes.push(`bg-[${node.fill.replace(/\s+/g, '')}]`);
    
    if (node.stroke && node.type !== 'Line') {
      classes.push(`border-[${node.stroke.replace(/\s+/g, '')}]`);
      if (node.strokeWidth) {
        classes.push(`border-[${round(node.strokeWidth)}px]`);
      } else {
        classes.push('border-[1px]');
      }
    }
    
    if (node.type === 'Line') {
      classes.push(`border-t-[${round(node.strokeWidth || 1)}px]`);
      classes.push(`border-[${(node.stroke || '#000000').replace(/\s+/g, '')}]`);
    }
    
    if (node.type === 'Circle') {
      classes.push('rounded-full');
    } else if (node.type === 'Triangle') {
      classes.push('clip-path-triangle');
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
        classes.push(`text-[${node.fill.replace(/\s+/g, '')}]`);
      }
      if (node.fontFamily) {
        const fam = node.fontFamily.toLowerCase().replace(/['"\s]+/g, '-');
        if (fam.includes('space')) {
          classes.push('font-space-grotesk');
        } else if (fam.includes('mono') || fam.includes('jetbrains')) {
          classes.push('font-jetbrains-mono');
        } else {
          classes.push('font-inter');
        }
      }
      if (node.fontWeight) {
        classes.push(`font-[${node.fontWeight}]`);
      }
      if (node.textAlign) {
        classes.push(`text-${node.textAlign}`);
      }
      classes.push('leading-none');
      classes.push('whitespace-nowrap');
    }

    // Effects
    if (node.opacity !== undefined && node.opacity < 100) {
      const opVal = Math.round(node.opacity) / 100;
      classes.push(`opacity-[${opVal}]`);
    }

    if (node.boxShadow?.enabled) {
      const s = node.boxShadow;
      const col = (s.color || 'rgba(0,0,0,0.25)').replace(/\s+/g, '');
      const sx = s.x ?? 0;
      const sy = s.y ?? 4;

      if (node.type === 'Text' || node.type === 'Triangle') {
        classes.push(`drop-shadow-[${sx}px_${sy}px_${s.blur ?? 10}px_${col}]`);
      } else {
        classes.push(`shadow-[${sx}px_${sy}px_${s.blur ?? 10}px_${s.spread ?? 0}px_${col}]`);
      }
    }

    if (node.filterBlur && node.filterBlur > 0) {
      classes.push(`blur-[${round(node.filterBlur)}px]`);
    }

    // Transitions & Hover Effects
    if (node.hoverEffect && node.hoverEffect !== 'none') {
      classes.push('transition-all');
      const dur = node.transitionDuration || 300;
      classes.push(`duration-[${dur}ms]`);

      const timing = node.transitionTimingFunction || 'ease';
      if (timing === 'linear') classes.push('ease-linear');
      else if (timing === 'ease-in') classes.push('ease-in');
      else if (timing === 'ease-out') classes.push('ease-out');
      else if (timing === 'ease-in-out') classes.push('ease-in-out');

      switch (node.hoverEffect) {
        case 'scale-up':
          classes.push('hover:scale-105');
          break;
        case 'scale-down':
          classes.push('hover:scale-95');
          break;
        case 'lift':
          classes.push('hover:-translate-y-1.5', 'hover:shadow-xl');
          break;
        case 'glow':
          const glowCol = (node.fill || '#4A3AFF').replace(/\s+/g, '');
          classes.push(`hover:shadow-[0_0_20px_${glowCol}]`);
          break;
        case 'darken':
          classes.push('hover:brightness-75');
          break;
        case 'brighten':
          classes.push('hover:brightness-125');
          break;
      }
    }

    return classes.join(' ');
  }

  private static generateNodeTailwindClasses(node: CanvasNode, isRoot: boolean = false, parentNode?: CanvasNode): string {
    const pos = this.generateNodePositionClasses(node, isRoot, parentNode);
    const style = this.generateNodeStyleClasses(node, isRoot, parentNode);
    const anim = this.generateNodeAnimationClasses(node);
    return [pos, style, anim].filter(Boolean).join(' ');
  }

  private static resolveBoundProps(node: CanvasNode, isMasterComponentDef: boolean): Record<string, { expression: string; defaultValue: string }> {
    const dynamicProps: Record<string, { expression: string; defaultValue: string }> = {};
    if (isMasterComponentDef && node.boundProps) {
      Object.keys(node.boundProps).forEach(field => {
        const propId = node.boundProps![field];
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

  private static getRouteForTarget(
    targetId: string, 
    pageRouteMap: { frameId: string; route: string; componentName: string }[],
    nodesById?: Record<string, CanvasNode>
  ): string {
    if (!targetId) return '/';
    
    // 1. Direct match on frameId
    let match = pageRouteMap.find(p => p.frameId === targetId);
    if (match) return match.route;

    // 2. Check if targetId belongs to a node inside a root frame
    if (nodesById && nodesById[targetId]) {
      let curr: CanvasNode | undefined = nodesById[targetId];
      if (curr.variantOf) {
        match = pageRouteMap.find(p => p.frameId === curr!.variantOf);
        if (match) return match.route;
      }
      while (curr && curr.parentId) {
        curr = nodesById[curr.parentId];
      }
      if (curr) {
        match = pageRouteMap.find(p => p.frameId === curr.id);
        if (match) return match.route;
      }
    }

    // 3. Match componentName or route slug
    const cleanTarget = targetId.toLowerCase().replace(/[^a-z0-9]/g, '');
    match = pageRouteMap.find(p => p.componentName.toLowerCase().replace(/[^a-z0-9]/g, '') === cleanTarget);
    if (match) return match.route;

    match = pageRouteMap.find(p => p.route.toLowerCase().replace(/[^a-z0-9]/g, '') === cleanTarget);
    if (match) return match.route;

    if (targetId === 'virtual_root_page') return '/';
    
    // Fallback: If pageRouteMap has items, return match by index or default page route
    if (pageRouteMap.length > 0) {
      const numMatch = targetId.match(/\d+/);
      if (numMatch) {
        const pageIdx = parseInt(numMatch[0], 10) - 1;
        if (pageIdx >= 0 && pageIdx < pageRouteMap.length) {
          return pageRouteMap[pageIdx].route;
        }
      }
      return pageRouteMap[0].route;
    }

    return targetId.startsWith('/') ? targetId : `/${targetId}`;
  }

  private static generateFrameChildrenJsx(
    frame: CanvasNode,
    allNodes: CanvasNode[],
    nodesById: Record<string, CanvasNode>,
    masterComponents: CanvasNode[],
    isMasterComponentDef: boolean,
    pages: CanvasNode[],
    pageRouteMap: { frameId: string; route: string; componentName: string }[],
    stateVariables: StateVariable[],
    indent: string = '        ',
    dataSources: DataSource[] = []
  ): string {
    const children = allNodes.filter(n => n.parentId === frame.id);

    if (!frame.repeaterBinding) {
      return children.map(child => this.generateJsxForNode(child, allNodes, nodesById, masterComponents, isMasterComponentDef, frame, pages, pageRouteMap, stateVariables, undefined, dataSources)).join(`\n${indent}`);
    }

    const repeatedChildren = children.filter(c => !c.excludeFromRepeater);
    const staticChildren = children.filter(c => c.excludeFromRepeater);

    const rawStaticJsx = staticChildren.map(child => this.generateJsxForNode(child, allNodes, nodesById, masterComponents, isMasterComponentDef, frame, pages, pageRouteMap, stateVariables, undefined, dataSources)).join(`\n${indent}`);

    const itemName = frame.repeaterBinding.itemName || 'item';
    const varId = frame.repeaterBinding.arrayVariableId;
    const stateVar = stateVariables.find(v => v.id === varId || v.name === varId);
    const arrayVarName = stateVar ? stateVar.name : (varId && !varId.startsWith('var-') ? varId : 'items');
    const isHorizontal = frame.repeaterBinding.direction === 'horizontal';
    const flexDir = isHorizontal ? 'flex-row overflow-x-auto' : 'flex-col';
    const gapPx = frame.repeaterBinding.gap ?? 16;

    const targetForBounds = repeatedChildren.length > 0 ? repeatedChildren : children;

    const minX = targetForBounds.length > 0 ? Math.min(...targetForBounds.map(c => c.x || 0)) : 0;
    const minY = targetForBounds.length > 0 ? Math.min(...targetForBounds.map(c => c.y || 0)) : 0;

    let itemH = 0;
    let itemW = 0;
    if (targetForBounds.length > 0) {
      const childrenMaxY = Math.max(...targetForBounds.map(c => (c.y || 0) + (c.height || (c.fontSize ? c.fontSize * 1.3 : 24))));
      itemH = Math.max(10, Math.round(childrenMaxY - minY));
      const childrenMaxX = Math.max(...targetForBounds.map(c => (c.x || 0) + (c.width || 100)));
      itemW = Math.max(10, Math.round(childrenMaxX - minX));
    } else {
      itemH = Math.round(frame.height || 100);
      itemW = Math.round(frame.width || 200);
    }

    const rawRepeatedJsx = repeatedChildren.map(child => this.generateJsxForNode(child, allNodes, nodesById, masterComponents, isMasterComponentDef, frame, pages, pageRouteMap, stateVariables, { x: minX, y: minY }, dataSources)).join(`\n${indent}    `);

    const staticContentJsx = rawStaticJsx ? `${rawStaticJsx}\n${indent}` : '';

    return `${staticContentJsx}<div className="flex ${flexDir} gap-[${gapPx}px] pointer-events-none" style={{ position: 'absolute', left: '${minX}px', top: '${minY}px' }}>
${indent}  {(${arrayVarName} || []).map((${itemName}, index) => (
${indent}    <div key={index} className="relative shrink-0 pointer-events-none" style={{ width: '${itemW}px', height: '${itemH}px' }}>
${indent}      ${rawRepeatedJsx}
${indent}    </div>
${indent}  ))}
${indent}</div>`;
  }

  private static generateJsxForNode(
    node: CanvasNode, 
    allNodes: CanvasNode[], 
    nodesById: Record<string, CanvasNode>, 
    masterComponents: CanvasNode[], 
    isMasterComponentDef: boolean = false, 
    parentNode?: CanvasNode,
    pages: CanvasNode[] = [],
    pageRouteMap: { frameId: string; route: string; componentName: string }[] = [],
    stateVariables: StateVariable[] = [],
    offset?: { x: number; y: number },
    dataSources: DataSource[] = []
  ): string {
    const round = (val: number) => Math.round(val);

    let targetLinkId = '';
    if (!isMasterComponentDef) {
      targetLinkId = node.linkTo || '';
      if (!targetLinkId && (node.componentId || node.isMasterComponent)) {
        const childWithLink = allNodes.find(c => c.parentId === node.id && c.linkTo);
        if (childWithLink && childWithLink.linkTo) {
          targetLinkId = childWithLink.linkTo;
        }
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

      if (targetLinkId && parentNode && parentNode.id === targetLinkId) {
        targetLinkId = '';
      }
    }

    const targetRoute = targetLinkId ? this.getRouteForTarget(targetLinkId, pageRouteMap, nodesById) : '';

    if (node.componentId || (node.isMasterComponent && !isMasterComponentDef)) {
      const master = masterComponents.find(m => m.id === (node.componentId || node.id)) || node;
      const compName = this.getComponentName(master);

      let propsStr = '';
      (stateVariables || []).forEach(sv => {
        const cleanName = this.sanitizeVarName(sv.name);
        const setter = `set${cleanName.charAt(0).toUpperCase() + cleanName.slice(1)}`;
        propsStr += ` ${cleanName}={${cleanName}} ${setter}={${setter}}`;
      });
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

      const nodeRelated = this.getRelatedNodes(node, allNodes);
      const nodeRelatedIds = this.getRelatedNodeIds(node, allNodes);
      const isTriggerSource = allNodes.some(n => {
        const anim = n.animation;
        if (!anim || anim.type === 'none' || !anim.triggerNodeId) return false;
        return nodeRelatedIds.has(anim.triggerNodeId) && !nodeRelatedIds.has(n.id);
      });
      const hasActions = nodeRelated.some(n => n.actionSequences && n.actionSequences.length > 0);
      const isInteractive = !!(targetRoute || isTriggerSource || hasActions);
      const posExtraStyles: string[] = isInteractive ? ["zIndex: 10"] : [];

      const posStyleStr = this.generateNodePositionStyles(node, false, parentNode, posExtraStyles, offset);
      const animClasses = this.generateNodeAnimationClasses(node, allNodes);
      const animStyleStr = this.generateNodeAnimationStyles(node, parentNode);
      const eventHandlers = this.generateNodeEventHandlers(node, allNodes, pageRouteMap, stateVariables, dataSources);

      const cursorClass = isInteractive ? ' cursor-pointer z-10 pointer-events-auto' : ' pointer-events-auto';
      const elemIdAttr = ` id="node-${node.id}" data-node-id="${node.sourceNodeId || node.id}"`;

      let scaleStyleStr = '';
      let sx = node.scaleX !== undefined ? node.scaleX : 1;
      let sy = node.scaleY !== undefined ? node.scaleY : 1;
      
      if (node.width !== undefined && master.width) {
        sx *= (node.width / master.width);
      }
      if (node.height !== undefined && master.height) {
        sy *= (node.height / master.height);
      }

      if (Math.abs(sx - 1) > 0.01 || Math.abs(sy - 1) > 0.01) {
        scaleStyleStr = ` style={{ transform: 'scale(${sx}, ${sy})', transformOrigin: 'top left' }}`;
      }

      const innerClasses = `relative w-full h-full ${animClasses}`.trim();
      const animAttrStr = `${animStyleStr}`;

      if (targetRoute) {
        return `<Link${elemIdAttr} to="${targetRoute}" className="${cursorClass.trim()} block"${posStyleStr}${eventHandlers}>
      <div data-anim="true" className="${innerClasses}"${animAttrStr}>
        <div${scaleStyleStr}>
          <${compName}${propsStr} />
        </div>
      </div>
    </Link>`;
      }
      return `<div${elemIdAttr} className="${cursorClass.trim()}"${posStyleStr}${eventHandlers}>
      <div data-anim="true" className="${innerClasses}"${animAttrStr}>
        <div${scaleStyleStr}>
          <${compName}${propsStr} />
        </div>
      </div>
    </div>`;
    }

    const nodeRelated = this.getRelatedNodes(node, allNodes);
    const nodeRelatedIds = this.getRelatedNodeIds(node, allNodes);
    const isTriggerSource = allNodes.some(n => {
      const anim = n.animation;
      if (!anim || anim.type === 'none' || !anim.triggerNodeId) return false;
      return nodeRelatedIds.has(anim.triggerNodeId) && !nodeRelatedIds.has(n.id);
    });
    const hasActions = nodeRelated.some(n => n.actionSequences && n.actionSequences.length > 0);
    const isFormInput = node.type === 'TextInput' || node.type === 'TextArea' || node.type === 'Checkbox' || node.type === 'Switch' || node.type === 'SelectDropdown';
    const isInteractive = !!(targetRoute || isTriggerSource || hasActions || isFormInput);
    const posExtraStyles: string[] = isInteractive ? ["zIndex: 10"] : [];

    const posStyleStr = this.generateNodePositionStyles(node, false, parentNode, posExtraStyles, offset);
    let styleClasses = this.generateNodeStyleClasses(node, false, parentNode);
    const animClasses = this.generateNodeAnimationClasses(node, allNodes);
    const animStyleStr = this.generateNodeAnimationStyles(node, parentNode);
    const eventHandlers = this.generateNodeEventHandlers(node, allNodes, pageRouteMap, stateVariables, dataSources);

    const cursorClass = (targetRoute || isTriggerSource || hasActions) ? ' cursor-pointer z-10 pointer-events-auto' : (isInteractive ? ' z-10 pointer-events-auto' : ' pointer-events-auto');
    const elemIdAttr = ` id="node-${node.id}" data-node-id="${node.sourceNodeId || node.id}"`;

    const dynamicProps = this.resolveBoundProps(node, isMasterComponentDef);
    
    let fillStyle = '';
    if ((dynamicProps.fill || node.bindings?.fill) && node.type !== 'Text') {
      styleClasses = styleClasses.replace(/bg-\[[^\]]+\]/g, '');
      const rawExpr = node.bindings?.fill ? this.resolveBindingExpr(node.bindings.fill, stateVariables) : (dynamicProps.fill?.expression || `'${node.fill || '#000000'}'`);
      const activeCol = node.fill || '#4A3AFF';
      fillStyle = ` style={{ backgroundColor: typeof ${rawExpr} === 'boolean' ? (${rawExpr} ? '${activeCol}' : 'transparent') : (${rawExpr} || '${dynamicProps.fill?.defaultValue || node.fill || '#000000'}') }}`;
    }
    let textColorStyle = '';
    if ((dynamicProps.fill || node.bindings?.fill) && node.type === 'Text') {
      styleClasses = styleClasses.replace(/text-\[#[^\]]+\]/g, '');
      const rawExpr = node.bindings?.fill ? this.resolveBindingExpr(node.bindings.fill, stateVariables) : (dynamicProps.fill?.expression || `'${node.fill || '#000000'}'`);
      const activeCol = node.fill || '#000000';
      textColorStyle = ` style={{ color: typeof ${rawExpr} === 'boolean' ? (${rawExpr} ? '${activeCol}' : '#64748b') : (${rawExpr} || '${dynamicProps.fill?.defaultValue || node.fill || '#000000'}') }}`;
    }

    const inlineStyle = fillStyle || textColorStyle || '';

    let innerContent = '';

    if (node.type === 'TextInput') {
      const extraStyles: string[] = isInteractive ? ["zIndex: 10"] : [];
      if (node.fill) extraStyles.push(`backgroundColor: '${node.fill}'`);
      if (node.stroke) extraStyles.push(`borderColor: '${node.stroke}'`);
      const inputStyleStr = this.generateNodePositionStyles(node, false, parentNode, extraStyles, offset);
      const boundPlaceholder = node.bindings?.placeholder ? this.resolveBindingExpr(node.bindings.placeholder, stateVariables) : null;
      const placeholderVal = boundPlaceholder ? `{${boundPlaceholder} ?? "${node.placeholder || ''}"}` : (node.placeholder ? `"${node.placeholder}"` : '""');
      const rawDefault = node.bindings?.defaultValue || node.bindings?.text;
      const boundDefault = rawDefault ? this.resolveBindingExpr(rawDefault, stateVariables) : null;
      const defaultVal = boundDefault ? `{${boundDefault} ?? "${node.defaultValue || ''}"}` : (node.defaultValue ? `"${node.defaultValue}"` : '""');
      const inputType = node.inputType || 'text';
      return `<input${elemIdAttr} type="${inputType}" placeholder=${placeholderVal} defaultValue=${defaultVal}${inputStyleStr}${eventHandlers} className="px-3 py-2 border rounded-md font-sans text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800" />`;
    } else if (node.type === 'TextArea') {
      const extraStyles: string[] = isInteractive ? ["zIndex: 10"] : [];
      if (node.fill) extraStyles.push(`backgroundColor: '${node.fill}'`);
      if (node.stroke) extraStyles.push(`borderColor: '${node.stroke}'`);
      const inputStyleStr = this.generateNodePositionStyles(node, false, parentNode, extraStyles, offset);
      const boundPlaceholder = node.bindings?.placeholder ? this.resolveBindingExpr(node.bindings.placeholder, stateVariables) : null;
      const placeholderVal = boundPlaceholder ? `{${boundPlaceholder} ?? "${node.placeholder || ''}"}` : (node.placeholder ? `"${node.placeholder}"` : '""');
      const rawDefault = node.bindings?.defaultValue || node.bindings?.text;
      const boundDefault = rawDefault ? this.resolveBindingExpr(rawDefault, stateVariables) : null;
      const defaultVal = boundDefault ? `{${boundDefault} ?? "${node.defaultValue || ''}"}` : (node.defaultValue ? `"${node.defaultValue}"` : '""');
      return `<textarea${elemIdAttr} placeholder=${placeholderVal} defaultValue=${defaultVal}${inputStyleStr}${eventHandlers} className="px-3 py-2 border rounded-md font-sans text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800" />`;
    } else if (node.type === 'Checkbox') {
      const rawChecked = node.bindings?.defaultChecked || node.bindings?.checked;
      const boundChecked = rawChecked ? this.resolveBindingExpr(rawChecked, stateVariables) : null;
      const isCheckedAttr = boundChecked ? ` defaultChecked={!!(${boundChecked})}` : (node.defaultChecked ? ' defaultChecked' : '');
      const boundText = node.bindings?.text ? this.resolveBindingExpr(node.bindings.text, stateVariables) : null;
      const labelText = boundText ? `{${boundText} ?? "${node.text || 'Checkbox'}"}` : (node.text || 'Checkbox');
      return `<label${elemIdAttr}${posStyleStr}${eventHandlers} className="inline-flex items-center gap-2 cursor-pointer text-sm font-medium text-slate-700 select-none whitespace-nowrap">
        <input type="checkbox"${isCheckedAttr} className="w-4 h-4 text-[#4A3AFF] rounded border-slate-300 focus:ring-indigo-500 cursor-pointer" />
        <span>${labelText}</span>
      </label>`;
    } else if (node.type === 'Switch') {
      const rawChecked = node.bindings?.defaultChecked || node.bindings?.checked;
      const boundChecked = rawChecked ? this.resolveBindingExpr(rawChecked, stateVariables) : null;
      const isCheckedAttr = boundChecked ? ` defaultChecked={!!(${boundChecked})}` : (node.defaultChecked ? ' defaultChecked' : '');
      const boundText = node.bindings?.text ? this.resolveBindingExpr(node.bindings.text, stateVariables) : null;
      const labelText = boundText ? `{${boundText} ?? "${node.text || 'Toggle'}"}` : (node.text || 'Toggle');
      return `<label${elemIdAttr}${posStyleStr}${eventHandlers} className="inline-flex items-center cursor-pointer select-none whitespace-nowrap">
        <input type="checkbox"${isCheckedAttr} className="sr-only peer" />
        <div className="w-10 h-5 bg-slate-300 peer-checked:bg-[#4A3AFF] peer-checked:[&>div]:translate-x-5 rounded-full p-0.5 transition-colors duration-200 flex items-center shrink-0">
          <div className="w-4 h-4 bg-white rounded-full shadow-md transform transition-transform duration-200" />
        </div>
        <span className="ml-2 text-sm font-medium text-slate-700 whitespace-nowrap">${labelText}</span>
      </label>`;
    } else if (node.type === 'SelectDropdown') {
      const extraStyles: string[] = isInteractive ? ["zIndex: 10"] : [];
      if (node.fill) extraStyles.push(`backgroundColor: '${node.fill}'`);
      if (node.stroke) extraStyles.push(`borderColor: '${node.stroke}'`);
      const inputStyleStr = this.generateNodePositionStyles(node, false, parentNode, extraStyles, offset);
      const placeholderOpt = node.placeholder ? `<option value="" disabled>${node.placeholder}</option>` : '';
      const defaultValAttr = node.defaultValue ? ` defaultValue="${node.defaultValue}"` : '';
      const optionsHtml = (node.options || ['Option 1', 'Option 2']).map(opt => `<option value="${opt}">${opt}</option>`).join('\n          ');
      return `<select${elemIdAttr}${defaultValAttr}${inputStyleStr}${eventHandlers} className="px-3 py-2 border rounded-md font-sans text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer text-slate-800">
        ${placeholderOpt}
        ${optionsHtml}
      </select>`;
    } else if (node.type === 'FormContainer') {
      const extraStyles: string[] = isInteractive ? ["zIndex: 10"] : [];
      if (node.fill) extraStyles.push(`backgroundColor: '${node.fill}'`);
      if (node.stroke) extraStyles.push(`borderColor: '${node.stroke}'`);
      const inputStyleStr = this.generateNodePositionStyles(node, false, parentNode, extraStyles, offset);
      const children = allNodes.filter(n => n.parentId === node.id);
      const innerContent = children.map(child => this.generateJsxForNode(child, allNodes, nodesById, masterComponents, isMasterComponentDef, node, pages, pageRouteMap, stateVariables, undefined, dataSources)).join('\n      ');
      return `<form${elemIdAttr}${inputStyleStr}${eventHandlers} className="p-4 border border-dashed rounded-lg relative">
        ${innerContent}
      </form>`;
    }

    if (node.type === 'Frame') {
      innerContent = this.generateFrameChildrenJsx(node, allNodes, nodesById, masterComponents, isMasterComponentDef, pages, pageRouteMap, stateVariables, '      ', dataSources);
    } else if (node.type === 'Text') {
      const boundExpr = node.bindings?.text || (nodeRelated.find(n => n.bindings?.text)?.bindings?.text);
      const boundText = boundExpr ? this.resolveBindingExpr(boundExpr, stateVariables) : null;
      let fallbackText = (node.text && node.text.trim() !== '') ? node.text : '';
      if (fallbackText === '""' || fallbackText === "''") fallbackText = '';
      if (boundText) {
        innerContent = `{typeof ${boundText} === 'boolean' ? String(${boundText}) : (typeof ${boundText} === 'object' && ${boundText} !== null ? (Array.isArray(${boundText}) ? \`[\${${boundText}.length} items]\` : JSON.stringify(${boundText})) : (${boundText} ?? "${fallbackText}"))}`;
      } else {
        let textVal = node.text || '';
        if (textVal === '""' || textVal === "''") textVal = '';
        innerContent = dynamicProps.text 
          ? `{typeof ${dynamicProps.text.expression} === 'boolean' ? String(${dynamicProps.text.expression}) : (${dynamicProps.text.expression} || "${dynamicProps.text.defaultValue}")}` 
          : textVal;
      }
    } else if (node.type === 'Image') {
      const boundSrc = node.bindings?.src || (nodeRelated.find(n => n.bindings?.src)?.bindings?.src);
      const resolvedSrc = boundSrc ? this.resolveBindingExpr(boundSrc, stateVariables) : null;
      const imgSrc = resolvedSrc
        ? `{${resolvedSrc} || "${node.src || ''}"}`
        : (dynamicProps.src 
            ? `{${dynamicProps.src.expression} || "${dynamicProps.src.defaultValue}"}`
            : `"${node.src || ''}"`);
      innerContent = `<img src=${imgSrc} className="w-full h-full object-cover" alt="image" />`;
    }

    const nonFrameChildren = allNodes.filter(n => n.parentId === node.id);
    if (node.type !== 'Frame' && nonFrameChildren.length > 0) {
      const childrenJsx = nonFrameChildren.map(child => this.generateJsxForNode(child, allNodes, nodesById, masterComponents, isMasterComponentDef, node, pages, pageRouteMap, stateVariables, undefined, dataSources)).join('\n        ');
      innerContent = innerContent ? `${childrenJsx}\n        ${innerContent}` : childrenJsx;
    }

    const animAttrStr = `${animStyleStr}${inlineStyle}`;
    const innerClasses = `relative w-full h-full ${styleClasses} ${animClasses}`.trim();

    if (targetRoute) {
      return `<Link${elemIdAttr} to="${targetRoute}" className="${cursorClass.trim()} block"${posStyleStr}${eventHandlers}>
      <div data-anim="true" className="${innerClasses}"${animAttrStr}>
        ${innerContent}
      </div>
    </Link>`;
    }

    return `<div${elemIdAttr} className="${cursorClass.trim()}"${posStyleStr}${eventHandlers}>
      <div data-anim="true" className="${innerClasses}"${animAttrStr}>
        ${innerContent}
      </div>
    </div>`;
  }

  private static getDescendants(nodeId: string, allNodes: CanvasNode[]): CanvasNode[] {
    const descendants: CanvasNode[] = [];
    const queue = [nodeId];
    while (queue.length > 0) {
      const parentId = queue.shift()!;
      const children = allNodes.filter(n => n.parentId === parentId);
      descendants.push(...children);
      children.forEach(c => queue.push(c.id));
    }
    return descendants;
  }

  private static generateComponentCode(
    comp: CanvasNode, 
    allNodes: CanvasNode[], 
    nodesById: Record<string, CanvasNode>,
    pages: CanvasNode[] = [],
    pageRouteMap: { frameId: string; route: string; componentName: string }[] = [],
    stateVariables: StateVariable[] = [],
    masterComponents: CanvasNode[] = [],
    dataSources: DataSource[] = []
  ): string {
    const componentName = this.getComponentName(comp);
    const compDescendants = [comp, ...this.getDescendants(comp.id, allNodes)];
    
    // Find nested master component instances used inside this component
    const instancesUsed = new Set<string>();
    compDescendants.forEach(node => {
      if (node.id !== comp.id && node.componentId) {
        const master = masterComponents.find(m => m.id === node.componentId);
        if (master) {
          const childCompName = this.getComponentName(master);
          if (childCompName !== componentName) {
            instancesUsed.add(childCompName);
          }
        }
      }
    });

    const compImports = Array.from(instancesUsed).map(name => `import ${name} from './${name}';`).join('\n');

    // Check if any descendant has linkTo
    const hasLink = compDescendants.some(n => n.linkTo);

    // Check if any descendant has navigate action sequence
    const hasNavigate = compDescendants.some(n => 
      n.actionSequences && n.actionSequences.some(seq => 
        seq.actions.some(act => act.enabled !== false && act.type === 'navigate')
      )
    );

    const routerImports: string[] = [];
    if (hasLink) routerImports.push('Link');
    if (hasNavigate) routerImports.push('useNavigate');
    const routerImportStr = routerImports.length > 0 ? `import { ${routerImports.join(', ')} } from 'react-router-dom';\n` : '';

    // Collect state variable declarations for this component
    const declaredVarNames = new Set<string>();
    const stateDeclarations: string[] = [];

    compDescendants.forEach(node => {
      if (node.bindings) {
        Object.values(node.bindings).forEach(expr => {
          if (expr && !expr.startsWith('item') && !expr.includes('.')) {
            const sv = (stateVariables || []).find(v => v.id === expr || v.name === expr);
            const rawName = sv ? sv.name : expr;
            const cleanName = this.sanitizeVarName(rawName);
            if (!declaredVarNames.has(cleanName)) {
              declaredVarNames.add(cleanName);
              const defaultVal = sv ? JSON.stringify(this.cleanDefaultValue(sv.defaultValue, sv.type)) : "''";
              const setter = `set${cleanName.charAt(0).toUpperCase() + cleanName.slice(1)}`;
              stateDeclarations.push(`const [internal_${cleanName}, setInternal_${cleanName}] = useState(${defaultVal});`);
              stateDeclarations.push(`const ${cleanName} = props['${cleanName}'] !== undefined ? props['${cleanName}'] : internal_${cleanName};`);
              stateDeclarations.push(`const ${setter} = props['${setter}'] || setInternal_${cleanName};`);
            }
          }
        });
      }
      if (node.actionSequences && node.actionSequences.length > 0) {
        node.actionSequences.forEach(seq => {
          seq.actions.forEach(act => {
            if (act.enabled !== false && act.type === 'setState' && act.stateVariableId) {
              const sv = (stateVariables || []).find(v => v.id === act.stateVariableId || v.name === act.stateVariableId);
              const rawName = sv ? sv.name : act.stateVariableId;
              const cleanName = this.sanitizeVarName(rawName);
              if (!declaredVarNames.has(cleanName)) {
                declaredVarNames.add(cleanName);
                const defaultVal = sv ? JSON.stringify(this.cleanDefaultValue(sv.defaultValue, sv.type)) : "''";
                const setter = `set${cleanName.charAt(0).toUpperCase() + cleanName.slice(1)}`;
                stateDeclarations.push(`const [internal_${cleanName}, setInternal_${cleanName}] = useState(${defaultVal});`);
                stateDeclarations.push(`const ${cleanName} = props['${cleanName}'] !== undefined ? props['${cleanName}'] : internal_${cleanName};`);
                stateDeclarations.push(`const ${setter} = props['${setter}'] || setInternal_${cleanName};`);
              }
            } else if (act.enabled !== false && act.type === 'callApi') {
              const targetVarId = act.apiTargetVariableId || (act.dataSourceId ? (dataSources || []).find(d => d.id === act.dataSourceId)?.targetVariableId : undefined);
              if (targetVarId) {
                const sv = (stateVariables || []).find(v => v.id === targetVarId || v.name === targetVarId);
                const rawName = sv ? sv.name : targetVarId;
                const cleanName = this.sanitizeVarName(rawName);
                if (!declaredVarNames.has(cleanName)) {
                  declaredVarNames.add(cleanName);
                  const defaultVal = sv ? JSON.stringify(this.cleanDefaultValue(sv.defaultValue, sv.type)) : "''";
                  const setter = `set${cleanName.charAt(0).toUpperCase() + cleanName.slice(1)}`;
                  stateDeclarations.push(`const [internal_${cleanName}, setInternal_${cleanName}] = useState(${defaultVal});`);
                  stateDeclarations.push(`const ${cleanName} = props['${cleanName}'] !== undefined ? props['${cleanName}'] : internal_${cleanName};`);
                  stateDeclarations.push(`const ${setter} = props['${setter}'] || setInternal_${cleanName};`);
                }
              }
            }
          });
        });
      }
    });

    const hasState = stateDeclarations.length > 0;
    const reactImport = hasState ? "import React, { useState } from 'react';" : "import React from 'react';";

    const bodyLines: string[] = [];
    if (hasNavigate) {
      bodyLines.push('  const navigate = useNavigate();');
    }
    if (stateDeclarations.length > 0) {
      bodyLines.push(...stateDeclarations.map(s => '  ' + s));
    }

    const bodyStr = bodyLines.length > 0 ? bodyLines.join('\n') + '\n' : '';
    
    const directChildren = allNodes.filter(n => n.parentId === comp.id);
    const childrenJsx = directChildren.map(child => this.generateJsxForNode(child, allNodes, nodesById, masterComponents, true, comp, pages, pageRouteMap, stateVariables, undefined, dataSources)).join('\n      ');
    
    const rootClasses = this.generateNodeTailwindClasses(comp, true);
    const compImportsStr = compImports ? compImports + '\n' : '';
    
    return `${reactImport}
${routerImportStr}${compImportsStr}
export default function ${componentName}(props) {
${bodyStr}  return (
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
    pageRouteMap: { frameId: string; route: string; componentName: string }[] = [],
    pageName: string = 'Page',
    stateVariables: StateVariable[] = [],
    dataSources: DataSource[] = []
  ): string {
    // Find all variant frames for this primary page
    const baseName = (page.name || '').replace(/\s*-\s*(Desktop|Tablet|Mobile)$/i, '');
    const variantFrames = allNodes.filter(n => 
      n.type === 'Frame' && 
      !n.parentId && 
      n.id !== page.id &&
      (n.variantOf === page.id || (n.name && baseName && n.name.startsWith(baseName)))
    );

    // Group frames by device type
    const desktopFrame = page.frameType === 'desktop' ? page : variantFrames.find(v => v.frameType === 'desktop') || page;
    const tabletFrame = page.frameType === 'tablet' ? page : variantFrames.find(v => v.frameType === 'tablet');
    const mobileFrame = page.frameType === 'mobile' ? page : variantFrames.find(v => v.frameType === 'mobile');

    // Collect component instances used across all frame variants
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

    if (desktopFrame) findInstances(desktopFrame.id);
    if (tabletFrame) findInstances(tabletFrame.id);
    if (mobileFrame) findInstances(mobileFrame.id);

    const imports = Array.from(instancesUsed).map(name => `import ${name} from '../components/${name}';`).join('\n');

    // Collect repeater frames and state variables for this page
    const pageFrameIds = new Set([desktopFrame?.id, tabletFrame?.id, mobileFrame?.id].filter(Boolean) as string[]);
    
    const repeaterFramesOnPage = allNodes.filter(n => {
      if (n.type !== 'Frame' || !n.repeaterBinding) return false;
      if (pageFrameIds.has(n.id)) return true;
      let curr: CanvasNode | undefined = n;
      while (curr && curr.parentId) {
        if (pageFrameIds.has(curr.parentId)) return true;
        curr = nodesById[curr.parentId];
      }
      return false;
    });

    const requiredArrayVars = new Set<string>();
    repeaterFramesOnPage.forEach(rf => {
      const binding = rf.repeaterBinding!;
      const varId = binding.arrayVariableId;
      const stateVar = stateVariables.find(v => v.id === varId || v.name === varId);
      const varName = stateVar ? stateVar.name : (varId && !varId.startsWith('var-') ? varId : 'items');
      requiredArrayVars.add(varName);
    });

    if (repeaterFramesOnPage.length > 0 && requiredArrayVars.size === 0) {
      requiredArrayVars.add('items');
    }

    const declaredVarNames = new Set<string>();
    const stateDeclarations: string[] = [];

    (stateVariables || []).forEach(sv => {
      const cleanName = this.sanitizeVarName(sv.name);
      if (declaredVarNames.has(cleanName)) return;
      declaredVarNames.add(cleanName);
      const val = JSON.stringify(this.cleanDefaultValue(sv.defaultValue, sv.type));
      const setter = `set${cleanName.charAt(0).toUpperCase() + cleanName.slice(1)}`;
      stateDeclarations.push(`const [${cleanName}, ${setter}] = useState(${val});`);
    });

    // Collect all node bindings and action sequence state variable references across page nodes
    allNodes.forEach(node => {
      if (node.bindings) {
        Object.values(node.bindings).forEach(expr => {
          if (expr) {
            const normalized = expr.replace(/\[\s*(['"])?([a-zA-Z0-9_$]+)\1\s*\]/g, '.$2');
            const baseName = normalized.split('.')[0];
            if (baseName && baseName !== 'item') {
              const sv = (stateVariables || []).find(v => v.id === baseName || v.name === baseName);
              const rawName = sv ? sv.name : baseName;
              const cleanName = this.sanitizeVarName(rawName);
              if (!declaredVarNames.has(cleanName)) {
                declaredVarNames.add(cleanName);
                const defaultVal = sv ? JSON.stringify(this.cleanDefaultValue(sv.defaultValue, sv.type)) : "''";
                const setter = `set${cleanName.charAt(0).toUpperCase() + cleanName.slice(1)}`;
                stateDeclarations.push(`const [${cleanName}, ${setter}] = useState(${defaultVal});`);
              }
            }
          }
        });
      }
      if (node.actionSequences && node.actionSequences.length > 0) {
        node.actionSequences.forEach(seq => {
          seq.actions.forEach(act => {
            if (act.type === 'setState' && act.stateVariableId) {
              const sv = (stateVariables || []).find(v => v.id === act.stateVariableId || v.name === act.stateVariableId);
              const rawName = sv ? sv.name : act.stateVariableId;
              const cleanName = this.sanitizeVarName(rawName);
              if (!declaredVarNames.has(cleanName)) {
                declaredVarNames.add(cleanName);
                const defaultVal = sv ? JSON.stringify(this.cleanDefaultValue(sv.defaultValue, sv.type)) : "''";
                const setter = `set${cleanName.charAt(0).toUpperCase() + cleanName.slice(1)}`;
                stateDeclarations.push(`const [${cleanName}, ${setter}] = useState(${defaultVal});`);
              }
            } else if (act.type === 'callApi') {
              const targetVarId = act.apiTargetVariableId || (act.dataSourceId ? (dataSources || []).find(d => d.id === act.dataSourceId)?.targetVariableId : undefined);
              if (targetVarId) {
                const sv = (stateVariables || []).find(v => v.id === targetVarId || v.name === targetVarId);
                const rawName = sv ? sv.name : targetVarId;
                const cleanName = this.sanitizeVarName(rawName);
                if (!declaredVarNames.has(cleanName)) {
                  declaredVarNames.add(cleanName);
                  const defaultVal = sv ? JSON.stringify(this.cleanDefaultValue(sv.defaultValue, sv.type)) : "''";
                  const setter = `set${cleanName.charAt(0).toUpperCase() + cleanName.slice(1)}`;
                  stateDeclarations.push(`const [${cleanName}, ${setter}] = useState(${defaultVal});`);
                }
              }
            }
          });
        });
      }
    });

    requiredArrayVars.forEach(varName => {
      const cleanName = this.sanitizeVarName(varName);
      if (declaredVarNames.has(cleanName)) return;
      declaredVarNames.add(cleanName);

      const stateVar = stateVariables.find(v => v.name === varName || v.id === varName);
      let defaultArray = [
        { id: 1, title: 'Repeater Item 1', name: 'Item 1', text: 'Repeater Item 1', price: '$29.99', image: 'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?w=300', src: 'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?w=300' },
        { id: 2, title: 'Repeater Item 2', name: 'Item 2', text: 'Repeater Item 2', price: '$49.99', image: 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?w=300', src: 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?w=300' },
        { id: 3, title: 'Repeater Item 3', name: 'Item 3', text: 'Repeater Item 3', price: '$79.99', image: 'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?w=300', src: 'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?w=300' },
      ];

      if (stateVar && Array.isArray(stateVar.defaultValue) && stateVar.defaultValue.length > 0) {
        defaultArray = stateVar.defaultValue;
      }

      const setter = `set${cleanName.charAt(0).toUpperCase() + cleanName.slice(1)}`;
      stateDeclarations.push(`const [${cleanName}, ${setter}] = useState(${JSON.stringify(defaultArray, null, 2)});`);
    });

    // Generate page-load auto-fetch effects
    const pageLoadDataSources = (dataSources || []).filter(ds => 
      ds.fetchOnLoad && (!ds.targetFrameId || pageFrameIds.has(ds.targetFrameId) || (desktopFrame && ds.targetFrameId === desktopFrame.sourceNodeId))
    );

    const autoFetchEffects: string[] = [];
    pageLoadDataSources.forEach(ds => {
      const sv = ds.targetVariableId ? (stateVariables || []).find(v => v.id === ds.targetVariableId || v.name === ds.targetVariableId) : undefined;
      const rawVarName = sv ? sv.name : ds.targetVariableId;
      const cleanVarName = rawVarName ? this.sanitizeVarName(rawVarName) : '';
      if (cleanVarName && !declaredVarNames.has(cleanVarName)) {
        declaredVarNames.add(cleanVarName);
        const defaultVal = sv ? JSON.stringify(this.cleanDefaultValue(sv.defaultValue, sv.type)) : "''";
        const setter = `set${cleanVarName.charAt(0).toUpperCase() + cleanVarName.slice(1)}`;
        stateDeclarations.push(`const [${cleanVarName}, ${setter}] = useState(${defaultVal});`);
      }

      const headersObj: Record<string, string> = {};
      (ds.headers || []).filter(h => h.enabled && h.key).forEach(h => {
        headersObj[h.key] = h.value;
      });

      const method = ds.method || 'GET';
      const bodyStr = (['POST', 'PUT', 'PATCH'].includes(method) && ds.bodyTemplate)
        ? `,\n        body: ${JSON.stringify(ds.bodyTemplate)}`
        : '';
      const setter = cleanVarName ? `set${cleanVarName.charAt(0).toUpperCase() + cleanVarName.slice(1)}` : '';
      const pathAccess = ds.responsePath ? `result = ${this.generatePathAccess('data', ds.responsePath)};` : '';
      const setterCall = setter ? `${setter}(result);` : '';

      autoFetchEffects.push(`  useEffect(() => {
    const fetch_${this.sanitizeVarName(ds.name || 'data')} = async () => {
      try {
        const res = await fetch('${this.normalizeUrl(ds.url)}', {
          method: '${method}',
          headers: ${JSON.stringify(headersObj)}${bodyStr}
        });
        const data = await res.json();
        let result = data;
        ${pathAccess}
        ${setterCall}
      } catch (err) {
        console.error('Failed to load data for ${ds.name}:', err);
      }
    };
    fetch_${this.sanitizeVarName(ds.name || 'data')}();
  }, []);`);
    });

    const autoFetchStr = autoFetchEffects.length > 0 ? '\n' + autoFetchEffects.join('\n\n') + '\n' : '';

    const stateDeclStr = stateDeclarations.length > 0 ? '\n  ' + stateDeclarations.join('\n  ') + '\n' : '';

    // Generate JSX for children of each frame
    const desktopJsx = desktopFrame ? this.generateFrameChildrenJsx(desktopFrame, allNodes, nodesById, masterComponents, false, pages, pageRouteMap, stateVariables, '        ', dataSources) : '';
    const tabletJsx = tabletFrame ? this.generateFrameChildrenJsx(tabletFrame, allNodes, nodesById, masterComponents, false, pages, pageRouteMap, stateVariables, '        ', dataSources) : '';
    const mobileJsx = mobileFrame ? this.generateFrameChildrenJsx(mobileFrame, allNodes, nodesById, masterComponents, false, pages, pageRouteMap, stateVariables, '        ', dataSources) : '';

    const dW = Math.round(desktopFrame.width || 1440);
    const dH = Math.round(desktopFrame.height || 900);
    const dBg = desktopFrame.fill || '#ffffff';

    const tW = tabletFrame ? Math.round(tabletFrame.width || 768) : 768;
    const tH = tabletFrame ? Math.round(tabletFrame.height || 1024) : 1024;
    const tBg = tabletFrame ? (tabletFrame.fill || '#ffffff') : '#ffffff';

    const mW = mobileFrame ? Math.round(mobileFrame.width || 393) : 393;
    const mH = mobileFrame ? Math.round(mobileFrame.height || 852) : 852;
    const mBg = mobileFrame ? (mobileFrame.fill || '#ffffff') : '#ffffff';

    const getFrameEffectStyles = (f?: CanvasNode): string => {
      if (!f) return '';
      const styles: string[] = ["overflow: 'hidden'"];
      if (f.opacity !== undefined && f.opacity < 100) {
        styles.push(`opacity: ${Math.round(f.opacity) / 100}`);
      }
      if (f.filterBlur && f.filterBlur > 0) {
        styles.push(`filter: 'blur(${Math.round(f.filterBlur)}px)'`);
      }
      if (f.boxShadow?.enabled) {
        const s = f.boxShadow;
        const col = (s.color || 'rgba(0,0,0,0.25)').replace(/\s+/g, '');
        styles.push(`boxShadow: '${s.x ?? 0}px ${s.y ?? 4}px ${s.blur ?? 10}px ${s.spread ?? 0}px ${col}'`);
      }
      return ',\n          ' + styles.join(',\n          ');
    };

    const hasVariants = !!(tabletFrame || mobileFrame);

    if (!hasVariants) {
      return `import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
${imports}

export default function ${pageName}() {
  const navigate = useNavigate();
  const [scaleX, setScaleX] = useState(1);
  const [scaleY, setScaleY] = useState(1);
${stateDeclStr}
  useEffect(() => {
    const updateScale = () => {
      setScaleX(window.innerWidth / ${dW});
      setScaleY(window.innerHeight / ${dH});
    };
    updateScale();
    window.addEventListener('resize', updateScale);
    return () => window.removeEventListener('resize', updateScale);
  }, []);
${autoFetchStr}
  const safeScaleX = Math.max(0.01, (isNaN(scaleX) || !scaleX) ? 1 : scaleX);
  const safeScaleY = Math.max(0.01, (isNaN(scaleY) || !scaleY) ? 1 : scaleY);

  return (
    <div className="w-screen h-screen overflow-hidden" style={{ backgroundColor: '${dBg}' }}>
      <div 
        className="relative" 
        style={{ 
          width: '${dW}px', 
          height: '${dH}px',
          transform: \`scale(\${safeScaleX}, \${safeScaleY})\`,
          transformOrigin: 'top left'${getFrameEffectStyles(desktopFrame)}
        }}
      >
        ${desktopJsx}
      </div>
    </div>
  );
}
`;
    }

    return `import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
${imports}

export default function ${pageName}() {
  const navigate = useNavigate();
  const [screenType, setScreenType] = useState('desktop');
  const [scaleX, setScaleX] = useState(1);
  const [scaleY, setScaleY] = useState(1);
${stateDeclStr}
  useEffect(() => {
    const updateScale = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;

      let currentType = 'desktop';
      let frameW = ${dW};
      let frameH = ${dH};

      ${mobileFrame ? `if (width <= 640) {
        currentType = 'mobile';
        frameW = ${mW};
        frameH = ${mH};
      } else ` : ''}${tabletFrame ? `if (width <= 1024) {
        currentType = 'tablet';
        frameW = ${tW};
        frameH = ${tH};
      }` : ''}

      setScreenType(currentType);
      setScaleX(width / frameW);
      setScaleY(height / frameH);
    };

    updateScale();
    window.addEventListener('resize', updateScale);
    return () => window.removeEventListener('resize', updateScale);
  }, []);
${autoFetchStr}
  const safeScaleX = Math.max(0.01, (isNaN(scaleX) || !scaleX) ? 1 : scaleX);
  const safeScaleY = Math.max(0.01, (isNaN(scaleY) || !scaleY) ? 1 : scaleY);

  ${mobileFrame ? `if (screenType === 'mobile') {
    return (
      <div className="w-screen h-screen overflow-hidden" style={{ backgroundColor: '${mBg}' }}>
        <div 
          className="relative" 
          style={{ 
            width: '${mW}px', 
            height: '${mH}px',
            transform: \`scale(\${safeScaleX}, \${safeScaleY})\`,
            transformOrigin: 'top left'${getFrameEffectStyles(mobileFrame)}
          }}
        >
          ${mobileJsx}
        </div>
      </div>
    );
  }` : ''}

  ${tabletFrame ? `if (screenType === 'tablet') {
    return (
      <div className="w-screen h-screen overflow-hidden" style={{ backgroundColor: '${tBg}' }}>
        <div 
          className="relative" 
          style={{ 
            width: '${tW}px', 
            height: '${tH}px',
            transform: \`scale(\${safeScaleX}, \${safeScaleY})\`,
            transformOrigin: 'top left'${getFrameEffectStyles(tabletFrame)}
          }}
        >
          ${tabletJsx}
        </div>
      </div>
    );
  }` : ''}

  return (
    <div className="w-screen h-screen overflow-hidden" style={{ backgroundColor: '${dBg}' }}>
      <div 
        className="relative" 
        style={{ 
          width: '${dW}px', 
          height: '${dH}px',
          transform: \`scale(\${safeScaleX}, \${safeScaleY})\`,
          transformOrigin: 'top left'${getFrameEffectStyles(desktopFrame)}
        }}
      >
        ${desktopJsx}
      </div>
    </div>
  );
}
`;
  }
}

