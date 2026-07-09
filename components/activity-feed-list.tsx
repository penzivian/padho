import { ClipboardCheck, Dumbbell, UserPlus } from "lucide-react";

import { feedText, type FeedEvent } from "@/lib/activity-feed";
import { cn } from "@/lib/utils";
import { timeAgo } from "@/lib/utils";

const ICON = { submitted: ClipboardCheck, joined: UserPlus, practiced: Dumbbell };
const TONE = {
  submitted: "text-primary",
  joined: "text-muted-foreground",
  practiced: "text-[#c98a3c]"
};

export function ActivityFeedList({ events }: { events: FeedEvent[] }) {
  if (events.length === 0) {
    return <p className="script-note">No student activity yet — it shows up here as it happens.</p>;
  }

  return (
    <ul className="grid gap-3 text-sm">
      {events.map((event, index) => {
        const Icon = ICON[event.kind];
        return (
          <li key={`${event.kind}-${event.actor}-${event.at}-${index}`} className="flex items-start gap-3">
            <span
              className={cn(
                "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted",
                TONE[event.kind]
              )}
            >
              <Icon className="h-3.5 w-3.5" aria-hidden="true" />
            </span>
            <span>
              {feedText(event)}
              <span className="block font-mono text-xs text-muted-foreground">{timeAgo(event.at)}</span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
