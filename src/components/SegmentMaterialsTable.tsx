import React, { useState } from 'react';
import { NormalizedXmlGraph, Segment, SurfaceDetail } from '../types';
import {
  ChevronRight,
  ChevronDown,
  LayoutGrid,
  TableProperties,
  Maximize2,
  Minimize2
} from 'lucide-react';

interface SegmentMaterialsTableProps {
  graph: NormalizedXmlGraph;
}

export const SegmentMaterialsTable: React.FC<SegmentMaterialsTableProps> = ({ graph }) => {
  const segments = graph.segments;
  const unitMaterials = graph.unitOptions.materials;

  const [viewMode, setViewMode] = useState<'summary' | 'matrix'>('summary');
  const [expandedRowIds, setExpandedRowIds] = useState<Set<string>>(new Set());

  const toggleRow = (id: string) => {
    setExpandedRowIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleExpandAll = () => {
    if (expandedRowIds.size === segments.length) {
      setExpandedRowIds(new Set());
    } else {
      setExpandedRowIds(new Set(segments.map(s => s.id)));
    }
  };

  const getSurface = (
    seg: Segment,
    face: 'left' | 'front' | 'right' | 'rear' | 'top' | 'bottom'
  ): SurfaceDetail => {
    if (seg.surfaces && seg.surfaces[face]) {
      return seg.surfaces[face]!;
    }
    const extMat = seg.casing?.exteriorMaterial || unitMaterials.exteriorMaterialType || 'STL GALV PPC';
    const extGa = seg.casing?.exteriorGauge || unitMaterials.exteriorMaterialGauge || 18;
    const intMat = seg.casing?.interiorMaterial || unitMaterials.interiorMaterialType || 'STL GALV';
    const intGa = seg.casing?.interiorGauge || unitMaterials.interiorMaterialGauge || 22;
    const thk = face === 'top'
      ? (seg.casing?.housingThicknessTop || seg.casing?.housingThickness || 2)
      : (face === 'bottom' ? 0 : (seg.casing?.housingThickness || 2));

    return {
      exteriorMaterial: extMat,
      exteriorGauge: extGa,
      exteriorPaint: seg.casing?.exteriorPaintType || unitMaterials.exteriorPaintType || 'None',
      interiorMaterial: intMat,
      interiorGauge: intGa,
      interiorPaint: seg.casing?.interiorPaintType || unitMaterials.interiorPaintType || 'None',
      housingThickness: thk
    };
  };

  const renderFaceCard = (faceLabel: string, surface: SurfaceDetail) => {
    return (
      <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-850/80 flex flex-col justify-between space-y-2">
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-1.5">
          <span className="text-[11px] font-bold text-slate-800 dark:text-slate-200 font-mono uppercase tracking-wide">
            {faceLabel}
          </span>
          <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400">
            {surface.housingThickness}" Wall
          </span>
        </div>
        <div className="space-y-1 text-[11px] font-mono">
          <div className="flex items-center justify-between">
            <span className="text-slate-500 dark:text-slate-400">Exterior:</span>
            <span className="text-slate-800 dark:text-slate-200 font-medium">
              {surface.exteriorMaterial}{' '}
              <span className="font-bold text-blue-600 dark:text-blue-400">({surface.exteriorGauge} GA)</span>
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-500 dark:text-slate-400">Interior:</span>
            <span className="text-slate-800 dark:text-slate-200 font-medium">
              {surface.interiorMaterial}{' '}
              <span className="font-bold text-indigo-600 dark:text-indigo-400">({surface.interiorGauge} GA)</span>
            </span>
          </div>
          {surface.exteriorPaint && surface.exteriorPaint !== 'None' && (
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-slate-500 dark:text-slate-400">Paint:</span>
              <span className="text-slate-700 dark:text-slate-300">{surface.exteriorPaint}</span>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Unit Default Baseline Schedule */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800">
          <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400">Exterior Skin Baseline</div>
          <div className="text-xs font-bold text-slate-900 dark:text-white mt-1">
            {unitMaterials.exteriorMaterialType || 'STL GALV PPC'}
          </div>
          <div className="text-[11px] font-mono text-slate-600 dark:text-slate-300 mt-0.5">
            Gauge: <span className="font-bold text-blue-600 dark:text-blue-400">{unitMaterials.exteriorMaterialGauge || 18} GA</span>
          </div>
        </div>

        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800">
          <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400">Interior Liner Baseline</div>
          <div className="text-xs font-bold text-slate-900 dark:text-white mt-1">
            {unitMaterials.interiorMaterialType || 'STL GALV'}
          </div>
          <div className="text-[11px] font-mono text-slate-600 dark:text-slate-300 mt-0.5">
            Gauge: <span className="font-bold text-indigo-600 dark:text-indigo-400">{unitMaterials.interiorMaterialGauge || 22} GA</span>
          </div>
        </div>

        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800">
          <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400">Floor & Insulation Baseline</div>
          <div className="text-xs font-bold text-slate-900 dark:text-white mt-1">
            {unitMaterials.floorMaterialType || 'STL GALV'} ({unitMaterials.floorMaterialGauge || 16} GA)
          </div>
          <div className="text-[11px] font-mono text-slate-600 dark:text-slate-300 mt-0.5">
            {unitMaterials.housingStyle || 'ThermalBreak'} • {unitMaterials.insulationType || 'Foam'}
          </div>
        </div>
      </div>

      {/* View Mode Switcher & Expand/Collapse Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-1">
        <div className="text-xs text-slate-500 dark:text-slate-400 font-mono">
          Surface details imported from XML configuration
        </div>

        <div className="flex items-center gap-2">
          {viewMode === 'summary' && (
            <button
              onClick={handleExpandAll}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-300 transition-colors"
            >
              {expandedRowIds.size === segments.length ? (
                <>
                  <Minimize2 className="w-3.5 h-3.5" />
                  <span>Collapse All</span>
                </>
              ) : (
                <>
                  <Maximize2 className="w-3.5 h-3.5" />
                  <span>Expand All Surfaces</span>
                </>
              )}
            </button>
          )}

          <div className="flex items-center bg-slate-100 dark:bg-slate-850 p-0.5 rounded-lg border border-slate-200 dark:border-slate-800">
            <button
              onClick={() => setViewMode('summary')}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                viewMode === 'summary'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Summary + Surfaces</span>
            </button>
            <button
              onClick={() => setViewMode('matrix')}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                viewMode === 'matrix'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <TableProperties className="w-3.5 h-3.5" />
              <span>5-Surface Matrix</span>
            </button>
          </div>
        </div>
      </div>

      {/* VIEW 1: Summary with Expandable 5-Face Surface Breakdown */}
      {viewMode === 'summary' ? (
        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-850 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-mono text-[11px]">
                <th className="py-2.5 px-3 w-8 text-center"></th>
                <th className="py-2.5 px-3 w-14 text-center">Code</th>
                <th className="py-2.5 px-3">Segment Name</th>
                <th className="py-2.5 px-3">Skid</th>
                <th className="py-2.5 px-3">Exterior Skin</th>
                <th className="py-2.5 px-3">Interior Liner</th>
                <th className="py-2.5 px-3 text-center">Wall Thk</th>
                <th className="py-2.5 px-3 text-center">Surfaces</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 bg-white dark:bg-slate-900/60">
              {segments.map((seg, idx) => {
                const parentSkid = graph.skids.find(s => s.segmentIds.includes(seg.id));
                const extMat = seg.casing?.exteriorMaterial || unitMaterials.exteriorMaterialType;
                const extGa = seg.casing?.exteriorGauge || unitMaterials.exteriorMaterialGauge;
                const intMat = seg.casing?.interiorMaterial || unitMaterials.interiorMaterialType;
                const intGa = seg.casing?.interiorGauge || unitMaterials.interiorMaterialGauge;
                const wallThk = seg.casing?.housingThickness || 2;
                const isExpanded = expandedRowIds.has(seg.id);

                const leftSurf = getSurface(seg, 'left');
                const frontSurf = getSurface(seg, 'front');
                const rightSurf = getSurface(seg, 'right');
                const rearSurf = getSurface(seg, 'rear');
                const topSurf = getSurface(seg, 'top');

                return (
                  <React.Fragment key={seg.id || idx}>
                    <tr
                      onClick={() => toggleRow(seg.id)}
                      className={`hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors cursor-pointer select-none ${
                        isExpanded ? 'bg-slate-50/70 dark:bg-slate-800/30' : ''
                      }`}
                    >
                      <td className="py-2.5 px-2 text-center text-slate-400">
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4 mx-auto text-blue-600 dark:text-blue-400" />
                        ) : (
                          <ChevronRight className="w-4 h-4 mx-auto" />
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono font-bold text-blue-600 dark:text-blue-400">
                        {seg.typeCode}
                      </td>
                      <td className="py-2.5 px-3 font-medium text-slate-900 dark:text-white">
                        {seg.name}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-[11px] text-slate-500 dark:text-slate-400">
                        {parentSkid ? parentSkid.name : '-'}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-[11px] text-slate-700 dark:text-slate-300">
                        <span>{extMat}</span> <span className="font-bold text-blue-600 dark:text-blue-400">({extGa} GA)</span>
                      </td>
                      <td className="py-2.5 px-3 font-mono text-[11px] text-slate-700 dark:text-slate-300">
                        <span>{intMat}</span> <span className="font-bold text-indigo-600 dark:text-indigo-400">({intGa} GA)</span>
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono text-[11px]">
                        {wallThk}"
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono text-[11px]">
                        <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                          5 Surfaces
                        </span>
                      </td>
                    </tr>

                    {/* Expandable 5-Surface Detail Drawer */}
                    {isExpanded && (
                      <tr className="bg-slate-50/50 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800">
                        <td colSpan={8} className="p-4 pl-10">
                          <div className="space-y-2.5">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 font-mono uppercase tracking-wide">
                                {seg.typeCode} ({seg.name}) • Surface Material Details
                              </span>
                              <span className="text-[10px] font-mono text-slate-400">
                                Left • Front • Right • Rear • Top
                              </span>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2.5">
                              {renderFaceCard('Left Surface', leftSurf)}
                              {renderFaceCard('Front Surface', frontSurf)}
                              {renderFaceCard('Right Surface', rightSurf)}
                              {renderFaceCard('Rear Surface', rearSurf)}
                              {renderFaceCard('Top Surface', topSurf)}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        /* VIEW 2: Comprehensive 5-Surface Side-by-Side Matrix Table */
        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-850 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-mono text-[11px]">
                <th className="py-2.5 px-3 w-14 text-center">Code</th>
                <th className="py-2.5 px-3">Segment Name</th>
                <th className="py-2.5 px-3 w-20">Skid</th>
                <th className="py-2.5 px-3">Left Surface</th>
                <th className="py-2.5 px-3">Front Surface</th>
                <th className="py-2.5 px-3">Right Surface</th>
                <th className="py-2.5 px-3">Rear Surface</th>
                <th className="py-2.5 px-3">Top Surface</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 bg-white dark:bg-slate-900/60">
              {segments.map((seg, idx) => {
                const parentSkid = graph.skids.find(s => s.segmentIds.includes(seg.id));
                const left = getSurface(seg, 'left');
                const front = getSurface(seg, 'front');
                const right = getSurface(seg, 'right');
                const rear = getSurface(seg, 'rear');
                const top = getSurface(seg, 'top');

                const renderMatrixCell = (surf: SurfaceDetail) => (
                  <div className="font-mono text-[11px] space-y-0.5">
                    <div className="text-slate-800 dark:text-slate-200">
                      <span>{surf.exteriorMaterial}</span> <span className="font-bold text-blue-600 dark:text-blue-400">({surf.exteriorGauge}G)</span>
                    </div>
                    <div className="text-slate-600 dark:text-slate-400 text-[10px]">
                      <span>{surf.interiorMaterial}</span> <span className="font-bold text-indigo-600 dark:text-indigo-400">({surf.interiorGauge}G)</span> • {surf.housingThickness}"
                    </div>
                  </div>
                );

                return (
                  <tr key={seg.id || idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-2.5 px-3 text-center font-mono font-bold text-blue-600 dark:text-blue-400">
                      {seg.typeCode}
                    </td>
                    <td className="py-2.5 px-3 font-medium text-slate-900 dark:text-white">
                      {seg.name}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-[11px] text-slate-500 dark:text-slate-400">
                      {parentSkid ? parentSkid.name : '-'}
                    </td>
                    <td className="py-2.5 px-3">{renderMatrixCell(left)}</td>
                    <td className="py-2.5 px-3">{renderMatrixCell(front)}</td>
                    <td className="py-2.5 px-3">{renderMatrixCell(right)}</td>
                    <td className="py-2.5 px-3">{renderMatrixCell(rear)}</td>
                    <td className="py-2.5 px-3">{renderMatrixCell(top)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
