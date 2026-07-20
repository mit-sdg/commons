import {
  BookOpen,
  CalendarDays,
  Clock,
  FileText,
  GraduationCap,
  Sparkles,
  StickyNote,
  Users,
} from "lucide-react";

const STUDENT_NAV = [
  { href: "/assignments", label: "Assignments", icon: BookOpen },
  { href: "/grades", label: "Grades", icon: GraduationCap },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/notes", label: "Notes", icon: StickyNote },
];

const STAFF_NAV = [
  { href: "/staff", label: "Dashboard", icon: Sparkles },
  { href: "/staff/roster", label: "Roster", icon: Users },
  { href: "/staff/assignments", label: "Assignments", icon: BookOpen },
  { href: "/staff/gradebook", label: "Gradebook", icon: FileText },
  { href: "/staff/late-days", label: "Late Days", icon: Clock },
  { href: "/staff/calendar", label: "Calendar", icon: CalendarDays },
];

export function lmsNavigation(isStaff: boolean) {
  return isStaff ? STAFF_NAV : STUDENT_NAV;
}

export function lmsAccess(seat: unknown, mayManageAssignments: boolean) {
  return {
    hasRosterSeat: typeof seat === "string" && seat.length > 0,
    isStaff: mayManageAssignments,
  };
}
