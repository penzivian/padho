import type { Metadata } from "next";

import { LegalHeader } from "../legal-header";

export const metadata: Metadata = {
  title: "Contact · Padho",
  description: "How to reach Padho — support, privacy requests, and where we are."
};

export default function ContactPage() {
  return (
    <article>
      <LegalHeader title="Contact" updated="30 August 2026" />

      <p>
        Padho is small and run from Agartala. Email reaches a person, usually the same day.
      </p>

      <h2>Email</h2>
      <p>
        <a href="mailto:supratimdebshan@gmail.com">supratimdebshan@gmail.com</a> — for support, a
        question about your data, a bug, or anything about billing.
      </p>

      <h2>Where we are</h2>
      <p>Agartala, West Tripura, Tripura, India.</p>

      <h2>If something is wrong with a test</h2>
      <p>
        If a test is live and something is not working, mail us with the test name and roughly
        when it started, and say how many students are affected. Those get looked at first. A
        teacher can close a test from the tests page, which banks the work of anyone still writing
        so no answers are lost.
      </p>

      <h2>Privacy and deletion requests</h2>
      <p>
        Use the same address, from the email on the account. Parents and guardians may write about
        a child’s data. See the <a href="/privacy">privacy policy</a> for what we hold and how long
        we keep it.
      </p>
    </article>
  );
}
