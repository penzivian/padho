"use client";

import { Loader2 } from "lucide-react";
import { useFormStatus } from "react-dom";

import { Button, type ButtonProps } from "@/components/ui/button";

type SubmitButtonProps = ButtonProps & {
  pendingText?: string;
};

export function SubmitButton({
  children,
  pendingText = "Saving",
  disabled,
  ...props
}: SubmitButtonProps) {
  const { pending } = useFormStatus();

  // `disabled` is combined, not overridden — a caller passing its own disabled state (an
  // unchecked declaration, say) must not switch the double-submit guard back off.
  return (
    <Button disabled={pending || disabled} {...props}>
      {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
      {pending ? pendingText : children}
    </Button>
  );
}
