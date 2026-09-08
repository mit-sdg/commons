---
milestone: public-deployment
concepts:
  - Roling
---

# Give staff classification one definition

## Current behavior

[`mayViewStaffCalendar`](../../../src/compositions/access/policy.ts) admits
`administer`, `course:manage`, `grade`, `student-records`, and `moderate`.
The frontend's [`isStaff`](../../../frontend/src/lib/auth.tsx) derives from
`course:manage`, `grade`, `student-records`, and `live:host`, using the expanded
capabilities returned for administrators.

An account holding only `live:host` is staff in the interface but cannot read
the staff calendar. An account holding only `moderate` can read the staff
calendar but is not staff in the interface. Neither definition alone can be
adopted as the Staff discussion audience without deciding who it includes.

## Desired behavior

Staff membership derives from `administer`, `course:manage`, `grade`,
`student-records`, or `live:host` in the `commons` context. Moderation alone does
not confer staff membership: a student assigned only `moderate` does not gain
access to Staff discussions or the staff calendar. A staff account with no
active course seat still qualifies through its role.

The calendar, audience membership, and interface classification use this shared
policy. Roster seat kind remains separate from role authority, and archival
denies audience access regardless of a retained grant.

## Acceptance condition

The capability registry, role explanation, enforcing views, and interface
classification agree. Tests cover each qualifying capability on its own,
`moderate` on its own, the administrator wildcard, and an account without a
qualifying role. Revoking a qualifying role changes Staff audience membership
without maintaining a separate group roster.
