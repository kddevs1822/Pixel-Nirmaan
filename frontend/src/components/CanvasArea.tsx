import React, { useRef, useEffect, useState } from 'react';
import { Stage, Layer, Rect, Circle, Text, Transformer, Group, Image as KonvaImage, RegularPolygon, Line } from 'react-konva';
import { useCanvasStore } from '../store/useCanvasStore';
import type { CanvasNode } from '../store/useCanvasStore';
import Konva from 'konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import useImage from 'use-image';

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
  const { nodes, selectedId, pan, zoom, setPan, setZoom, selectNode, updateNode } = useCanvasStore();
  
  const stageRef = useRef<Konva.Stage>(null);
  const transformerRef = useRef<Konva.Transformer>(null);

  const [stageSize, setStageSize] = useState({ width: window.innerWidth, height: window.innerHeight });
  
  useEffect(() => {
    const handleResize = () => {
      setStageSize({
        width: window.innerWidth - 64 - 288,
        height: window.innerHeight - 56,
      });
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (transformerRef.current && stageRef.current) {
      if (selectedId) {
        const storeNode = nodes.find(n => n.id === selectedId);
        if (storeNode && storeNode.type !== 'Line') {
          const selectedNode = stageRef.current.findOne(`#node-${selectedId}`);
          if (selectedNode) {
            transformerRef.current.nodes([selectedNode]);
            transformerRef.current.getLayer()?.batchDraw();
          }
        } else {
          transformerRef.current.nodes([]);
        }
      } else {
        transformerRef.current.nodes([]);
      }
    }
  }, [selectedId, nodes.length, zoom, pan]);

  const handleWheel = (e: KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();
    if (!stageRef.current) return;
    
    const stage = stageRef.current;
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
  };

  const handleDragEnd = (e: KonvaEventObject<DragEvent>, id: string) => {
    const node = e.target;
    if (node.name() === 'anchor') return;
    if (node === stageRef.current) return;
    updateNode(id, { x: node.x(), y: node.y() }, true);
  };

  const handleTransformEnd = (e: KonvaEventObject<Event>, id: string) => {
    const node = e.target;
    const scaleX = node.scaleX();
    const scaleY = node.scaleY();
    
    const updates: any = {
      x: node.x(),
      y: node.y(),
    };

    node.scaleX(1);
    node.scaleY(1);

    const storeNode = nodes.find(n => n.id === id);
    if (!storeNode) return;

    if (storeNode.type === 'Rect' || storeNode.type === 'Image' || storeNode.type === 'Frame') {
      updates.width = Math.max(5, (storeNode.width || 0) * scaleX);
      updates.height = Math.max(5, (storeNode.height || 0) * scaleY);
    } else if (storeNode.type === 'Circle' || storeNode.type === 'Triangle') {
      updates.radius = Math.max(5, (storeNode.radius || 0) * Math.max(scaleX, scaleY));
    } else if (storeNode.type === 'Text') {
      updates.fontSize = Math.max(8, (storeNode.fontSize || 16) * scaleX);
    }

    updateNode(id, updates, true);
  };

  const handleAnchorDragMove = (e: KonvaEventObject<DragEvent>, nodeId: string, index: number) => {
    const storeNode = nodes.find(n => n.id === nodeId);
    if (!storeNode || !storeNode.points) return;
    const newPoints = [...storeNode.points];
    
    newPoints[index * 2] = e.target.x();
    newPoints[index * 2 + 1] = e.target.y();
    
    updateNode(nodeId, { points: newPoints }, false);
  };

  const handleAnchorDragEnd = (e: KonvaEventObject<DragEvent>, nodeId: string, index: number) => {
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
    if (selectedId !== nodeId) return;
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
    const storeNode = nodes.find(n => n.id === nodeId);
    if (!storeNode || !storeNode.points) return;
    if (storeNode.points.length <= 4) return; // Keep at least 2 points
    
    const newPoints = [...storeNode.points];
    newPoints.splice(index * 2, 2);
    updateNode(nodeId, { points: newPoints }, true);
  };

  const renderNode = (node: CanvasNode) => {
    const commonProps = {
      id: `node-${node.id}`,
      x: node.x,
      y: node.y,
      fill: node.fill,
      draggable: true,
      onClick: (e: any) => { e.cancelBubble = true; selectNode(node.id); },
      onTap: (e: any) => { e.cancelBubble = true; selectNode(node.id); },
      onDragStart: (e: any) => { e.cancelBubble = true; selectNode(node.id); },
      onDragEnd: (e: any) => { e.cancelBubble = true; handleDragEnd(e, node.id); },
      onTransformEnd: (e: any) => { e.cancelBubble = true; handleTransformEnd(e, node.id); },
    };

    if (node.type === 'Frame') {
      const childNodes = nodes.filter(n => n.parentId === node.id);
      return (
        <Group 
          key={node.id} 
          {...commonProps} 
          clipX={0} 
          clipY={0} 
          clipWidth={node.width} 
          clipHeight={node.height}
        >
          {/* Frame Background */}
          <Rect
            x={0}
            y={0}
            width={node.width}
            height={node.height}
            fill={node.fill || '#ffffff'}
            stroke="#cbd5e1"
            strokeWidth={1}
          />
          {/* Frame Label */}
          <Text
            x={0}
            y={-20}
            text={`Frame - ${Math.round(node.width || 0)}x${Math.round(node.height || 0)}`}
            fill="#94a3b8"
            fontSize={12}
            fontFamily="Inter"
            listening={false}
          />
          {/* Children inside frame */}
          {childNodes.map(renderNode)}
        </Group>
      );
    }

    if (node.type === 'Rect') {
      return (
        <Rect
          key={node.id}
          {...commonProps}
          width={node.width}
          height={node.height}
          cornerRadius={node.cornerRadius}
        />
      );
    }

    if (node.type === 'Circle') {
      return (
        <Circle
          key={node.id}
          {...commonProps}
          radius={node.radius}
        />
      );
    }

    if (node.type === 'Triangle') {
      return (
        <RegularPolygon
          key={node.id}
          {...commonProps}
          sides={3}
          radius={node.radius}
        />
      );
    }

    if (node.type === 'Line') {
      return (
        <Group key={node.id} {...commonProps}>
          <Line
            points={node.points}
            stroke={node.stroke}
            strokeWidth={node.strokeWidth}
            tension={node.tension || 0}
            fillEnabled={false}
            hitStrokeWidth={15}
            listening={true}
            onDblClick={(e) => { e.cancelBubble = true; handleLineDblClick(e, node.id); }}
          />
          {selectedId === node.id && node.points && (
            <>
              {Array.from({ length: node.points.length / 2 }).map((_, i) => (
                <Circle
                  key={`anchor-${i}`}
                  name="anchor"
                  x={node.points![i * 2]}
                  y={node.points![i * 2 + 1]}
                  radius={6}
                  fill="#ffffff"
                  stroke="#4A3AFF"
                  strokeWidth={2}
                  draggable
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
    }

    if (node.type === 'Text') {
      return (
        <Text
          key={node.id}
          {...commonProps}
          text={node.text}
          fontSize={node.fontSize}
          fontFamily={node.fontFamily}
        />
      );
    }

    if (node.type === 'Image') {
      return <URLImage key={node.id} node={node} commonProps={commonProps} />;
    }
    
    return null;
  };

  const rootNodes = nodes.filter(n => !n.parentId);

  return (
    <div className="flex-1 bg-canvas-grid relative overflow-hidden">
      <Stage
        width={stageSize.width}
        height={stageSize.height}
        onWheel={handleWheel}
        ref={stageRef}
        scaleX={zoom}
        scaleY={zoom}
        x={pan.x}
        y={pan.y}
        draggable
        onDragMove={(e) => {}}
        onDragEnd={(e) => {
          if (e.target === stageRef.current) {
            setPan({ x: e.target.x(), y: e.target.y() });
          }
        }}
        onMouseDown={(e) => {
          if (e.target === e.target.getStage()) {
            selectNode(null);
          }
        }}
      >
        <Layer>
          {rootNodes.map(renderNode)}

          <Transformer
            ref={transformerRef}
            boundBoxFunc={(oldBox, newBox) => {
              if (newBox.width < 5 || newBox.height < 5) {
                return oldBox;
              }
              return newBox;
            }}
          />
        </Layer>
      </Stage>
    </div>
  );
};
