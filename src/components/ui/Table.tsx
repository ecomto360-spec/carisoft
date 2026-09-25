import { ReactNode, HTMLAttributes, ThHTMLAttributes, TdHTMLAttributes } from 'react';
import { cn } from '../../lib/utils';

export function Table({ children, className, ...props }: HTMLAttributes<HTMLTableElement> & { children: ReactNode }) {
  return (
    <div className="w-full overflow-auto bg-white rounded-lg border border-slate-200 shadow-sm">
      <table className={cn('w-full text-sm text-left text-slate-600', className)} {...props}>
        {children}
      </table>
    </div>
  );
}

export function TableHeader({ children, className, ...props }: HTMLAttributes<HTMLTableSectionElement> & { children: ReactNode }) {
  return (
    <thead className={cn('text-xs text-slate-700 uppercase bg-slate-50 border-b border-slate-200', className)} {...props}>
      {children}
    </thead>
  );
}

export function TableRow({ children, className, onClick, ...props }: HTMLAttributes<HTMLTableRowElement> & { children: ReactNode }) {
  return (
    <tr 
      className={cn('border-b border-slate-100 hover:bg-slate-50 transition-colors', onClick && 'cursor-pointer', className)}
      onClick={onClick}
      {...props}
    >
      {children}
    </tr>
  );
}

export function TableHead({ children, className, ...props }: ThHTMLAttributes<HTMLTableCellElement> & { children?: ReactNode }) {
  return <th className={cn('px-4 py-3 font-medium', className)} {...props}>{children}</th>;
}

export function TableCell({ children, className, ...props }: TdHTMLAttributes<HTMLTableCellElement> & { children?: ReactNode }) {
  return <td className={cn('px-4 py-3', className)} {...props}>{children}</td>;
}
