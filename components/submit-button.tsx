"use client";

import { Loader2 } from "lucide-react";
import { useFormStatus } from "react-dom";

import { Button, type ButtonProps } from "@/components/ui/button";

type SubmitButtonProps = ButtonProps & {
  pendingText?: string;
};

export function SubmitButton({ children, pendingText = "Saving", ...props }: SubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <Button disabled={pending} {...props}>
      {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
      {pending ? pendingText : children}
    </Button>
  );
}
