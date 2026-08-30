import type { Metadata } from "next";

import { LegalHeader } from "../legal-header";

export const metadata: Metadata = {
  title: "Privacy Policy · Padho",
  description: "What Padho stores about teachers and students, why, and who else can see it."
};

export default function PrivacyPage() {
  return (
    <article>
      <LegalHeader title="Privacy Policy" updated="30 August 2026" />

      <p>
        Padho is a teaching platform used by coaching institutes and their students. Much of what
        it stores is about children, so this page is specific about what is kept and who can see
        it rather than reaching for generalities.
      </p>

      <h2>Who runs this</h2>
      <p>
        Padho is operated from Agartala, Tripura, India. For any question about your data, write
        to <a href="mailto:supratimdebshan@gmail.com">supratimdebshan@gmail.com</a>.
      </p>

      <h2>What we store</h2>
      <ul>
        <li>
          <strong>Account</strong> — your email address, and the name and phone number you enter.
          Phone numbers are optional except where a teacher adds a student by phone.
        </li>
        <li>
          <strong>Teaching records</strong> — the batches you create, the students in them, the
          question papers you upload or write, and the tests you schedule.
        </li>
        <li>
          <strong>Student work</strong> — answers submitted in a test, which questions were marked
          for review, marks awarded, teacher feedback, and practice attempts.
        </li>
        <li>
          <strong>Progress</strong> — scores per test and per topic, derived from the above.
        </li>
        <li>
          <strong>Files</strong> — question papers you upload and diagram images cropped from
          them, held in private storage.
        </li>
        <li>
          <strong>Usage</strong> — a count of AI requests per teacher, used only to enforce a
          monthly limit, plus anonymous page-performance measurements.
        </li>
      </ul>
      <p>
        We do not collect location, contacts, browsing history, or advertising identifiers, and
        there are no third-party advertising or tracking scripts on the site.
      </p>

      <h2>Who can see it</h2>
      <p>Access is enforced in the database itself, not only in the app. In practice:</p>
      <ul>
        <li>A teacher sees only their own batches, papers, tests and their own students’ work.</li>
        <li>A student sees only their own answers, marks and progress.</li>
        <li>
          Students never receive answer keys or marking rubrics while a test is open, and can only
          review a paper once they have submitted and the test has closed.
        </li>
        <li>
          Ranks are shown to a student only if their teacher has chosen to publish them; otherwise
          a student sees their own position and nothing about named classmates.
        </li>
      </ul>

      <h2>Children</h2>
      <p>
        Most students on Padho are under 18. Student accounts exist because a teacher invited them
        to a batch — we do not market to students, and there is no public profile, no messaging
        between students, and no discovery of one student by another. A parent or guardian may ask
        us to show or delete their child’s data using the contact address above.
      </p>

      <h2>Services we rely on</h2>
      <ul>
        <li><strong>Supabase</strong> — database, sign-in and file storage, hosted in Mumbai, India.</li>
        <li><strong>Vercel</strong> — application hosting, with server functions run in Mumbai.</li>
        <li><strong>Brevo</strong> — sends sign-in codes by email. Receives your email address only.</li>
        <li>
          <strong>Anthropic</strong> — powers question extraction, grading suggestions and doubt
          answers. Receives the text of the question and answer being processed, and does not use
          it to train models.
        </li>
        <li>
          <strong>Vercel Analytics and Speed Insights</strong> — aggregate page-performance
          numbers. No cookies and no individual profiles.
        </li>
        <li><strong>Google</strong> — only if you choose to sign in with a Google account.</li>
      </ul>

      <h2>Cookies</h2>
      <p>
        Padho sets cookies for one purpose: keeping you signed in. There are no advertising or
        cross-site tracking cookies. Your theme preference is kept in your browser and never sent
        to us.
      </p>

      <h2>How long it is kept</h2>
      <p>
        Teaching records are kept while the account is active, because a progress history is the
        point of the product. Ask us to delete your account and we remove your profile and the
        work attached to it. A teacher deleting a batch removes the link between that teacher and
        those students.
      </p>

      <h2>Your rights</h2>
      <p>
        You can ask for a copy of your data, ask us to correct it, or ask us to delete it. Write
        to the address above and we will respond within 30 days. Your name and phone number can be
        edited yourself at any time from your profile page.
      </p>

      <h2>Changes</h2>
      <p>
        If this policy changes in a way that affects what we store or who can see it, we will say
        so here and update the date at the top.
      </p>
    </article>
  );
}
