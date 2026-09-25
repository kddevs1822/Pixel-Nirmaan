import { CanvasNode } from '../models/types';

export class CodeGeneratorService {
  static generate(nodes: CanvasNode[]): Record<string, string> {
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
      files[`src/components/${componentName}.jsx`] = this.generateComponentCode(comp, nodes, nodesById, pages, pageRouteMap);
    });

    // Generate page code
    pages.forEach((page, index) => {
      const routeInfo = pageRouteMap.find(p => p.frameId === page.id);
      const pageName = routeInfo ? routeInfo.componentName : `Page${index + 1}`;
      files[`src/pages/${pageName}.jsx`] = this.generatePageCode(page, nodes, nodesById, masterComponents, pages, pageRouteMap, pageName);
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
}

.animate-slide-up {
  animation: slideUp 1000ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
  will-change: transform, opacity;
}

.animate-slide-up-reverse {
  animation: slideUpReverse 1000ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
  will-change: transform, opacity;
}

.animate-slide-down {
  animation: slideDown 1000ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
  will-change: transform, opacity;
}

.animate-slide-down-reverse {
  animation: slideDownReverse 1000ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
  will-change: transform, opacity;
}

.animate-slide-left {
  animation: slideLeft 1000ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
  will-change: transform, opacity;
}

.animate-slide-left-reverse {
  animation: slideLeftReverse 1000ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
  will-change: transform, opacity;
}

.animate-slide-right {
  animation: slideRight 1000ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
  will-change: transform, opacity;
}

.animate-slide-right-reverse {
  animation: slideRightReverse 1000ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
  will-change: transform, opacity;
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

  private static generateNodeAnimationClasses(node: CanvasNode): string {
    if (!node.animation || node.animation.type === 'none') return '';
    const animType = node.animation.type;
    const trigger = node.animation.trigger || 'auto';
    
    // If this node's animation is triggered by ANOTHER element, do not attach self-trigger animation classes
    if (node.animation.triggerNodeId && node.animation.triggerNodeId !== node.id) {
      return node.animation.initiallyHidden ? 'is-initially-hidden' : '';
    }

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
        return '';
    }

    const isHidden = !!node.animation?.initiallyHidden;

    if (isHidden) {
      if (trigger === 'hover') return 'is-initially-hidden cursor-pointer';
      if (trigger === 'focus') return 'is-initially-hidden cursor-pointer outline-none';
      if (trigger === 'click' || trigger === 'dblclick') return 'is-initially-hidden cursor-pointer';
      if (trigger === 'scroll') return 'is-initially-hidden transition-all';
      if (trigger === 'auto') return baseClass;
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

  private static getAnimReverseClass(animType: string): string {
    switch (animType) {
      case 'bounce': return 'animate-fade-out';
      case 'pulse': return 'animate-fade-out';
      case 'spin': return 'animate-fade-out';
      case 'fade-in': return 'animate-fade-out';
      case 'slide-up': return 'animate-slide-up-reverse';
      case 'slide-down': return 'animate-slide-down-reverse';
      case 'slide-left': return 'animate-slide-left-reverse';
      case 'slide-right': return 'animate-slide-right-reverse';
      default: return 'animate-fade-out';
    }
  }

  private static generateNodeEventHandlers(node: CanvasNode, allNodes: CanvasNode[]): string {
    const onClickStatements: string[] = [];
    const onDblClickStatements: string[] = [];
    const onMouseEnterStatements: string[] = [];
    const onMouseLeaveStatements: string[] = [];
    const onFocusStatements: string[] = [];
    const onBlurStatements: string[] = [];
    let refProp = '';

    // 1. Cross-element triggers (where node.id is the triggerNodeId for target nodes)
    const triggeredNodes = allNodes.filter(n => n.animation && n.animation.type !== 'none' && n.animation.triggerNodeId === node.id && n.id !== node.id);
    triggeredNodes.forEach(targetNode => {
      const animType = targetNode.animation!.type;
      const baseClass = this.getAnimBaseClass(animType);
      const reverseClass = this.getAnimReverseClass(animType);
      if (!baseClass) return;

      const trigger = targetNode.animation!.trigger || 'click';
      const isHidden = !!targetNode.animation!.initiallyHidden;
      const targetIdStr = `node-${targetNode.id}`;
      const targetQuery = `const el = document.getElementById('${targetIdStr}'); if (el) { const target = el.querySelector('[data-anim="true"]') || el;`;

      if (trigger === 'click') {
        if (isHidden) {
          onClickStatements.push(`${targetQuery} if (target.classList.contains('${baseClass}')) { target.classList.remove('${baseClass}'); void target.offsetWidth; target.classList.add('${reverseClass}'); } else { target.classList.remove('${reverseClass}'); target.classList.remove('is-initially-hidden'); void target.offsetWidth; target.classList.add('${baseClass}'); } }`);
        } else {
          onClickStatements.push(`${targetQuery} if (target.classList.contains('${baseClass}')) { target.classList.remove('${baseClass}'); } else { target.classList.remove('${reverseClass}'); void target.offsetWidth; target.classList.add('${baseClass}'); } }`);
        }
      } else if (trigger === 'dblclick') {
        if (isHidden) {
          onDblClickStatements.push(`${targetQuery} if (target.classList.contains('${baseClass}')) { target.classList.remove('${baseClass}'); void target.offsetWidth; target.classList.add('${reverseClass}'); } else { target.classList.remove('${reverseClass}'); target.classList.remove('is-initially-hidden'); void target.offsetWidth; target.classList.add('${baseClass}'); } }`);
        } else {
          onDblClickStatements.push(`${targetQuery} if (target.classList.contains('${baseClass}')) { target.classList.remove('${baseClass}'); } else { target.classList.remove('${reverseClass}'); void target.offsetWidth; target.classList.add('${baseClass}'); } }`);
        }
      } else if (trigger === 'hover') {
        if (isHidden) {
          onMouseEnterStatements.push(`${targetQuery} target.classList.remove('${reverseClass}'); target.classList.remove('is-initially-hidden'); void target.offsetWidth; target.classList.add('${baseClass}'); }`);
          onMouseLeaveStatements.push(`${targetQuery} target.classList.remove('${baseClass}'); void target.offsetWidth; target.classList.add('${reverseClass}'); }`);
        } else {
          onMouseEnterStatements.push(`${targetQuery} target.classList.add('${baseClass}'); }`);
          onMouseLeaveStatements.push(`${targetQuery} target.classList.remove('${baseClass}'); }`);
        }
      } else if (trigger === 'focus') {
        if (isHidden) {
          onFocusStatements.push(`${targetQuery} target.classList.remove('${reverseClass}'); target.classList.remove('is-initially-hidden'); void target.offsetWidth; target.classList.add('${baseClass}'); }`);
          onBlurStatements.push(`${targetQuery} target.classList.remove('${baseClass}'); void target.offsetWidth; target.classList.add('${reverseClass}'); }`);
        } else {
          onFocusStatements.push(`${targetQuery} target.classList.add('${baseClass}'); }`);
          onBlurStatements.push(`${targetQuery} target.classList.remove('${baseClass}'); }`);
        }
      }
    });

    // 2. Self-triggered animation (if node itself has animation and is self-triggered)
    if (node.animation && node.animation.type !== 'none' && (!node.animation.triggerNodeId || node.animation.triggerNodeId === node.id)) {
      const animType = node.animation.type;
      const baseClass = this.getAnimBaseClass(animType);
      const reverseClass = this.getAnimReverseClass(animType);
      if (baseClass) {
        const trigger = node.animation.trigger || 'auto';
        const isHidden = !!node.animation.initiallyHidden;
        const selfQuery = `const target = e.currentTarget.querySelector('[data-anim="true"]') || e.currentTarget;`;

        if (trigger === 'click') {
          if (isHidden) {
            onClickStatements.push(`${selfQuery} if (target.classList.contains('${baseClass}')) { target.classList.remove('${baseClass}'); void target.offsetWidth; target.classList.add('${reverseClass}'); } else { target.classList.remove('${reverseClass}'); target.classList.remove('is-initially-hidden'); void target.offsetWidth; target.classList.add('${baseClass}'); }`);
          } else {
            onClickStatements.push(`${selfQuery} if (target.classList.contains('${baseClass}')) { target.classList.remove('${baseClass}'); } else { target.classList.remove('${reverseClass}'); void target.offsetWidth; target.classList.add('${baseClass}'); }`);
          }
        } else if (trigger === 'dblclick') {
          if (isHidden) {
            onDblClickStatements.push(`${selfQuery} if (target.classList.contains('${baseClass}')) { target.classList.remove('${baseClass}'); void target.offsetWidth; target.classList.add('${reverseClass}'); } else { target.classList.remove('${reverseClass}'); target.classList.remove('is-initially-hidden'); void target.offsetWidth; target.classList.add('${baseClass}'); }`);
          } else {
            onDblClickStatements.push(`${selfQuery} if (target.classList.contains('${baseClass}')) { target.classList.remove('${baseClass}'); } else { target.classList.remove('${reverseClass}'); void target.offsetWidth; target.classList.add('${baseClass}'); }`);
          }
        } else if (trigger === 'hover') {
          if (isHidden) {
            onMouseEnterStatements.push(`${selfQuery} target.classList.remove('${reverseClass}'); target.classList.remove('is-initially-hidden'); void target.offsetWidth; target.classList.add('${baseClass}');`);
            onMouseLeaveStatements.push(`${selfQuery} target.classList.remove('${baseClass}'); void target.offsetWidth; target.classList.add('${reverseClass}');`);
          } else {
            onMouseEnterStatements.push(`${selfQuery} target.classList.add('${baseClass}');`);
            onMouseLeaveStatements.push(`${selfQuery} target.classList.remove('${baseClass}');`);
          }
        } else if (trigger === 'focus') {
          if (isHidden) {
            onFocusStatements.push(`${selfQuery} target.classList.remove('${reverseClass}'); target.classList.remove('is-initially-hidden'); void target.offsetWidth; target.classList.add('${baseClass}');`);
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

    const handlerParts: string[] = [];

    if (onClickStatements.length > 0) {
      handlerParts.push(`onClick={(e) => { ${onClickStatements.map(s => `{ ${s} }`).join(' ')} }}`);
    }
    if (onDblClickStatements.length > 0) {
      handlerParts.push(`onDoubleClick={(e) => { ${onDblClickStatements.map(s => `{ ${s} }`).join(' ')} }}`);
    }
    if (onMouseEnterStatements.length > 0) {
      handlerParts.push(`onMouseEnter={(e) => { ${onMouseEnterStatements.map(s => `{ ${s} }`).join(' ')} }}`);
    }
    if (onMouseLeaveStatements.length > 0) {
      handlerParts.push(`onMouseLeave={(e) => { ${onMouseLeaveStatements.map(s => `{ ${s} }`).join(' ')} }}`);
    }
    if (onFocusStatements.length > 0) {
      handlerParts.push(`tabIndex={0} onFocus={(e) => { ${onFocusStatements.map(s => `{ ${s} }`).join(' ')} }}`);
    }
    if (onBlurStatements.length > 0) {
      handlerParts.push(`onBlur={(e) => { ${onBlurStatements.map(s => `{ ${s} }`).join(' ')} }}`);
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

  private static generateNodePositionStyles(node: CanvasNode, isRoot: boolean = false, parentNode?: CanvasNode): string {
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
    let nodeW = node.width;
    let nodeH = node.height;

    if ((node.type === 'Circle' || node.type === 'Triangle') && node.radius) {
      nodeW = node.radius * 2 * scaleX;
      nodeH = node.radius * 2 * scaleY;
      cssX -= node.radius * scaleX;
      cssY -= node.radius * scaleY;
    }

    if (parentNode) {
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
        styles.push(`width: '${round(node.width)}px'`);
      }
      
      if (isFullHeight) {
        styles.push("height: '100%'");
      } else if (node.height) {
        styles.push(`height: '${round(node.height)}px'`);
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
      styles.push("overflow: 'hidden'");
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
    let match = pageRouteMap.find(p => p.frameId === targetId);
    if (match) return match.route;

    if (nodesById && nodesById[targetId] && nodesById[targetId].variantOf) {
      const parentFrameId = nodesById[targetId].variantOf;
      match = pageRouteMap.find(p => p.frameId === parentFrameId);
      if (match) return match.route;
    }

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

      const posStyleStr = this.generateNodePositionStyles(node, false, parentNode);
      const animClasses = this.generateNodeAnimationClasses(node);
      const animStyleStr = this.generateNodeAnimationStyles(node, parentNode);
      const eventHandlers = this.generateNodeEventHandlers(node, allNodes);

      const isTriggerSource = allNodes.some(n => n.animation && n.animation.type !== 'none' && n.animation.triggerNodeId === node.id && n.id !== node.id);
      const cursorClass = (targetRoute || isTriggerSource) ? ' cursor-pointer' : '';
      const elemIdAttr = ` id="node-${node.id}"`;

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

    const posStyleStr = this.generateNodePositionStyles(node, false, parentNode);
    let styleClasses = this.generateNodeStyleClasses(node, false, parentNode);
    const animClasses = this.generateNodeAnimationClasses(node);
    const animStyleStr = this.generateNodeAnimationStyles(node, parentNode);
    const eventHandlers = this.generateNodeEventHandlers(node, allNodes);

    const isTriggerSource = allNodes.some(n => n.animation && n.animation.type !== 'none' && n.animation.triggerNodeId === node.id && n.id !== node.id);
    const cursorClass = (targetRoute || isTriggerSource) ? ' cursor-pointer' : '';
    const elemIdAttr = ` id="node-${node.id}"`;

    const dynamicProps = this.resolveBoundProps(node, isMasterComponentDef);
    
    let fillStyle = '';
    if (dynamicProps.fill && node.type !== 'Text') {
      styleClasses = styleClasses.replace(/bg-\[[^\]]+\]/g, '');
      fillStyle = ` style={{ backgroundColor: ${dynamicProps.fill.expression} || '${dynamicProps.fill.defaultValue}' }}`;
    }
    let textColorStyle = '';
    if (dynamicProps.fill && node.type === 'Text') {
      styleClasses = styleClasses.replace(/text-\[#[^\]]+\]/g, '');
      textColorStyle = ` style={{ color: ${dynamicProps.fill.expression} || '${dynamicProps.fill.defaultValue}' }}`;
    }

    const inlineStyle = fillStyle || textColorStyle || '';

    let innerContent = '';

    if (node.type === 'Frame') {
      const children = allNodes.filter(n => n.parentId === node.id);
      innerContent = children.map(child => this.generateJsxForNode(child, allNodes, nodesById, masterComponents, isMasterComponentDef, node, pages, pageRouteMap)).join('\n      ');
    } else if (node.type === 'Text') {
      innerContent = dynamicProps.text 
        ? `{${dynamicProps.text.expression} || "${dynamicProps.text.defaultValue}"}` 
        : (node.text || '');
    } else if (node.type === 'Image') {
      const imgSrc = dynamicProps.src 
        ? `{${dynamicProps.src.expression} || "${dynamicProps.src.defaultValue}"}`
        : `"${node.src || ''}"`;
      innerContent = `<img src=${imgSrc} className="w-full h-full object-cover" alt="image" />`;
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
    pageRouteMap: { frameId: string; route: string; componentName: string }[] = [],
    pageName: string = 'Page'
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

    // Generate JSX for children of each frame
    const desktopChildren = allNodes.filter(n => n.parentId === desktopFrame.id);
    const desktopJsx = desktopChildren.map(child => this.generateJsxForNode(child, allNodes, nodesById, masterComponents, false, desktopFrame, pages, pageRouteMap)).join('\n        ');

    const tabletChildren = tabletFrame ? allNodes.filter(n => n.parentId === tabletFrame.id) : [];
    const tabletJsx = tabletFrame ? tabletChildren.map(child => this.generateJsxForNode(child, allNodes, nodesById, masterComponents, false, tabletFrame, pages, pageRouteMap)).join('\n        ') : '';

    const mobileChildren = mobileFrame ? allNodes.filter(n => n.parentId === mobileFrame.id) : [];
    const mobileJsx = mobileFrame ? mobileChildren.map(child => this.generateJsxForNode(child, allNodes, nodesById, masterComponents, false, mobileFrame, pages, pageRouteMap)).join('\n        ') : '';

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

  useEffect(() => {
    const updateScale = () => {
      setScaleX(window.innerWidth / ${dW});
      setScaleY(window.innerHeight / ${dH});
    };
    updateScale();
    window.addEventListener('resize', updateScale);
    return () => window.removeEventListener('resize', updateScale);
  }, []);

  return (
    <div className="w-screen h-screen overflow-hidden" style={{ backgroundColor: '${dBg}' }}>
      <div 
        className="relative" 
        style={{ 
          width: '${dW}px', 
          height: '${dH}px',
          transform: \`scale(\${scaleX}, \${scaleY})\`,
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

  ${mobileFrame ? `if (screenType === 'mobile') {
    return (
      <div className="w-screen h-screen overflow-hidden" style={{ backgroundColor: '${mBg}' }}>
        <div 
          className="relative" 
          style={{ 
            width: '${mW}px', 
            height: '${mH}px',
            transform: \`scale(\${scaleX}, \${scaleY})\`,
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
            transform: \`scale(\${scaleX}, \${scaleY})\`,
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
          transform: \`scale(\${scaleX}, \${scaleY})\`,
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
