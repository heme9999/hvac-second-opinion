export type RefrigerantType = 'r22' | 'r410a' | 'r32' | 'unsure';

export interface CalculatorInputs {
  repairQuote: number | null;
  replacementQuote: number | null;
  systemAge: number | null;
  refrigerant: RefrigerantType | null;
  stayYears: number;
  futureAnnualRepairCost: number;
  annualEnergySavings: number;
}

export type CheckOutcome = 'replace' | 'repair' | 'tie';

export interface CheckResult {
  id: 'A' | 'B' | 'C' | 'D';
  title: string;
  fired: boolean;
  favors: CheckOutcome;
  arithmetic: string;
  explanation: string;
}

export type VerdictCode = 'incomplete' | 'replace' | 'repair' | 'borderline';

export interface CalculationResult {
  ready: boolean;
  verdict: VerdictCode;
  verdictHeadline: string;
  verdictDetail: string;
  repairTotal: number;
  replacementTotal: number;
  differenceDollars: number;
  cheaperOption: 'repair' | 'replace' | 'even';
  flipPerYearDollars: number | null;
  flipExplanation: string;
  stayHorizonNote: string | null;
  ageWarningNote: string | null;
  isShortStay: boolean;
  checks: readonly CheckResult[];
  firedChecksSummary: string;
  contractorQuestions: readonly string[];
}
