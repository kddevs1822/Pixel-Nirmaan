import React, { useRef, useEffect, useState } from 'react';
import { Stage, Layer, Rect, Circle, Text, Transformer, Group, Image as KonvaImage, RegularPolygon, Line, Arrow } from 'react-konva';
import { useCanvasStore } from '../store/useCanvasStore';
import type { CanvasNode } from '../store/useCanvasStore';
import Konva from 'konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import useImage from 'use-image';
import { X, AlertCircle, Monitor, Tablet, Smartphone, Target } from 'lucide-react';

const URLImage = ({ node, commonProps, shapeRef, shadowProps }: any) => {
  const [image] = useImage(node.src || '');
  const { shadowEnabled, shadowColor, shadowBlur, shadowOffsetX, shadowOffsetY, shadowOpacity, ...groupProps } = commonProps;
  return (
    <Group ref={shapeRef} {...groupProps} width={node.width} height={node.height}>
      {!image ? (
        <>
          <Rect 
            width={node.width} 
            height={node.height} 
            fill="#e2e8f0" 
            stroke="#cbd5e1" 
            strokeWidth={2} 
            dash={[5, 5]} 
            cornerRadius={node.cornerRadius}
            {...shadowProps}
          />
          <Text text="Loading..." width={node.width} height={node.height} verticalAlign="middle" align="center" fontSize={14} fill="#64748b" fontFamily="Inter" />
        </>
      ) : (
        <KonvaImage 
          image={image} 
          width={node.width} 
          height={node.height} 
          cornerRadius={node.cornerRadius}
          {...shadowProps}
        />
      )}
    </Group>
  );
};

interface NodeContext {
  nodes: CanvasNode[];
  selectedIds: string[];
  mode: any;
  selectNodes: (ids: string[]) => void;
  toggleNodeSelection: (id: string) => void;
  handleNodeClick: (e: any, node: CanvasNode, isDoubleClick?: boolean) => void;
  handleDragEnd: (e: KonvaEventObject<DragEvent>, id: string) => void;
  handleTransformEnd: (e: KonvaEventObject<Event>, id: string) => void;
  handleLineDblClick: (e: KonvaEventObject<MouseEvent>, nodeId: string) => void;
  handleAnchorDragMove: (e: KonvaEventObject<DragEvent>, nodeId: string, index: number) => void;
  handleAnchorDragEnd: (e: KonvaEventObject<DragEvent>, nodeId: string, index: number) => void;
  handleAnchorDblClick: (e: KonvaEventObject<MouseEvent>, nodeId: string, index: number) => void;
}

const getKonvaEasing = (timing?: string) => {
  switch (timing) {
    case 'linear': return Konva.Easings.Linear;
    case 'ease-in': return Konva.Easings.EaseIn;
    case 'ease-out': return Konva.Easings.EaseOut;
    case 'ease-in-out': return Konva.Easings.EaseInOut;
    default: return Konva.Easings.EaseInOut;
  }
};

