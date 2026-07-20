import type {
  ReactNode,
  InputHTMLAttributes,
  TextareaHTMLAttributes,
  SelectHTMLAttributes,
} from "react";

/** Shared input styling + labelled wrappers for the CRUD forms. */

const inputCls =
  "mt-1 w-full rounded-md border border-outline-gray-2 bg-surface-white px-3 py-2 text-sm text-ink-gray-8 " +
  "focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand";

export function Field({
  label,
  children,
  required,
}: {
  label: string;
  children: ReactNode;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-ink-gray-7">
        {label}
        {required && <span className="text-ink-red-3"> *</span>}
      </span>
      {children}
    </label>
  );
}

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={inputCls} />;
}

export function TextArea(
  props: TextareaHTMLAttributes<HTMLTextAreaElement>
) {
  return <textarea {...props} className={inputCls} rows={3} />;
}

export function Select({
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...props} className={inputCls}>
      {children}
    </select>
  );
}

export function Checkbox({
  label,
  ...props
}: { label: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="flex items-center gap-2 text-sm text-slate-700">
      <input
        type="checkbox"
        {...props}
        className="h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand"
      />
      {label}
    </label>
  );
}

export function SubmitButton({ children, disabled }: { children: ReactNode; disabled?: boolean }) {
  return (
    <button
      type="submit"
      disabled={disabled}
      className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-60"
    >
      {children}
    </button>
  );
}

export function FormCard({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="max-w-2xl rounded-xl border border-outline-gray-2 bg-surface-white p-6 shadow-sm">
      <h2 className="mb-4 text-lg font-semibold text-ink-gray-8">{title}</h2>
      {children}
    </div>
  );
}
