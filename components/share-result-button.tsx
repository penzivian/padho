"use client";

import { Share2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { buildStudentShareMessage, buildWaShareLink } from "@/lib/whatsapp";

// "Share with parent": opens the student's own WhatsApp with a prefilled message —
// no phone number needed (wa.me without a number opens the contact picker).
export function ShareResultButton(props: {
  testTitle: string;
  percentage: number;
  rank?: number | null;
  totalStudents?: number | null;
}) {
  const link = buildWaShareLink(buildStudentShareMessage(props));

  return (
    <Button asChild variant="outline">
      <a href={link} rel="noopener noreferrer" target="_blank">
        <Share2 className="h-4 w-4" aria-hidden="true" />
        Share with parent
      </a>
    </Button>
  );
}
