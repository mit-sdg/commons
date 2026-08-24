import {
  BookOpen,
  CalendarDays,
  Clock,
  FileText,
  GraduationCap,
  Settings,
  Sparkles,
  StickyNote,
  Users,
} from "lucide-react";
import type { Capability } from "@/lib/models";

const STUDENT_NAV = [
  { href: "/assignments", label: "Assignments", icon: BookOpen },
  { href: "/grades", label: "Grades", icon: GraduationCap },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/notes", label: "Notes", icon: StickyNote },
];

/**
 * Each staff destination names the capability that its page enforces, so the
 * navigation never offers a link that will refuse the person who clicks it.
 */
const STAFF_NAV: {
  href: string;
  label: string;
  icon: typeof Sparkles;
  needs: Capability[];
}[] = [
  {
    href: "/staff",
    label: "Dashboard",
    icon: Sparkles,
    needs: ["course:manage"],
  },
  {
    href: "/staff/roster",
    label: "Roster",
    icon: Users,
    needs: ["course:manage"],
  },
  {
    href: "/staff/assignments",
    label: "Assignments",
    icon: BookOpen,
    needs: ["course:manage"],
  },
  {
    href: "/staff/gradebook",
    label: "Gradebook",
    icon: FileText,
    needs: ["grade"],
  },
  {
    href: "/staff/late-days",
    label: "Late Days",
    icon: Clock,
    needs: ["student-records"],
  },
  {
    href: "/staff/class",
    label: "Class settings",
    icon: Settings,
    needs: ["course:manage"],
  },
  {
    href: "/staff/calendar",
    label: "Calendar",
    icon: CalendarDays,
    needs: ["course:manage", "grade", "student-records"],
  },
];

export function lmsNavigation(
  isStaff: boolean,
  can: (capability: Capability) => boolean = () => true,
) {
  if (!isStaff) return STUDENT_NAV;
  return STAFF_NAV.filter((item) => item.needs.some(can)).map(
    ({ href, label, icon }) => ({ href, label, icon }),
  );
}

/**
 * Course navigation appears for anybody with a seat or any staff capability.
 * Staff authority no longer depends on holding a roster seat, so an
 * administrator who was never enrolled still reaches the tools they can use.
 */
export function lmsAccess(seat: unknown, isStaff: boolean) {
  return {
    hasRosterSeat: typeof seat === "string" && seat.length > 0,
    isStaff,
  };
}
