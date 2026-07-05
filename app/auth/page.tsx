import { KeyRound, MailCheck } from "lucide-react";

import { sendOtpAction, signInWithGoogleAction, verifyOtpAction } from "@/app/actions";
import { AuthHashErrors } from "@/components/auth-hash-errors";
import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";

type AuthPageProps = {
  searchParams?: {
    sent?: string;
    contact?: string;
    error?: string;
    devcode?: string;
  };
};

export default function AuthPage({ searchParams }: AuthPageProps) {
  const contact = searchParams?.contact ?? "";
  const sent = searchParams?.sent === "1";
  const devCode = searchParams?.devcode ?? "";

  return (
    <main className="page-shell max-w-md">
      <AuthHashErrors />
      <div className="text-center">
        <p className="font-serif text-4xl font-bold text-primary">Padho.</p>
        <p className="script-note mt-1 text-lg">teaching, tests &amp; progress — in one place</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>{sent ? "Verify OTP" : "Sign in"}</CardTitle>
          {sent ? <MailCheck className="h-5 w-5 text-primary" /> : <KeyRound className="h-5 w-5 text-primary" />}
        </CardHeader>

        {searchParams?.error ? (
          <p className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            {searchParams.error}
          </p>
        ) : null}

        {sent && devCode ? (
          <p className="mb-4 rounded-md border bg-muted p-3 text-sm text-muted-foreground">
            Local test mode — code <strong className="text-foreground">{devCode}</strong> is
            filled in below. Press Continue.
          </p>
        ) : null}

        {sent && !devCode ? (
          <p className="mb-4 rounded-md border bg-muted p-3 text-sm">
            Check your email and click the sign-in link in the <strong>most recent</strong> email,
            using this same browser. Requesting again invalidates older emails. If the email shows
            a code, you can enter it below instead.
          </p>
        ) : null}

        {sent ? (
          <form action={verifyOtpAction} className="grid gap-4">
            <FormField htmlFor="contact" label="Email or phone">
              <Input id="contact" name="contact" defaultValue={contact} required />
            </FormField>
            <FormField htmlFor="token" label="OTP">
              <Input
                id="token"
                name="token"
                inputMode="numeric"
                autoComplete="one-time-code"
                defaultValue={devCode}
                required
              />
            </FormField>
            <SubmitButton pendingText="Verifying">Continue</SubmitButton>
          </form>
        ) : (
          <>
            <form action={sendOtpAction} className="grid gap-4">
              <FormField htmlFor="contact" label="Email or phone">
                <Input id="contact" name="contact" placeholder="you@example.com or +919999999999" required />
              </FormField>
              <SubmitButton pendingText="Sending">Send OTP</SubmitButton>
            </form>

            <div className="my-4 flex items-center gap-3 text-xs text-muted-foreground">
              <span className="h-px flex-1 bg-border" />
              or
              <span className="h-px flex-1 bg-border" />
            </div>

            <form action={signInWithGoogleAction}>
              <SubmitButton className="w-full" pendingText="Redirecting" variant="outline">
                <GoogleIcon />
                Continue with Google
              </SubmitButton>
            </form>
          </>
        )}

        {sent ? (
          <Button className="mt-3 w-full" variant="ghost" asChild>
            <a href="/auth">Use another contact</a>
          </Button>
        ) : null}
      </Card>

      <p className="text-center text-xs text-muted-foreground">
        Private by design — scores and answers are visible only to students and their teacher.
      </p>
    </main>
  );
}

function GoogleIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.5 12.27c0-.85-.08-1.66-.22-2.45H12v4.64h6.45a5.52 5.52 0 0 1-2.39 3.62v3h3.87c2.26-2.09 3.57-5.16 3.57-8.81Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.07 7.93-2.91l-3.87-3c-1.07.72-2.44 1.14-4.06 1.14-3.12 0-5.77-2.11-6.71-4.95H1.29v3.1A12 12 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.29 14.28a7.22 7.22 0 0 1 0-4.56v-3.1H1.29a12 12 0 0 0 0 10.76l4-3.1Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.77c1.76 0 3.34.6 4.58 1.79l3.44-3.44A11.98 11.98 0 0 0 1.29 6.62l4 3.1C6.23 6.88 8.88 4.77 12 4.77Z"
      />
    </svg>
  );
}
