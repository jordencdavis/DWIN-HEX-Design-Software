/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useDwin } from '../../context/DwinContext';
import { Parameter, DwinDataType, VpRole } from '../../types/dwin';
import { formatVpHex, generateDwinFrame } from '../../utils/hexEngine';
import { 
  Plus, Search, Edit3, Trash2, Copy, AlertTriangle, ExternalLink, 
  Cpu, Hash, CheckCircle2, Sliders, X, ArrowDown, ArrowUp
} from 'lucide-react';

const getGroupBadgeClass = (group: string) => {
  const g = group.toLowerCase();
  if (g.includes('chamber') || g.includes('env')) return 'bg-blue-50 text-blue-700 border-blue-200';
  if (g.includes('temp') || g.includes('therm')) return 'bg-amber-50 text-amber-700 border-amber-200';
  if (g.includes('humid') || g.includes('sensor')) return 'bg-cyan-50 text-cyan-700 border-cyan-200';
  if (g.includes('press') || g.includes('safe') || g.includes('alarm')) return 'bg-rose-50 text-rose-700 border-rose-200';
  if (g.includes('control') || g.includes('calib')) return 'bg-purple-50 text-purple-700 border-purple-200';
  if (g.includes('status') || g.includes('diag')) return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  return 'bg-indigo-50 text-indigo-700 border-indigo-200';
};

const getRoleBadgeClass = (role: VpRole) => {
  switch (role) {
    case 'read_write':
      return 'bg-violet-100/80 text-violet-800 border-violet-300/70';
    case 'read_only':
      return 'bg-sky-100/80 text-sky-800 border-sky-300/70';
    case 'write_only':
      return 'bg-orange-100/80 text-orange-800 border-orange-300/70';
    case 'system_reg':
      return 'bg-amber-100/80 text-amber-800 border-amber-300/70';
    case 'touch_return':
      return 'bg-emerald-100/80 text-emerald-800 border-emerald-300/70';
    default:
      return 'bg-slate-100 text-slate-700 border-slate-300';
  }
};

const getRoleCommandBadge = (role: VpRole): string => {
  switch (role) {
    case 'write_only':
      return '0x82 (Write VP)';
    case 'read_only':
      return '0x83 (Read VP)';
    case 'read_write':
      return '0x82 / 0x83 (Write / Read)';
    case 'touch_return':
      return '0x84 (Touch Jump)';
    case 'system_reg':
      return '0x80 / 0x81 (Sys Reg)';
    default:
      return '0x82 / 0x83';
  }
};

const getQuickHexPreview = (param: Parameter, headerHex: string): string => {
  try {
    const frame = generateDwinFrame({
      header: headerHex || '5A A5',
      command: param.role === 'read_only' ? 0x83 : 0x82,
      vpAddress: param.vpAddress,
      dataType: param.dataType,
      value: param.defaultValue,
      wordCount: param.words || 1
    });
    return frame.rawHex;
  } catch {
    return `5A A5 05 82 ${(param.vpAddress >> 8).toString(16).padStart(2, '0').toUpperCase()} ${(param.vpAddress & 0xff).toString(16).padStart(2, '0').toUpperCase()} 00 00`;
  }
};

