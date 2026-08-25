import React, { useState } from 'react';
import { X, PlusCircle, Building, Hash, User, Layers, ShieldCheck, Box } from 'lucide-react';
import { ManualUnitConfig } from '../services/manualUnitFactory';

interface ManualUnitModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateUnit: (config: ManualUnitConfig) => void;
}

export const ManualUnitModal: React.FC<ManualUnitModalProps> = ({
  isOpen,
  onClose,
  onCreateUnit
}) => {
  const [jobName, setJobName] = useState('New AHU Project');
  const [comNumber, setComNumber] = useState('COM-100001');
  const [detailerName, setDetailerName] = useState('Detailer');
  const [unitType, setUnitType] = useState<'Outdoor' | 'Indoor'>('Outdoor');
  const [housingStyle, setHousingStyle] = useState<'ThermalBreak' | 'Standard'>('ThermalBreak');
  const [skidCount, setSkidCount] = useState<number>(2);
  const [wallThickness, setWallThickness] = useState<number>(2.0);
  const [baseHeight, setBaseHeight] = useState<number>(10.0);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onCreateUnit({
      jobName,
      comNumber,
      detailerName,
      unitType,
      housingStyle,
      skidCount,
      wallThickness,
      baseHeight
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 dark:bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl w-full max-w-xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden text-slate-900 dark:text-slate-100">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-850">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30 flex items-center justify-center font-bold">
              <PlusCircle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Manual Unit Setup Wizard</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Initialize a blank verification workspace with custom job parameters.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Order & Identity */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider font-mono">
              1. Order & Identification
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1 flex items-center gap-1.5">
                  <Building className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                  <span>Job Name</span>
                </label>
                <input
                  type="text"
                  required
                  value={jobName}
                  onChange={(e) => setJobName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 font-medium"
                  placeholder="e.g. Medical Center Phase 3"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1 flex items-center gap-1.5">
                  <Hash className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                  <span>COM Number</span>
                </label>
                <input
                  type="text"
                  required
                  value={comNumber}
                  onChange={(e) => setComNumber(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 font-mono font-medium"
                  placeholder="e.g. COM-842910"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Detailer Name</span>
              </label>
              <input
                type="text"
                required
                value={detailerName}
                onChange={(e) => setDetailerName(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 font-medium"
                placeholder="e.g. Tanner Dean"
              />
            </div>
          </div>

          <div className="border-t border-slate-100 dark:border-slate-800 pt-4 space-y-3">
            <h4 className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider font-mono">
              2. Unit Construction & Casing
            </h4>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">Unit Environment</label>
                <div className="grid grid-cols-2 gap-1.5 p-1 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                  <button
                    type="button"
                    onClick={() => setUnitType('Outdoor')}
                    className={`py-1.5 rounded-md text-xs font-semibold transition-all ${
                      unitType === 'Outdoor'
                        ? 'bg-white dark:bg-blue-600 text-blue-600 dark:text-white shadow-sm'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    Outdoor
                  </button>
                  <button
                    type="button"
                    onClick={() => setUnitType('Indoor')}
                    className={`py-1.5 rounded-md text-xs font-semibold transition-all ${
                      unitType === 'Indoor'
                        ? 'bg-white dark:bg-blue-600 text-blue-600 dark:text-white shadow-sm'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    Indoor
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">Housing Style</label>
                <div className="grid grid-cols-2 gap-1.5 p-1 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                  <button
                    type="button"
                    onClick={() => setHousingStyle('ThermalBreak')}
                    className={`py-1.5 rounded-md text-xs font-semibold transition-all ${
                      housingStyle === 'ThermalBreak'
                        ? 'bg-white dark:bg-blue-600 text-blue-600 dark:text-white shadow-sm'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    Thermal Break
                  </button>
                  <button
                    type="button"
                    onClick={() => setHousingStyle('Standard')}
                    className={`py-1.5 rounded-md text-xs font-semibold transition-all ${
                      housingStyle === 'Standard'
                        ? 'bg-white dark:bg-blue-600 text-blue-600 dark:text-white shadow-sm'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    Standard
                  </button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">Wall Thickness</label>
                <select
                  value={wallThickness}
                  onChange={(e) => setWallThickness(parseFloat(e.target.value))}
                  className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 font-mono"
                >
                  <option value={2.0}>2.0 Inch (Standard)</option>
                  <option value={3.0}>3.0 Inch</option>
                  <option value={4.0}>4.0 Inch (High Spec)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">Base Height</label>
                <select
                  value={baseHeight}
                  onChange={(e) => setBaseHeight(parseFloat(e.target.value))}
                  className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 font-mono"
                >
                  <option value={6.0}>6.0 Inch Channel</option>
                  <option value={8.0}>8.0 Inch Structural</option>
                  <option value={10.0}>10.0 Inch (Standard)</option>
                  <option value={12.0}>12.0 Inch Heavy Base</option>
                </select>
              </div>
            </div>
          </div>

          {/* Shipping Splits */}
          <div className="border-t border-slate-100 dark:border-slate-800 pt-4 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider font-mono flex items-center gap-1.5">
                <Box className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                <span>3. Number of Shipping Skids</span>
              </label>
              <span className="px-2 py-0.5 rounded bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 text-xs font-mono font-bold">
                {skidCount} Skid{skidCount > 1 ? 's' : ''}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {[1, 2, 3, 4, 5, 6].map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => setSkidCount(num)}
                  className={`flex-1 py-2 rounded-lg text-xs font-bold font-mono transition-all border ${
                    skidCount === num
                      ? 'bg-indigo-600 border-indigo-500 text-white shadow-md shadow-indigo-600/30'
                      : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  {num}
                </button>
              ))}
            </div>
          </div>

          {/* Action Footer */}
          <div className="border-t border-slate-100 dark:border-slate-800 pt-5 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex items-center gap-2 px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-lg shadow-blue-600/30 transition-all"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Initialize Workspace</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
