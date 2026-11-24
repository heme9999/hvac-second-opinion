import type {
  CalculationResult,
  CalculatorInputs,
  CheckOutcome,
  CheckResult,
  ScenarioEstimates,
} from './types';

/**
 * Computes age-based annual repair and SEER2 kWh utility-savings scenario estimates.
 * Marked explicitly as editable planning scenarios (never factual guarantees).
 */
export function getScenarioEstimates(age: number): ScenarioEstimates {
  const cleanAge = Math.max(0, Math.round(age));

  let futureAnnualRepairCost = 550;
  let repairBasis = 'Age 14+ scenario: $550/yr (illustrative elevated risk of major repairs)';
  if (cleanAge <= 5) {
    futureAnnualRepairCost = 0;
    repairBasis = 'Age 0–5 scenario: $0/yr (typical factory parts warranty period)';
  } else if (cleanAge <= 9) {
    futureAnnualRepairCost = 150;
    repairBasis = 'Age 6–9 scenario: $150/yr (illustrative routine wear parts)';
  } else if (cleanAge <= 13) {
    futureAnnualRepairCost = 350;
    repairBasis = 'Age 10–13 scenario: $350/yr (illustrative blower, board, or sensor repairs)';
  }

  let annualEnergySavings = 0;
  let energyBasis = 'Age 0–9 SEER2 kWh scenario: $0/yr (already near modern DOE SEER2 minimums)';
  if (cleanAge >= 15) {
    annualEnergySavings = 170;
    energyBasis = 'Age 15+ SEER2 kWh scenario: $170/yr (3-ton, 1,000 hrs, $0.16/kWh: ~10 to 14.3 SEER2)';
  } else if (cleanAge >= 10) {
    annualEnergySavings = 80;
    energyBasis = 'Age 10–14 SEER2 kWh scenario: $80/yr (3-ton, 1,000 hrs, $0.16/kWh: ~12 to 14.3 SEER2)';
  }

  return {
    futureAnnualRepairCost,
    annualEnergySavings,
    repairBasis,
    energyBasis,
  };
}

export function formatDollars(amount: number): string {
  const rounded = Math.round(amount);
  const absFormatted = Math.abs(rounded).toLocaleString('en-US');
  return rounded < 0 ? `-$${absFormatted}` : `$${absFormatted}`;
}

function buildQuestions(
  inputs: CalculatorInputs,
  verdict: 'replace' | 'repair' | 'borderline',
  repairQuote: number,
  replacementQuote: number,
  cleanYears: number,
  cleanAge: number,
): string[] {
  const questions: string[] = [
    'Is this quote itemized, and what is included — permits, disposal, thermostat, line set?',
  ];

  const isR22 = inputs.refrigerant === 'r22';
  const nearHalf = replacementQuote > 0 && repairQuote / replacementQuote >= 0.35;
  const isShortStay = cleanYears <= 2;
  const isReplacingOrBorderline = verdict === 'replace' || verdict === 'borderline';

  if (isShortStay) {
    questions.push(
      cleanYears === 1
        ? 'Is there a cheaper repair that gets me through 1 year safely?'
        : 'Is there a cheaper repair that gets me through 2 years safely?',
    );
  }

  if (cleanAge === 0) {
    questions.push(
      'Since this system is under 1 year old (age 0), is this repair covered by the manufacturer parts warranty and installer labor warranty?',
    );
  }

  if (isR22) {
    questions.push(
      'Does the replacement quote include a new line set and R-410A/R-32 refrigerant?',
    );
  }

  if (nearHalf) {
    questions.push(
      'What warranty comes with this repair, and for how long — if it breaks again in 6 months, what do I pay?',
    );
  }

  if (isReplacingOrBorderline) {
    questions.push(
      'Did you do a Manual J load calculation for sizing, or is the quoted size a rule of thumb?',
    );
  }

  const fallbacks = [
    'What warranty comes with this repair, and for how long — if it breaks again in 6 months, what do I pay?',
    'Did you do a Manual J load calculation for sizing, or is the quoted size a rule of thumb?',
  ];

  for (const fallback of fallbacks) {
    if (questions.length >= 3) break;
    if (!questions.includes(fallback)) {
      questions.push(fallback);
    }
  }

  return questions.slice(0, 3);
}

