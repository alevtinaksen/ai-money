import { InputHTMLAttributes } from 'react';

export function InlineField({ label, ...input }: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return <label className="design-inline-field">{label}<input {...input} /></label>;
}
