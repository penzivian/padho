import { LogOut, UserRoundCheck } from "lucide-react";

import { completeProfileAction, signOutAction } from "@/app/actions";
import { SubmitButton } from "@/components/submit-button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { getCurrentProfile } from "@/lib/auth";

type OnboardingPageProps = {
  searchParams?: { error?: string };
};

export default async function OnboardingPage({ searchParams }: OnboardingPageProps) {
  const session = await getCurrentProfile();

  return (
    <main className="page-shell max-w-lg">
      <Card>
        <CardHeader>
          <CardTitle>Complete profile</CardTitle>
          <UserRoundCheck className="h-5 w-5 text-primary" />
        </CardHeader>
        {searchParams?.error ? (
          <p className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            {searchParams.error}
          </p>
        ) : null}
        <form action={completeProfileAction} className="grid gap-4">
          <FormField htmlFor="full_name" label="Full name">
            <Input
              id="full_name"
              name="full_name"
              defaultValue={session?.profile?.full_name ?? ""}
              required
            />
          </FormField>
          <FormField htmlFor="phone" label="Phone">
            <Input id="phone" name="phone" defaultValue={session?.profile?.phone ?? ""} />
          </FormField>
          <FormField htmlFor="role" label="Role">
            <Select id="role" name="role" defaultValue={session?.profile?.role ?? "teacher"}>
              <option value="teacher">Teacher</option>
              <option value="student">Student</option>
            </Select>
          </FormField>
          <SubmitButton pendingText="Saving">Continue</SubmitButton>
        </form>
        <form action={signOutAction} className="mt-3">
          <SubmitButton className="w-full" pendingText="Signing out" variant="ghost">
            <LogOut className="h-4 w-4" aria-hidden="true" />
            Sign out and use another account
          </SubmitButton>
        </form>
      </Card>
    </main>
  );
}
