"use client";

import { SendHorizonal } from "lucide-react";
import { useFormState } from "react-dom";

import { askDoubtAction, type DoubtState } from "@/app/actions";
import { SubmitButton } from "@/components/submit-button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { FormField } from "@/components/ui/form-field";
import { Textarea } from "@/components/ui/textarea";

const initialState: DoubtState = {
  ok: false,
  message: ""
};

export function DoubtChat() {
  const [state, action] = useFormState(askDoubtAction, initialState);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Ask a doubt</CardTitle>
        <SendHorizonal className="h-5 w-5 text-primary" />
      </CardHeader>
      <form action={action} className="grid gap-3">
        <FormField htmlFor="question" label="Question">
          <Textarea id="question" name="question" required />
        </FormField>
        <SubmitButton pendingText="Thinking">
          <SendHorizonal className="h-4 w-4" aria-hidden="true" />
          Ask
        </SubmitButton>
      </form>
      {state.message ? (
        <div className="mt-4 rounded-md border bg-muted p-3 text-sm">
          {state.ok ? state.data?.answer : state.message}
        </div>
      ) : null}
    </Card>
  );
}
