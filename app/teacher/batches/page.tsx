import { Plus, Trash2, UserPlus } from "lucide-react";

import { addStudentByPhoneAction, createBatchAction, removeStudentAction } from "@/app/actions";
import { CopyChip } from "@/components/copy-chip";
import { SubmitButton } from "@/components/submit-button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { requireProfile } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { formatDateTime } from "@/lib/utils";

type BatchWithStudents = {
  id: string;
  name: string;
  subject: string;
  exam_target: string;
  invite_code: string;
  batch_students: {
    joined_at: string;
    profiles: {
      id: string;
      full_name: string;
      phone: string | null;
    } | null;
  }[];
};

type BatchPageProps = {
  searchParams?: { error?: string };
};

export default async function TeacherBatchesPage({ searchParams }: BatchPageProps) {
  await requireProfile("teacher");
  const supabase = createSupabaseServerClient();
  const { data } = await supabase
    .from("batches")
    .select("id,name,subject,exam_target,invite_code,batch_students(joined_at,profiles(id,full_name,phone))")
    .order("created_at", { ascending: false });
  const batches = (data ?? []) as unknown as BatchWithStudents[];

  return (
    <main className="page-shell">
      <div>
        <h1 className="text-2xl font-semibold">Your batches</h1>
        <p className="text-sm text-muted-foreground">
          Share the invite code, or add students yourself by phone.
        </p>
      </div>

      {searchParams?.error ? (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {searchParams.error}
        </p>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Create batch</CardTitle>
          <Plus className="h-5 w-5 text-primary" />
        </CardHeader>
        <form action={createBatchAction} className="grid gap-3 md:grid-cols-[1fr_1fr_1fr_auto]">
          <FormField htmlFor="name" label="Name">
            <Input id="name" name="name" placeholder="Class XII — Physics" required />
          </FormField>
          <FormField htmlFor="subject" label="Subject">
            <Input id="subject" name="subject" required />
          </FormField>
          <FormField htmlFor="exam_target" label="Exam">
            <Input id="exam_target" name="exam_target" placeholder="JEE / NEET / Board" required />
          </FormField>
          <div className="flex items-end">
            <SubmitButton pendingText="Creating">Create</SubmitButton>
          </div>
        </form>
      </Card>

      <div className="grid gap-4">
        {batches.map((batch) => {
          const students = batch.batch_students;

          return (
            <Card key={batch.id}>
              <CardHeader>
                <div>
                  <CardTitle className="text-lg">{batch.name}</CardTitle>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {batch.subject} · {batch.exam_target}
                  </p>
                </div>
                <CopyChip value={batch.invite_code} />
              </CardHeader>

              <div className="mb-4 flex items-center gap-3">
                <AvatarStack
                  names={students.map((student) => student.profiles?.full_name ?? "?")}
                />
                <span className="text-sm text-muted-foreground">
                  {students.length} {students.length === 1 ? "student" : "students"}
                </span>
              </div>

              <form action={addStudentByPhoneAction} className="mb-4 grid gap-3 md:grid-cols-[1fr_1fr_auto]">
                <input type="hidden" name="batch_id" value={batch.id} />
                <FormField htmlFor={`student_name_${batch.id}`} label="Student name">
                  <Input id={`student_name_${batch.id}`} name="full_name" />
                </FormField>
                <FormField htmlFor={`student_phone_${batch.id}`} label="Phone">
                  <Input id={`student_phone_${batch.id}`} name="phone" required />
                </FormField>
                <div className="flex items-end">
                  <SubmitButton pendingText="Adding" variant="secondary">
                    <UserPlus className="h-4 w-4" aria-hidden="true" />
                    Add student
                  </SubmitButton>
                </div>
              </form>

              {students.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                        <th className="py-2 font-medium">Student</th>
                        <th className="py-2 font-medium">Phone</th>
                        <th className="py-2 font-medium">Joined</th>
                        <th className="py-2 text-right font-medium">Remove</th>
                      </tr>
                    </thead>
                    <tbody>
                      {students.map((student) => (
                        <tr key={student.profiles?.id ?? student.joined_at} className="border-b last:border-0">
                          <td className="py-2">{student.profiles?.full_name ?? "Unknown"}</td>
                          <td className="py-2">{student.profiles?.phone ?? "-"}</td>
                          <td className="py-2">{formatDateTime(student.joined_at)}</td>
                          <td className="py-2 text-right">
                            {student.profiles?.id ? (
                              <form action={removeStudentAction}>
                                <input type="hidden" name="batch_id" value={batch.id} />
                                <input type="hidden" name="student_id" value={student.profiles.id} />
                                <SubmitButton aria-label="Remove student" size="icon" variant="ghost" pendingText="">
                                  <Trash2 className="h-4 w-4" />
                                </SubmitButton>
                              </form>
                            ) : null}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="script-note">No students yet — share the code above to get started.</p>
              )}
            </Card>
          );
        })}
      </div>
    </main>
  );
}

function AvatarStack({ names }: { names: string[] }) {
  const shown = names.slice(0, 3);
  const extra = names.length - shown.length;

  if (names.length === 0) return null;

  return (
    <span className="flex -space-x-2">
      {shown.map((name, index) => (
        <span
          key={`${name}-${index}`}
          className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-card bg-secondary text-xs font-semibold text-secondary-foreground"
        >
          {(name[0] ?? "?").toUpperCase()}
        </span>
      ))}
      {extra > 0 ? (
        <span className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-card bg-muted text-xs font-medium text-muted-foreground">
          +{extra}
        </span>
      ) : null}
    </span>
  );
}
