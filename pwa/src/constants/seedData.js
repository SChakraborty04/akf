export const INITIAL_SEED_DATA = {
  groupProfile: {
    name: 'SHG Group',
    hindiName: 'स्वयं सहायता समूह',
    address: '',
    state: '',
    district: '',
    block: '',
    panchayat: '',
    village: '',
    memberCount: 0,
    stampValue: 50,
    maxLoanAmount: 50000,
    approvalRequired: true,
    cycleNo: 1,
    cycleStart: '',
    cycleEnd: '',
    cycleWeek: 50,
    meetingDay: 'Weekly'
  },
  loanShapes: [
    { id: 'pentagon', name: 'Pentagon', symbol: 'pentagon', value: 500, color: '#0d9488' },
    { id: 'circle', name: 'Circle', symbol: 'circle', value: 1000, color: '#2563eb' },
    { id: 'triangle', name: 'Triangle', symbol: 'triangle', value: 3000, color: '#d97706' },
    { id: 'star', name: 'Star', symbol: 'star', value: 5000, color: '#7c3aed' },
    { id: 'sun', name: 'Sun', symbol: 'sun', value: 10000, color: '#ea580c' }
  ],
  deposits: [],
  loans: [],
  repayments: [],
  ledger: [],
  members: []
};
