import type { Metadata } from "next";

import { LegalHeader } from "../legal-header";

export const metadata: Metadata = {
  title: "Terms of Use · Padho",
  description: "The terms you agree to when using Padho."
};

export default function TermsPage() {
  return (
    <article>
      <LegalHeader title="Terms of Use" updated="30 August 2026" />

      <p>
        These terms cover your use of Padho. Using the service means you accept them. Padho is
        operated from Agartala, Tripura, India.
      </p>

      <h2>Accounts</h2>
      <ul>
        <li>
          You need an email address to sign in. Keep your sign-in codes to yourself — anyone with
          the code can reach your account.
        </li>
        <li>
          A student account is created when a teacher invites a student to a batch. If you are
          under 18, a parent or guardian should agree to these terms on your behalf.
        </li>
        <li>One person, one account. Do not share an account between teachers or students.</li>
      </ul>

      <h2>Your content stays yours</h2>
      <p>
        Question papers, questions, rubrics and feedback you create or upload remain yours. You
        give us only the permission needed to run the service — to store your files, show them to
        the students you have chosen, and process them to produce extraction and grading
        suggestions. We do not sell your content, and we do not publish it to other teachers
        unless you explicitly choose to share a question into the shared library.
      </p>

      <h2>What you upload</h2>
      <p>
        You are responsible for having the right to upload what you upload. Do not upload material
        you do not have permission to use, and do not upload anything unlawful. We may remove
        content we are told infringes someone’s rights.
      </p>

      <h2>AI assistance</h2>
      <p>
        Padho uses AI to extract questions from a PDF, to suggest marks on written answers, and to
        answer student doubts. These are suggestions, not decisions. A written answer is never
        finalised without a teacher approving the mark, and you should check extracted questions
        before scheduling a test. We do not guarantee that AI output is correct.
      </p>

      <h2>Acceptable use</h2>
      <ul>
        <li>Do not attempt to reach another teacher’s or student’s data.</li>
        <li>Do not use Padho to cheat in an examination, or to help someone else do so.</li>
        <li>Do not scrape, resell or redistribute the service.</li>
        <li>Do not upload malware or attempt to disrupt the service for others.</li>
      </ul>

      <h2>Availability</h2>
      <p>
        Padho is offered as-is, with no uptime guarantee. We may change or discontinue features.
        If we plan to shut the service down, we will give notice and a way to export your data.
      </p>

      <h2>Liability</h2>
      <p>
        To the extent the law allows, we are not liable for indirect or consequential loss,
        including lost teaching time or examination outcomes. Nothing here limits liability that
        cannot lawfully be limited.
      </p>

      <h2>Ending your use</h2>
      <p>
        You may stop using Padho and ask for your account to be deleted at any time. We may
        suspend an account that breaks these terms, and will say why where we can.
      </p>

      <h2>Governing law</h2>
      <p>
        These terms are governed by the laws of India, and the courts at Agartala, Tripura have
        jurisdiction.
      </p>

      <h2>Contact</h2>
      <p>
        Questions about these terms:{" "}
        <a href="mailto:supratimdebshan@gmail.com">supratimdebshan@gmail.com</a>.
      </p>
    </article>
  );
}
