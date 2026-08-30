import { MessagePage } from "@/components/marketing/message-page";

export default function NotFound() {
  return (
    <MessagePage eyebrow="404" title="That page is not here.">
      <p>
        The link may be old, or the test or paper it pointed at may have been removed. If you
        reached this from inside Padho, signing in again usually sorts it.
      </p>
    </MessagePage>
  );
}
