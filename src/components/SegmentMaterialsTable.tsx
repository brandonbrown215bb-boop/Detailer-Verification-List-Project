import React from 'react';
import { NormalizedXmlGraph } from '../types';
import { Layers, ShieldCheck } from 'lucide-react';

interface SegmentMaterialsTableProps {
  graph: NormalizedXmlGraph;
}

export const SegmentMaterialsTable: React.FC<SegmentMaterialsTableProps> = ({ graph }) => {
  const segments = graph.segments;
  const unitMaterials = graph.unitOptions.materials;

  return (
    <div className="space-y-4">
      {/* Unit Default Baseline Schedule */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800">
          <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400">Exterior Skin</div>
          <div className="text-xs font-bold text-slate-900 dark:text-white mt-1">
            {unitMaterials.exteriorMaterialType || 'STL GALV PPC'}
          </div>
          <div className="text-[11px] font-mono text-slate-600 dark:text-slate-300 mt-0.5">
            Gauge: <span className="font-bold text-blue-600 dark:text-blue-400">{unitMaterials.exteriorMaterialGauge || 18} GA</span>
          </div>
        </div>

        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800">
          <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400">Interior Liner</div>
          <div className="text-xs font-bold text-slate-900 dark:text-white mt-1">
            {unitMaterials.interiorMaterialType || 'STL GALV'}
          </div>
          <div className="text-[11px] font-mono text-slate-600 dark:text-slate-300 mt-0.5">
            Gauge: <span className="font-bold text-indigo-600 dark:text-indigo-400">{unitMaterials.interiorMaterialGauge || 22} GA</span>
          </div>
        </div>

        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800">
          <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400">Floor & Insulation</div>
          <div className="text-xs font-bold text-slate-900 dark:text-white mt-1">
            {unitMaterials.floorMaterialType || 'STL GALV'} ({unitMaterials.floorMaterialGauge || 16} GA)
          </div>
          <div className="text-[11px] font-mono text-slate-600 dark:text-slate-300 mt-0.5">
            {unitMaterials.housingStyle || 'ThermalBreak'} • {unitMaterials.insulationType || 'Foam'}
          </div>
        </div>
      </div>

      {/* Segment-Level Schedule Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-850 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-mono text-[11px]">
              <th className="py-2.5 px-3 w-14 text-center">Code</th>
              <th className="py-2.5 px-3">Segment Name</th>
              <th className="py-2.5 px-3">Skid</th>
              <th className="py-2.5 px-3">Exterior Skin</th>
              <th className="py-2.5 px-3">Interior Liner</th>
              <th className="py-2.5 px-3 text-center">Wall Thk</th>
              <th className="py-2.5 px-3 text-center">Status</th>
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
                  <td className="py-2.5 px-3 font-mono text-[11px] text-slate-700 dark:text-slate-300">
                    <span>{extMat}</span> <span className="font-bold text-blue-600 dark:text-blue-400">({extGa} GA)</span>
                  </td>
                  <td className="py-2.5 px-3 font-mono text-[11px] text-slate-700 dark:text-slate-300">
                    <span>{intMat}</span> <span className="font-bold text-indigo-600 dark:text-indigo-400">({intGa} GA)</span>
                  </td>
                  <td className="py-2.5 px-3 text-center font-mono text-[11px]">
                    {wallThk}"
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    <span className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-semibold border border-emerald-500/30 whitespace-nowrap">
                      <ShieldCheck className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                      <span>Verified</span>
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
