export type UserRole = 'admin' | 'do' | 'shg' | 'viewer' | 'super_admin' | 'operator';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected';

export interface LocationHierarchy {
  states: string[];
  districts: string[];
  blocks: string[];
  panchayats: string[];
  villages?: string[];
  hierarchy: Record<string, Record<string, Record<string, string[]>>>;
  villageMap?: Record<string, string[]>;
}

export interface MasterLocation {
  id: string;
  state: string;
  district: string;
  block: string;
  panchayat: string;
  village: string;
  pincode?: string | null;
  isActive: boolean;
  linkedGroupCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface SHGGroup {
  id: string;
  name: string;
  hindiName?: string | null;
  address?: string | null;
  state: string;
  district: string;
  block: string;
  panchayat: string;
  village?: string | null;
  stampValue: number;
  maxStampsPerMember: number;
  maxLoanAmount: number;
  approvalRequired: boolean;
  monthlyInterestRate: string;
  repaymentStampRate: string;
  meetingDay?: string | null;
  loanSeq: number;
  isActive: boolean;
  memberCount?: number;
  totalDeposits?: number;
  activeLoanAmount?: number;
  activeLoanCount?: number;
  currentCycle?: {
    id: string;
    cycleNo: number;
    startDate: string;
    endDate: string;
    durationWeeks: number;
    isCurrent: boolean;
  } | null;
  createdAt: string;
}

export interface Member {
  id: string;
  groupId: string;
  hhNo: string;
  name: string;
  husbandName?: string | null;
  idNo?: string | null;
  age?: number | null;
  caste?: string | null;
  mobileNo?: string | null;
  education?: string | null;
  agriLandAcres?: string | null;
  irrigatedLandAcres?: string | null;
  goatCount: number;
  animalCount: number;
  familySize?: number | null;
  incomeSource?: string | null;
  isActive: boolean;
  joinedOn?: string | null;
}

export interface LoanShape {
  id: string;
  groupId: string;
  code: string;
  name: string;
  value: number;
  color?: string | null;
  sortOrder: number;
  isActive: boolean;
}

export interface DepositItem {
  memberId: string;
  memberName: string;
  hhNo: string;
  stamps: number;
  amount: number;
}

export interface DepositTransaction {
  id: string;
  type: 'deposit';
  date: string;
  note?: string;
  totalStamps: number;
  stampValue: number;
  totalAmount: number;
  approvalStatus: ApprovalStatus;
  approvedAt?: string | null;
  memberDeposits: DepositItem[];
  createdAt: string;
}

export interface LoanStamp {
  shape: string;
  name: string;
  value: number;
}

export interface LoanTransaction {
  id: string;
  type: 'loan';
  loanNo: number;
  loanRef: string;
  memberId: string;
  memberName: string;
  memberHhNo: string;
  principalAmount: number;
  date: string;
  monthlyInterestRate: string;
  status: 'active' | 'paid';
  approvalStatus: ApprovalStatus;
  approvedAt?: string | null;
  stamps: LoanStamp[];
  createdAt: string;
}

export interface SHGTransactionsGroup {
  groupId: string;
  groupName: string;
  hindiName?: string | null;
  state: string;
  district: string;
  block: string;
  panchayat: string;
  village?: string | null;
  pendingCount: number;
  approvedCount: number;
  pendingAmount: number;
  deposits: DepositTransaction[];
  loans: LoanTransaction[];
}

export interface LedgerEntry {
  id: string;
  groupId: string;
  groupName: string;
  type: 'deposit' | 'loan' | 'repayment';
  amount: number;
  date: string;
  memberId?: string | null;
  memberName?: string | null;
  hhNo?: string | null;
  stamps?: number | null;
  description: string;
  createdAt: string;
}

export interface WeeklyPaymentMemberDetail {
  memberId: string;
  memberName: string;
  hhNo: string;
  weekNo: string;
  date: string;
  displayDate: string;
  totalDeposit: number;
  noOfStamps: number;
  loanDisbursed: number;
  repayment: number;
  balanceAmount: number;
  outstandingAmount: number;
  approvalStatus: 'approved' | 'pending';
  depositId: string | null;
  depositItemId: string | null;
  loanIds?: string[];
  repaymentIds?: string[];
}

export interface WeeklyPaymentRow {
  weekNo: string;
  weekIndex: number;
  date: string;
  displayDate: string;
  totalDeposit: number;
  noOfStamps: number;
  loanDisbursed: number;
  repayment: number;
  boxAmount: number;
  outstandingAmount: number;
  approvedCount: number;
  totalCount: number;
  approvalRatio: string;
  approvalStatus: 'approved' | 'pending';
  isCurrentWeek: boolean;
  depositId: string | null;
  members: WeeklyPaymentMemberDetail[];
}

export interface MemberFinanceHistoryItem {
  weekNo: string;
  date: string;
  displayDate: string;
  totalDeposit: number;
  noOfStamps: number;
  loanDisbursed: number;
  repayment: number;
  balanceAmount: number;
  outstandingAmount: number;
  approvalStatus: 'approved' | 'pending';
}

export interface SHGWeeklyFinanceResponse {
  shg: SHGGroup;
  totalMembers: number;
  currentBoxAmount: number;
  currentOutstandingAmount: number;
  weeks: WeeklyPaymentRow[];
  memberHistories: Record<string, MemberFinanceHistoryItem[]>;
}

export interface MISUser {
  id: string;
  username: string;
  fullName: string;
  role: UserRole;
  language: 'en' | 'hi';
  isActive: boolean;
  isLocked: boolean;
  groupId?: string | null;
  groupName?: string | null;
  assignedGroupIds?: string[] | null;
  assignedGroupNames?: string[] | null;
  failedLoginCount: number;
  lastLoginAt?: string | null;
  createdAt: string;
}

export interface SystemSettingsData {
  rateOfInterest: {
    monthlyRate: string;
    percentage: string;
    annualRate: string;
    description: string;
  };
  validationRules: {
    defaultStampValue: number;
    maxLoanAmount: number;
    maxStampsPerMeeting: number;
    requireApproval: boolean;
    description: string;
  };
  accessControl: {
    allowViewerExport: boolean;
    enforcePasswordExpiry: boolean;
    roles: {
      role: UserRole;
      label: string;
      description: string;
      canApprove: boolean;
      canEditSettings: boolean;
      canManageUsers: boolean;
    }[];
  };
}

export interface DashboardKPIs {
  totalGroups: number;
  totalMembers: number;
  totalActivePortfolio: number;
  activeLoansCount: number;
  totalSavingsCollected: number;
  pendingApprovals: {
    totalCount: number;
    totalAmount: number;
    depositsCount: number;
    loansCount: number;
  };
}
