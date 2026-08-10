import type { AccountingIssue, LotAccountingSnapshot } from './AccountingTypes';

export class AccountingInvariantError extends Error {
  readonly issues: AccountingIssue[];

  constructor(issues: AccountingIssue[]) {
    super(issues.map(issue => issue.message).join(' '));
    this.name = 'AccountingInvariantError';
    this.issues = issues;
  }
}

export function assertAccountingSnapshot(snapshot: LotAccountingSnapshot): void {
  if (snapshot.issues.length > 0) {
    throw new AccountingInvariantError(snapshot.issues);
  }
}
