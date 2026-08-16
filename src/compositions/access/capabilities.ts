export const FORUM = "forum";

export const ADMIN_ROLE = "administrator";
export const INITIAL_ADMIN_CAPABILITIES = [
  "administer",
  "moderate",
  "pin",
  "roster:manage",
  "late-days:manage",
  "calendar:view-staff",
  "student-notes:manage",
];

export const INITIAL_ROSTER_BOOTSTRAP_ROLE = "initial-roster-bootstrap";
export const INITIAL_ROSTER_BOOTSTRAP_CAPABILITIES = ["roster:manage"];

export const COURSE_STAFF_ROLE = "course-staff";
export const STAFF_CAPABILITIES = [
  "roster:manage",
  "assignments:manage",
  "submissions:view-all",
  "grades:manage",
  "grades:view-all",
  "late-days:manage",
  "student-notes:manage",
  "calendar:view-staff",
];
