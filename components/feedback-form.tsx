"use client";

import { useFormState } from "react-dom";
import { Send } from "lucide-react";

import { submitFeedbackAction, type FeedbackState } from "@/app/actions";
import { SubmitButton } from "@/components/submit-button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const initialState: FeedbackState = { ok: false, message: "" };

// Deliberately three questions and a contact line. Every extra field costs responses, and the
// people worth hearing from — teachers between classes — are the least likely to finish a
// long form.
export function FeedbackForm() {
  const [state, action] = useFormState(submitFeedbackAction, initialState);

  if (state.ok) {
    return (
      <div className="rounded-xl border bg-card p-6 text-center shadow-sm sm:p-8">
        <p className="font-serif text-xl font-semibold">{state.message}</p>
        <p className="script-note mt-2">
          We read every one of these. If you left a way to reach you, we will.
        </p>
      </div>
    );
  }

  return (
    <form action={action} className="grid gap-5 rounded-xl border bg-card p-6 shadow-sm sm:p-8">
      <FormField
        htmlFor="feedback_suggestion"
        label="What should we build or fix first?"
      >
        <Textarea
          id="feedback_suggestion"
          name="suggestion"
          required
          rows={5}
          maxLength={4000}
          placeholder="The part of running your batches that wastes the most time, or anything here that got in your way."
        />
      </FormField>

      <FormField
        htmlFor="feedback_interest"
        label="Would you like to be one of the first institutes on Padho?"
      >
        <Select id="feedback_interest" name="interest" defaultValue="">
          <option value="">Prefer not to say</option>
          <option value="yes">Yes — I&apos;d like early access</option>
          <option value="maybe">Maybe — tell me more first</option>
          <option value="not_now">Not right now, just sharing thoughts</option>
        </Select>
      </FormField>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField htmlFor="feedback_name" label="Your name or institute (optional)">
          <Input
            id="feedback_name"
            name="name"
            maxLength={200}
            placeholder="Ananya, or Sunrise Classes"
          />
        </FormField>
        <FormField htmlFor="feedback_contact" label="Email or phone (optional)">
          <Input
            id="feedback_contact"
            name="contact"
            maxLength={200}
            placeholder="Only if you'd like a reply"
          />
        </FormField>
      </div>

      {/* Honeypot. Off-screen rather than display:none, which some bots detect and skip. */}
      <div aria-hidden="true" className="absolute left-[-9999px] top-0 h-0 w-0 overflow-hidden">
        <label htmlFor="feedback_website">Leave this empty</label>
        <input id="feedback_website" name="website" tabIndex={-1} autoComplete="off" />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton pendingText="Sending">
          <Send className="h-4 w-4" aria-hidden="true" />
          Send it
        </SubmitButton>
        <p className="script-note">Goes straight to the people building this. No newsletter.</p>
      </div>

      {state.message && !state.ok ? (
        <p className="rounded-md border bg-muted p-3 text-sm">{state.message}</p>
      ) : null}
    </form>
  );
}
