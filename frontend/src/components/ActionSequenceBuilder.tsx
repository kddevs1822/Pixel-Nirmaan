import React, { useState } from 'react';
import { useCanvasStore } from '../store/useCanvasStore';
import type { CanvasNode, NodeActionSequence, NodeAction, ActionType, StateVariable, DataSource } from '../store/useCanvasStore';
import { Plus, Trash2, ChevronUp, ChevronDown, Zap, Target, X, Database, Play, Check, AlertCircle, RefreshCw } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { getNodeDescriptiveLabel } from '../utils/nodeUtils';
import { normalizeApiUrl, executeApiFetch } from '../utils/urlUtils';

interface TargetElementPickerProps {
  originNode: CanvasNode;
  targetId: string | undefined;
  onSelectTarget: (id: string | undefined) => void;
  sequenceId: string;
  actionId: string;
  actionType: 'triggerAnimation' | 'toggleVisibility' | 'submitForm' | 'resetForm' | 'navigate';
  label?: string;
  defaultLabel?: string;
  allowedTypes?: string[];
  isPagePicker?: boolean;
}

const TargetElementPicker: React.FC<TargetElementPickerProps> = ({
  originNode,
  targetId,
  onSelectTarget,
  sequenceId,
  actionId,
  actionType,
  label = 'Target Element',
  defaultLabel,
  allowedTypes,
  isPagePicker = false,
}) => {
  const { nodes, pickingActionTarget, setPickingActionTarget, selectNodes, setToastMessage } = useCanvasStore();

  const isPickingThis =
    pickingActionTarget?.nodeId === originNode.id &&
    pickingActionTarget?.sequenceId === sequenceId &&
    pickingActionTarget?.actionId === actionId;

  const candidates = nodes.filter(n => {
    if (isPagePicker) {
      return n.type === 'Frame' && !n.parentId;
    }
    if (allowedTypes && allowedTypes.length > 0) {
      return allowedTypes.includes(n.type);
    }
    return n.id !== originNode.id;
  });

  const targetNode = targetId ? nodes.find(n => n.id === targetId) : undefined;
  const targetLabel = targetNode
    ? getNodeDescriptiveLabel(targetNode, nodes)
    : (defaultLabel || `Current Element (${originNode.name || originNode.type})`);

  return (
    <div className="flex flex-col gap-1 w-full box-border">
      <div className="flex items-center justify-between">
        <label className="text-[9.5px] font-semibold text-slate-500 uppercase tracking-wider">
          {label}
        </label>
        {targetId && (
          <button
            type="button"
            onClick={() => {
              onSelectTarget(undefined);
              setToastMessage(`Reset ${label.toLowerCase()} to default`);
            }}
            className="text-[9.5px] text-rose-500 hover:text-rose-700 flex items-center gap-0.5 font-medium hover:underline cursor-pointer"
            title="Reset to default / self"
          >
            <X size={10} /> Reset
          </button>
        )}
      </div>

      {isPickingThis ? (
        <div className="flex items-center justify-between p-1.5 bg-indigo-50 border border-indigo-300 rounded text-xs text-indigo-700 animate-pulse">
          <span className="flex items-center gap-1.5 font-medium text-[10.5px]">
            <Target size={13} className="text-indigo-600 animate-spin" />
            Click element on canvas...
          </span>
          <button
            type="button"
            onClick={() => setPickingActionTarget(null)}
            className="px-1.5 py-0.5 hover:bg-indigo-100 rounded text-indigo-700 text-[10px] font-semibold flex items-center gap-0.5 cursor-pointer"
          >
            <X size={11} /> Cancel
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-1 w-full">
          <div className="flex items-center gap-1.5 w-full">
            <button
              type="button"
              onClick={() => {
                setPickingActionTarget({
                  nodeId: originNode.id,
                  sequenceId,
                  actionId,
                  actionType,
                  targetField: isPagePicker ? 'targetPageId' : 'targetNodeId',
                  allowedTypes,
                });
                setToastMessage(`🎯 Click any element on canvas to select as ${label.toLowerCase()}`);
              }}
              className={`flex items-center justify-center gap-1 px-2 py-1 rounded border text-[10.5px] font-medium transition-all shrink-0 cursor-pointer ${
                targetNode
                  ? 'bg-indigo-50 border-indigo-300 text-indigo-700 hover:bg-indigo-100'
                  : 'bg-white border-slate-200 text-slate-700 hover:border-indigo-400 hover:text-indigo-600 hover:bg-slate-50 shadow-2xs'
              }`}
              title="Select this element directly on the canvas"
            >
              <Target size={12} className={targetNode ? "text-indigo-600" : "text-slate-400"} />
              <span className="whitespace-nowrap">{targetNode ? 'Change' : 'Pick on Canvas'}</span>
            </button>

            <select
              value={targetId || ''}
              onChange={(e) => onSelectTarget(e.target.value || undefined)}
              className="flex-1 min-w-0 border border-slate-200 rounded px-1.5 py-1 text-[10px] bg-slate-50 text-slate-800 truncate focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="">{defaultLabel || `Current Element (${originNode.name || originNode.type})`}</option>
              {candidates.map(candidate => (
                <option key={candidate.id} value={candidate.id}>
                  {getNodeDescriptiveLabel(candidate, nodes)}
                </option>
              ))}
            </select>
          </div>

          {targetNode && (
            <div className="flex items-center justify-between px-2 py-0.5 bg-indigo-50/60 border border-indigo-100 rounded text-[9.5px] text-indigo-900">
              <span className="truncate text-slate-600">
                Selected: <strong className="text-indigo-700 font-medium">{targetLabel}</strong>
              </span>
              <button
                type="button"
                onClick={() => selectNodes([targetNode.id])}
                className="text-[9px] text-indigo-600 hover:text-indigo-800 underline shrink-0 ml-1 cursor-pointer"
                title="Select and highlight element on canvas"
              >
                Locate
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

interface ActionSequenceBuilderProps {
  node: CanvasNode;
}

export const ActionSequenceBuilder: React.FC<ActionSequenceBuilderProps> = ({ node }) => {
  const { nodes, stateVariables, dataSources, updateNodes, setToastMessage } = useCanvasStore();

  const actionSequences = node.actionSequences || [];
  const frames = nodes.filter(n => n.type === 'Frame');
  const availablePages = frames.filter(f => !f.parentId);

  const [testingActionId, setTestingActionId] = useState<string | null>(null);
  const [actionTestResult, setActionTestResult] = useState<{
    actionId: string;
    ok: boolean;
    status?: number;
    timeMs?: number;
    data?: any;
    extracted?: any;
    error?: string;
  } | null>(null);

  const handleTestActionApi = async (action: NodeAction) => {
    setTestingActionId(action.id);
    setActionTestResult(null);
    const startTime = performance.now();

    try {
      let url = action.apiUrl || '';
      let method = action.apiMethod || 'GET';
      let headersObj: Record<string, string> = {};
      let body = action.apiBody;
      let responsePath = action.apiResponsePath;

      if (action.dataSourceId && action.dataSourceId !== 'custom') {
        const ds = dataSources.find(d => d.id === action.dataSourceId);
        if (ds) {
          url = ds.url;
          method = ds.method;
          (ds.headers || []).filter(h => h.enabled && h.key).forEach(h => {
            headersObj[h.key] = h.value;
          });
          if (['POST', 'PUT', 'PATCH'].includes(method) && ds.bodyTemplate) {
            body = ds.bodyTemplate;
          }
          if (!responsePath && ds.responsePath) {
            responsePath = ds.responsePath;
          }
        }
      }

      const cleanUrl = normalizeApiUrl(url);
      if (!cleanUrl) {
        throw new Error('No API endpoint URL specified');
      }

      const res = await executeApiFetch(cleanUrl, {
        method,
        headers: headersObj,
        body: ['POST', 'PUT', 'PATCH'].includes(method) && body ? body : undefined,
      });

      let extracted: any = undefined;
      if (responsePath && typeof res.data === 'object' && res.data !== null) {
        extracted = responsePath.split('.').reduce((acc, part) => (acc ? acc[part] : undefined), res.data);
      }

      setActionTestResult({
        actionId: action.id,
        ok: res.ok,
        status: res.status,
        timeMs: res.timeMs,
        data: res.data,
        extracted,
      });
    } catch (err: any) {
      setActionTestResult({
        actionId: action.id,
        ok: false,
        timeMs: err.timeMs || 0,
        error: err.message || 'API request failed',
      });
    } finally {
      setTestingActionId(null);
    }
  };

  const updateSequences = (newSequences: NodeActionSequence[]) => {
    updateNodes([node.id], { actionSequences: newSequences }, true);
  };

  const isInputNode = ['TextInput', 'TextArea', 'SelectDropdown', 'Checkbox', 'Switch'].includes(node.type);
  const isFormNode = node.type === 'FormContainer';

  const getAllowedOperations = (seqEvent: string, varType?: string) => {
    const ops: { value: string; label: string }[] = [
      { value: 'set', label: 'Set Value' },
    ];

    if (varType === 'boolean') {
      ops.push({ value: 'toggle', label: 'Toggle (Bool)' });
    } else if (varType === 'number') {
      ops.push({ value: 'increment', label: 'Increment (+)' });
      ops.push({ value: 'decrement', label: 'Decrement (-)' });
    }

    if (seqEvent === 'onChange' && isInputNode) {
      ops.push({ value: 'setInputVal', label: 'From Input' });
    }

    return ops;
  };

  const handleAddSequence = (event: 'onClick' | 'onChange' | 'onSubmit' | 'onHover' | 'onFocus') => {
    if (actionSequences.some(seq => seq.event === event)) {
      setToastMessage(`Action sequence for ${event} already exists`);
      return;
    }
    let defaultVar = stateVariables[0];
    if (!defaultVar) {
      const newVarId = uuidv4();
      useCanvasStore.getState().addStateVariable({ name: 'isStateActive', type: 'boolean', defaultValue: false });
      const created = useCanvasStore.getState().stateVariables.slice(-1)[0];
      defaultVar = created || { id: newVarId, name: 'isStateActive', type: 'boolean', defaultValue: false };
    }
    const defaultVarId = defaultVar.id;
    const isDefaultInputOp = (event === 'onChange' && isInputNode);
    let initialVal: any = true;
    if (isDefaultInputOp) {
      initialVal = '';
    } else if (defaultVar.type === 'number') {
      initialVal = 0;
    } else if (defaultVar.type === 'string') {
      initialVal = '';
    } else if (defaultVar.type === 'boolean') {
      initialVal = true;
    }

    const newSeq: NodeActionSequence = {
      id: uuidv4(),
      event,
      actions: [
        {
          id: uuidv4(),
          type: 'setState',
          enabled: true,
          stateVariableId: defaultVarId,
          stateOperation: isDefaultInputOp ? 'setInputVal' : 'set',
          value: initialVal,
        }
      ]
    };
    updateSequences([...actionSequences, newSeq]);
  };

  const handleRemoveSequence = (seqId: string) => {
    updateSequences(actionSequences.filter(s => s.id !== seqId));
  };

  const handleAddAction = (seqId: string) => {
    let defaultVar = stateVariables[0];
    if (!defaultVar) {
      const newVarId = uuidv4();
      useCanvasStore.getState().addStateVariable({ name: 'isStateActive', type: 'boolean', defaultValue: false });
      const created = useCanvasStore.getState().stateVariables.slice(-1)[0];
      defaultVar = created || { id: newVarId, name: 'isStateActive', type: 'boolean', defaultValue: false };
    }
    const defaultVarId = defaultVar.id;
    let initialVal: any = true;
    if (defaultVar.type === 'number') {
      initialVal = 0;
    } else if (defaultVar.type === 'string') {
      initialVal = '';
    } else if (defaultVar.type === 'boolean') {
      initialVal = true;
    }

    const updated = actionSequences.map(seq => {
      if (seq.id !== seqId) return seq;
      const newAction: NodeAction = {
        id: uuidv4(),
        type: 'setState',
        enabled: true,
        stateVariableId: defaultVarId,
        stateOperation: 'set',
        value: initialVal,
      };
      return { ...seq, actions: [...seq.actions, newAction] };
    });
    updateSequences(updated);
  };

  const handleUpdateAction = (seqId: string, actionId: string, patch: Partial<NodeAction>) => {
    const updated = actionSequences.map(seq => {
      if (seq.id !== seqId) return seq;
      const actions = seq.actions.map(act => {
        if (act.id !== actionId) return act;
        return { ...act, ...patch };
      });
      return { ...seq, actions };
    });
    updateSequences(updated);
  };

  const handleRemoveAction = (seqId: string, actionId: string) => {
    const updated = actionSequences.map(seq => {
      if (seq.id !== seqId) return seq;
      const actions = seq.actions.filter(act => act.id !== actionId);
      return { ...seq, actions };
    });
    updateSequences(updated);
  };

  const handleMoveAction = (seqId: string, index: number, direction: 'up' | 'down') => {
    const seq = actionSequences.find(s => s.id === seqId);
    if (!seq) return;
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= seq.actions.length) return;

    const newActions = [...seq.actions];
    const [moved] = newActions.splice(index, 1);
    newActions.splice(targetIdx, 0, moved);

    const updated = actionSequences.map(s => s.id === seqId ? { ...s, actions: newActions } : s);
    updateSequences(updated);
  };

  const availableEvents: ('onClick' | 'onChange' | 'onSubmit' | 'onHover' | 'onFocus')[] = [
    'onClick',
    ...(isInputNode ? ['onChange' as const] : []),
    ...(isFormNode ? ['onSubmit' as const] : []),
    'onHover',
    'onFocus',
  ];

  const unusedEvents = availableEvents.filter(ev => !actionSequences.some(seq => seq.event === ev));

  return (
    <div className="flex flex-col gap-2.5 pt-4 border-t border-slate-200 w-full max-w-full overflow-hidden box-border">
      <div className="flex items-center justify-between gap-1 w-full flex-wrap">
        <div className="flex items-center gap-1 shrink-0">
          <Zap size={13} className="text-[#4A3AFF]" />
          <label className="text-[11px] font-semibold text-slate-700 uppercase tracking-wider">
            Action Sequences
          </label>
        </div>
        {unusedEvents.length > 0 && (
          <select
            onChange={(e) => {
              if (e.target.value) {
                handleAddSequence(e.target.value as any);
                e.target.value = '';
              }
            }}
            defaultValue=""
            className="text-[11px] font-medium text-indigo-600 bg-indigo-50 border border-indigo-200 rounded px-1.5 py-0.5 hover:bg-indigo-100 cursor-pointer max-w-[125px] truncate"
          >
            <option value="" disabled>+ Event</option>
            {unusedEvents.map(ev => (
              <option key={ev} value={ev}>{ev}</option>
            ))}
          </select>
        )}
      </div>

      {actionSequences.length === 0 ? (
        <div className="p-2.5 bg-slate-50 border border-dashed border-slate-200 rounded-lg text-center w-full box-border">
          <p className="text-[11px] text-slate-500 mb-1.5">No action sequences attached</p>
          <div className="flex flex-wrap gap-1 justify-center">
            <button
              onClick={() => handleAddSequence('onClick')}
              className="text-[10px] font-medium text-indigo-600 bg-white border border-indigo-200 rounded px-2 py-0.5 hover:bg-indigo-50 transition-colors"
            >
              + On Click
            </button>
            {isInputNode && (
              <button
                onClick={() => handleAddSequence('onChange')}
                className="text-[10px] font-medium text-indigo-600 bg-white border border-indigo-200 rounded px-2 py-0.5 hover:bg-indigo-50 transition-colors"
              >
                + On Change
              </button>
            )}
            {isFormNode && (
              <button
                onClick={() => handleAddSequence('onSubmit')}
                className="text-[10px] font-medium text-indigo-600 bg-white border border-indigo-200 rounded px-2 py-0.5 hover:bg-indigo-50 transition-colors"
              >
                + On Submit
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5 w-full">
          {actionSequences.map(seq => (
            <div key={seq.id} className="p-2 bg-slate-50 border border-slate-200 rounded-lg flex flex-col gap-1.5 w-full box-border overflow-hidden">
              <div className="flex justify-between items-center pb-1 border-b border-slate-200 w-full">
                <span className="text-[11px] font-semibold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded font-mono">
                  {seq.event}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleAddAction(seq.id)}
                    className="text-[10px] text-indigo-600 hover:text-indigo-800 font-medium px-1.5 py-0.5 bg-white border border-slate-200 hover:border-indigo-300 rounded flex items-center gap-0.5 transition-colors"
                  >
                    <Plus size={11} /> Step
                  </button>
                  <button
                    onClick={() => handleRemoveSequence(seq.id)}
                    className="text-slate-400 hover:text-rose-600 p-0.5 rounded hover:bg-rose-50 transition-colors"
                    title="Delete event sequence"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-1.5 w-full">
                {seq.actions.map((action, idx) => (
                  <div key={action.id} className="p-1.5 bg-white border border-slate-200 rounded text-xs flex flex-col gap-1.5 w-full box-border overflow-hidden shadow-2xs">
                    <div className="flex items-center justify-between gap-1 w-full">
                      <div className="flex items-center gap-1 flex-1 min-w-0">
                        <span className="w-3.5 h-3.5 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-bold text-[9px] shrink-0">
                          {idx + 1}
                        </span>
                        <select
                          value={action.type}
                          onChange={(e) => handleUpdateAction(seq.id, action.id, { type: e.target.value as ActionType })}
                          className="font-medium text-slate-800 bg-slate-50 border border-slate-200 rounded px-1 py-0.5 text-[11px] focus:outline-none focus:ring-1 focus:ring-indigo-500 flex-1 min-w-0 truncate"
                        >
                          <option value="setState">Set State Variable</option>
                          <option value="navigate">Navigate Page</option>
                          <option value="callApi">Call API (REST)</option>
                          <option value="triggerAnimation">Trigger Animation</option>
                          <option value="toggleVisibility">Toggle Visibility</option>
                          <option value="resetForm">Reset Form</option>
                          <option value="submitForm">Submit Form</option>
                        </select>
                      </div>

                      <div className="flex items-center gap-0.5 shrink-0">
                        <button
                          disabled={idx === 0}
                          onClick={() => handleMoveAction(seq.id, idx, 'up')}
                          className="text-slate-400 hover:text-slate-600 disabled:opacity-30 p-0.5"
                        >
                          <ChevronUp size={12} />
                        </button>
                        <button
                          disabled={idx === seq.actions.length - 1}
                          onClick={() => handleMoveAction(seq.id, idx, 'down')}
                          className="text-slate-400 hover:text-slate-600 disabled:opacity-30 p-0.5"
                        >
                          <ChevronDown size={12} />
                        </button>
                        <button
                          onClick={() => handleRemoveAction(seq.id, action.id)}
                          className="text-slate-400 hover:text-rose-600 p-0.5"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>

                    {/* Action Parameters depending on action.type */}
                    {action.type === 'setState' && (() => {
                      const selectedVar = stateVariables.find(sv => sv.id === action.stateVariableId);
                      const varType = selectedVar?.type;
                      const allowedOps = getAllowedOperations(seq.event, varType);
                      const currentOp = allowedOps.some(o => o.value === action.stateOperation)
                        ? (action.stateOperation || 'set')
                        : 'set';

                      return (
                        <div className="flex flex-col gap-1 pt-1 border-t border-slate-100 w-full">
                          <div className="flex gap-1 w-full">
                            <select
                              value={action.stateVariableId || ''}
                              onChange={(e) => {
                                const nextVarId = e.target.value;
                                const nextVar = stateVariables.find(sv => sv.id === nextVarId);
                                const nextAllowedOps = getAllowedOperations(seq.event, nextVar?.type);
                                const validOp = nextAllowedOps.some(o => o.value === action.stateOperation) ? action.stateOperation : 'set';
                                let sanitizedValue: any = action.value;
                                if (nextVar?.type === 'number') {
                                  const num = Number(action.value);
                                  sanitizedValue = isNaN(num) ? 0 : num;
                                } else if (nextVar?.type === 'boolean') {
                                  sanitizedValue = (action.value === true || action.value === 'true');
                                } else if (nextVar?.type === 'string') {
                                  sanitizedValue = action.value !== undefined ? String(action.value) : '';
                                }
                                handleUpdateAction(seq.id, action.id, { 
                                  stateVariableId: nextVarId,
                                  stateOperation: validOp,
                                  value: sanitizedValue
                                });
                              }}
                              className="flex-1 min-w-0 border border-slate-200 rounded px-1 py-0.5 text-[10px] bg-slate-50 text-slate-700 truncate"
                            >
                              <option value="" disabled>Select State Variable</option>
                              {stateVariables.map(sv => (
                                <option key={sv.id} value={sv.id}>{sv.name} ({sv.type})</option>
                              ))}
                            </select>
                            <select
                              value={currentOp}
                              onChange={(e) => {
                                const newOp = e.target.value as any;
                                const updates: any = { stateOperation: newOp };
                                if ((newOp === 'increment' || newOp === 'decrement') && (action.value === undefined || action.value === '' || isNaN(Number(action.value)))) {
                                  updates.value = 1;
                                } else if (newOp === 'set') {
                                  if (varType === 'number' && (action.value === undefined || isNaN(Number(action.value)))) {
                                    updates.value = 0;
                                  } else if (varType === 'boolean' && typeof action.value !== 'boolean') {
                                    updates.value = true;
                                  }
                                }
                                handleUpdateAction(seq.id, action.id, updates);
                              }}
                              className="w-24 shrink-0 border border-slate-200 rounded px-1 py-0.5 text-[10px] bg-slate-50 text-slate-700 truncate"
                            >
                              {allowedOps.map(op => (
                                <option key={op.value} value={op.value}>{op.label}</option>
                              ))}
                            </select>
                          </div>
                          {currentOp === 'set' && (
                            varType === 'number' ? (
                              <input
                                type="number"
                                placeholder="0"
                                value={action.value !== undefined && action.value !== null && !isNaN(Number(action.value)) ? action.value : ''}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  handleUpdateAction(seq.id, action.id, { value: val === '' ? 0 : Number(val) });
                                }}
                                className="border border-slate-200 rounded px-1.5 py-0.5 text-[10px] w-full font-mono bg-white text-slate-800"
                              />
                            ) : varType === 'boolean' ? (
                              <select
                                value={action.value === true || action.value === 'true' ? 'true' : 'false'}
                                onChange={(e) => handleUpdateAction(seq.id, action.id, { value: e.target.value === 'true' })}
                                className="border border-slate-200 rounded px-1.5 py-0.5 text-[10px] w-full font-mono bg-white text-slate-800"
                              >
                                <option value="true">true</option>
                                <option value="false">false</option>
                              </select>
                            ) : (
                              <input
                                type="text"
                                placeholder="Value (e.g. Hello)"
                                value={action.value ?? ''}
                                onChange={(e) => handleUpdateAction(seq.id, action.id, { value: e.target.value })}
                                className="border border-slate-200 rounded px-1.5 py-0.5 text-[10px] w-full font-mono bg-white text-slate-800"
                              />
                            )
                          )}
                          {(currentOp === 'increment' || currentOp === 'decrement') && (
                            <div className="flex items-center gap-1.5 w-full">
                              <span className="text-[10px] text-slate-500 font-medium whitespace-nowrap">
                                {currentOp === 'increment' ? 'Increment by:' : 'Decrement by:'}
                              </span>
                              <input
                                type="number"
                                placeholder="1"
                                value={action.value !== undefined && action.value !== '' ? action.value : ''}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  handleUpdateAction(seq.id, action.id, { value: val === '' ? '' : Number(val) });
                                }}
                                className="border border-slate-200 rounded px-1.5 py-0.5 text-[10px] flex-1 min-w-0 font-mono bg-white text-slate-800"
                              />
                            </div>
                          )}
                          {currentOp === 'setInputVal' && (
                            <div className="px-1.5 py-0.5 bg-indigo-50/70 border border-indigo-100 rounded text-[9.5px] text-indigo-700 italic">
                              Dynamically sets value from input
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    {action.type === 'navigate' && (
                      <div className="flex flex-col gap-1.5 pt-1.5 border-t border-slate-100 w-full">
                        <TargetElementPicker
                          originNode={node}
                          targetId={action.targetPageId}
                          onSelectTarget={(id) => handleUpdateAction(seq.id, action.id, { targetPageId: id })}
                          sequenceId={seq.id}
                          actionId={action.id}
                          actionType="navigate"
                          label="Target Page / Frame"
                          defaultLabel="Select Target Page"
                          isPagePicker={true}
                        />
                      </div>
                    )}

                    {action.type === 'callApi' && (() => {
                      const selectedDs = dataSources.find(d => d.id === action.dataSourceId);
                      const isCustom = !action.dataSourceId || action.dataSourceId === 'custom';

                      return (
                        <div className="flex flex-col gap-2 pt-1.5 border-t border-slate-100 w-full">
                          {/* Endpoint selection: Saved Data Source vs Inline */}
                          <div className="flex flex-col gap-0.5">
                            <label className="text-[9px] font-semibold text-slate-500 uppercase tracking-wider">
                              API Data Source
                            </label>
                            <select
                              value={action.dataSourceId || 'custom'}
                              onChange={(e) => {
                                const val = e.target.value;
                                if (val === 'custom') {
                                  handleUpdateAction(seq.id, action.id, {
                                    dataSourceId: 'custom',
                                    apiMethod: action.apiMethod || 'GET',
                                    apiUrl: action.apiUrl || '',
                                  });
                                } else {
                                  const ds = dataSources.find(d => d.id === val);
                                  handleUpdateAction(seq.id, action.id, {
                                    dataSourceId: val,
                                    apiTargetVariableId: action.apiTargetVariableId || ds?.targetVariableId,
                                    apiResponsePath: action.apiResponsePath || ds?.responsePath,
                                  });
                                }
                              }}
                              className="border border-slate-200 rounded px-1.5 py-1 text-[10px] bg-slate-50 text-slate-800 w-full truncate focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            >
                              <option value="custom">⚙️ Custom / Inline API Endpoint</option>
                              {dataSources.map(ds => (
                                <option key={ds.id} value={ds.id}>
                                  {ds.method} - {ds.name} ({ds.url})
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* If Saved Data Source chosen */}
                          {!isCustom && selectedDs && (
                            <div className="p-2 bg-slate-50 rounded border border-slate-200 text-[10.5px] flex flex-col gap-1">
                              <div className="flex items-center gap-1.5">
                                <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-sky-100 text-sky-800 border border-sky-200">
                                  {selectedDs.method}
                                </span>
                                <span className="font-mono text-slate-700 truncate">{selectedDs.url}</span>
                              </div>
                              {selectedDs.targetVariableId && (
                                <span className="text-[9.5px] text-slate-500">
                                  Default store: <strong className="text-slate-700 font-mono">{stateVariables.find(v => v.id === selectedDs.targetVariableId)?.name || selectedDs.targetVariableId}</strong>
                                </span>
                              )}
                            </div>
                          )}

                          {/* If Custom / Inline API */}
                          {isCustom && (
                            <div className="flex flex-col gap-1.5">
                              <div className="grid grid-cols-4 gap-1.5">
                                <div className="col-span-1">
                                  <label className="text-[9px] font-semibold text-slate-500 uppercase tracking-wider">Method</label>
                                  <select
                                    value={action.apiMethod || 'GET'}
                                    onChange={(e) => handleUpdateAction(seq.id, action.id, { apiMethod: e.target.value as any })}
                                    className="w-full border border-slate-200 rounded px-1 py-1 text-[10px] bg-slate-50 text-slate-800 font-bold"
                                  >
                                    <option value="GET">GET</option>
                                    <option value="POST">POST</option>
                                    <option value="PUT">PUT</option>
                                    <option value="DELETE">DELETE</option>
                                    <option value="PATCH">PATCH</option>
                                  </select>
                                </div>
                                <div className="col-span-3">
                                  <label className="text-[9px] font-semibold text-slate-500 uppercase tracking-wider">URL</label>
                                  <input
                                    type="url"
                                    placeholder="https://api.example.com/items"
                                    value={action.apiUrl || ''}
                                    onChange={(e) => handleUpdateAction(seq.id, action.id, { apiUrl: e.target.value })}
                                    onBlur={() => {
                                      if (action.apiUrl?.trim()) {
                                        handleUpdateAction(seq.id, action.id, { apiUrl: normalizeApiUrl(action.apiUrl) });
                                      }
                                    }}
                                    className="w-full border border-slate-200 rounded px-1.5 py-1 text-[10px] bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                  />
                                </div>
                              </div>

                              {['POST', 'PUT', 'PATCH'].includes(action.apiMethod || 'GET') && (
                                <div className="flex flex-col gap-0.5">
                                  <label className="text-[9px] font-semibold text-slate-500 uppercase tracking-wider">Body (JSON)</label>
                                  <textarea
                                    rows={2}
                                    placeholder='{ "title": "New item" }'
                                    value={action.apiBody || ''}
                                    onChange={(e) => handleUpdateAction(seq.id, action.id, { apiBody: e.target.value })}
                                    className="w-full border border-slate-200 rounded p-1 text-[10px] font-mono bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                  />
                                </div>
                              )}
                            </div>
                          )}

                          {/* Target State Variable Selection */}
                          <div className="flex flex-col gap-0.5">
                            <label className="text-[9px] font-semibold text-slate-500 uppercase tracking-wider">
                              Store Result in State Variable
                            </label>
                            <select
                              value={action.apiTargetVariableId || ''}
                              onChange={(e) => handleUpdateAction(seq.id, action.id, { apiTargetVariableId: e.target.value || undefined })}
                              className="border border-slate-200 rounded px-1.5 py-1 text-[10px] bg-slate-50 text-slate-800 w-full truncate focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            >
                              <option value="">
                                {selectedDs?.targetVariableId 
                                  ? `Default from Data Source (${stateVariables.find(v => v.id === selectedDs.targetVariableId)?.name || 'Linked'})` 
                                  : '-- Select State Variable (Optional) --'}
                              </option>
                              {stateVariables.map(v => (
                                <option key={v.id} value={v.id}>
                                  {v.name} ({v.type})
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* Response Path Selection */}
                          <div className="flex flex-col gap-0.5">
                            <div className="flex items-center justify-between">
                              <label className="text-[9px] font-semibold text-slate-500 uppercase tracking-wider">Response Path</label>
                              <span className="text-[8.5px] text-slate-400">e.g. data.items or products</span>
                            </div>
                            <input
                              type="text"
                              placeholder={selectedDs?.responsePath || 'Leave empty for full response'}
                              value={action.apiResponsePath || ''}
                              onChange={(e) => handleUpdateAction(seq.id, action.id, { apiResponsePath: e.target.value })}
                              className="border border-slate-200 rounded px-1.5 py-1 text-[10px] bg-white text-slate-800 font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            />
                          </div>

                          {/* Optional Delay */}
                          <div className="flex items-center justify-between pt-0.5">
                            <label className="text-[9px] font-semibold text-slate-500 uppercase tracking-wider">Delay (ms)</label>
                            <input
                              type="number"
                              min={0}
                              step={100}
                              placeholder="0"
                              value={action.delay || ''}
                              onChange={(e) => handleUpdateAction(seq.id, action.id, { delay: e.target.value ? Number(e.target.value) : undefined })}
                              className="w-20 border border-slate-200 rounded px-1.5 py-0.5 text-[10px] bg-slate-50 text-right focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            />
                          </div>

                          {/* Test Button & Result */}
                          <div className="pt-1 flex flex-col gap-1">
                            <button
                              type="button"
                              disabled={testingActionId === action.id}
                              onClick={() => handleTestActionApi(action)}
                              className="w-full py-1 px-2 bg-indigo-50 hover:bg-indigo-100 disabled:opacity-50 text-indigo-700 border border-indigo-200 rounded text-[10px] font-medium flex items-center justify-center gap-1 cursor-pointer transition-colors"
                            >
                              {testingActionId === action.id ? (
                                <>
                                  <RefreshCw size={11} className="animate-spin text-indigo-600" />
                                  Testing API...
                                </>
                              ) : (
                                <>
                                  <Play size={10} className="fill-indigo-700" />
                                  Test This API Action
                                </>
                              )}
                            </button>

                            {actionTestResult && actionTestResult.actionId === action.id && (
                              <div className={`p-1.5 rounded border text-[9.5px] flex flex-col gap-1 ${actionTestResult.ok ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-rose-50 border-rose-200 text-rose-900'}`}>
                                <div className="flex items-center justify-between">
                                  <span className="font-bold flex items-center gap-1">
                                    {actionTestResult.ok ? <Check size={11} className="text-emerald-600" /> : <AlertCircle size={11} className="text-rose-600" />}
                                    Status: {actionTestResult.status || (actionTestResult.ok ? '200 OK' : 'Error')}
                                  </span>
                                  <span className="text-[9px] opacity-75">{actionTestResult.timeMs}ms</span>
                                </div>

                                {actionTestResult.error && (
                                  <span className="text-rose-700">{actionTestResult.error}</span>
                                )}

                                {actionTestResult.extracted !== undefined ? (
                                  <div className="flex flex-col gap-0.5">
                                    <span className="text-[9px] font-semibold text-emerald-800">
                                      Extracted ({Array.isArray(actionTestResult.extracted) ? actionTestResult.extracted.length + ' items' : typeof actionTestResult.extracted}):
                                    </span>
                                    <pre className="max-h-20 overflow-y-auto bg-slate-900 text-emerald-300 p-1.5 rounded font-mono text-[9px]">
                                      {JSON.stringify(actionTestResult.extracted, null, 2)}
                                    </pre>
                                  </div>
                                ) : actionTestResult.data !== undefined ? (
                                  <pre className="max-h-20 overflow-y-auto bg-slate-900 text-slate-100 p-1.5 rounded font-mono text-[9px]">
                                    {typeof actionTestResult.data === 'object' ? JSON.stringify(actionTestResult.data, null, 2) : String(actionTestResult.data)}
                                  </pre>
                                ) : null}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })()}

                    {action.type === 'triggerAnimation' && (
                      <div className="flex flex-col gap-1.5 pt-1.5 border-t border-slate-100 w-full">
                        <TargetElementPicker
                          originNode={node}
                          targetId={action.targetNodeId}
                          onSelectTarget={(id) => handleUpdateAction(seq.id, action.id, { targetNodeId: id })}
                          sequenceId={seq.id}
                          actionId={action.id}
                          actionType="triggerAnimation"
                          label="Target Element to Animate"
                        />
                        <div className="flex flex-col gap-0.5">
                          <label className="text-[9px] font-semibold text-slate-500 uppercase tracking-wider">Animation Effect</label>
                          <select
                            value={action.animationType || 'bounce'}
                            onChange={(e) => handleUpdateAction(seq.id, action.id, { animationType: e.target.value as any })}
                            className="w-full border border-slate-200 rounded px-1.5 py-1 text-[10px] bg-slate-50 text-slate-800 truncate"
                          >
                            <option value="bounce">Bounce</option>
                            <option value="pulse">Pulse</option>
                            <option value="spin">Spin</option>
                            <option value="fade-in">Fade In</option>
                            <option value="slide-up">Slide Up</option>
                            <option value="slide-down">Slide Down</option>
                            <option value="slide-left">Slide Left</option>
                            <option value="slide-right">Slide Right</option>
                          </select>
                        </div>
                      </div>
                    )}

                    {action.type === 'toggleVisibility' && (
                      <div className="flex flex-col gap-1.5 pt-1.5 border-t border-slate-100 w-full">
                        <TargetElementPicker
                          originNode={node}
                          targetId={action.targetNodeId}
                          onSelectTarget={(id) => handleUpdateAction(seq.id, action.id, { targetNodeId: id })}
                          sequenceId={seq.id}
                          actionId={action.id}
                          actionType="toggleVisibility"
                          label="Target Element Visibility"
                        />
                        <div className="flex flex-col gap-0.5">
                          <label className="text-[9px] font-semibold text-slate-500 uppercase tracking-wider">Visibility Mode</label>
                          <select
                            value={action.visibilityAction || 'toggle'}
                            onChange={(e) => handleUpdateAction(seq.id, action.id, { visibilityAction: e.target.value as any })}
                            className="border border-slate-200 rounded px-1.5 py-1 text-[10px] bg-slate-50 text-slate-800 w-full truncate"
                          >
                            <option value="toggle">Toggle Visibility</option>
                            <option value="show">Show Element</option>
                            <option value="hide">Hide Element</option>
                          </select>
                        </div>
                      </div>
                    )}

                    {(action.type === 'submitForm' || action.type === 'resetForm') && (
                      <div className="flex flex-col gap-1.5 pt-1.5 border-t border-slate-100 w-full">
                        <TargetElementPicker
                          originNode={node}
                          targetId={action.targetNodeId}
                          onSelectTarget={(id) => handleUpdateAction(seq.id, action.id, { targetNodeId: id })}
                          sequenceId={seq.id}
                          actionId={action.id}
                          actionType={action.type}
                          label={action.type === 'submitForm' ? 'Target Form to Submit' : 'Target Form to Reset'}
                          defaultLabel="Auto (Nearest Form)"
                          allowedTypes={['FormContainer']}
                        />
                        <p className="text-[9px] text-slate-500 italic pt-0.5">
                          {action.type === 'submitForm' ? 'Submits form to run its onSubmit actions.' : 'Resets form inputs on trigger.'}
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
