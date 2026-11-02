---
milestone: later
concepts:
  - Grading
  - Policymaking
  - Overriding
  - Rostering
---

# Export the gradebook

## Resolution at completion

`/grades/export` writes the final course grades as CSV for a caller holding
`grade-policies` who is not enrolled as an active student. It computes every
active student's grade under the final policy as saved, as of the request,
over the same inputs Course grades shows, and answers `NO_FINAL_POLICY`
without a final policy.

## Decision at completion

The columns are Student name, Email, Section, one column per policy group in
the policy's order, Average, Grade, Policy grade, Reason, Lectures attended,
Lectures, Policy, Version, and As of. Rows follow the roster's order. Left-out
work isn't a column: each group's value already leaves it out, and the
breakdown lives on the Course grades page. A group without counted work, or a
student without an average, leaves its cell empty. A group named like another
column gets a number, so no header repeats. The text is UTF-8 with CRLF line
endings; a field holding a comma, quote, or line break is quoted, and one
starting with `=`, `+`, `-`, or `@` is prefixed with an apostrophe. The browser
names the file after the class code.

## Verification at completion

Computation tests check the header with a repeated group name and a quoted
policy name. An application test downloads the CSV with an override and after
clearing it, and refuses a grader without `grade-policies`.
