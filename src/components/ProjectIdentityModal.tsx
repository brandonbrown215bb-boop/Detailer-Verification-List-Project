import React, { useState, useEffect } from 'react';
import { Fact } from '../types';
import { Building2, X, Check, Calendar, Hash, Tag, User, Briefcase } from 'lucide-react';

interface ProjectIdentityModalProps {
  isOpen: boolean;
  onClose: () => void;
  facts: Record<string, Fact>;
  onUpdateFact: (key: string, value: any, author?: string, note?: string) => void;
}

export const ProjectIdentityModal: React.FC<ProjectIdentityModalProps> = ({
  isOpen,
  onClose,
  facts,
  onUpdateFact
}) => {
  const [jobName, setJobName] = useState('');
  const [comNumber, setComNumber] = useState('');
  const [orderNumber, setOrderNumber] = useState('');
  const [unitTag, setUnitTag] = useState('');
  const [detailer, setDetailer] = useState('');
  const [verificationDate, setVerificationDate] = useState('');

  useEffect(() => {
    if (isOpen) {
      setJobName(facts['unit.jobName']?.value ? String(facts['unit.jobName'].value) : '');
      setComNumber(facts['unit.comNumber']?.value ? String(facts['unit.comNumber'].value) : '');
      setOrderNumber(facts['unit.orderNumber']?.value ? String(facts['unit.orderNumber'].value) : '');
      setUnitTag(facts['unit.tag']?.value ? String(facts['unit.tag'].value) : '');
      setDetailer(facts['unit.detailer']?.value ? String(facts['unit.detailer'].value) : localStorage.getItem('dvl_detailer_name') || '');
      setVerificationDate(facts['unit.date']?.value ? String(facts['unit.date'].value) : new Date().toISOString().split('T')[0]);
    }
  }, [isOpen, facts]);

  if (!isOpen) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();

    if (jobName !== (facts['unit.jobName']?.value ?? '')) {
      onUpdateFact('unit.jobName', jobName.trim(), 'Detailer', 'Manual project identity update');
    }
    if (comNumber !== (facts['unit.comNumber']?.value ?? '')) {
      onUpdateFact('unit.comNumber', comNumber.trim(), 'Detailer', 'Manual project identity update');
    }
    if (orderNumber !== (facts['unit.orderNumber']?.value ?? '')) {
      onUpdateFact('unit.orderNumber', orderNumber.trim(), 'Detailer', 'Manual project identity update');
    }
    if (unitTag !== (facts['unit.tag']?.value ?? '')) {
      onUpdateFact('unit.tag', unitTag.trim(), 'Detailer', 'Manual project identity update');
    }
    if (detailer !== (facts['unit.detailer']?.value ?? '')) {
      onUpdateFact('unit.detailer', detailer.trim(), 'Detailer', 'Manual project identity update');
      localStorage.setItem('dvl_detailer_name', detailer.trim());
    }
    if (verificationDate !== (facts['unit.date']?.value ?? '')) {
      onUpdateFact('unit.date', verificationDate.trim(), 'Detailer', 'Manual project identity update');
    }

    onClose();
  };

  return (
    <div
      onClick={(e) => e.target === e.currentTarget && onClose()}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden text-slate-800 dark:text-slate-100 animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-850">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/30 flex items-center justify-center font-bold">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Project & Order Identity
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Primary job metadata for deliverable generation and verification records
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="p-6 space-y-4">
          {/* Job Name */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Briefcase className="w-3.5 h-3.5 text-blue-500" />
              <span>Job / Project Name</span>
            </label>
            <input
              type="text"
              value={jobName}
              onChange={(e) => setJobName(e.target.value)}
              placeholder="e.g. HCA 3100300032 DHOA Vertical Exp"
              className="w-full px-3.5 py-2 text-xs bg-slate-50 dark:bg-slate-950/70 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 placeholder-slate-400 outline-none focus:border-blue-500 transition-colors font-medium"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* COM # */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Hash className="w-3.5 h-3.5 text-blue-500" />
                <span>COM Number</span>
              </label>
              <input
                type="text"
                value={comNumber}
                onChange={(e) => setComNumber(e.target.value)}
                placeholder="e.g. 20183"
                className="w-full px-3.5 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-950/70 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 placeholder-slate-400 outline-none focus:border-blue-500 transition-colors"
              />
            </div>

            {/* Order # */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Hash className="w-3.5 h-3.5 text-indigo-500" />
                <span>Order Number</span>
              </label>
              <input
                type="text"
                value={orderNumber}
                onChange={(e) => setOrderNumber(e.target.value)}
                placeholder="e.g. 6E-900064-07"
                className="w-full px-3.5 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-950/70 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 placeholder-slate-400 outline-none focus:border-blue-500 transition-colors"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Unit Tag */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-emerald-500" />
                <span>Unit Tag</span>
              </label>
              <input
                type="text"
                value={unitTag}
                onChange={(e) => setUnitTag(e.target.value)}
                placeholder="e.g. AHU-518"
                className="w-full px-3.5 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-950/70 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 placeholder-slate-400 outline-none focus:border-blue-500 transition-colors"
              />
            </div>

            {/* Verification Date */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-amber-500" />
                <span>Verification Date</span>
              </label>
              <input
                type="date"
                value={verificationDate}
                onChange={(e) => setVerificationDate(e.target.value)}
                className="w-full px-3.5 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-950/70 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 outline-none focus:border-blue-500 transition-colors"
              />
            </div>
          </div>

          {/* Detailer Name */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-teal-500" />
              <span>Detailer Name</span>
            </label>
            <input
              type="text"
              value={detailer}
              onChange={(e) => setDetailer(e.target.value)}
              placeholder="e.g. Brandon Brown"
              className="w-full px-3.5 py-2 text-xs bg-slate-50 dark:bg-slate-950/70 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 placeholder-slate-400 outline-none focus:border-blue-500 transition-colors"
            />
          </div>

          {/* Footer Actions */}
          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-300 text-xs font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-md shadow-blue-600/20 transition-all"
            >
              <Check className="w-4 h-4" />
              <span>Save Identity</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
