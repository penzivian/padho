import { sendOtpAction, signInWithGoogleAction, verifyOtpAction } from "@/app/actions";
import { AuthHashErrors } from "@/components/auth-hash-errors";
import { OtpInput } from "@/components/otp-input";
import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui/button";
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
    <main className="flex min-h-screen">
      <AuthHashErrors />

      {/* Brand panel — desktop only */}
      <aside className="hidden w-[45%] flex-col justify-between bg-gradient-to-br from-[#1a6b63] to-[#14544e] p-10 lg:flex">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-foreground/10 font-serif text-xl font-semibold text-primary-foreground">
          प
        </span>
        <div>
          <p className="font-serif text-6xl font-bold text-primary-foreground">Padho.</p>
          <p className="mt-3 text-lg text-primary-foreground/80">
            teaching, tests &amp; progress — in one place
          </p>
        </div>
        <p className="text-sm text-primary-foreground/60">
          Made for tutors and small institutes · Agartala
        </p>
      </aside>

      {/* Form panel */}
      <section className="flex flex-1 items-center justify-center px-4 py-10 sm:px-6">
        <div className="w-full max-w-sm">
          <div className="mb-8 text-center lg:hidden">
            <p className="font-serif text-4xl font-bold text-primary">Padho.</p>
            <p className="script-note mt-1 text-base">teaching, tests &amp; progress — in one place</p>
          </div>

          <h1 className="text-2xl font-semibold">{sent ? "Enter your code" : "Sign in"}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {sent
              ? `We sent a 6-digit code to ${contact || "your email"}.`
              : "Tests, grading and progress for your batches."}
          </p>

          {searchParams?.error ? (
            <p className="mt-4 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              {searchParams.error}
            </p>
          ) : null}

          {sent && devCode ? (
            <p className="mt-4 rounded-md border bg-muted p-3 text-sm text-muted-foreground">
              Local test mode — code <strong className="text-foreground">{devCode}</strong> is
              filled in below. Press Continue.
            </p>
          ) : null}

          {sent && !devCode ? (
            <p className="mt-4 rounded-md border bg-muted p-3 text-sm">
              Enter the code from the <strong>most recent</strong> email — requesting again
              invalidates older ones.
            </p>
          ) : null}

          {sent ? (
            <form action={verifyOtpAction} className="mt-6 grid gap-4">
              <FormField htmlFor="contact" label="Email or phone">
                <Input className="h-12" defaultValue={contact} id="contact" name="contact" required />
              </FormField>
              <FormField htmlFor="token" label="6-digit code">
                <OtpInput defaultValue={devCode} name="token" />
              </FormField>
              <SubmitButton className="h-11 w-full" pendingText="Verifying">
                Continue
              </SubmitButton>
            </form>
          ) : (
            <>
              <form action={sendOtpAction} className="mt-6 grid gap-4">
                <FormField htmlFor="contact" label="Email or phone">
                  <Input
                    className="h-12"
                    id="contact"
                    name="contact"
                    placeholder="you@example.com or +919999999999"
                    required
                  />
                </FormField>
                <SubmitButton className="h-11 w-full" pendingText="Sending">
                  Send code
                </SubmitButton>
              </form>

              <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
                <span className="h-px flex-1 bg-border" />
                or
                <span className="h-px flex-1 bg-border" />
              </div>

              <form action={signInWithGoogleAction}>
                <SubmitButton className="h-11 w-full" pendingText="Redirecting" variant="outline">
                  <GoogleIcon />
                  Continue with Google
                </SubmitButton>
              </form>
            </>
          )}

          {sent ? (
            <Button asChild className="mt-3 w-full" variant="ghost">
              <a href="/auth">Use another contact</a>
            </Button>
          ) : null}

          <p className="mt-8 text-center text-xs text-muted-foreground">
            Private by design — scores and answers are visible only to students and their teacher.
          </p>
        </div>
      </section>
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