const RenderNode: React.FC<{ node: CanvasNode; isPreview?: boolean; context: NodeContext }> = ({ node, isPreview = false, context }) => {
  const { nodes, selectedIds, mode, selectNodes, toggleNodeSelection, handleNodeClick, handleDragEnd, handleTransformEnd, handleLineDblClick, handleAnchorDragMove, handleAnchorDragEnd, handleAnchorDblClick } = context;
  const [interactiveState, setInteractiveState] = useState<'default'|'hover'|'active'|'disabled'>('default');
  const shapeRef = useRef<any>(null);
  const hoverTweenRef = useRef<Konva.Tween | null>(null);
  const shadowTweenRef = useRef<Konva.Tween | null>(null);

  let resolvedNode = { ...node };
  let masterNode = node.isMasterComponent ? node : undefined;
  
  let rootInstance: CanvasNode | undefined = undefined;

  if (node.componentId) {
    masterNode = nodes.find(n => n.id === node.componentId);
    if (masterNode) {
      rootInstance = node;
      let curr = node;
      while (curr.parentId) {
        const parent = nodes.find(n => n.id === curr.parentId);
        if (!parent || !parent.componentId) break;
        rootInstance = parent;
        curr = parent;
      }

      resolvedNode = {
        ...masterNode,
        ...node,
        id: node.id,
        x: node.x,
        y: node.y,
        parentId: node.parentId,
        componentId: node.componentId,
        variant: node.variant,
        linkTo: node.linkTo,
        isMasterComponent: false,
        propOverrides: node.propOverrides
      };

      if (masterNode.boundProps && rootInstance.propOverrides) {
        Object.entries(masterNode.boundProps).forEach(([field, propId]) => {
          if (rootInstance!.propOverrides![propId] !== undefined) {
            (resolvedNode as any)[field] = rootInstance!.propOverrides![propId];
          }
        });
      }
    }
  }

  if (masterNode && masterNode.variants) {
    let activeVariant = isPreview ? interactiveState : (rootInstance?.variant || node.variant || 'default');
    if (activeVariant !== 'default' && masterNode.variants[activeVariant]) {
      resolvedNode = { ...resolvedNode, ...masterNode.variants[activeVariant] };
    } else if (isPreview && interactiveState !== 'default') {
      activeVariant = 'default';
    }
  }

  const isInteractive = mode === 'preview' && (resolvedNode.linkTo || masterNode || (resolvedNode.hoverEffect && resolvedNode.hoverEffect !== 'none'));
  
  let inComponent = false;
  let currCheck = node;
  while (currCheck.parentId) {
    const parent = nodes.find(n => n.id === currCheck.parentId);
    if (!parent) break;
    if (parent.isMasterComponent || parent.componentId) {
      inComponent = true;
      break;
    }
    currCheck = parent;
  }

  // Cleanup hover tween on unmount
  useEffect(() => {
    return () => {
      if (hoverTweenRef.current) {
        hoverTweenRef.current.destroy();
      }
      if (shadowTweenRef.current) {
        shadowTweenRef.current.destroy();
      }
    };
  }, []);

  // Filter blur caching (Gaussian blur)
  useEffect(() => {
    if (shapeRef.current) {
      if (resolvedNode.filterBlur && resolvedNode.filterBlur > 0) {
        try {
          shapeRef.current.clearCache();
          shapeRef.current.cache({ pixelRatio: 1 });
        } catch {
          // ignore cache errors during rapid changes
        }
      } else {
        try {
          shapeRef.current.clearCache();
        } catch {}
      }
    }
  }, [
    resolvedNode.filterBlur,
    resolvedNode.width,
    resolvedNode.height,
    resolvedNode.radius,
    resolvedNode.fill,
    resolvedNode.text,
    resolvedNode.fontSize,
    resolvedNode.fontFamily,
    resolvedNode.boxShadow?.enabled,
    resolvedNode.boxShadow?.x,
    resolvedNode.boxShadow?.y,
    resolvedNode.boxShadow?.blur,
    resolvedNode.boxShadow?.spread,
    resolvedNode.boxShadow?.color,
    resolvedNode.opacity
  ]);

  // Entrance and continuous animations in preview mode
  useEffect(() => {
    if (!isPreview || !resolvedNode.animation || resolvedNode.animation.type === 'none' || !shapeRef.current) return;
    
    const animConfig = resolvedNode.animation;
    const durMs = animConfig.duration || 1000;
    const trigger = animConfig.trigger || 'auto';
    const konvaEl = shapeRef.current;
    const initialX = resolvedNode.x;
    const initialY = resolvedNode.y;
    const initialOpacity = resolvedNode.opacity !== undefined ? Math.max(0, Math.min(1, resolvedNode.opacity / 100)) : 1;
    let anim: Konva.Animation | null = null;
    let currentTween: Konva.Tween | null = null;

    const resetKonvaEl = () => {
      if (anim) anim.stop();
      if (currentTween) currentTween.destroy();
      if (konvaEl) {
        konvaEl.x(initialX);
        konvaEl.y(initialY);
        konvaEl.scaleX(resolvedNode.scaleX || 1);
        konvaEl.scaleY(resolvedNode.scaleY || 1);
        konvaEl.rotation(resolvedNode.rotation || 0);
        konvaEl.opacity(initialOpacity);
      }
    };

    const runAnimation = () => {
      resetKonvaEl();

      if (animConfig.type === 'spin') {
        anim = new Konva.Animation((frame) => {
          if (!frame) return;
          const progress = (frame.time % durMs) / durMs;
          konvaEl.rotation((resolvedNode.rotation || 0) + progress * 360);
        }, konvaEl.getLayer());
        anim.start();
      } else if (animConfig.type === 'pulse') {
        anim = new Konva.Animation((frame) => {
          if (!frame) return;
          const progress = (frame.time % durMs) / durMs;
          const s = 1 + 0.08 * Math.sin(progress * Math.PI * 2);
          konvaEl.scaleX((resolvedNode.scaleX || 1) * s);
          konvaEl.scaleY((resolvedNode.scaleY || 1) * s);
        }, konvaEl.getLayer());
        anim.start();
      } else if (animConfig.type === 'bounce') {
        anim = new Konva.Animation((frame) => {
          if (!frame) return;
          const progress = (frame.time % durMs) / durMs;
          const bounce = -Math.abs(Math.sin(progress * Math.PI * 2)) * 18;
          konvaEl.y(initialY + bounce);
        }, konvaEl.getLayer());
        anim.start();
      } else if (animConfig.type === 'fade-in') {
        konvaEl.opacity(0);
        currentTween = new Konva.Tween({
          node: konvaEl,
          duration: durMs / 1000,
          opacity: initialOpacity,
          easing: Konva.Easings.EaseOut,
        });
        currentTween.play();
      } else if (animConfig.type === 'slide-up') {
        konvaEl.y(initialY + 30);
        konvaEl.opacity(0);
        currentTween = new Konva.Tween({
          node: konvaEl,
          duration: durMs / 1000,
          y: initialY,
          opacity: initialOpacity,
          easing: Konva.Easings.EaseOut,
        });
        currentTween.play();
      } else if (animConfig.type === 'slide-down') {
        konvaEl.y(initialY - 30);
        konvaEl.opacity(0);
        currentTween = new Konva.Tween({
          node: konvaEl,
          duration: durMs / 1000,
          y: initialY,
          opacity: initialOpacity,
          easing: Konva.Easings.EaseOut,
        });
        currentTween.play();
      } else if (animConfig.type === 'slide-left') {
        konvaEl.x(initialX + 30);
        konvaEl.opacity(0);
        currentTween = new Konva.Tween({
          node: konvaEl,
          duration: durMs / 1000,
          x: initialX,
          opacity: initialOpacity,
          easing: Konva.Easings.EaseOut,
        });
        currentTween.play();
      } else if (animConfig.type === 'slide-right') {
        konvaEl.x(initialX - 30);
        konvaEl.opacity(0);
        currentTween = new Konva.Tween({
          node: konvaEl,
          duration: durMs / 1000,
          x: initialX,
          opacity: initialOpacity,
          easing: Konva.Easings.EaseOut,
        });
        currentTween.play();
      }
    };

    let boundTriggerEl: Konva.Node | null = null;

    const timerId = setTimeout(() => {
      const stage = konvaEl.getStage();
      let triggerEl: Konva.Node | null = null;
      if (animConfig.triggerNodeId && stage) {
        triggerEl = stage.findOne('#node-' + animConfig.triggerNodeId) || null;
      }
      if (!triggerEl) {
        triggerEl = konvaEl;
      }
      boundTriggerEl = triggerEl;

      if (triggerEl) {
        if (trigger === 'auto' || trigger === 'scroll') {
          runAnimation();
        } else if (trigger === 'click') {
          triggerEl.on('click tap', runAnimation);
        } else if (trigger === 'dblclick') {
          triggerEl.on('dblclick dbltap', runAnimation);
        } else if (trigger === 'hover') {
          triggerEl.on('mouseenter', runAnimation);
          triggerEl.on('mouseleave', resetKonvaEl);
        } else if (trigger === 'focus') {
          triggerEl.on('mouseenter click tap', runAnimation);
          triggerEl.on('mouseleave', resetKonvaEl);
        }
      }
    }, 50);

    return () => {
      clearTimeout(timerId);
      if (boundTriggerEl) {
        boundTriggerEl.off('click tap', runAnimation);
        boundTriggerEl.off('dblclick dbltap', runAnimation);
        boundTriggerEl.off('mouseenter', runAnimation);
        boundTriggerEl.off('mouseleave', resetKonvaEl);
      }
      resetKonvaEl();
    };
  }, [isPreview, resolvedNode.animation?.type, resolvedNode.animation?.duration, resolvedNode.animation?.trigger, resolvedNode.animation?.triggerNodeId]);

  const hasShadow = !!resolvedNode.boxShadow?.enabled;
  const hasBlur = !!(resolvedNode.filterBlur && resolvedNode.filterBlur > 0);
  const resolvedOpacity = resolvedNode.opacity !== undefined ? Math.max(0, Math.min(1, resolvedNode.opacity / 100)) : 1;

  const shadowProps = {
    shadowEnabled: hasShadow,
    shadowColor: hasShadow ? (resolvedNode.boxShadow?.color || 'rgba(0,0,0,0.25)') : undefined,
    shadowBlur: hasShadow ? (resolvedNode.boxShadow?.blur ?? 10) : 0,
    shadowOffsetX: hasShadow ? (resolvedNode.boxShadow?.x ?? 0) : 0,
    shadowOffsetY: hasShadow ? (resolvedNode.boxShadow?.y ?? 4) : 0,
    shadowOpacity: hasShadow ? 1 : 0,
  };

  const commonProps: any = {
    id: `node-${resolvedNode.id}`,
    x: resolvedNode.x,
    y: resolvedNode.y,
    scaleX: resolvedNode.scaleX || 1,
    scaleY: resolvedNode.scaleY || 1,
    rotation: resolvedNode.rotation || 0,
    fill: resolvedNode.fill,
    opacity: resolvedOpacity,
    ...shadowProps,
    filters: hasBlur ? [Konva.Filters.Blur] : undefined,
    blurRadius: hasBlur ? (resolvedNode.filterBlur || 0) : 0,
    draggable: mode === 'select' && (!inComponent || selectedIds.includes(node.id)),
    listening: (mode === 'preview' || isPreview) 
      ? (resolvedNode.type === 'Frame' ? true : !!resolvedNode.linkTo || !!masterNode || !!(resolvedNode.hoverEffect && resolvedNode.hoverEffect !== 'none') || !!(resolvedNode.animation && resolvedNode.animation.type !== 'none') || nodes.some(n => n.animation?.triggerNodeId === resolvedNode.id && n.animation?.type !== 'none')) 
      : true,
    onClick: (e: any) => handleNodeClick(e, node, false),
    onTap: (e: any) => handleNodeClick(e, node, false),
    onDblClick: (e: any) => handleNodeClick(e, node, true),
    onDblTap: (e: any) => handleNodeClick(e, node, true),
    onDragStart: (e: any) => { 
      if (mode === 'select') { 
        e.cancelBubble = true; 
        let targetNode = node;
        if (!selectedIds.includes(node.id)) {
          let rootComponent = null;
          let curr = node;
          while (curr.parentId) {
            const parent = nodes.find(n => n.id === curr.parentId);
            if (!parent) break;
            if (parent.isMasterComponent || parent.componentId) {
              rootComponent = parent;
            }
            curr = parent;
          }
          if (rootComponent) targetNode = rootComponent;
          
          if (e.evt.shiftKey) toggleNodeSelection(targetNode.id);
          else selectNodes([targetNode.id]); 
        }
      } 
    },
    onDragEnd: (e: any) => { if (mode === 'select') { e.cancelBubble = true; handleDragEnd(e, node.id); } },
    onTransformEnd: (e: any) => { if (mode === 'select') { e.cancelBubble = true; handleTransformEnd(e, node.id); } },
    onMouseEnter: (e: any) => {
      const hasHover = !!(resolvedNode.hoverEffect && resolvedNode.hoverEffect !== 'none');
      if (isInteractive || mode === 'connect' || hasHover) {
        const container = e.target.getStage()?.container();
        if (container) container.style.cursor = 'pointer';
      }
      if (mode === 'preview' || isPreview) {
        if (masterNode?.variants?.hover) {
          setInteractiveState('hover');
        }
        if (hasHover) {
          const konvaNode = shapeRef.current || e.target;
          const shadowTarget = (konvaNode instanceof Konva.Group && konvaNode.children?.length)
            ? (konvaNode.findOne('Image') || konvaNode.findOne('Rect') || konvaNode.children[0])
            : konvaNode;

          const duration = (resolvedNode.transitionDuration || 300) / 1000;
          const easing = getKonvaEasing(resolvedNode.transitionTimingFunction);

          if (hoverTweenRef.current) hoverTweenRef.current.destroy();

          const targetProps: any = {
            node: konvaNode,
            duration,
            easing,
          };

          const baseScaleX = resolvedNode.scaleX || 1;
          const baseScaleY = resolvedNode.scaleY || 1;
          const isCenterBased = resolvedNode.type === 'Circle' || resolvedNode.type === 'Triangle';
          const w = resolvedNode.width || (typeof konvaNode.width === 'function' ? konvaNode.width() : 100);
          const h = resolvedNode.height || (typeof konvaNode.height === 'function' ? konvaNode.height() : 40);
          const isGroupTarget = shadowTarget && shadowTarget !== konvaNode;

          switch (resolvedNode.hoverEffect) {
            case 'scale-up':
              targetProps.scaleX = baseScaleX * 1.08;
              targetProps.scaleY = baseScaleY * 1.08;
              if (!isCenterBased) {
                targetProps.x = resolvedNode.x - (w * (baseScaleX * 0.08)) / 2;
                targetProps.y = resolvedNode.y - (h * (baseScaleY * 0.08)) / 2;
              }
              break;
            case 'scale-down':
              targetProps.scaleX = baseScaleX * 0.92;
              targetProps.scaleY = baseScaleY * 0.92;
              if (!isCenterBased) {
                targetProps.x = resolvedNode.x + (w * (baseScaleX * 0.08)) / 2;
                targetProps.y = resolvedNode.y + (h * (baseScaleY * 0.08)) / 2;
              }
              break;
            case 'lift':
              targetProps.y = resolvedNode.y - 8;
              if (shadowTarget && shadowTarget.shadowEnabled) {
                shadowTarget.shadowEnabled(true);
                shadowTarget.shadowColor(resolvedNode.boxShadow?.color || 'rgba(0,0,0,0.35)');
              }
              targetProps.shadowOffsetY = (resolvedNode.boxShadow?.y || 4) + 12;
              targetProps.shadowBlur = (resolvedNode.boxShadow?.blur || 10) + 16;
              targetProps.shadowOpacity = 1;
              break;
            case 'glow':
              if (shadowTarget && shadowTarget.shadowEnabled) {
                shadowTarget.shadowEnabled(true);
                const glowCol = resolvedNode.fill && resolvedNode.fill !== '#ffffff' ? resolvedNode.fill : '#4A3AFF';
                shadowTarget.shadowColor(glowCol);
              }
              targetProps.shadowBlur = 32;
              targetProps.shadowOffsetX = 0;
              targetProps.shadowOffsetY = 0;
              targetProps.shadowOpacity = 1;
              break;
            case 'darken':
              targetProps.opacity = Math.max(0.1, resolvedOpacity * 0.55);
              break;
            case 'brighten':
              if (resolvedOpacity < 0.9) {
                targetProps.opacity = Math.min(1, resolvedOpacity * 1.4);
              } else {
                if (shadowTarget && shadowTarget.shadowEnabled) {
                  shadowTarget.shadowEnabled(true);
                  shadowTarget.shadowColor('#ffffff');
                }
                targetProps.shadowBlur = 24;
                targetProps.shadowOffsetX = 0;
                targetProps.shadowOffsetY = 0;
                targetProps.shadowOpacity = 0.9;
                targetProps.scaleX = baseScaleX * 1.02;
                targetProps.scaleY = baseScaleY * 1.02;
                if (!isCenterBased) {
                  targetProps.x = resolvedNode.x - (w * (baseScaleX * 0.02)) / 2;
                  targetProps.y = resolvedNode.y - (h * (baseScaleY * 0.02)) / 2;
                }
              }
              break;
          }

          if (isGroupTarget) {
            const shadowAnimProps: any = {
              node: shadowTarget,
              duration,
              easing,
            };
            if (targetProps.shadowOffsetY !== undefined) shadowAnimProps.shadowOffsetY = targetProps.shadowOffsetY;
            if (targetProps.shadowOffsetX !== undefined) shadowAnimProps.shadowOffsetX = targetProps.shadowOffsetX;
            if (targetProps.shadowBlur !== undefined) shadowAnimProps.shadowBlur = targetProps.shadowBlur;
            if (targetProps.shadowOpacity !== undefined) shadowAnimProps.shadowOpacity = targetProps.shadowOpacity;

            delete targetProps.shadowOffsetY;
            delete targetProps.shadowOffsetX;
            delete targetProps.shadowBlur;
            delete targetProps.shadowOpacity;

            if (shadowTweenRef.current) shadowTweenRef.current.destroy();
            shadowTweenRef.current = new Konva.Tween(shadowAnimProps);
            shadowTweenRef.current.play();
          }

          hoverTweenRef.current = new Konva.Tween(targetProps);
          hoverTweenRef.current.play();
        }
      }
    },
    onMouseLeave: (e: any) => {
      const hasHover = !!(resolvedNode.hoverEffect && resolvedNode.hoverEffect !== 'none');
      if (isInteractive || mode === 'connect' || hasHover) {
        const container = e.target.getStage()?.container();
        if (container) container.style.cursor = 'default';
      }
      if (mode === 'preview' || isPreview) {
        setInteractiveState('default');
        if (hasHover) {
          const konvaNode = shapeRef.current || e.target;
          const shadowTarget = (konvaNode instanceof Konva.Group && konvaNode.children?.length)
            ? (konvaNode.findOne('Image') || konvaNode.findOne('Rect') || konvaNode.children[0])
            : konvaNode;

          const duration = (resolvedNode.transitionDuration || 300) / 1000;
          const easing = getKonvaEasing(resolvedNode.transitionTimingFunction);
          const isGroupTarget = shadowTarget && shadowTarget !== konvaNode;

          if (hoverTweenRef.current) hoverTweenRef.current.destroy();
          if (shadowTweenRef.current) shadowTweenRef.current.destroy();

          const resetProps: any = {
            node: konvaNode,
            duration,
            easing,
            scaleX: resolvedNode.scaleX || 1,
            scaleY: resolvedNode.scaleY || 1,
            x: resolvedNode.x,
            y: resolvedNode.y,
            opacity: resolvedOpacity,
            shadowColor: hasShadow ? (resolvedNode.boxShadow?.color || 'rgba(0,0,0,0.25)') : undefined,
            shadowBlur: hasShadow ? (resolvedNode.boxShadow?.blur ?? 10) : 0,
            shadowOffsetX: hasShadow ? (resolvedNode.boxShadow?.x ?? 0) : 0,
            shadowOffsetY: hasShadow ? (resolvedNode.boxShadow?.y ?? 4) : 0,
            shadowOpacity: hasShadow ? 1 : 0,
            onFinish: () => {
              if (!hasShadow && !isGroupTarget && shadowTarget && shadowTarget.shadowEnabled) {
                shadowTarget.shadowEnabled(false);
                shadowTarget.getLayer()?.batchDraw();
              }
            }
          };

          if (isGroupTarget) {
            delete resetProps.shadowColor;
            delete resetProps.shadowBlur;
            delete resetProps.shadowOffsetX;
            delete resetProps.shadowOffsetY;
            delete resetProps.shadowOpacity;

            const shadowResetProps: any = {
              node: shadowTarget,
              duration,
              easing,
              shadowColor: hasShadow ? (resolvedNode.boxShadow?.color || 'rgba(0,0,0,0.25)') : undefined,
              shadowBlur: hasShadow ? (resolvedNode.boxShadow?.blur ?? 10) : 0,
              shadowOffsetX: hasShadow ? (resolvedNode.boxShadow?.x ?? 0) : 0,
              shadowOffsetY: hasShadow ? (resolvedNode.boxShadow?.y ?? 4) : 0,
              shadowOpacity: hasShadow ? 1 : 0,
              onFinish: () => {
                if (!hasShadow && shadowTarget.shadowEnabled) {
                  shadowTarget.shadowEnabled(false);
                  shadowTarget.getLayer()?.batchDraw();
                }
              }
            };
            shadowTweenRef.current = new Konva.Tween(shadowResetProps);
            shadowTweenRef.current.play();
          }

          hoverTweenRef.current = new Konva.Tween(resetProps);
          hoverTweenRef.current.play();
        }
      }
    },
    onMouseDown: (e: any) => {
      if (mode === 'select') {
        if (e.target === e.target.getStage()) {
          if (!e.evt.shiftKey) selectNodes([]);
        }
      }
      if (mode === 'preview' && masterNode?.variants?.active) {
        setInteractiveState('active');
      }
    },
    onMouseUp: (e: any) => {
      if (mode === 'preview' && interactiveState === 'active') {
        setInteractiveState('hover');
      }
    }
  };

  const isComponentIndicator = (mode === 'select' && !isPreview && (node.isMasterComponent || node.componentId));
  const indicatorStroke = node.isMasterComponent ? '#4A3AFF' : '#C65D3B';

  let content = null;

  if (resolvedNode.type === 'Frame') {
    const childNodes = nodes.filter(n => n.parentId === node.id);
    const { shadowEnabled, shadowColor, shadowBlur, shadowOffsetX, shadowOffsetY, shadowOpacity, ...groupProps } = commonProps;
    content = (
      <Group 
        ref={shapeRef}
        key={node.id} 
        {...groupProps} 
        width={resolvedNode.width}
        height={resolvedNode.height}
        draggable={mode === 'select' && !isPreview}
      >
        <Rect
          x={0}
          y={0}
          width={resolvedNode.width}
          height={resolvedNode.height}
          fill={resolvedNode.fill || '#ffffff'}
          cornerRadius={resolvedNode.cornerRadius}
          stroke={isComponentIndicator ? indicatorStroke : "#cbd5e1"}
          strokeWidth={isComponentIndicator ? 2 : 1}
          dash={node.componentId ? [5, 5] : undefined}
          shadowEnabled={hasShadow}
          shadowColor={shadowProps.shadowColor}
          shadowBlur={shadowProps.shadowBlur}
          shadowOffsetX={shadowProps.shadowOffsetX}
          shadowOffsetY={shadowProps.shadowOffsetY}
          shadowOpacity={shadowProps.shadowOpacity}
        />
        {!isPreview && (
          <Text
            x={0}
            y={-20}
            text={resolvedNode.name ? `${resolvedNode.name}${resolvedNode.variantOf ? ' • Variant' : ''} (${Math.round(resolvedNode.width || 0)}x${Math.round(resolvedNode.height || 0)})` : `Frame - ${Math.round(resolvedNode.width || 0)}x${Math.round(resolvedNode.height || 0)}`}
            fill={resolvedNode.variantOf ? "#4A3AFF" : "#64748b"}
            fontSize={12}
            fontStyle="500"
            fontFamily="Inter, sans-serif"
            listening={false}
          />
        )}
        <Group
          clipX={0} 
          clipY={0} 
          clipWidth={resolvedNode.width} 
          clipHeight={resolvedNode.height}
        >
          {childNodes.map(n => <RenderNode key={n.id} node={n} isPreview={isPreview} context={context} />)}
        </Group>
      </Group>
    );
  } else if (resolvedNode.type === 'Rect') {
    content = (
      <Rect
        ref={shapeRef}
        key={node.id}
        {...commonProps}
        width={resolvedNode.width}
        height={resolvedNode.height}
        cornerRadius={resolvedNode.cornerRadius}
        stroke={isComponentIndicator && !resolvedNode.stroke ? indicatorStroke : resolvedNode.stroke}
        strokeWidth={isComponentIndicator && !resolvedNode.strokeWidth ? 2 : (resolvedNode.strokeWidth || 0)}
        dash={node.componentId && isComponentIndicator ? [5, 5] : undefined}
      />
    );
  } else if (resolvedNode.type === 'Circle') {
    content = (
      <Circle
        ref={shapeRef}
        key={node.id}
        {...commonProps}
        radius={resolvedNode.radius}
        stroke={isComponentIndicator && !resolvedNode.stroke ? indicatorStroke : resolvedNode.stroke}
        strokeWidth={isComponentIndicator && !resolvedNode.strokeWidth ? 2 : (resolvedNode.strokeWidth || 0)}
        dash={node.componentId && isComponentIndicator ? [5, 5] : undefined}
      />
    );
  } else if (resolvedNode.type === 'Triangle') {
    content = (
      <RegularPolygon
        ref={shapeRef}
        key={node.id}
        {...commonProps}
        sides={3}
        radius={resolvedNode.radius || 50}
        stroke={isComponentIndicator && !resolvedNode.stroke ? indicatorStroke : resolvedNode.stroke}
        strokeWidth={isComponentIndicator && !resolvedNode.strokeWidth ? 2 : (resolvedNode.strokeWidth || 0)}
        dash={node.componentId && isComponentIndicator ? [5, 5] : undefined}
      />
    );
  } else if (resolvedNode.type === 'Line') {
    const { shadowEnabled, shadowColor, shadowBlur, shadowOffsetX, shadowOffsetY, shadowOpacity, ...groupProps } = commonProps;
    content = (
      <Group ref={shapeRef} key={node.id} {...groupProps}>
        <Line
          points={resolvedNode.points}
          stroke={isComponentIndicator ? indicatorStroke : resolvedNode.stroke}
          strokeWidth={resolvedNode.strokeWidth}
          tension={resolvedNode.tension || 0}
          fillEnabled={false}
          hitStrokeWidth={15}
          listening={true}
          dash={node.componentId && isComponentIndicator ? [5, 5] : undefined}
          onDblClick={(e) => { e.cancelBubble = true; handleLineDblClick(e, node.id); }}
          shadowEnabled={hasShadow}
          shadowColor={shadowProps.shadowColor}
          shadowBlur={shadowProps.shadowBlur}
          shadowOffsetX={shadowProps.shadowOffsetX}
          shadowOffsetY={shadowProps.shadowOffsetY}
          shadowOpacity={shadowProps.shadowOpacity}
        />
        {mode === 'select' && selectedIds.includes(node.id) && resolvedNode.points && (
          <>
            {Array.from({ length: resolvedNode.points.length / 2 }).map((_, i) => (
              <Circle
                key={`anchor-${i}`}
                name="anchor"
                x={resolvedNode.points![i * 2]}
                y={resolvedNode.points![i * 2 + 1]}
                radius={6}
                fill="#ffffff"
                stroke="#4A3AFF"
                strokeWidth={2}
                draggable={mode === 'select'}
                onDragMove={(e) => handleAnchorDragMove(e, node.id, i)}
                onDragEnd={(e) => handleAnchorDragEnd(e, node.id, i)}
                onDblClick={(e) => { e.cancelBubble = true; handleAnchorDblClick(e, node.id, i); }}
                onMouseEnter={(e) => {
                  const container = e.target.getStage()?.container();
                  if (container) container.style.cursor = 'pointer';
                }}
                onMouseLeave={(e) => {
                  const container = e.target.getStage()?.container();
                  if (container) container.style.cursor = 'default';
                }}
              />
            ))}
          </>
        )}
      </Group>
    );
  } else if (resolvedNode.type === 'Text') {
    content = (
      <Text
        ref={shapeRef}
        key={node.id}
        {...commonProps}
        text={resolvedNode.text}
        fontSize={resolvedNode.fontSize}
        fontFamily={resolvedNode.fontFamily}
        stroke={isComponentIndicator ? indicatorStroke : undefined}
        strokeWidth={isComponentIndicator ? 1 : 0}
      />
    );
  } else if (resolvedNode.type === 'Image') {
    content = <URLImage shapeRef={shapeRef} key={node.id} node={resolvedNode} commonProps={commonProps} shadowProps={shadowProps} />;
  }

  // Add component indicator label in select mode
  if (isComponentIndicator) {
    return (
      <Group key={node.id}>
        {content}
        <Text
          x={resolvedNode.x}
          y={resolvedNode.y - 14}
          text={node.isMasterComponent ? `❖ ${node.componentName || 'Component'}` : `◇ Instance`}
          fill={indicatorStroke}
          fontSize={10}
          fontFamily="Inter"
          fontStyle="bold"
          listening={false}
        />
      </Group>
    );
  }

  return content;
};

