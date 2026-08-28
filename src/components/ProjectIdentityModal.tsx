import React, { useState, useEffect } from 'react';
import { Fact } from '../types';
import { Building2, Check, Calendar, Hash, Tag, User, Briefcase } from 'lucide-react';
import { ModalShell } from './common/ModalShell';
import { STORAGE_KEYS, FACT_KEYS } from '../utils/constants';

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
      setJobName(facts[FACT_KEYS.JOB_NAME]?.value ? String(facts[FACT_KEYS.JOB_NAME].value) : '');
      setComNumber(facts[FACT_KEYS.COM_NUMBER]?.value ? String(facts[FACT_KEYS.COM_NUMBER].value) : '');
      setOrderNumber(facts[FACT_KEYS.ORDER_NUMBER]?.value ? String(facts[FACT_KEYS.ORDER_NUMBER].value) : '');
      setUnitTag(facts[FACT_KEYS.TAG]?.value ? String(facts[FACT_KEYS.TAG].value) : '');
      setDetailer(
        facts[FACT_KEYS.DETAILER]?.value
          ? String(facts[FACT_KEYS.DETAILER].value)
          : localStorage.getItem(STORAGE_KEYS.DETAILER_NAME) || ''
      );
      setVerificationDate(
        facts[FACT_KEYS.DATE]?.value
          ? String(facts[FACT_KEYS.DATE].value)
          : new Date().toISOString().split('T')[0]
      );
    }
  }, [isOpen, facts]);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();

    if (jobName !== (facts[FACT_KEYS.JOB_NAME]?.value ?? '')) {
      onUpdateFact(FACT_KEYS.JOB_NAME, jobName.trim(), 'Detailer', 'Manual project identity update');
    }
    if (comNumber !== (facts[FACT_KEYS.COM_NUMBER]?.value ?? '')) {
      onUpdateFact(FACT_KEYS.COM_NUMBER, comNumber.trim(), 'Detailer', 'Manual project identity update');
    }
    if (orderNumber !== (facts[FACT_KEYS.ORDER_NUMBER]?.value ?? '')) {
      onUpdateFact(FACT_KEYS.ORDER_NUMBER, orderNumber.trim(), 'Detailer', 'Manual project identity update');
    }
    if (unitTag !== (facts[FACT_KEYS.TAG]?.value ?? '')) {
      onUpdateFact(FACT_KEYS.TAG, unitTag.trim(), 'Detailer', 'Manual project identity update');
    }
    if (detailer !== (facts[FACT_KEYS.DETAILER]?.value ?? '')) {
      onUpdateFact(FACT_KEYS.DETAILER, detailer.trim(), 'Detailer', 'Manual project identity update');
      localStorage.setItem(STORAGE_KEYS.DETAILER_NAME, detailer.trim());
    }
    if (verificationDate !== (facts[FACT_KEYS.DATE]?.value ?? '')) {
      onUpdateFact(FACT_KEYS.DATE, verificationDate.trim(), 'Detailer', 'Manual project identity update');
    }

    onClose();
  };

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      title="Project & Order Identity"
      subtitle="Primary job metadata for deliverable generation and verification records"
      icon={<Building2 className="w-5 h-5" />}
      maxWidth="lg"
    >
      <form onSubmit={handleSave} className="space-y-4">
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
    </ModalShell>
  );
};