export const ParameterRegistry: React.FC = () => {
  const {
    project,
    addParameter,
    updateParameter,
    deleteParameter,
    duplicateParameter,
    jumpToHexLabWithParam,
    setSelectedScreenId,
    setActiveTab
  } = useDwin();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGroup, setSelectedGroup] = useState<string>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingParam, setEditingParam] = useState<Parameter | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [vpHexInput, setVpHexInput] = useState('0x1000');
  const [dataType, setDataType] = useState<DwinDataType>('UINT16');
  const [words, setWords] = useState(1);
  const [unit, setUnit] = useState('°C');
  const [scale, setScale] = useState(1);
  const [minVal, setMinVal] = useState(0);
  const [maxVal, setMaxVal] = useState(100);
  const [defaultVal, setDefaultVal] = useState<string | number>(25);
  const [role, setRole] = useState<VpRole>('read_write');
  const [group, setGroup] = useState('Thermal Loop');
  const [description, setDescription] = useState('');

  // Groups
  const groups = Array.from(new Set(project.parameters.map(p => p.group))).filter(Boolean);

  // Check for duplicate / overlapping VP addresses
  const vpOccupancy = new Map<number, Parameter[]>();
  project.parameters.forEach(p => {
    for (let i = 0; i < p.words; i++) {
      const addr = p.vpAddress + i;
      const list = vpOccupancy.get(addr) || [];
      list.push(p);
      vpOccupancy.set(addr, list);
    }
  });

  const getOverlapConflict = (param: Parameter): string | null => {
    for (let i = 0; i < param.words; i++) {
      const addr = param.vpAddress + i;
      const list = vpOccupancy.get(addr);
      if (list && list.length > 1) {
        const others = list.filter(p => p.id !== param.id).map(p => `"${p.name}" (${formatVpHex(p.vpAddress)})`);
        if (others.length > 0) {
          return `Overlaps address ${formatVpHex(addr)} with: ${others.join(', ')}`;
        }
      }
    }
    return null;
  };

  const filteredParameters = project.parameters.filter(p => {
    const q = searchQuery.toLowerCase();
    const matchesSearch = 
      p.name.toLowerCase().includes(q) ||
      p.identifier.toLowerCase().includes(q) ||
      formatVpHex(p.vpAddress).toLowerCase().includes(q) ||
      p.unit.toLowerCase().includes(q) ||
      p.dataType.toLowerCase().includes(q);
    const matchesGroup = selectedGroup === 'all' || p.group === selectedGroup;
    return matchesSearch && matchesGroup;
  });

  const handleOpenAdd = () => {
    setEditingParam(null);
    const highestVp = project.parameters.reduce((max, p) => Math.max(max, p.vpAddress + p.words), 0x1000);
    setName('');
    setIdentifier('');
    setVpHexInput(formatVpHex(highestVp));
    setDataType('UINT16');
    setWords(1);
    setUnit('');
    setScale(1);
    setMinVal(0);
    setMaxVal(100);
    setDefaultVal(0);
    setRole('read_write');
    setGroup('Thermal Loop');
    setDescription('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (p: Parameter) => {
    setEditingParam(p);
    setName(p.name);
    setIdentifier(p.identifier);
    setVpHexInput(formatVpHex(p.vpAddress));
    setDataType(p.dataType);
    setWords(p.words);
    setUnit(p.unit);
    setScale(p.scale);
    setMinVal(p.min);
    setMaxVal(p.max);
    setDefaultVal(p.defaultValue);
    setRole(p.role);
    setGroup(p.group);
    setDescription(p.description);
    setIsModalOpen(true);
  };

  const handleDataTypeChange = (type: DwinDataType) => {
    setDataType(type);
    if (type === 'UINT32' || type === 'INT32' || type === 'FLOAT32') {
      setWords(2);
    } else if (type === 'STRING') {
      setWords(10);
    } else {
      setWords(1);
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanHex = vpHexInput.trim().replace(/^0x/i, '');
    const vpAddress = parseInt(cleanHex, 16) || 0x1000;

    const payload = {
      name: name.trim() || 'Unnamed Parameter',
      identifier: identifier.trim() || name.toUpperCase().replace(/[^A-Z0-9]/g, '_') || 'PARAM',
      vpAddress,
      dataType,
      words: Number(words) || 1,
      unit: unit.trim(),
      scale: Number(scale) || 1,
      min: Number(minVal),
      max: Number(maxVal),
      defaultValue: defaultVal,
      role,
      group: group.trim() || 'General',
      description: description.trim()
    };

    if (editingParam) {
      updateParameter(editingParam.id, payload);
    } else {
      addParameter(payload);
    }

    setIsModalOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-slate-200 rounded-lg p-5 shadow-xs">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            Parameter Registry
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Define each DGUS parameter once. Configure engineering units, word sizes, VP addresses, permitted range, scaling factor, and roles.
          </p>
        </div>
        <button
          onClick={handleOpenAdd}
          className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors whitespace-nowrap self-start sm:self-auto shadow-xs"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Define Parameter</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-3 shadow-xs">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search by parameter name, identifier, VP address (e.g. 0x1000), or unit..."
              className="w-full text-xs pl-8 pr-3 py-1.5 rounded-md border border-slate-300 bg-slate-50 text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Group Filter */}
          <div className="flex items-center gap-1 overflow-x-auto text-xs shrink-0">
            <button
              onClick={() => setSelectedGroup('all')}
              className={`px-2.5 py-1 rounded text-xs transition-colors whitespace-nowrap ${
                selectedGroup === 'all'
                  ? 'bg-blue-600 text-white font-medium'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              All Groups ({project.parameters.length})
            </button>
            {groups.map(g => (
              <button
                key={g}
                onClick={() => setSelectedGroup(g)}
                className={`px-2.5 py-1 rounded text-xs transition-colors whitespace-nowrap ${
                  selectedGroup === g
                    ? 'bg-blue-600 text-white font-medium'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {g}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Parameters Table */}
      <div 
        className="border border-slate-200 rounded-lg overflow-hidden shadow-xs"
        style={{ backgroundColor: '#eaeaea' }}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 font-semibold text-xs">
                <th className="py-3 px-4 bg-blue-100/90 text-blue-900 border-l-4 border-l-blue-600 border-r border-blue-200/80">Screen &amp; VP Address</th>
                <th className="py-3 px-4 bg-amber-100/90 text-amber-900 border-l-4 border-l-amber-600 border-r border-amber-200/80">Parameter Name &amp; Key</th>
                <th className="py-3 px-4 bg-cyan-100/90 text-cyan-900 border-l-4 border-l-cyan-600 border-r border-cyan-200/80">Unit &amp; Scaling</th>
                <th className="py-3 px-4 bg-emerald-100/90 text-emerald-950 border-l-4 border-l-emerald-600 border-r border-emerald-200/80">
                  <div className="flex items-center gap-1">
                    <ArrowDown className="w-3.5 h-3.5 text-emerald-700" />
                    <span>Lower Limit (Min)</span>
                  </div>
                </th>
                <th className="py-3 px-4 bg-rose-100/90 text-rose-950 border-l-4 border-l-rose-600 border-r border-rose-200/80">
                  <div className="flex items-center gap-1">
                    <ArrowUp className="w-3.5 h-3.5 text-rose-700" />
                    <span>Upper Limit (Max)</span>
                  </div>
                </th>
                <th className="py-3 px-4 bg-violet-100/90 text-violet-900 border-l-4 border-l-violet-600 border-r border-violet-200/80">Role &amp; DWIN Cmd</th>
                <th className="py-3 px-4 bg-slate-200/90 text-slate-800 border-l-4 border-l-slate-600 text-right">Actions &amp; HEX Frame</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredParameters.map((param, idx) => {
                const conflict = getOverlapConflict(param);
                const boundScreens = project.screens.filter(s =>
                  s.vpBindings && s.vpBindings.some(vp => vp.vpAddress === param.vpAddress)
                );
                const screenNames = boundScreens.map(s => s.name);
                return (
                  <tr
                    key={param.id}
                    className={`transition-colors hover:bg-blue-50/40 ${
                      conflict ? 'bg-amber-50/60' : idx % 2 === 1 ? 'bg-slate-50/30' : 'bg-white'
                    }`}
                  >
                    {/* VP Address (Blue Theme - Left Margin Blue) */}
                    <td className="py-3 px-4 whitespace-nowrap border-l-4 border-l-blue-500 border-r border-slate-100">
                      {/* Screen name as first on the div (no number needed) */}
                      {screenNames.length > 0 ? (
                        <div
                          onClick={() => {
                            if (boundScreens[0]) {
                              setSelectedScreenId(boundScreens[0].id);
                              setActiveTab('screens');
                            }
                          }}
                          className="text-xs font-bold text-slate-800 hover:text-blue-700 cursor-pointer truncate max-w-[200px] mb-1.5 transition-colors"
                          title={`Assigned Screen: ${screenNames.join(', ')} (Click to view screen)`}
                        >
                          {screenNames.join(', ')}
                        </div>
                      ) : (
                        <div className="text-[11px] text-slate-400 italic mb-1.5">
                          No Screen
                        </div>
                      )}

                      <div className="flex items-center gap-1.5 font-mono">
                        <span 
                          style={{ fontSize: '14px' }}
                          className="font-mono font-bold text-[14px] px-2.5 py-0.5 rounded-md bg-blue-100/80 text-blue-800 border border-blue-300/70 shadow-2xs"
                        >
                          {formatVpHex(param.vpAddress)}
                        </span>
                        {param.words > 1 && (
                          <span className="text-[10px] text-blue-600 font-mono">
                            ..{formatVpHex(param.vpAddress + param.words - 1)}
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                        {param.words} {param.words === 1 ? 'word' : 'words'} ({param.words * 2}B)
                      </div>
                      {conflict && (
                        <div className="flex items-center gap-1 text-[11px] text-amber-600 font-medium mt-0.5">
                          <AlertTriangle className="w-3 h-3 shrink-0" />
                          <span className="truncate max-w-[180px]" title={conflict}>{conflict}</span>
                        </div>
                      )}
                    </td>

                    {/* Name & Key (Amber Theme - Left Margin Amber) */}
                    <td className="py-3 px-4 border-l-4 border-l-amber-500 border-r border-slate-100">
                      <div className="font-semibold text-slate-900">
                        {param.name}
                      </div>
                      <div className="font-mono text-[11px] text-slate-500 mt-0.5">
                        {param.identifier}
                      </div>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className={`inline-block text-[10px] font-medium px-2 py-0.2 rounded-full border ${getGroupBadgeClass(param.group)}`}>
                          {param.group}
                        </span>
                      </div>
                    </td>

                    {/* Unit & Scale (Cyan Theme - Left Margin Cyan) */}
                    <td className="py-3 px-4 whitespace-nowrap border-l-4 border-l-cyan-500 border-r border-slate-100">
                      <span className="inline-flex items-center font-semibold text-xs px-2.5 py-0.5 rounded-md bg-cyan-100/80 text-cyan-800 border border-cyan-300/70">
                        {param.unit || 'Unitless'}
                      </span>
                      <div className="text-[11px] text-cyan-700 font-mono mt-0.5">
                        Scale: 1 / {param.scale}
                        {param.scale > 1 && (
                          <span className="text-cyan-600"> (res 0.{(1 / param.scale).toString().slice(2)})</span>
                        )}
                      </div>
                    </td>

                    {/* Lower Limit (Emerald Theme - Left Margin Emerald) */}
                    <td className="py-3 px-4 whitespace-nowrap border-l-4 border-l-emerald-500 border-r border-slate-100">
                      <div className="flex items-center gap-1.5 font-mono">
                        <span className="inline-flex items-center gap-1 font-semibold text-xs px-2.5 py-0.5 rounded-md bg-emerald-100/90 text-emerald-800 border border-emerald-300/80 shadow-2xs">
                          <ArrowDown className="w-3 h-3 text-emerald-600" />
                          <span>{param.min}</span>
                        </span>
                        {param.unit && (
                          <span className="text-[11px] text-emerald-700 font-medium">{param.unit}</span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        Minimum limit
                      </div>
                    </td>

                    {/* Upper Limit (Rose Theme - Left Margin Rose) */}
                    <td className="py-3 px-4 whitespace-nowrap border-l-4 border-l-rose-500 border-r border-slate-100">
                      <div className="flex items-center gap-1.5 font-mono">
                        <span className="inline-flex items-center gap-1 font-semibold text-xs px-2.5 py-0.5 rounded-md bg-rose-100/90 text-rose-800 border border-rose-300/80 shadow-2xs">
                          <ArrowUp className="w-3 h-3 text-rose-600" />
                          <span>{param.max}</span>
                        </span>
                        {param.unit && (
                          <span className="text-[11px] text-rose-700 font-medium">{param.unit}</span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        Default: <span className="font-mono font-semibold text-slate-700">{param.defaultValue}</span>
                      </div>
                    </td>

                    {/* Role & DWIN Command (Violet Theme - Left Margin Violet) */}
                    <td className="py-3 px-4 whitespace-nowrap border-l-4 border-l-violet-500 border-r border-slate-100">
                      <div className="flex flex-col gap-1 items-start">
                        <span className={`inline-flex items-center font-mono text-[11px] px-2.5 py-0.5 rounded-md border font-medium ${getRoleBadgeClass(param.role)}`}>
                          {param.role.replace(/_only$/, '').replace('_', ' ')}
                        </span>
                        <span 
                          className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-violet-50 text-violet-800 border border-violet-200 font-bold"
                          title="DWIN Protocol: 0x82 = Write to VP, 0x83 = Read from VP, 0x84 = Touch/Page Jump"
                        >
                          {getRoleCommandBadge(param.role)}
                        </span>
                      </div>
                    </td>

                    {/* Actions & HEX Lab (Slate Theme - Left Margin Slate) */}
                    <td className="py-3 px-4 text-right whitespace-nowrap border-l-4 border-l-slate-400">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => jumpToHexLabWithParam(param)}
                          className="px-2.5 py-1 text-xs text-blue-700 hover:text-blue-900 border border-blue-200 bg-blue-50/70 rounded hover:bg-blue-100 flex items-center gap-1 font-medium transition-colors"
                          title="Generate or Test HEX Frame for this Parameter"
                        >
                          <ExternalLink className="w-3 h-3" />
                          <span>HEX Lab</span>
                        </button>
                        <button
                          onClick={() => handleOpenEdit(param)}
                          className="p-1.5 text-slate-600 hover:text-slate-900 rounded hover:bg-slate-100 transition-colors"
                          title="Edit Parameter"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => duplicateParameter(param.id)}
                          className="p-1.5 text-slate-600 hover:text-slate-900 rounded hover:bg-slate-100 transition-colors"
                          title="Duplicate Parameter"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`Delete parameter "${param.name}"?`)) {
                              deleteParameter(param.id);
                            }
                          }}
                          className="p-1.5 text-red-500 hover:text-red-700 rounded hover:bg-red-50 transition-colors"
                          title="Delete Parameter"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Second line: Hex Value frame preview */}
                      <div className="flex items-center justify-end mt-1.5">
                        <div
                          onClick={() => jumpToHexLabWithParam(param)}
                          className="inline-flex items-center gap-1.5 font-mono text-xs text-blue-700 hover:text-blue-900 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-2 py-0.5 rounded cursor-pointer transition-colors shadow-2xs font-semibold"
                          title={`Click to load into HEX Lab: ${getQuickHexPreview(param, project.headerHex)}`}
                        >
                          <span className="text-[10px] text-slate-400 font-sans uppercase font-medium">HEX:</span>
                          <span style={{ fontSize: '14px' }} className="text-[14px] font-mono tracking-wide">
                            {getQuickHexPreview(param, project.headerHex)}
                          </span>
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filteredParameters.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-xs text-slate-500">
                    No parameters match your search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Parameter Edit / Add Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-lg max-w-xl w-full p-6 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">
                {editingParam ? `Edit Parameter: ${editingParam.name}` : 'Define New DGUS Parameter'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-700 font-medium mb-1">
                    Parameter Name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Target Temperature"
                    value={name}
                    onChange={e => {
                      setName(e.target.value);
                      if (!identifier || identifier.startsWith('PARAM_')) {
                        setIdentifier(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '_'));
                      }
                    }}
                    className="w-full px-3 py-1.5 rounded border border-slate-300 bg-slate-50 text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-medium mb-1 font-mono">
                    Identifier (C Macro / Key)
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. CMD_TARGET_TEMP"
                    value={identifier}
                    onChange={e => setIdentifier(e.target.value.toUpperCase())}
                    className="w-full px-3 py-1.5 rounded border border-slate-300 bg-slate-50 text-slate-900 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-slate-700 font-medium mb-1 font-mono">
                    VP Address (Hex)
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="0x1000"
                    value={vpHexInput}
                    onChange={e => setVpHexInput(e.target.value)}
                    className="w-full px-3 py-1.5 rounded border border-slate-300 bg-slate-50 text-slate-900 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-medium mb-1">
                    Data Type
                  </label>
                  <select
                    value={dataType}
                    onChange={e => handleDataTypeChange(e.target.value as DwinDataType)}
                    className="w-full px-3 py-1.5 rounded border border-slate-300 bg-slate-50 text-slate-900 font-mono"
                  >
                    <option value="UINT16">UINT16 (1 word / 2 bytes)</option>
                    <option value="INT16">INT16 (Signed 1 word)</option>
                    <option value="UINT32">UINT32 (2 words / 4 bytes)</option>
                    <option value="INT32">INT32 (Signed 2 words)</option>
                    <option value="FLOAT32">FLOAT32 (IEEE-754 4 bytes)</option>
                    <option value="STRING">STRING (ASCII/GBK variable)</option>
                    <option value="BITFIELD">BITFIELD (16-bit status mask)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-medium mb-1 font-mono">
                    Words Allocated
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="64"
                    value={words}
                    onChange={e => setWords(parseInt(e.target.value) || 1)}
                    className="w-full px-3 py-1.5 rounded border border-slate-300 bg-slate-50 text-slate-900 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-700 font-medium mb-1">
                    Engineering Unit
                  </label>
                  <input
                    type="text"
                    placeholder="°C, RPM, bar, ms, %, etc."
                    value={unit}
                    onChange={e => setUnit(e.target.value)}
                    className="w-full px-3 py-1.5 rounded border border-slate-300 bg-slate-50 text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-medium mb-1">
                    Scale Factor (1 = 1:1, 10 = 0.1 res)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="10000"
                    value={scale}
                    onChange={e => setScale(parseInt(e.target.value) || 1)}
                    className="w-full px-3 py-1.5 rounded border border-slate-300 bg-slate-50 text-slate-900 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-slate-700 font-medium mb-1 font-mono">
                    Minimum Allowed
                  </label>
                  <input
                    type="number"
                    value={minVal}
                    onChange={e => setMinVal(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-1.5 rounded border border-slate-300 bg-slate-50 text-slate-900 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-medium mb-1 font-mono">
                    Maximum Allowed
                  </label>
                  <input
                    type="number"
                    value={maxVal}
                    onChange={e => setMaxVal(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-1.5 rounded border border-slate-300 bg-slate-50 text-slate-900 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-medium mb-1 font-mono">
                    Default Initial Value
                  </label>
                  <input
                    type="text"
                    value={defaultVal}
                    onChange={e => setDefaultVal(e.target.value)}
                    className="w-full px-3 py-1.5 rounded border border-slate-300 bg-slate-50 text-slate-900 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-700 font-medium mb-1">
                    VP Role
                  </label>
                  <select
                    value={role}
                    onChange={e => setRole(e.target.value as VpRole)}
                    className="w-full px-3 py-1.5 rounded border border-slate-300 bg-slate-50 text-slate-900"
                  >
                    <option value="read_write">Read &amp; Write (Setpoint / Interactive)</option>
                    <option value="read_only">Read Telemetry (Sensor / Calculated)</option>
                    <option value="write_only">Write Pulse / Command</option>
                    <option value="system_reg">DWIN System Register (0x0000 - 0x00FF)</option>
                    <option value="touch_return">Touch Return Keycode / Keypad buffer</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-medium mb-1">
                    Group / Subsystem
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Thermal Loop, Motion, Pneumatics"
                    value={group}
                    onChange={e => setGroup(e.target.value)}
                    className="w-full px-3 py-1.5 rounded border border-slate-300 bg-slate-50 text-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-medium mb-1">
                  Description &amp; Embedded Implementation Notes
                </label>
                <textarea
                  rows={2}
                  placeholder="Detail protocol word alignment, calibration, or DGUS config notes..."
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  className="w-full px-3 py-1.5 rounded border border-slate-300 bg-slate-50 text-slate-900"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3 py-1.5 rounded border border-slate-300 text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3.5 py-1.5 rounded bg-blue-600 text-white font-medium hover:bg-blue-700"
                >
                  {editingParam ? 'Save Changes' : 'Create Parameter'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