export const CanvasArea: React.FC = () => {
  const { nodes, selectedIds, pan, zoom, setPan, setZoom, selectNodes, toggleNodeSelection, updateNode, mode, setMode, connectingSourceId, setConnectingSourceId, previewFrameId, setPreviewFrameId, generateResponsiveVariants, pickingTriggerForNodeId, setPickingTriggerForNodeId, setToastMessage } = useCanvasStore();
  
  const stageRef = useRef<Konva.Stage>(null);
  const transformerRef = useRef<Konva.Transformer>(null);

  const [stageSize, setStageSize] = useState({ width: window.innerWidth, height: window.innerHeight });
  const [errorPopup, setErrorPopup] = useState<string | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [previewDeviceOverride, setPreviewDeviceOverride] = useState<'desktop'|'tablet'|'mobile'|null>(null);
  const [selectionRect, setSelectionRect] = useState<{ startX: number, startY: number, x: number, y: number, width: number, height: number } | null>(null);
  
  useEffect(() => {
    const handleResize = () => {
      setStageSize({
        width: window.innerWidth - (mode === 'preview' ? 0 : 64 + 288),
        height: window.innerHeight - (mode === 'preview' ? 0 : 56),
      });
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [mode]);

  useEffect(() => {
    if (mode === 'preview' || mode === 'connect') {
      if (transformerRef.current) transformerRef.current.nodes([]);
      return;
    }

    if (transformerRef.current && stageRef.current) {
      if (selectedIds.length > 0) {
        const filteredIds = selectedIds.filter(id => {
          const node = nodes.find(n => n.id === id);
          if (!node) return false;
          let curr = node;
          while (curr.parentId) {
            if (selectedIds.includes(curr.parentId)) return false;
            curr = nodes.find(n => n.id === curr.parentId) || ({} as any);
          }
          return true;
        });

        const selectedKonvaNodes = filteredIds.map(id => stageRef.current?.findOne(`#node-${id}`)).filter(Boolean) as Konva.Node[];
        
        // Don't attach transformer to Line directly if it's the only one selected (we use custom anchors)
        if (filteredIds.length === 1) {
          const storeNode = nodes.find(n => n.id === filteredIds[0]);
          if (storeNode && storeNode.type === 'Line') {
            transformerRef.current.nodes([]);
            return;
          }
        }
        
        transformerRef.current.nodes(selectedKonvaNodes);
        transformerRef.current.getLayer()?.batchDraw();
      } else {
        transformerRef.current.nodes([]);
      }
    }
  }, [selectedIds, nodes, zoom, pan, mode]);

  const handleWheel = (e: KonvaEventObject<WheelEvent>) => {
    if (mode === 'preview') return;
    e.evt.preventDefault();
    if (!stageRef.current) return;
    
    const stage = stageRef.current;
    
    if (e.evt.ctrlKey || e.evt.metaKey) {
      const oldScale = stage.scaleX();
      const pointer = stage.getPointerPosition();

      if (!pointer) return;

      const mousePointTo = {
        x: (pointer.x - stage.x()) / oldScale,
        y: (pointer.y - stage.y()) / oldScale,
      };

      const direction = e.evt.deltaY > 0 ? -1 : 1;
      const scaleBy = 1.1;
      const newScale = direction > 0 ? oldScale * scaleBy : oldScale / scaleBy;
      const clampedScale = Math.max(0.1, Math.min(newScale, 5));
      
      const newPos = {
        x: pointer.x - mousePointTo.x * clampedScale,
        y: pointer.y - mousePointTo.y * clampedScale,
      };

      setZoom(clampedScale);
      setPan(newPos);
    } else {
      // Support holding shift for horizontal scroll if user has a standard scroll wheel
      const deltaX = e.evt.shiftKey && e.evt.deltaY !== 0 ? e.evt.deltaY : e.evt.deltaX;
      const deltaY = e.evt.shiftKey && e.evt.deltaY !== 0 ? 0 : e.evt.deltaY;

      setPan({
        x: stage.x() - deltaX,
        y: stage.y() - deltaY
      });
    }
  };

  const handleDragEnd = (e: KonvaEventObject<DragEvent>, id: string) => {
    if (mode !== 'select') return;
    const node = e.target;
    if (node.name() === 'anchor') return;
    if (node === stageRef.current) return;
    
    const storeNode = nodes.find(n => n.id === id);
    if (!storeNode) return;

    let unscaledAbsX = node.x();
    let unscaledAbsY = node.y();
    if (storeNode.parentId) {
      const parentFrame = nodes.find(n => n.id === storeNode.parentId);
      if (parentFrame) {
        unscaledAbsX += parentFrame.x;
        unscaledAbsY += parentFrame.y;
      }
    }

    let updates: any = { x: node.x(), y: node.y() };

    // Allow reparenting for non-Frames, component instances, OR master components
    if (storeNode.type !== 'Frame' || storeNode.componentId || storeNode.isMasterComponent) {
      const centerX = unscaledAbsX + (storeNode.width || 0) / 2;
      const centerY = unscaledAbsY + (storeNode.height || 0) / 2;
      
      let targetFrameId = undefined;
      // Only valid target frames are actual layout frames, not master components or instances themselves
      const frames = nodes.filter(n => n.type === 'Frame' && !n.isMasterComponent && !n.componentId && n.id !== storeNode.id);
      for (let i = frames.length - 1; i >= 0; i--) {
        const frame = frames[i];
        if (
          centerX >= frame.x && centerX <= frame.x + (frame.width || 0) &&
          centerY >= frame.y && centerY <= frame.y + (frame.height || 0)
        ) {
          targetFrameId = frame.id;
          break;
        }
      }

      if (targetFrameId !== storeNode.parentId) {
        updates.parentId = targetFrameId;
        if (targetFrameId) {
          const targetFrame = frames.find(f => f.id === targetFrameId);
          if (targetFrame) {
            updates.x = unscaledAbsX - targetFrame.x;
            updates.y = unscaledAbsY - targetFrame.y;
          }
        } else {
          updates.x = unscaledAbsX;
          updates.y = unscaledAbsY;
        }
      }
    }

    updateNode(id, updates, true);
  };

  const handleTransformEnd = (e: KonvaEventObject<Event>, id: string) => {
    if (mode !== 'select') return;
    const node = e.target;
    const scaleX = node.scaleX();
    const scaleY = node.scaleY();
    
    const updates: any = {
      x: node.x(),
      y: node.y(),
      rotation: node.rotation()
    };

    const storeNode = nodes.find(n => n.id === id);
    if (!storeNode) return;

    if (storeNode.type === 'Rect' || storeNode.type === 'Image' || storeNode.type === 'Frame') {
      const w = node.width();
      const h = node.height();
      node.scaleX(1);
      node.scaleY(1);
      const newW = Math.max(5, Math.abs(w * scaleX));
      const newH = Math.max(5, Math.abs(h * scaleY));
      updates.width = newW;
      updates.height = newH;

      if (storeNode.type === 'Frame') {
        const ratioX = newW / Math.max(1, w);
        const ratioY = newH / Math.max(1, h);
        if (ratioX !== 1 || ratioY !== 1) {
          const scaleChildren = (parentId: string, rx: number, ry: number) => {
            nodes.filter(n => n.parentId === parentId).forEach(child => {
              const childUpdates: any = {
                x: child.x * rx,
                y: child.y * ry,
              };
              if (child.width !== undefined) childUpdates.width = child.width * rx;
              if (child.height !== undefined) childUpdates.height = child.height * ry;
              if (child.radius !== undefined) childUpdates.radius = child.radius * Math.min(rx, ry);
              if (child.fontSize !== undefined) childUpdates.fontSize = child.fontSize * Math.min(rx, ry);
              if (child.points !== undefined) {
                childUpdates.points = child.points.map((p, i) => i % 2 === 0 ? p * rx : p * ry);
              }
              updateNode(child.id, childUpdates, false);
              scaleChildren(child.id, rx, ry);
            });
          };
          scaleChildren(id, ratioX, ratioY);
        }
      }
    } else if (storeNode.type === 'Circle' || storeNode.type === 'Triangle') {
      updates.scaleX = scaleX;
      updates.scaleY = scaleY;
    } else if (storeNode.type === 'Text') {
      const fs = (node as any).fontSize ? (node as any).fontSize() : (storeNode.fontSize || 16);
      node.scaleX(1);
      node.scaleY(1);
      updates.fontSize = Math.max(8, Math.abs(fs * scaleX));
    }

    updateNode(id, updates, true);
  };

  const handleAnchorDragMove = (e: KonvaEventObject<DragEvent>, nodeId: string, index: number) => {
    if (mode !== 'select') return;
    const storeNode = nodes.find(n => n.id === nodeId);
    if (!storeNode || !storeNode.points) return;
    const newPoints = [...storeNode.points];
    newPoints[index * 2] = e.target.x();
    newPoints[index * 2 + 1] = e.target.y();
    updateNode(nodeId, { points: newPoints }, false);
  };

  const handleAnchorDragEnd = (e: KonvaEventObject<DragEvent>, nodeId: string, index: number) => {
    if (mode !== 'select') return;
    const storeNode = nodes.find(n => n.id === nodeId);
    if (!storeNode || !storeNode.points) return;
    const newPoints = [...storeNode.points];
    newPoints[index * 2] = e.target.x();
    newPoints[index * 2 + 1] = e.target.y();
    updateNode(nodeId, { points: newPoints }, true);
  };

  const getDistanceToSegment = (p: any, v: any, w: any) => {
    const l2 = (v.x - w.x) ** 2 + (v.y - w.y) ** 2;
    if (l2 === 0) return Math.sqrt((p.x - v.x) ** 2 + (p.y - v.y) ** 2);
    let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
    t = Math.max(0, Math.min(1, t));
    return Math.sqrt((p.x - (v.x + t * (w.x - v.x))) ** 2 + (p.y - (v.y + t * (w.y - v.y))) ** 2);
  };

  const handleLineDblClick = (e: KonvaEventObject<MouseEvent>, nodeId: string) => {
    if (mode !== 'select' || !selectedIds.includes(nodeId)) return;
    const storeNode = nodes.find(n => n.id === nodeId);
    if (!storeNode || !storeNode.points) return;
    
    const pos = e.target.getRelativePointerPosition();
    if (!pos) return;

    const pts = storeNode.points;
    let minDist = Infinity;
    let insertIndex = -1;

    for (let i = 0; i < pts.length - 2; i += 2) {
      const p1 = { x: pts[i], y: pts[i+1] };
      const p2 = { x: pts[i+2], y: pts[i+3] };
      const dist = getDistanceToSegment(pos, p1, p2);
      if (dist < minDist) {
        minDist = dist;
        insertIndex = i + 2;
      }
    }

    if (minDist < 30 && insertIndex !== -1) {
      const newPoints = [...pts];
      newPoints.splice(insertIndex, 0, pos.x, pos.y);
      updateNode(nodeId, { points: newPoints }, true);
    }
  };

  const handleAnchorDblClick = (e: KonvaEventObject<MouseEvent>, nodeId: string, index: number) => {
    if (mode !== 'select') return;
    const storeNode = nodes.find(n => n.id === nodeId);
    if (!storeNode || !storeNode.points) return;
    if (storeNode.points.length <= 4) return;
    
    const newPoints = [...storeNode.points];
    newPoints.splice(index * 2, 2);
    updateNode(nodeId, { points: newPoints }, true);
  };

  const handleNodeClick = (e: any, node: CanvasNode, isDoubleClick: boolean = false) => {
    e.cancelBubble = true;
    (document.activeElement as HTMLElement)?.blur();

    if (pickingTriggerForNodeId) {
      const animatedNode = nodes.find(n => n.id === pickingTriggerForNodeId);
      if (animatedNode) {
        if (node.id === animatedNode.id) {
          // User clicked self -> reset trigger to self
          updateNode(pickingTriggerForNodeId, {
            animation: {
              ...animatedNode.animation,
              type: animatedNode.animation?.type || 'bounce',
              duration: animatedNode.animation?.duration || 1000,
              infinite: animatedNode.animation?.infinite ?? true,
              triggerNodeId: undefined,
            }
          }, true);
          setToastMessage(`Trigger source set to self for "${animatedNode.name}"`);
        } else {
          // User clicked trigger element -> bind triggerNodeId
          updateNode(pickingTriggerForNodeId, {
            animation: {
              ...animatedNode.animation,
              type: animatedNode.animation?.type || 'bounce',
              duration: animatedNode.animation?.duration || 1000,
              infinite: animatedNode.animation?.infinite ?? true,
              triggerNodeId: node.id,
            }
          }, true);
          setToastMessage(`Animation trigger set to "${node.name}"`);
        }
      }
      setPickingTriggerForNodeId(null);
      return;
    }

    if (mode === 'preview') {
      if (node.linkTo) {
        const targetNode = nodes.find(n => n.id === node.linkTo);
        if (!targetNode) return;
        // Always resolve to the primary (non-variant) target frame
        const primaryTargetId = targetNode.variantOf || targetNode.id;
        setPreviewFrameId(primaryTargetId);
      }
      return;
    }
    
    if (mode === 'connect') {
      const findRootLayoutFrame = (startNode: CanvasNode): CanvasNode | undefined => {
        let curr: CanvasNode | undefined = startNode;
        while (curr && curr.parentId) {
          const p = nodes.find(n => n.id === curr!.parentId);
          if (p && p.type === 'Frame' && !p.isMasterComponent && !p.componentId) {
            return p;
          }
          curr = p;
        }
        if (curr && curr.type === 'Frame' && !curr.isMasterComponent && !curr.componentId) {
          return curr;
        }
        return undefined;
      };

      if (connectingSourceId) {
        const sourceNode = nodes.find(n => n.id === connectingSourceId);
        const sourceFrame = sourceNode ? findRootLayoutFrame(sourceNode) : undefined;
        const targetFrame = findRootLayoutFrame(node);
        
        if (sourceNode && sourceFrame && targetFrame && targetFrame.type === 'Frame') {
          const sType = sourceFrame.frameType || 'desktop';
          const tType = targetFrame.frameType || 'desktop';
          if (sType === tType) {
            updateNode(connectingSourceId, { linkTo: targetFrame.id }, true);
            // Also link the parent component if sourceNode is inside a component
            let curr = sourceNode;
            while (curr && curr.parentId) {
              const parent = nodes.find(n => n.id === curr.parentId);
              if (parent && (parent.isMasterComponent || parent.componentId)) {
                updateNode(parent.id, { linkTo: targetFrame.id }, true);
              }
              curr = parent!;
            }
          } else {
            setErrorPopup(`Cannot connect a ${sType} to a ${tType}. Frames must be of the same type.`);
          }
        }
        setConnectingSourceId(null);
      } else {
        if (node.parentId || node.type !== 'Frame' || node.isMasterComponent || node.componentId) {
          setConnectingSourceId(node.id);
        }
      }
      return;
    }
    
    let targetNode = node;
    if (!isDoubleClick) {
      let rootComponent = null;
      let curr = node;
      while (curr.parentId) {
        const parent = nodes.find(n => n.id === curr.parentId);
        if (!parent) break;
        if (parent.isMasterComponent || parent.componentId) {
          rootComponent = parent;
        }
        curr = parent;
      }
      if (rootComponent) {
        targetNode = rootComponent;
      }
    }

    if (e.evt.shiftKey || e.evt.ctrlKey || e.evt.metaKey) {
      toggleNodeSelection(targetNode.id);
    } else {
      selectNodes([targetNode.id]);
    }
  };

  const nodeContext: NodeContext = {
    nodes,
    selectedIds,
    mode,
    selectNodes,
    toggleNodeSelection,
    handleNodeClick,
    handleDragEnd,
    handleTransformEnd,
    handleLineDblClick,
    handleAnchorDragMove,
    handleAnchorDragEnd,
    handleAnchorDblClick,
  };

  if (mode === 'preview' && previewFrameId) {
    const selectedFrame = nodes.find(n => n.id === previewFrameId);
    if (!selectedFrame) return null;

    const primaryFrame = selectedFrame.variantOf 
      ? nodes.find(n => n.id === selectedFrame.variantOf) || selectedFrame 
      : selectedFrame;

    const baseName = (primaryFrame.name || '').replace(/\s*-\s*(Desktop|Tablet|Mobile)$/i, '');
    const variantFrames = nodes.filter(n =>
      n.type === 'Frame' &&
      !n.parentId &&
      n.id !== primaryFrame.id &&
      (n.variantOf === primaryFrame.id || (n.name && baseName && n.name.startsWith(baseName)))
    );

    const desktopFrame = primaryFrame.frameType === 'desktop' ? primaryFrame : variantFrames.find(v => v.frameType === 'desktop') || primaryFrame;
    const tabletFrame = primaryFrame.frameType === 'tablet' ? primaryFrame : variantFrames.find(v => v.frameType === 'tablet');
    const mobileFrame = primaryFrame.frameType === 'mobile' ? primaryFrame : variantFrames.find(v => v.frameType === 'mobile');

    // Use manual override if set, otherwise auto-detect from window width
    let activePreviewFrame = desktopFrame;
    if (previewDeviceOverride === 'mobile' && mobileFrame) {
      activePreviewFrame = mobileFrame;
    } else if (previewDeviceOverride === 'tablet' && tabletFrame) {
      activePreviewFrame = tabletFrame;
    } else if (previewDeviceOverride === 'desktop') {
      activePreviewFrame = desktopFrame;
    } else if (!previewDeviceOverride) {
      // Auto mode based on window width
      if (stageSize.width <= 640 && mobileFrame) {
        activePreviewFrame = mobileFrame;
      } else if (stageSize.width <= 1024 && tabletFrame) {
        activePreviewFrame = tabletFrame;
      }
    }

    const padding = 40;
    const previewScaleX = (stageSize.width - padding * 2) / (activePreviewFrame.width || 1);
    const previewScaleY = ((stageSize.height - 56) - padding * 2) / (activePreviewFrame.height || 1);
    const fitScale = Math.min(previewScaleX, previewScaleY, 1);
    
    const centeredX = (stageSize.width - (activePreviewFrame.width || 0) * fitScale) / 2;
    const centeredY = 20;

    const modifiedPreviewFrame = { ...activePreviewFrame, x: 0, y: 0 };
    const activeDevice = activePreviewFrame.frameType || 'desktop';

    const deviceButtons: { key: 'desktop'|'tablet'|'mobile', icon: React.ReactNode, label: string, available: boolean }[] = [
      { key: 'desktop', icon: <Monitor size={16} />, label: 'Desktop', available: !!desktopFrame },
      { key: 'tablet', icon: <Tablet size={16} />, label: 'Tablet', available: !!tabletFrame },
      { key: 'mobile', icon: <Smartphone size={16} />, label: 'Mobile', available: !!mobileFrame },
    ];

    return (
      <div className="fixed inset-0 bg-black z-50 flex flex-col">
        <div className="h-14 flex items-center justify-between px-6 bg-slate-900 text-white shrink-0">
          <div className="flex items-center gap-3">
            <span className="font-semibold text-sm">Previewing: {primaryFrame.name || 'Screen'}</span>
            <span className="px-2 py-0.5 rounded text-xs font-mono font-bold bg-indigo-600 text-white uppercase tracking-wide">
              {activeDevice.toUpperCase()} ({Math.round(activePreviewFrame.width || 0)}×{Math.round(activePreviewFrame.height || 0)})
            </span>
          </div>
          <div className="flex items-center gap-2">
            {/* Device dimension toggle buttons */}
            <div className="flex items-center bg-slate-800 rounded-lg p-0.5 gap-0.5">
              {deviceButtons.map(btn => (
                <button
                  key={btn.key}
                  onClick={() => setPreviewDeviceOverride(btn.key)}
                  disabled={!btn.available}
                  title={btn.available ? btn.label : `${btn.label} (no variant)`}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                    activeDevice === btn.key
                      ? 'bg-indigo-600 text-white shadow-md'
                      : btn.available
                        ? 'text-slate-400 hover:text-white hover:bg-slate-700'
                        : 'text-slate-600 cursor-not-allowed opacity-50'
                  }`}
                >
                  {btn.icon}
                  <span className="hidden sm:inline">{btn.label}</span>
                </button>
              ))}
              {previewDeviceOverride && (
                <button
                  onClick={() => setPreviewDeviceOverride(null)}
                  title="Auto (follow window size)"
                  className="flex items-center gap-1 px-2 py-1.5 rounded-md text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-700 transition-all ml-0.5 border-l border-slate-700 pl-2"
                >
                  Auto
                </button>
              )}
            </div>
            <button 
              onClick={() => { setMode('select'); setPreviewDeviceOverride(null); }}
              className="flex items-center gap-2 px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 transition-colors text-sm font-medium ml-2"
            >
              <X size={16} /> Exit Preview
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-hidden">
          <Stage width={stageSize.width} height={stageSize.height - 56}>
            <Layer x={centeredX} y={centeredY} scaleX={fitScale} scaleY={fitScale}>
              <RenderNode node={modifiedPreviewFrame} isPreview={true} context={nodeContext} />
            </Layer>
          </Stage>
        </div>
      </div>
    );
  }

  const getNodeCanvasBounds = (nodeId: string) => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return null;

    let absX = node.x;
    let absY = node.y;
    let curr = node;
    while (curr.parentId) {
      const parent = nodes.find(n => n.id === curr.parentId);
      if (!parent) break;
      absX += parent.x;
      absY += parent.y;
      curr = parent;
    }
    const w = node.width || (node.radius ? node.radius * 2 : 100);
    const h = node.height || (node.radius ? node.radius * 2 : 100);
    const isCentered = node.type === 'Circle' || node.type === 'Triangle';
    const finalX = isCentered ? absX - w/2 : absX;
    const finalY = isCentered ? absY - h/2 : absY;

    return {
      x: finalX,
      y: finalY,
      width: w,
      height: h,
      centerX: finalX + w / 2,
      centerY: finalY + h / 2,
    };
  };

  const getConnectionPoints = () => {
    const lines: { id: string, points: number[] }[] = [];

    const getFrameCenter = (frame: CanvasNode) => ({
      x: frame.x + (frame.width || 0) / 2,
      y: frame.y + (frame.height || 0) / 2,
    });

    const getEdgePoint = (frame: CanvasNode, targetCenter: { x: number, y: number }) => {
      const cx = frame.x + (frame.width || 0) / 2;
      const cy = frame.y + (frame.height || 0) / 2;
      const fw = (frame.width || 0) / 2;
      const fh = (frame.height || 0) / 2;
      const dx = targetCenter.x - cx;
      const dy = targetCenter.y - cy;
      
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return { x: cx + fw, y: cy };
      
      // Check which edge the line crosses
      const absDx = Math.abs(dx);
      const absDy = Math.abs(dy);
      
      if (absDx / fw > absDy / fh) {
        // Exits from left or right edge
        const sign = dx > 0 ? 1 : -1;
        return { x: cx + sign * fw, y: cy + dy * (fw / absDx) };
      } else {
        // Exits from top or bottom edge
        const sign = dy > 0 ? 1 : -1;
        return { x: cx + dx * (fh / absDy), y: cy + sign * fh };
      }
    };

    const drawnPairs = new Set<string>();

    nodes.forEach(node => {
      if (node.linkTo && node.parentId) {
        const sourceFrame = nodes.find(n => n.id === node.parentId);
        if (!sourceFrame || sourceFrame.type !== 'Frame') return;

        // Determine the source frame's device type
        const sourceFrameType = sourceFrame.frameType || 'desktop';

        // Resolve target: find matching variant of the target for this device type
        let targetFrame = nodes.find(n => n.id === node.linkTo);
        if (!targetFrame) return;

        // Get the primary target ID
        const primaryTargetId = targetFrame.variantOf || targetFrame.id;

        // If source is a variant frame, try to find matching variant of the target
        if (sourceFrame.variantOf) {
          const matchingVariant = nodes.find(n =>
            n.variantOf === primaryTargetId &&
            n.frameType === sourceFrameType &&
            n.type === 'Frame'
          );
          if (matchingVariant) {
            targetFrame = matchingVariant;
          } else {
            // Fall back to the primary target
            const primaryTarget = nodes.find(n => n.id === primaryTargetId);
            if (primaryTarget) targetFrame = primaryTarget;
          }
        } else {
          // Source is primary — resolve target to primary too
          if (targetFrame.variantOf) {
            const primaryTarget = nodes.find(n => n.id === targetFrame!.variantOf);
            if (primaryTarget) targetFrame = primaryTarget;
          }
        }

        // Deduplicate: only one arrow per source-frame → target-frame pair
        const pairKey = `${sourceFrame.id}->${targetFrame.id}`;
        if (drawnPairs.has(pairKey)) return;
        drawnPairs.add(pairKey);

        const sourceBounds = getNodeCanvasBounds(node.id);
        if (sourceBounds && targetFrame && targetFrame.type === 'Frame') {
          const start = { x: sourceBounds.centerX, y: sourceBounds.centerY };
          const end = getEdgePoint(targetFrame, start);
          lines.push({ id: node.id, points: [start.x, start.y, end.x, end.y] });
        }
      }
    });

    if (mode === 'connect' && connectingSourceId && stageRef.current) {
      const sourceBounds = getNodeCanvasBounds(connectingSourceId);
      if (sourceBounds) {
        const stage = stageRef.current;
        const pointer = stage.getPointerPosition();
        if (pointer) {
          const mouseX = (pointer.x - stage.x()) / stage.scaleX();
          const mouseY = (pointer.y - stage.y()) / stage.scaleY();
          const start = { x: sourceBounds.centerX, y: sourceBounds.centerY };
          lines.push({ id: 'temp', points: [start.x, start.y, mouseX, mouseY] });
        }
      }
    }
    return lines;
  };

  const rootNodes = nodes.filter(n => !n.parentId);

  return (
    <div className="flex-1 bg-canvas-grid relative overflow-hidden" style={{ cursor: mode === 'connect' ? 'crosshair' : 'default' }}>
      <Stage
        width={stageSize.width}
        height={stageSize.height}
        onWheel={handleWheel}
        ref={stageRef}
        scaleX={zoom}
        scaleY={zoom}
        x={pan.x}
        y={pan.y}
        draggable={mode === 'select' && !selectionRect}
        onMouseMove={(e) => {
          if (mode === 'connect' && connectingSourceId) {
            stageRef.current?.draw();
          }
          if (selectionRect && stageRef.current) {
            const pointer = stageRef.current.getPointerPosition();
            if (pointer) {
              const unscaledX = (pointer.x - stageRef.current.x()) / zoom;
              const unscaledY = (pointer.y - stageRef.current.y()) / zoom;
              setSelectionRect({
                ...selectionRect,
                x: Math.min(selectionRect.startX, unscaledX),
                y: Math.min(selectionRect.startY, unscaledY),
                width: Math.abs(unscaledX - selectionRect.startX),
                height: Math.abs(unscaledY - selectionRect.startY),
              });
            }
          }
        }}
        onDragMove={(e) => {}}
        onDragEnd={(e) => {
          if (mode === 'select' && e.target === stageRef.current) {
            setPan({ x: e.target.x(), y: e.target.y() });
          }
        }}
        onMouseDown={(e) => {
          (document.activeElement as HTMLElement)?.blur();
          const target = e.target;
          const isStage = target === target.getStage();
          const clickedKonvaId = target.attrs?.id || target.parent?.attrs?.id || '';
          const clickedNodeId = clickedKonvaId.replace('node-', '');
          const clickedNode = nodes.find(n => n.id === clickedNodeId);
          const isFrameBg = clickedNode?.type === 'Frame' && !clickedNode.componentId && !clickedNode.isMasterComponent;

          if (isStage || isFrameBg) {
            if (mode === 'select') {
              if (!e.evt.shiftKey && !e.evt.ctrlKey && !e.evt.metaKey) {
                if (isStage) selectNodes([]);
              }
              const pointer = stageRef.current?.getPointerPosition();
              if (pointer && stageRef.current) {
                const unscaledX = (pointer.x - stageRef.current.x()) / zoom;
                const unscaledY = (pointer.y - stageRef.current.y()) / zoom;
                setSelectionRect({ startX: unscaledX, startY: unscaledY, x: unscaledX, y: unscaledY, width: 0, height: 0 });
              }
            }
            if (mode === 'connect') setConnectingSourceId(null);
          }
        }}
        onMouseUp={(e) => {
          if (selectionRect && stageRef.current) {
            const r1 = selectionRect;
            setSelectionRect(null);

            if (r1.width > 5 || r1.height > 5) {
              const newSelectedIds = (e.evt.shiftKey || e.evt.ctrlKey || e.evt.metaKey) ? [...selectedIds] : [];
              
              nodes.forEach(node => {
                if (node.type === 'Frame') return; // Don't marquee select layout frames
                
                // Recursively compute absolute canvas coords for nested nodes inside frames
                let absX = node.x;
                let absY = node.y;
                let currParentId = node.parentId;
                while (currParentId) {
                  const parent = nodes.find(n => n.id === currParentId);
                  if (!parent) break;
                  absX += parent.x;
                  absY += parent.y;
                  currParentId = parent.parentId;
                }
                
                const scaleX = node.scaleX || 1;
                const scaleY = node.scaleY || 1;
                const w = (node.width || (node.radius ? node.radius * 2 : 100)) * scaleX;
                const h = (node.height || (node.radius ? node.radius * 2 : 100)) * scaleY;
                const r2 = { x: absX, y: absY, width: w, height: h };

                if (node.type === 'Circle' || node.type === 'Triangle') {
                  r2.x -= w / 2;
                  r2.y -= h / 2;
                }

                if (r1.x < r2.x + r2.width && r1.x + r1.width > r2.x &&
                    r1.y < r2.y + r2.height && r1.y + r1.height > r2.y) {
                  if (!newSelectedIds.includes(node.id)) {
                    newSelectedIds.push(node.id);
                  }
                }
              });
              
              if (newSelectedIds.length > 0) {
                selectNodes(newSelectedIds);
              }
            }
          }
        }}
      >
        <Layer>
          {rootNodes.map(n => <RenderNode key={n.id} node={n} context={nodeContext} />)}

          {/* Connect mode: highlight all frames as potential targets */}
          {mode === 'connect' && nodes.filter(n => n.type === 'Frame' && !n.parentId && !n.isMasterComponent && !n.componentId).map(frame => (
            <Rect
              key={`frame-highlight-${frame.id}`}
              x={frame.x}
              y={frame.y}
              width={frame.width || 100}
              height={frame.height || 100}
              stroke={connectingSourceId ? '#10B981' : '#94A3B8'}
              strokeWidth={3}
              cornerRadius={4}
              dash={[8, 4]}
              fill="transparent"
              listening={false}
            />
          ))}

          {/* Highlight for all elements that have connections */}
          {mode === 'connect' && nodes.filter(n => n.linkTo && n.id !== connectingSourceId).map(connectedNode => {
            const bounds = getNodeCanvasBounds(connectedNode.id);
            if (!bounds) return null;
            return (
              <Group key={`trigger-hl-${connectedNode.id}`}>
                <Rect
                  x={bounds.x - 4}
                  y={bounds.y - 4}
                  width={bounds.width + 8}
                  height={bounds.height + 8}
                  cornerRadius={connectedNode.cornerRadius || (connectedNode.type === 'Circle' ? bounds.width/2 : 4)}
                  stroke="#4A3AFF"
                  strokeWidth={2}
                  fill="rgba(74, 58, 255, 0.08)"
                  dash={[4, 2]}
                  listening={false}
                />
                <Circle
                  x={bounds.centerX}
                  y={bounds.centerY}
                  radius={5}
                  fill="#4A3AFF"
                  stroke="white"
                  strokeWidth={2}
                  listening={false}
                />
              </Group>
            );
          })}

          {/* Highlight for connection source */}
          {mode === 'connect' && connectingSourceId && (() => {
            const sourceNode = nodes.find(n => n.id === connectingSourceId);
            if (!sourceNode) return null;
            const bounds = getNodeCanvasBounds(sourceNode.id);
            if (!bounds) return null;
            
            return (
              <>
                <Rect
                  x={bounds.x - 6}
                  y={bounds.y - 6}
                  width={bounds.width + 12}
                  height={bounds.height + 12}
                  cornerRadius={sourceNode.cornerRadius || (sourceNode.type === 'Circle' ? bounds.width/2 : 6)}
                  stroke="#4A3AFF"
                  strokeWidth={3}
                  fill="rgba(74, 58, 255, 0.12)"
                  dash={[6, 3]}
                  listening={false}
                />
                {/* Label above source */}
                <Group x={bounds.centerX} y={bounds.y - 28}>
                  <Rect
                    x={-40}
                    y={0}
                    width={80}
                    height={20}
                    fill="#4A3AFF"
                    cornerRadius={4}
                    listening={false}
                  />
                  <Text
                    text="SOURCE"
                    fill="white"
                    fontSize={11}
                    fontStyle="bold"
                    fontFamily="Inter, sans-serif"
                    x={-40}
                    y={3}
                    width={80}
                    align="center"
                    listening={false}
                  />
                </Group>
              </>
            );
          })()}

          {/* Connection arrows - visible in both select and connect modes */}
          {(mode === 'connect' || mode === 'select') && getConnectionPoints().map(line => (
            <Group key={`conn-group-${line.id}`}>
              <Arrow
                key={`conn-${line.id}`}
                points={line.points}
                stroke={line.id === 'temp' ? '#4A3AFF' : (mode === 'select' ? '#94A3B8' : '#4A3AFF')}
                strokeWidth={line.id === 'temp' ? 2 : (mode === 'select' ? 2 : 4)}
                fill={mode === 'select' ? '#94A3B8' : '#4A3AFF'}
                pointerLength={mode === 'select' ? 10 : 15}
                pointerWidth={mode === 'select' ? 10 : 15}
                dash={line.id === 'temp' ? [6, 6] : undefined}
                opacity={line.id === 'temp' ? 0.6 : (mode === 'select' ? 0.5 : 1)}
                shadowColor={mode === 'select' ? undefined : '#4A3AFF'}
                shadowBlur={line.id === 'temp' ? 0 : (mode === 'select' ? 0 : 8)}
                shadowOpacity={mode === 'select' ? 0 : 0.3}
                listening={false}
              />
              {/* Delete button at midpoint of established connections */}
              {mode === 'connect' && line.id !== 'temp' && (
                <Group
                  x={(line.points[0] + line.points[2]) / 2}
                  y={(line.points[1] + line.points[3]) / 2}
                  listening={true}
                  onClick={(e) => {
                    e.cancelBubble = true;
                    updateNode(line.id, { linkTo: undefined }, true);
                  }}
                  onMouseEnter={(e) => {
                    const container = e.target.getStage()?.container();
                    if (container) container.style.cursor = 'pointer';
                  }}
                  onMouseLeave={(e) => {
                    const container = e.target.getStage()?.container();
                    if (container) container.style.cursor = 'crosshair';
                  }}
                >
                  <Circle radius={14} fill="#EF4444" shadowColor="rgba(0,0,0,0.3)" shadowBlur={6} shadowOffsetY={2} />
                  <Text text="✕" fill="white" fontSize={14} fontStyle="bold" fontFamily="Inter, sans-serif" x={-5} y={-7} listening={false} />
                </Group>
              )}
            </Group>
          ))}

          {/* Animation Trigger Connectors */}
          {(mode === 'select' || pickingTriggerForNodeId) && nodes
            .filter(targetNode => targetNode.animation?.triggerNodeId && targetNode.animation?.type !== 'none')
            .map(targetNode => {
              const triggerNodeId = targetNode.animation!.triggerNodeId!;
              const triggerNode = nodes.find(n => n.id === triggerNodeId);
              if (!triggerNode) return null;

              const isTargetSelected = selectedIds.includes(targetNode.id);
              const isTriggerSelected = selectedIds.includes(triggerNode.id);
              const isPickingThis = pickingTriggerForNodeId === targetNode.id;
              
              // Display connector line if either element is selected or when picking mode is active for targetNode
              if (!isTargetSelected && !isTriggerSelected && !isPickingThis) return null;

              const sourceBounds = getNodeCanvasBounds(triggerNode.id);
              const targetBounds = getNodeCanvasBounds(targetNode.id);
              if (!sourceBounds || !targetBounds) return null;

              const points = [sourceBounds.centerX, sourceBounds.centerY, targetBounds.centerX, targetBounds.centerY];
              const midX = (sourceBounds.centerX + targetBounds.centerX) / 2;
              const midY = (sourceBounds.centerY + targetBounds.centerY) / 2;

              const actionText = targetNode.animation?.trigger?.toUpperCase() || 'CLICK';

              return (
                <Group key={`anim-trigger-link-${targetNode.id}`}>
                  {/* Source outline highlight box */}
                  <Rect
                    x={sourceBounds.x - 4}
                    y={sourceBounds.y - 4}
                    width={sourceBounds.width + 8}
                    height={sourceBounds.height + 8}
                    cornerRadius={triggerNode.cornerRadius || 6}
                    stroke="#8B5CF6"
                    strokeWidth={2}
                    fill="rgba(139, 92, 246, 0.08)"
                    dash={[5, 3]}
                    listening={false}
                  />
                  {/* Source badge pill overlay */}
                  <Group x={sourceBounds.centerX} y={sourceBounds.y - 24} listening={false}>
                    <Rect
                      x={-60}
                      y={0}
                      width={120}
                      height={20}
                      fill="#8B5CF6"
                      cornerRadius={10}
                      shadowColor="rgba(0,0,0,0.2)"
                      shadowBlur={4}
                    />
                    <Text
                      text={`⚡ ON ${actionText}: ${(targetNode.name || 'Element').toUpperCase()}`}
                      fill="white"
                      fontSize={9}
                      fontStyle="bold"
                      fontFamily="Inter, sans-serif"
                      x={-60}
                      y={4}
                      width={120}
                      align="center"
                    />
                  </Group>

                  {/* Connector Arrow Line */}
                  <Arrow
                    points={points}
                    stroke="#8B5CF6"
                    strokeWidth={2.5}
                    fill="#8B5CF6"
                    pointerLength={12}
                    pointerWidth={10}
                    dash={[8, 4]}
                    shadowColor="#8B5CF6"
                    shadowBlur={6}
                    shadowOpacity={0.4}
                    listening={false}
                  />

                  {/* Delete button at center of line */}
                  <Group
                    x={midX}
                    y={midY}
                    listening={true}
                    onClick={(e) => {
                      e.cancelBubble = true;
                      updateNode(targetNode.id, {
                        animation: {
                          ...targetNode.animation,
                          type: targetNode.animation?.type || 'bounce',
                          duration: targetNode.animation?.duration || 1000,
                          infinite: targetNode.animation?.infinite ?? true,
                          triggerNodeId: undefined,
                        }
                      }, true);
                      setToastMessage(`Reset trigger source to self for "${targetNode.name}"`);
                    }}
                    onMouseEnter={(e) => {
                      const container = e.target.getStage()?.container();
                      if (container) container.style.cursor = 'pointer';
                    }}
                    onMouseLeave={(e) => {
                      const container = e.target.getStage()?.container();
                      if (container) container.style.cursor = 'default';
                    }}
                  >
                    <Circle radius={13} fill="#EF4444" shadowColor="rgba(0,0,0,0.3)" shadowBlur={4} shadowOffsetY={1} />
                    <Text text="✕" fill="white" fontSize={12} fontStyle="bold" fontFamily="Inter, sans-serif" x={-4} y={-6} listening={false} />
                  </Group>
                </Group>
              );
            })}

          {selectionRect && (
            <Rect
              x={selectionRect.x}
              y={selectionRect.y}
              width={selectionRect.width}
              height={selectionRect.height}
              fill="rgba(74, 58, 255, 0.1)"
              stroke="#4A3AFF"
              strokeWidth={1}
              listening={false}
            />
          )}

          {mode === 'select' && selectedIds.length > 0 && (
            <Transformer
              ref={transformerRef}
            />
          )}
        </Layer>
      </Stage>

      {/* Picking trigger target mode banner */}
      {pickingTriggerForNodeId && (() => {
        const animNode = nodes.find(n => n.id === pickingTriggerForNodeId);
        return (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-40 bg-indigo-900/90 text-white px-5 py-2.5 rounded-full shadow-xl border border-indigo-400/40 flex items-center gap-3 backdrop-blur-md">
            <div className="flex items-center gap-2 text-xs font-semibold">
              <Target size={16} className="text-indigo-300 animate-spin" />
              <span>Click any element to trigger <span className="text-indigo-200 underline font-bold">{animNode?.name || 'Element'}</span>'s animation</span>
            </div>
            <button 
              onClick={() => setPickingTriggerForNodeId(null)}
              className="text-xs bg-indigo-700/70 hover:bg-indigo-700 px-2.5 py-1 rounded-full font-medium transition-colors flex items-center gap-1"
            >
              <X size={12} /> Cancel (Esc)
            </button>
          </div>
        );
      })()}

      {/* Connect mode status bar */}
      {mode === 'connect' && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 pointer-events-none">
          <div className="bg-slate-900/90 backdrop-blur-sm text-white px-5 py-3 rounded-xl shadow-lg flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${connectingSourceId ? 'bg-emerald-400 animate-pulse' : 'bg-blue-400'}`} />
            <span className="text-sm font-medium">
              {connectingSourceId
                ? '✨ Now click the target frame to create the connection'
                : '👆 Click an element inside a frame to start a connection'}
            </span>
          </div>
        </div>
      )}

      {errorPopup && (
        <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center z-50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-[400px] p-6 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center text-[#C65D3B] shrink-0">
                <AlertCircle size={20} />
              </div>
              <h3 className="font-heading font-bold text-lg text-slate-800">Connection Error</h3>
            </div>
            <p className="text-slate-600 mb-6 leading-relaxed">{errorPopup}</p>
            <div className="flex justify-end">
              <button 
                onClick={() => setErrorPopup(null)}
                className="px-6 py-2 rounded-xl text-white font-medium transition-colors shadow-sm"
                style={{ backgroundColor: '#4A3AFF' }}
                onMouseOver={(e) => e.currentTarget.style.opacity = '0.9'} 
                onMouseOut={(e) => e.currentTarget.style.opacity = '1'}
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
