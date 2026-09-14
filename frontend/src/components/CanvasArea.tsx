import React, { useRef, useEffect, useState } from 'react';
import { Stage, Layer, Rect, Circle, Text, Transformer, Group, Image as KonvaImage, RegularPolygon, Line, Arrow } from 'react-konva';
import { useCanvasStore } from '../store/useCanvasStore';
import type { CanvasNode } from '../store/useCanvasStore';
import Konva from 'konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import useImage from 'use-image';
import { X, AlertCircle } from 'lucide-react';

const URLImage = ({ node, commonProps }: any) => {
  const [image] = useImage(node.src || '');
  if (!image) {
    return (
      <Group {...commonProps}>
        <Rect width={node.width} height={node.height} fill="#e2e8f0" stroke="#cbd5e1" strokeWidth={2} dash={[5, 5]} />
        <Text text="Loading..." width={node.width} height={node.height} verticalAlign="middle" align="center" fontSize={14} fill="#64748b" fontFamily="Inter" />
      </Group>
    );
  }
  return <KonvaImage image={image} width={node.width} height={node.height} {...commonProps} />;
};

export const CanvasArea: React.FC = () => {
  const { nodes, selectedIds, pan, zoom, setPan, setZoom, selectNodes, toggleNodeSelection, updateNode, mode, setMode, connectingSourceId, setConnectingSourceId, previewFrameId, setPreviewFrameId } = useCanvasStore();
  
  const stageRef = useRef<Konva.Stage>(null);
  const transformerRef = useRef<Konva.Transformer>(null);

  const [stageSize, setStageSize] = useState({ width: window.innerWidth, height: window.innerHeight });
  const [errorPopup, setErrorPopup] = useState<string | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
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
        const selectedKonvaNodes = selectedIds.map(id => stageRef.current?.findOne(`#node-${id}`)).filter(Boolean) as Konva.Node[];
        
        // Don't attach transformer to Line directly if it's the only one selected (we use custom anchors)
        if (selectedIds.length === 1) {
          const storeNode = nodes.find(n => n.id === selectedIds[0]);
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
      let targetFrameId = undefined;
      // Only valid target frames are actual layout frames, not master components or instances themselves
      const frames = nodes.filter(n => n.type === 'Frame' && !n.isMasterComponent && !n.componentId && n.id !== storeNode.id);
      for (let i = frames.length - 1; i >= 0; i--) {
        const frame = frames[i];
        if (
          unscaledAbsX >= frame.x && unscaledAbsX <= frame.x + (frame.width || 0) &&
          unscaledAbsY >= frame.y && unscaledAbsY <= frame.y + (frame.height || 0)
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
      updates.width = Math.max(5, Math.abs(w * scaleX));
      updates.height = Math.max(5, Math.abs(h * scaleY));
    } else if (storeNode.type === 'Circle' || storeNode.type === 'Triangle') {
      updates.scaleX = scaleX;
      updates.scaleY = scaleY;
    } else if (storeNode.type === 'Text') {
      const fs = node.fontSize ? node.fontSize() : (storeNode.fontSize || 16);
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
    if (mode === 'preview') {
      if (node.linkTo) {
        setPreviewFrameId(node.linkTo);
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

    if (e.evt.shiftKey) {
      toggleNodeSelection(targetNode.id);
    } else {
      selectNodes([targetNode.id]);
    }
  };

  const RenderNode = ({ node, isPreview = false }: { node: CanvasNode, isPreview?: boolean }) => {
    const [interactiveState, setInteractiveState] = useState<'default'|'hover'|'active'|'disabled'>('default');

    let resolvedNode = { ...node };
    let masterNode = node.isMasterComponent ? node : undefined;
    
    let rootInstance: CanvasNode | undefined = undefined;
    let rootMaster: CanvasNode | undefined = undefined;

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

        rootMaster = rootInstance.componentId ? nodes.find(n => n.id === rootInstance!.componentId) : undefined;

        resolvedNode = {
          ...masterNode,
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

    const isInteractive = mode === 'preview' && (resolvedNode.linkTo || masterNode);
    
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
    
    const commonProps = {
      id: `node-${resolvedNode.id}`,
      x: resolvedNode.x,
      y: resolvedNode.y,
      scaleX: resolvedNode.scaleX || 1,
      scaleY: resolvedNode.scaleY || 1,
      rotation: resolvedNode.rotation || 0,
      fill: resolvedNode.fill,
      draggable: mode === 'select' && (!inComponent || selectedIds.includes(node.id)),
      listening: mode === 'preview' ? (resolvedNode.type === 'Frame' ? true : !!resolvedNode.linkTo || !!masterNode) : true,
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
        if (isInteractive || mode === 'connect') {
          const container = e.target.getStage()?.container();
          if (container) container.style.cursor = 'pointer';
        }
        if (mode === 'preview' && masterNode?.variants?.hover) {
          setInteractiveState('hover');
        }
      },
      onMouseLeave: (e: any) => {
        if (isInteractive || mode === 'connect') {
          const container = e.target.getStage()?.container();
          if (container) container.style.cursor = 'default';
        }
        if (mode === 'preview') {
          setInteractiveState('default');
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
      content = (
        <Group 
          key={node.id} 
          {...commonProps} 
          clipX={0} 
          clipY={0} 
          clipWidth={resolvedNode.width} 
          clipHeight={resolvedNode.height}
          draggable={mode === 'select' && !isPreview}
        >
          <Rect
            x={0}
            y={0}
            width={resolvedNode.width}
            height={resolvedNode.height}
            fill={resolvedNode.fill || '#ffffff'}
            stroke={isComponentIndicator ? indicatorStroke : "#cbd5e1"}
            strokeWidth={isComponentIndicator ? 2 : 1}
            dash={node.componentId ? [5, 5] : undefined}
          />
          {!isPreview && (
            <Text
              x={0}
              y={-20}
              text={`Frame - ${Math.round(resolvedNode.width || 0)}x${Math.round(resolvedNode.height || 0)}`}
              fill="#94a3b8"
              fontSize={12}
              fontFamily="Inter"
              listening={false}
            />
          )}
          {childNodes.map(n => <RenderNode key={n.id} node={n} isPreview={isPreview} />)}
        </Group>
      );
    } else if (resolvedNode.type === 'Rect') {
      content = (
        <Rect
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
          key={node.id}
          {...commonProps}
          sides={3}
          radius={resolvedNode.radius}
          stroke={isComponentIndicator && !resolvedNode.stroke ? indicatorStroke : resolvedNode.stroke}
          strokeWidth={isComponentIndicator && !resolvedNode.strokeWidth ? 2 : (resolvedNode.strokeWidth || 0)}
          dash={node.componentId && isComponentIndicator ? [5, 5] : undefined}
        />
      );
    } else if (resolvedNode.type === 'Line') {
      content = (
        <Group key={node.id} {...commonProps}>
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
      content = <URLImage key={node.id} node={resolvedNode} commonProps={commonProps} />;
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

  if (mode === 'preview' && previewFrameId) {
    const previewFrame = nodes.find(n => n.id === previewFrameId);
    if (!previewFrame) return null;
    
    const padding = 60;
    const scaleX = (window.innerWidth - padding * 2) / (previewFrame.width || 1);
    const scaleY = (window.innerHeight - padding * 2) / (previewFrame.height || 1);
    const fitScale = Math.min(scaleX, scaleY, 1);
    
    const centeredX = (window.innerWidth - (previewFrame.width || 0) * fitScale) / 2;
    const centeredY = (window.innerHeight - (previewFrame.height || 0) * fitScale) / 2;

    const modifiedPreviewFrame = { ...previewFrame, x: 0, y: 0 };

    return (
      <div className="fixed inset-0 bg-black z-50 flex flex-col">
        <div className="h-14 flex items-center justify-between px-6 bg-slate-900 text-white shrink-0">
          <span className="font-semibold text-sm">Previewing: {previewFrame.frameType}</span>
          <button 
            onClick={() => setMode('select')}
            className="flex items-center gap-2 px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 transition-colors text-sm font-medium"
          >
            <X size={16} /> Exit Preview
          </button>
        </div>
        <div className="flex-1 overflow-hidden">
          <Stage width={window.innerWidth} height={window.innerHeight - 56}>
            <Layer x={centeredX} y={centeredY} scaleX={fitScale} scaleY={fitScale}>
              <RenderNode node={modifiedPreviewFrame} isPreview={true} />
            </Layer>
          </Stage>
        </div>
      </div>
    );
  }

  const getConnectionPoints = () => {
    const lines: { id: string, points: number[] }[] = [];
    nodes.forEach(node => {
      if (node.linkTo && node.parentId) {
        const parentFrame = nodes.find(n => n.id === node.parentId);
        const targetFrame = nodes.find(n => n.id === node.linkTo);
        if (parentFrame && targetFrame) {
          const startX = parentFrame.x + node.x + (node.width || 0) / 2;
          const startY = parentFrame.y + node.y + (node.height || 0) / 2;
          const endX = targetFrame.x;
          const endY = targetFrame.y + (targetFrame.height || 0) / 2;
          lines.push({ id: node.id, points: [startX, startY, endX, endY] });
        }
      }
    });

    if (mode === 'connect' && connectingSourceId && stageRef.current) {
      const sourceNode = nodes.find(n => n.id === connectingSourceId);
      const parentFrame = nodes.find(n => n.id === sourceNode?.parentId);
      if (sourceNode && parentFrame) {
        const startX = parentFrame.x + sourceNode.x + (sourceNode.width || 0) / 2;
        const startY = parentFrame.y + sourceNode.y + (sourceNode.height || 0) / 2;
        
        const stage = stageRef.current;
        const pointer = stage.getPointerPosition();
        if (pointer) {
          const endX = (pointer.x - stage.x()) / stage.scaleX();
          const endY = (pointer.y - stage.y()) / stage.scaleY();
          lines.push({ id: 'temp', points: [startX, startY, endX, endY] });
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
          if (e.target === e.target.getStage()) {
            if (mode === 'select') {
              if (!e.evt.shiftKey) selectNodes([]);
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
            // Find intersected nodes
            const newSelectedIds = e.evt.shiftKey ? [...selectedIds] : [];
            const r1 = selectionRect;
            
            nodes.forEach(node => {
              if (node.type === 'Frame') return; // Don't marquee select frames
              // Basic bounding box check using unscaled absolute coords
              let absX = node.x;
              let absY = node.y;
              if (node.parentId) {
                const parent = nodes.find(n => n.id === node.parentId);
                if (parent) {
                  absX += parent.x;
                  absY += parent.y;
                }
              }
              
              const w = node.width || (node.radius ? node.radius * 2 : 100);
              const h = node.height || (node.radius ? node.radius * 2 : 100);
              const r2 = { x: absX, y: absY, width: w, height: h };

              if (node.type === 'Circle' || node.type === 'Triangle') {
                r2.x -= w/2;
                r2.y -= h/2;
              }

              if (r1.x < r2.x + r2.width && r1.x + r1.width > r2.x &&
                  r1.y < r2.y + r2.height && r1.y + r1.height > r2.y) {
                if (!newSelectedIds.includes(node.id)) {
                  newSelectedIds.push(node.id);
                }
              }
            });
            
            selectNodes(newSelectedIds);
            setSelectionRect(null);
          }
        }}
      >
        <Layer>
          {getConnectionPoints().map(line => (
            <Arrow
              key={`conn-${line.id}`}
              points={line.points}
              stroke="#4A3AFF"
              strokeWidth={2}
              fill="#4A3AFF"
              pointerLength={10}
              pointerWidth={10}
              dash={[5, 5]}
              opacity={line.id === 'temp' ? 0.5 : 1}
              listening={false}
            />
          ))}
          {rootNodes.map(n => <RenderNode key={n.id} node={n} />)}

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
