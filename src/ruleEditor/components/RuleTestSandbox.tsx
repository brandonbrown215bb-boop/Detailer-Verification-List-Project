import React, { useState, useEffect } from 'react';
import { Play, FileCode, Sliders, CheckCircle2, XCircle, AlertTriangle, RefreshCw, Upload } from 'lucide-react';
import { RuleDefinition } from '../../types';
import { desktopBridge } from '../../services/desktopBridge';
import { getFactDefinition } from './FactDictionaryCatalog';

interface RuleTestSandboxProps {
  rule: RuleDefinition;
  onCustomFactChange?: (key: string, val: any) => void;
}

export const RuleTestSandbox: React.FC<RuleTestSandboxProps> = ({ rule }) => {
  // Preset simulation profiles
  const presetProfiles: Record<string, { name: string; facts: Record<string, any> }> = {
    standardOutdoor: {
      name: 'Standard 2-Skid Outdoor Unit',
      facts: {
        'unit.shellType': 'ThermalBreak',
        'unit.detailingTool': 'ISG',
        'unit.thermalBreak': true,
        'unit.unitType': 'Outdoor',
        'unit.wallThickness': 2,
        'unit.baseHeight': 10,
        'unit.washdown': false,
        'unit.knockdown': false,
        'unit.hasUTL': false,
        'unit.isSeismic': false,
        'unit.totalStaticPressure': 2.5,
        'unit.floorMaterial': 'Galvanized',
        'skid.weight': 3200,
        'skid.segmentCount': 2,
        'skid.hasDrainPan': true,
        'skid.hasFans': true,
        'skid.hasCoils': true,
        'skid.hasFilters': true,
        'skid.hasHeatWheel': false,
        'segment.typeCode': 'FS',
        'motorControl.fla': 18.5,
        'motorControl.motorControlType': 'VFD'
      }
    },
    heavyCustomWashdown: {
      name: 'Heavy 4-Skid Washdown & Seismic Unit',
      facts: {
        'unit.shellType': 'ThermalBreak',
        'unit.detailingTool': 'ISG',
        'unit.thermalBreak': true,
        'unit.unitType': 'Outdoor',
        'unit.wallThickness': 3,
        'unit.baseHeight': 12,
        'unit.washdown': true,
        'unit.knockdown': true,
        'unit.hasUTL': true,
        'unit.isSeismic': true,
        'unit.totalStaticPressure': 4.5,
        'unit.floorMaterial': 'Stainless 304',
        'skid.weight': 5800,
        'skid.segmentCount': 4,
        'skid.hasDrainPan': true,
        'skid.hasFans': true,
        'skid.hasCoils': true,
        'skid.hasFilters': true,
        'skid.hasHeatWheel': true,
        'segment.typeCode': 'CC',
        'motorControl.fla': 45.0,
        'motorControl.motorControlType': 'VFD'
      }
    }
  };

  const [activeProfileKey, setActiveProfileKey] = useState<string>('heavyCustomWashdown');
  const [simulatedValues, setSimulatedValues] = useState<Record<string, any>>(
    presetProfiles.heavyCustomWashdown.facts
  );

  const handleProfileSelect = (key: string) => {
    setActiveProfileKey(key);
    if (presetProfiles[key]) {
      setSimulatedValues({ ...presetProfiles[key].facts });
    }
  };

  const handleTweakFact = (factKey: string, val: any) => {
    setSimulatedValues(prev => ({
      ...prev,
      [factKey]: val
    }));
  };

  const [evalResult, setEvalResult] = useState<{ result: boolean; needsInput: boolean; trace: string }>({
    result: true,
    needsInput: false,
    trace: 'Evaluating rule logic...'
  });
  const [isRuleValid, setIsRuleValid] = useState<boolean>(true);
  const [evalError, setEvalError] = useState<string | null>(null);

  // Evaluate rule dynamically against simulated values using C# authoritative engine
  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const res = await desktopBridge.evaluateRuleSandbox({ rule, simulatedValues });
        if (cancelled) return;
        if (!res.isValid) {
          setIsRuleValid(false);
          setEvalError(res.error || 'The rule logic is currently incomplete or contains errors.');
          setEvalResult({
            result: false,
            needsInput: true,
            trace: res.trace || 'The rule logic is currently incomplete or contains errors.'
          });
        } else {
          setIsRuleValid(true);
          setEvalError(null);
          setEvalResult({
            result: res.result,
            needsInput: res.needsInput,
            trace: res.trace
          });
        }
      } catch (err: any) {
        if (cancelled) return;
        setIsRuleValid(false);
        setEvalError(err?.message || 'Failed to evaluate rule condition.');
        setEvalResult({
          result: false,
          needsInput: true,
          trace: 'The rule logic is currently incomplete or contains errors.'
        });
      }
    }, 50);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [rule, simulatedValues]);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col h-full">
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-blue-950/80 border border-blue-800 rounded-lg text-blue-400">
            <Play className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-slate-100 uppercase tracking-wider">
              Rule Simulation Sandbox
            </h3>
            <p className="text-[11px] text-slate-400">
              Live testing & verification for <code className="text-blue-300 font-semibold">{rule.id}</code>
            </p>
          </div>
        </div>

        {/* Profile preset picker */}
        <select
          aria-label="Preset profile"
          value={activeProfileKey}
          onChange={e => handleProfileSelect(e.target.value)}
          className="text-xs bg-slate-950 border border-slate-700 rounded-md px-2.5 py-1.5 text-slate-200 focus:outline-none"
        >
          {Object.entries(presetProfiles).map(([k, p]) => (
            <option key={k} value={k}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      {/* Outcome Banner */}
      <div className="my-4">
        {!isRuleValid ? (
          <div className="flex items-center gap-3 p-3 bg-red-950/60 border border-red-800 rounded-lg">
            <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0" />
            <div>
              <div className="text-xs font-bold text-red-300">
                Simulation Paused: Incomplete or Invalid Rule Logic
              </div>
              <div className="text-[11px] text-red-400/90 mt-0.5">
                {evalError || evalResult.trace}
              </div>
            </div>
          </div>
        ) : evalResult.needsInput ? (
          <div className="flex items-center gap-3 p-3 bg-amber-950/40 border border-amber-800/80 rounded-lg">
            <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0" />
            <div>
              <div className="text-xs font-bold text-amber-300">
                Outcome: NEEDS INPUT
              </div>
              <div className="text-[11px] text-amber-400/80 mt-0.5">
                {evalResult.trace}
              </div>
            </div>
          </div>
        ) : evalResult.result ? (
          <div className="flex items-center gap-3 p-3 bg-emerald-950/40 border border-emerald-800/80 rounded-lg">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
            <div>
              <div className="text-xs font-bold text-emerald-300">
                Outcome: APPLICABLE (Active Check)
              </div>
              <div className="text-[11px] text-emerald-400/80 mt-0.5">
                {evalResult.trace}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3 p-3 bg-slate-800/50 border border-slate-700 rounded-lg">
            <XCircle className="w-5 h-5 text-slate-400 flex-shrink-0" />
            <div>
              <div className="text-xs font-bold text-slate-300">
                Outcome: NOT APPLICABLE (Skipped Check)
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                {evalResult.trace}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Interactive Fact Tweaker Controls */}
      <div className="flex-1 overflow-y-auto space-y-3 pr-1">
        <div className="flex items-center justify-between text-xs font-semibold text-slate-300 pb-1 border-b border-slate-800">
          <span className="flex items-center gap-1.5">
            <Sliders className="w-3.5 h-3.5 text-blue-400" />
            Required Fact Inputs ({rule.requiredFacts.length})
          </span>
          <button
            type="button"
            onClick={() => handleProfileSelect(activeProfileKey)}
            className="text-[11px] text-blue-400 hover:text-blue-300 flex items-center gap-1"
          >
            <RefreshCw className="w-3 h-3" /> Reset Profile
          </button>
        </div>

        {rule.requiredFacts.length === 0 ? (
          <div className="p-4 text-center text-xs text-slate-400 bg-slate-950/40 rounded-lg border border-dashed border-slate-800">
            This rule has no required facts and evaluates as a standard check (always applicable).
          </div>
        ) : (
          <div className="space-y-3">
            {rule.requiredFacts.map(factKey => {
              const factDef = getFactDefinition(factKey);
              const val = simulatedValues[factKey];
              const dataType = factDef?.dataType || 'string';

              return (
                <div
                  key={factKey}
                  className="p-2.5 rounded-lg bg-slate-950/70 border border-slate-800/80 space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-200">
                      {factDef?.label || factKey}
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">
                      {factKey}
                    </span>
                  </div>

                  {dataType === 'boolean' ? (
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => handleTweakFact(factKey, true)}
                        className={`flex-1 py-1 text-xs font-semibold rounded border transition-colors ${
                          val === true
                            ? 'bg-emerald-600 border-emerald-500 text-white'
                            : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        True (Yes)
                      </button>
                      <button
                        type="button"
                        onClick={() => handleTweakFact(factKey, false)}
                        className={`flex-1 py-1 text-xs font-semibold rounded border transition-colors ${
                          val === false
                            ? 'bg-red-600 border-red-500 text-white'
                            : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        False (No)
                      </button>
                    </div>
                  ) : factDef?.dataType === 'enum' ? (
                    <select
                      aria-label={`Value for ${factKey}`}
                      value={val ?? ''}
                      onChange={e => handleTweakFact(factKey, e.target.value)}
                      className="w-full text-xs bg-slate-900 border border-slate-700 rounded px-2.5 py-1 text-slate-200 focus:outline-none"
                    >
                      {factDef.enumOptions?.map(opt => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  ) : dataType === 'number' ? (
                    <div className="flex items-center gap-2">
                      <input
                        aria-label={`Value for ${factKey}`}
                        type="number"
                        step="any"
                        value={val ?? 0}
                        onChange={e => handleTweakFact(factKey, parseFloat(e.target.value) || 0)}
                        className="w-full text-xs bg-slate-900 border border-slate-700 rounded px-2.5 py-1 text-slate-200 focus:outline-none font-mono"
                      />
                      {factDef?.unit && (
                        <span className="text-xs text-slate-400 font-medium">
                          {factDef.unit}
                        </span>
                      )}
                    </div>
                  ) : (
                    <input
                      aria-label={`Value for ${factKey}`}
                      type="text"
                      value={val ?? ''}
                      onChange={e => handleTweakFact(factKey, e.target.value)}
                      className="w-full text-xs bg-slate-900 border border-slate-700 rounded px-2.5 py-1 text-slate-200 focus:outline-none font-mono"
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
