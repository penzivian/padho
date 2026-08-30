import type { Metadata } from "next";

import { LegalHeader } from "../legal-header";

export const metadata: Metadata = {
  title: "Refund Policy · Padho",
  description: "Padho is free while we are getting started. What happens when paid plans begin."
};

export default function RefundPage() {
  return (
    <article>
      <LegalHeader title="Refund Policy" updated="30 August 2026" />

      <h2>Padho is currently free</h2>
      <p>
        There is no paid plan today. We do not ask for a card, we do not charge a setup fee, and
        nothing on the service is behind a payment. If you have not paid us anything, there is
        nothing to refund.
      </p>

      <h2>When paid plans begin</h2>
      <p>
        Padho will eventually be sold to institutes as a monthly subscription. When that happens,
        these are the terms we intend to hold ourselves to, and this page will be updated with the
        exact prices before anyone is charged.
      </p>
      <ul>
        <li>
          <strong>Monthly, cancel any time.</strong> Cancelling stops the next charge. You keep
          access until the end of the period you have already paid for.
        </li>
        <li>
          <strong>Seven days to change your mind.</strong> Ask within seven days of your first
          payment and we refund it in full, no questions.
        </li>
        <li>
          <strong>If we break it, we refund it.</strong> If a fault on our side stops you running
          tests for a meaningful stretch of a billing period, tell us and we will refund that
          period pro-rata.
        </li>
        <li>
          <strong>Your data comes with you.</strong> Cancelling does not delete your papers or
          your students’ progress. Ask and we will export them; ask and we will delete them.
        </li>
      </ul>

      <h2>How to ask</h2>
      <p>
        Write to <a href="mailto:supratimdebshan@gmail.com">supratimdebshan@gmail.com</a> from the
        email address on the account. We will reply within three working days, and any approved
        refund goes back to the original payment method within seven to ten working days.
      </p>
    </article>
  );
}
