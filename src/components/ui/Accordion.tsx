import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';

interface AccordionItemProps {
  id: string;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
  defaultOpen?: boolean;
  isOpen?: boolean;
  onToggle?: () => void;
  children: React.ReactNode;
  className?: string;
  headerClassName?: string;
}

export function AccordionItem({
  title,
  subtitle,
  icon,
  badge,
  isOpen: controlledIsOpen,
  defaultOpen = false,
  onToggle,
  children,
  className = '',
  headerClassName = ''
}: AccordionItemProps) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const isOpen = controlledIsOpen !== undefined ? controlledIsOpen : internalOpen;

  const handleToggle = () => {
    if (onToggle) {
      onToggle();
    } else {
      setInternalOpen(!internalOpen);
    }
  };

  return (
    <div className={`border border-slate-200 bg-white rounded-xl overflow-hidden transition-all shadow-2xs ${className}`}>
      <button
        type="button"
        onClick={handleToggle}
        className={`w-full px-4 py-2.5 flex items-center justify-between gap-3 text-left font-semibold text-slate-800 hover:bg-slate-50 transition-colors cursor-pointer select-none ${headerClassName} ${
          isOpen ? 'bg-slate-50/70 border-b border-slate-200' : ''
        }`}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          {icon && <span className="text-slate-500 shrink-0">{icon}</span>}
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs sm:text-sm font-bold text-slate-800 truncate">{title}</span>
              {badge}
            </div>
            {subtitle && <p className="text-[11px] text-slate-500 font-normal truncate mt-0.5">{subtitle}</p>}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <ChevronDown
            className={`h-4 w-4 text-slate-400 transition-transform duration-200 ${
              isOpen ? 'transform rotate-180 text-blue-600' : ''
            }`}
          />
        </div>
      </button>

      {isOpen && (
        <div className="p-4 bg-white animate-in fade-in duration-200">
          {children}
        </div>
      )}
    </div>
  );
}

interface AccordionProps {
  children: React.ReactNode;
  className?: string;
}

export function Accordion({ children, className = '' }: AccordionProps) {
  return (
    <div className={`space-y-2.5 ${className}`}>
      {children}
    </div>
  );
}
