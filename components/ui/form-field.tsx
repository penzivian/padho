import type { ReactNode } from "react";

import { Label } from "@/components/ui/label";

type FormFieldProps = {
  label: string;
  htmlFor: string;
  children: ReactNode;
};

export function FormField({ label, htmlFor, children }: FormFieldProps) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  );
}
