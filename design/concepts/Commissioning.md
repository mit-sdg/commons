# Commissioning

## Purpose

Remember a proposed undertaking, its fixed brief, whether it was accepted, the executions carrying it out, and its conclusion. A recorded refusal answers a proposal too; later circumstances do not silently change that occasion's decision.

## Principle

Mira asks Omar to arrange a collection with a written brief. She prepares a commission, Omar accepts it, and his first attempt is assigned to it. A correction needs another attempt on the same undertaking. The undertaking completes only when its work is done. A repeated completion or a late failure cannot rewrite that conclusion. Another proposal is declined because there is no work; it cannot subsequently be accepted simply because new work arrives. A new proposal is needed.

## Types

```types
external Subject
  What the work concerns; Commissioning neither creates nor validates it.
external Execution
  An external attempt carrying out the undertaking; its own behavior belongs elsewhere.
```

## State

```state
a set of Commissions with
  a subject Subject
  a brief String
  a status String
  an account String
  an executions Seq
  a createdAt Date
  an updatedAt Date
  an optional acceptedAt Date

Rule: status is exactly one of prepared, declined, accepted, completed, failed.
Rule: subject, brief, and createdAt never change.
Rule: an empty preparation account prepares work; a nonempty account declines it.
Rule: only prepared work can be accepted; only accepted work can complete successfully; prepared or accepted work can fail.
Rule: the first terminal conclusion is retained. Repeated conclusions return it without reopening work.
Rule: an execution may be associated only with work that was accepted, including completed or failed work, so a late association does not lose an execution or reopen the undertaking.
Rule: associations are sets; adding the same execution twice changes nothing.
Rule: exclusion, eligibility, and execution are not owned here. The caller supplies a brief and its admission account.
a set of Receipts with
  an execution Execution
  a successful Boolean
  an account String
  an at Date

Rule: at most one receipt exists per execution; the first receipt is retained. Reporting a receipt concludes its associated accepted commissions. Associating an execution whose receipt already exists applies that receipt, so either order has the same effect.
Rule: receipts are eligible for expiry after seven days.
Rule: declined records are eligible for expiry after one hour, completed or failed records after seven days. The Mongo floor's TTL monitor removes eligible records asynchronously. Prepared and accepted work never expires automatically. This is bounded historical retention, not recovery or an enduring audit trail.
```

## Actions

```actions
prepare(subject: Subject, brief: String, account: String, at: Date) : return (commission: Commission, subject: Subject, status: String, account: String, brief: String)
  where true
  then
    add a commission with subject, brief, account, no executions, and both times at
    set status to prepared when account is empty, otherwise declined
    return commission, subject, status, account, brief

accept(commission: Commission, at: Date) : return (commission: Commission, brief: String)
  where commission exists and is prepared
  then
    set status to accepted and both acceptedAt and updatedAt to at
    return commission, brief
  where commission does not exist
  then
    refuse COMMISSION_NOT_FOUND "There is no such commission."
  where commission exists and is not prepared
  then
    refuse COMMISSION_NOT_PREPARED "Only a prepared commission can be accepted."

assign(commission: Commission, execution: Execution, at: Date) : return (commission: Commission, execution: Execution)
  where commission exists and has an acceptedAt
  then
    add execution to its executions and set updatedAt to at
    if execution has a receipt, conclude commission from that receipt
    return commission, execution
  where commission does not exist
  then
    refuse COMMISSION_NOT_FOUND "There is no such commission."
  where commission exists and has no acceptedAt
  then
    refuse COMMISSION_NOT_PREPARED "Only an accepted undertaking can receive an execution."

report(execution: Execution, successful: Boolean, account: String, at: Date) : return (execution: Execution, successful: Boolean, account: String)
  where true
  then
    record execution's receipt with successful, account, and at only if it has no receipt
    conclude each associated accepted commission from the recorded receipt
    return execution, successful, account


conclude(commission: Commission, successful: Boolean, account: String, at: Date) : return (commission: Commission, status: String, account: String)
  where commission exists
  then
    if successful and commission is accepted, set status to completed, account to account, and updatedAt to at
    if not successful and commission is prepared or accepted, set status to failed, account to account, and updatedAt to at
    leave every other status and account unchanged
    return commission, status, account
  where commission does not exist
  then
    refuse COMMISSION_NOT_FOUND "There is no such commission."
```

## Queries

```queries
_receipt (execution: String) : optional (successful: Boolean, account: String, at: Date)
  answers the retained first completion receipt of the execution


_commission (commission: String) : optional (subject: String, brief: String, status: String, account: String, executions: Seq, createdAt: Date, updatedAt: Date)
  answers the retained commission's brief, disposition, executions and times; absent after expiry

_forExecution (execution: String) : many (commission: String, subject: String, status: String)
  answers the retained commissions associated with that execution

_forSubject (subject: String) : many (commission: String, status: String, account: String, brief: String, executions: Seq)
  answers retained commissions for the subject, newest creation first with identity breaking ties
```
