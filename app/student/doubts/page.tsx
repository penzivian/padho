import Link from "next/link";

import { DoubtChat } from "@/components/student/doubt-chat";
import { Button } from "@/components/ui/button";
import { requireProfile } from "@/lib/auth";

export default async function DoubtsPage() {
  await requireProfile("student");

  return (
    <main className="page-shell max-w-2xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Doubts</h1>
          <p className="script-note mt-0.5">Ask anything — your AI tutor is patient —</p>
        </div>
        <Button asChild variant="outline">
          <Link href="/student">Back</Link>
        </Button>
      </div>
      <DoubtChat />
    </main>
  );
}