export function calculateSecondOpinion(
  inputs: CalculatorInputs,
): CalculationResult {
  const {
    repairQuote,
    replacementQuote,
    systemAge,
    refrigerant,
    stayYears,
    futureAnnualRepairCost,
    annualEnergySavings,
  } = inputs;

  const isValidRequired =
    repairQuote !== null &&
    Number.isFinite(repairQuote) &&
    repairQuote >= 0 &&
    replacementQuote !== null &&
    Number.isFinite(replacementQuote) &&
    replacementQuote > 0 &&
    systemAge !== null &&
    Number.isFinite(systemAge) &&
    systemAge >= 0 &&
    refrigerant !== null &&
    Number.isFinite(stayYears) &&
    stayYears >= 1 &&
    stayYears <= 20;

  if (!isValidRequired) {
    return {
      ready: false,
      verdict: 'incomplete',
      verdictHeadline: 'Enter both quotes, system age, and refrigerant to run all 4 checks',
      verdictDetail:
        'Nothing is sent to a server. Fill in the required fields on the sheet to compute the $5,000 rule, 50% rule, R-22 check, and holding-cost math.',
      repairTotal: 0,
      replacementTotal: 0,
      differenceDollars: 0,
      cheaperOption: 'even',
      flipPerYearDollars: null,
      flipExplanation:
        'Enter your repair quote, replacement quote, and stay horizon to see the exact yearly break-even threshold.',
      stayHorizonNote: null,
      horizonAgeNote: null,
      checkDEstimateNote: null,
      ageWarningNote: null,
      isShortStay: false,
      checks: [],
      firedChecksSummary: 'Waiting for required inputs.',
      contractorQuestions: [
        'Is this quote itemized, and what is included — permits, disposal, thermostat, line set?',
        'What warranty comes with this repair, and for how long — if it breaks again in 6 months, what do I pay?',
        'Did you do a Manual J load calculation for sizing, or is the quoted size a rule of thumb?',
      ],
    };
  }

  const cleanRepair = Math.round(repairQuote);
  const cleanReplace = Math.round(replacementQuote);
  const cleanAge = Math.round(systemAge);
  const cleanYears = Math.min(20, Math.max(1, Math.round(stayYears)));
  const cleanAnnualRepair = Math.max(0, Math.round(futureAnnualRepairCost || 0));
  const cleanEnergySavings = Math.max(0, Math.round(annualEnergySavings || 0));

  // Check A: $5,000 rule (reference only)
  const productA = cleanAge * cleanRepair;
  const firedA = productA > 5000;
  const isAgeZero = cleanAge === 0;
  const checkA: CheckResult = {
    id: 'A',
    shortName: 'Check A ($5,000 Rule)',
    title: 'Check A — $5,000 Rule (reference check)',
    fired: firedA,
    favors: firedA ? 'replace' : 'repair',
    arithmetic: isAgeZero
      ? `0 years × ${formatDollars(cleanRepair)} = $0 — age 0 zeroes out Check A (verify warranty or actual nameplate age), leans repair`
      : `${cleanAge} years × ${formatDollars(cleanRepair)} = ${formatDollars(productA)} — ${
          firedA
            ? 'over the $5,000 line, leans replace'
            : 'at or under the $5,000 line, leans repair'
        }`,
    explanation: isAgeZero
      ? 'Because system age is entered as 0 years, age × repair equals $0. Confirm whether the unit is genuinely under 1 year old (and under warranty) rather than an unknown age.'
      : firedA
        ? 'Age multiplied by repair quote exceeds $5,000, which signals rising risk of another major part failing soon.'
        : 'Age multiplied by repair quote stays at or below $5,000, so this screening check does not push toward replacement.',
  };

  // Check B: 50% rule (reference only)
  const halfThreshold = cleanReplace * 0.5;
  const pctOfReplace = (cleanRepair / cleanReplace) * 100;
  const firedB = cleanRepair > halfThreshold;
  const checkB: CheckResult = {
    id: 'B',
    shortName: 'Check B (50% Rule)',
    title: 'Check B — 50% Rule (reference check)',
    fired: firedB,
    favors: firedB ? 'replace' : 'repair',
    arithmetic: `${formatDollars(cleanRepair)} ÷ ${formatDollars(cleanReplace)} = ${pctOfReplace.toFixed(1)}% (50% threshold is ${formatDollars(halfThreshold)}) — ${
      firedB
        ? 'over 50% of replacement cost, leans replace'
        : 'at or under 50% of replacement cost, leans repair'
    }`,
    explanation: firedB
      ? 'Paying more than half the cost of a new installed system for a single fix rarely makes sense unless your stay is very short.'
      : 'Repair cost stays at or below half the replacement quote, leaving room to repair if the rest of the system is healthy.',
  };

  // Check C: Hard flag (age > 12 AND R-22)
  const firedC = cleanAge > 12 && refrigerant === 'r22';
  const refLabel =
    refrigerant === 'r22'
      ? 'R-22'
      : refrigerant === 'r410a'
        ? 'R-410A'
        : refrigerant === 'r32'
          ? 'R-32'
          : 'Not sure';
  const checkC: CheckResult = {
    id: 'C',
    shortName: 'Check C (R-22 Flag)',
    title: 'Check C — R-22 Refrigerant & Age Hard Flag',
    fired: firedC,
    favors: firedC ? 'replace' : 'repair',
    arithmetic: `Age ${cleanAge} years (${cleanAge > 12 ? 'over 12' : '12 or under'}) + Refrigerant ${refLabel} — ${
      firedC
        ? 'hard flag FIRED: strong lean replace'
        : 'hard flag not fired'
    }`,
    explanation: firedC
      ? 'EPA banned R-22 production and import on January 1, 2020. Systems over 12 years old using R-22 rely on scarce, expensive reclaimed refrigerant.'
      : refrigerant === 'r22'
        ? 'System uses R-22 (phased out under EPA rules), though age is 12 or under; avoid sinking major money into refrigerant leaks.'
        : 'No R-22 hard flag triggered.',
  };

  // Check D: Holding-cost comparison over stay horizon
  const repairTotal = cleanRepair + cleanYears * cleanAnnualRepair;
  const replacementTotal = cleanReplace - cleanYears * cleanEnergySavings;
  const differenceDollars = Math.abs(replacementTotal - repairTotal);
  let favorsD: CheckOutcome = 'tie';
  let cheaperOption: 'repair' | 'replace' | 'even' = 'even';
  if (replacementTotal < repairTotal) {
    favorsD = 'replace';
    cheaperOption = 'replace';
  } else if (repairTotal < replacementTotal) {
    favorsD = 'repair';
    cheaperOption = 'repair';
  }
  const firedD = favorsD === 'replace';

  const checkD: CheckResult = {
    id: 'D',
    shortName: `Check D (${cleanYears}-Yr Holding Cost)`,
    title: `Check D — ${cleanYears}-Year Holding-Cost Comparison`,
    fired: firedD,
    favors: favorsD,
    arithmetic: `Repair total: ${formatDollars(cleanRepair)} + (${cleanYears} yr × ${formatDollars(cleanAnnualRepair)}/yr) = ${formatDollars(repairTotal)} vs. Replace total: ${formatDollars(cleanReplace)} − (${cleanYears} yr × ${formatDollars(cleanEnergySavings)}/yr) = ${formatDollars(replacementTotal)} — ${
      cheaperOption === 'replace'
        ? `replacing is ${formatDollars(differenceDollars)} cheaper over ${cleanYears} yr`
        : cheaperOption === 'repair'
          ? `repairing is ${formatDollars(differenceDollars)} cheaper over ${cleanYears} yr`
          : `both totals match at ${formatDollars(repairTotal)}`
    }`,
    explanation:
      cheaperOption === 'replace'
        ? 'Over your stay horizon, expected ongoing repairs and energy savings make replacement less expensive overall.'
        : cheaperOption === 'repair'
          ? 'Over your stay horizon, repairing keeps more cash in your pocket given your current repair and energy inputs.'
          : 'Both options produce the same net cost over your planned stay.',
  };

  // Flip condition
  const upfrontGap = cleanReplace - cleanRepair;
  let flipPerYearDollars: number | null = null;
  let flipExplanation = '';
  if (upfrontGap > 0) {
    flipPerYearDollars = Math.round(upfrontGap / cleanYears);
    const exactFlip = upfrontGap / cleanYears;
    const formattedExact =
      Number.isInteger(exactFlip)
        ? formatDollars(exactFlip)
        : `$${exactFlip.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
    flipExplanation = `Replacement becomes cheaper over ${cleanYears} year${cleanYears === 1 ? '' : 's'} if your combined yearly extra repairs + extra utility cost on the old system exceeds (${formatDollars(cleanReplace)} − ${formatDollars(cleanRepair)}) ÷ ${cleanYears} = ${formattedExact}/year.`;
  } else {
    flipExplanation = `The repair quote (${formatDollars(cleanRepair)}) is already at or above the replacement quote (${formatDollars(cleanReplace)}), so replacement starts ahead before counting any future repairs or energy savings.`;
  }

  // Age 0 sanity check
  const ageWarningNote = isAgeZero
    ? 'Age 0 Sanity Check: You entered 0 years (under 1 year old). A newly installed system should be covered by the 10-year manufacturer parts warranty and 1st-year installer labor warranty—verify warranty coverage before paying out of pocket. If you entered 0 because you do not know the system age, look up the MFR DATE on the outdoor condenser nameplate, as age 0 sets Check A to $0 and skips the Check C age threshold.'
    : null;

  // Stay horizon note
  const isShortStay = cleanYears <= 2;
  const stayHorizonNote = isShortStay
    ? `Short stay notice (${cleanYears} year${cleanYears === 1 ? '' : 's'}): A new HVAC system will not pay for itself in ${
        cleanYears === 1 ? '1 year (or a 1–2 year window)' : '1–2 years'
      } through utility savings or avoided breakdowns, so repair tolerance is higher unless there is a safety failure or severe R-22 leak.`
    : null;

  // End-of-stay age check
  const endOfStayAge = cleanAge + cleanYears;
  const horizonAgeNote =
    cleanAge >= 10 && endOfStayAge >= 16
      ? `End-of-stay age check: Keeping a ${cleanAge}-year-old unit for ${cleanYears} more year${
          cleanYears === 1 ? '' : 's'
        } carries it to age ${endOfStayAge}, when replacement often becomes unavoidable anyway.`
      : null;

  // Scenario estimate disclosure
  const checkDEstimateNote =
    inputs.usingEstimatedFutureRepair || inputs.usingEstimatedEnergySavings
      ? 'Scenario estimates active: Optional yearly repair and/or SEER2 energy figures are editable planning scenarios—not guaranteed facts. Replace them with your own utility/service numbers or click “Use $0 Conservative” to run zero-assumption math.'
      : null;

  // Verdict logic:
  // Replace if Check C fires, or if 2 or more of checks A, B, D favor replace.
  // Short-stay exception: when staying 1–2 years, Check D favors repair, and Check B did not exceed 50%,
  // surface Borderline instead of a hard Replace verdict so holding-cost savings and R-22/age risks are weighed openly.
  // Repair if 3 or more of checks A, B, D favor repair and Check C does not fire.
  // Otherwise Borderline.
  const allChecks: CheckResult[] = [checkA, checkB, checkC, checkD];
  const firedShortNames = allChecks.filter((c) => c.fired).map((c) => c.shortName);
  const clearedShortNames = allChecks.filter((c) => !c.fired).map((c) => c.shortName);

  const abdChecks = [checkA, checkB, checkD];
  const replaceFavoredCount = abdChecks.filter((c) => c.favors === 'replace').length;
  const repairFavoredCount = abdChecks.filter((c) => c.favors === 'repair').length;

  let verdict: 'replace' | 'repair' | 'borderline';
  let verdictHeadline: string;
  let verdictDetail: string;

  if (isShortStay && cheaperOption === 'repair' && !checkB.fired && (checkC.fired || replaceFavoredCount >= 2)) {
    verdict = 'borderline';
    verdictHeadline = checkC.fired
      ? `Borderline — Check C (R-22 Flag) vs. ${cleanYears}-Yr Short Stay`
      : `Borderline — ${firedShortNames.join(' & ')} vs. ${cleanYears}-Yr Short Stay`;
    verdictDetail = checkC.fired
      ? `Your ${cleanAge}-year-old R-22 system triggered the Check C phase-out flag, which normally leans replace—but because you only plan to stay ${cleanYears} year${
          cleanYears === 1 ? '' : 's'
        }, repairing is ${formatDollars(differenceDollars)} cheaper over your stay (Check D) and replacement requires ${formatDollars(
          flipPerYearDollars ?? upfrontGap,
        )}/year in savings to break even. If the issue is a non-refrigerant electrical or mechanical part, a targeted repair is defensible to bridge your ${cleanYears}-year stay; replace only if the unit has a major R-22 coil/compressor failure or safety issue.`
      : `Check A and ${
          replaceFavoredCount >= 2 ? 'other screening rules' : 'age'
        } lean replace for long-term owners, but over a ${cleanYears}-year stay repairing saves ${formatDollars(
          differenceDollars,
        )} (Check D). Either a targeted repair to bridge your move or replacement is defensible depending on repair warranty terms.`;
  } else if (checkC.fired || replaceFavoredCount >= 2) {
    verdict = 'replace';
    verdictHeadline = `Lean Replace — ${firedShortNames.join(' & ')} Triggered`;
    verdictDetail = checkC.fired
      ? 'The R-22 hard flag fired (over 12 years old with phased-out R-22 refrigerant). Sinking large repairs into an R-22 system carries high supply and leak risk.'
      : `${replaceFavoredCount} of the 3 financial checks (A, B, D) favor replacement over your ${cleanYears}-year stay.`;
  } else if (!checkC.fired && repairFavoredCount >= 3) {
    verdict = 'repair';
    verdictHeadline = 'Lean Repair — All 4 Checks Clear';
    verdictDetail = `All 3 reference and holding-cost checks (A, B, D) favor repairing, and the R-22 hard flag did not fire.${
      isAgeZero
        ? ' Note: Age 0 sets Check A to $0—confirm whether this unit is covered by first-year installer or manufacturer warranty, or enter the actual nameplate age if unknown.'
        : ''
    }`;
  } else {
    verdict = 'borderline';
    verdictHeadline =
      firedShortNames.length > 0
        ? `Borderline — ${firedShortNames.join(' & ')} Triggered`
        : 'Borderline — Close Call Across Checks';
    verdictDetail =
      'Either is defensible; here is what would change the answer: check whether your contractor guarantees parts and labor on the repair, and look at the yearly flip number below.';
  }

  const firedChecksSummary =
    firedShortNames.length > 0
      ? `Triggered for replace: ${firedShortNames.join(', ')}. Cleared: ${
          clearedShortNames.length > 0 ? clearedShortNames.join(', ') : 'none'
        }.`
      : 'All 4 checks cleared (Checks A, B, C, and D stayed below replacement triggers or favored repair).';

  return {
    ready: true,
    verdict,
    verdictHeadline,
    verdictDetail,
    repairTotal,
    replacementTotal,
    differenceDollars,
    cheaperOption,
    flipPerYearDollars,
    flipExplanation,
    stayHorizonNote,
    horizonAgeNote,
    checkDEstimateNote,
    ageWarningNote,
    isShortStay,
    checks: allChecks,
    firedChecksSummary,
    contractorQuestions: buildQuestions(inputs, verdict, cleanRepair, cleanReplace, cleanYears, cleanAge),
  };
}
