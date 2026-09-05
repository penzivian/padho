import {
  ClipboardList,
  Dumbbell,
  FileText,
  House,
  Library,
  type LucideIcon,
  MessagesSquare,
  UsersRound
} from "lucide-react";

// Single source of truth for the primary nav routes, shared by the desktop top
// nav (AppNav → NavLinks, labels only) and the mobile bottom bar (BottomNav,
// icon + shortLabel). Keep the lists here so the two navs never drift.
export type NavItem = { href: string; label: string; shortLabel?: string; icon: LucideIcon };

export const STUDENT_NAV: NavItem[] = [
  { href: "/student", label: "Dashboard", shortLabel: "Home", icon: House },
  { href: "/student/tests", label: "Tests", icon: ClipboardList },
  { href: "/student/practice", label: "Practice", icon: Dumbbell },
  { href: "/student/doubts", label: "Doubts", icon: MessagesSquare }
];

export const TEACHER_NAV: NavItem[] = [
  { href: "/teacher", label: "Dashboard", shortLabel: "Home", icon: House },
  { href: "/teacher/batches", label: "Batches", icon: UsersRound },
  { href: "/teacher/papers", label: "Papers", icon: FileText },
  { href: "/teacher/bank", label: "My bank", shortLabel: "Bank", icon: Library },
  { href: "/teacher/tests", label: "Tests", icon: ClipboardList }
];
