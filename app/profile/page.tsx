import { redirect } from "next/navigation";

import { updateProfileAction } from "@/app/actions";
import { SubmitButton } from "@/components/submit-button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { getCurrentProfile } from "@/lib/auth";
import { formatDateTime } from "@/lib/utils";

type ProfilePageProps = {
  searchParams?: { saved?: string; error?: string };
};

export default async function ProfilePage({ searchParams }: ProfilePageProps) {
  const session = await getCurrentProfile();
  if (!session?.user) redirect("/auth");
  if (!session.profile) redirect("/onboarding");

  const { user, profile } = session;
  const initials =
    profile.full_name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((word: string) => word[0]!.toUpperCase())
      .join("") || "U";

  return (
    <main className="page-shell max-w-2xl">
      <div className="flex items-center gap-4">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-primary font-serif text-2xl font-semibold text-primary-foreground">
          {initials}
        </span>
        <div>
          <h1 className="text-2xl font-semibold">{profile.full_name}</h1>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span className="rounded-full bg-secondary px-2.5 py-0.5 font-medium capitalize text-secondary-foreground">
              {profile.role}
            </span>
            <span>Joined {formatDateTime(profile.created_at)}</span>
          </p>
        </div>
      </div>

      {searchParams?.error ? (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {searchParams.error}
        </p>
      ) : null}
      {searchParams?.saved ? (
        <p className="rounded-md border border-primary/30 bg-secondary/60 p-3 text-sm">
          Profile updated.
        </p>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Account details</CardTitle>
        </CardHeader>
        <dl className="grid gap-2 text-sm">
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">Email</dt>
            <dd>{user.email ?? "—"}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">Phone</dt>
            <dd>{profile.phone ?? "—"}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">Role</dt>
            <dd className="capitalize">{profile.role}</dd>
          </div>
        </dl>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Edit profile</CardTitle>
        </CardHeader>
        <form action={updateProfileAction} className="grid gap-4">
          <FormField htmlFor="full_name" label="Full name">
            <Input id="full_name" name="full_name" defaultValue={profile.full_name} required />
          </FormField>
          <FormField htmlFor="phone" label="Phone">
            <Input id="phone" name="phone" defaultValue={profile.phone ?? ""} placeholder="+91..." />
          </FormField>
          <SubmitButton pendingText="Saving">Save changes</SubmitButton>
        </form>
      </Card>
    </main>
  );
}
