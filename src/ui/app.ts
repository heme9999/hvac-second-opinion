import { calculateSecondOpinion, getScenarioEstimates } from '../engine/calculate';
import type { CalculatorInputs, RefrigerantType } from '../engine/types';
import { renderCalculationResult } from './render';
import { decodeShareFragment, encodeShareFragment } from './shareLink';
import { initFormValidation, parseWholeDollarInput } from './validate';

const SAMPLE_SCENARIOS = {
  r22: {
    repairQuote: 1450,
    replacementQuote: 9800,
    systemAge: 14,
    refrigerant: 'r22',
    stayYears: 5,
    futureAnnualRepairCost: 450,
    annualEnergySavings: 240,
  },
  repair: {
    repairQuote: 480,
    replacementQuote: 9200,
    systemAge: 6,
    refrigerant: 'r410a',
    stayYears: 5,
    futureAnnualRepairCost: 150,
    annualEnergySavings: 120,
  },
  borderline: {
    repairQuote: 1100,
    replacementQuote: 8500,
    systemAge: 10,
    refrigerant: 'r410a',
    stayYears: 2,
    futureAnnualRepairCost: 300,
    annualEnergySavings: 180,
  },
} as const;

export function readCalculatorInputs(form: HTMLFormElement): CalculatorInputs {
  const getDollar = (id: string): number | null => {
    const el = form.querySelector<HTMLInputElement>(`#${id}`);
    if (!el) return null;
    return parseWholeDollarInput(el.value);
  };

  const getInt = (id: string): number | null => {
    const el = form.querySelector<HTMLInputElement>(`#${id}`);
    if (!el || el.value.trim() === '') return null;
    const n = Number(el.value);
    if (!Number.isFinite(n) || n < 0) return null;
    return Math.round(n);
  };

  const refEl = form.querySelector<HTMLInputElement>('input[name="refrigerant"]:checked');
  const refVal = refEl?.value;
  const refrigerant: RefrigerantType | null =
    refVal === 'r22' || refVal === 'r410a' || refVal === 'r32' || refVal === 'unsure'
      ? refVal
      : null;

  const stayRaw = getInt('stay-years');
  const stayYears = stayRaw !== null ? Math.min(20, Math.max(1, stayRaw)) : 5;

  const futureRepairBadge = document.getElementById('future-repair-badge');
  const energySavingsBadge = document.getElementById('energy-savings-badge');

  return {
    repairQuote: getDollar('repair-quote'),
    replacementQuote: getDollar('replacement-quote'),
    systemAge: getInt('system-age'),
    refrigerant,
    stayYears,
    futureAnnualRepairCost: getDollar('future-annual-repair') ?? 0,
    annualEnergySavings: getDollar('annual-energy-savings') ?? 0,
    usingEstimatedFutureRepair: futureRepairBadge ? !futureRepairBadge.hidden : false,
    usingEstimatedEnergySavings: energySavingsBadge ? !energySavingsBadge.hidden : false,
  };
}

export function applyInputsToForm(
  form: HTMLFormElement,
  partial: Partial<CalculatorInputs>,
): void {
  const setVal = (id: string, val: number | null | undefined, format = false): void => {
    const el = form.querySelector<HTMLInputElement>(`#${id}`);
    if (!el || val === undefined) return;
    if (val === null) {
      el.value = '';
    } else {
      el.value = format ? Math.round(val).toLocaleString('en-US') : String(Math.round(val));
    }
  };

  setVal('repair-quote', partial.repairQuote, true);
  setVal('replacement-quote', partial.replacementQuote, true);
  setVal('system-age', partial.systemAge, false);
  setVal('stay-years', partial.stayYears, false);
  setVal('future-annual-repair', partial.futureAnnualRepairCost, true);
  setVal('annual-energy-savings', partial.annualEnergySavings, true);

  if (partial.refrigerant) {
    const radio = form.querySelector<HTMLInputElement>(
      `input[name="refrigerant"][value="${partial.refrigerant}"]`,
    );
    if (radio) radio.checked = true;
  }
}

export function initCalculatorApp(): void {
  const form = document.getElementById('calc-form') as HTMLFormElement | null;
  const worksheetEl = document.getElementById('results-worksheet');
  const mobileStickyBar = document.getElementById('mobile-sticky-bar');
  const mobileToggleBtn = document.getElementById('mobile-sticky-toggle');
  const mobileDrawer = document.getElementById('mobile-result-drawer');
  const mobileStickyVerdictEl = document.getElementById('mobile-sticky-verdict');
  const mobileStickyMetaEl = document.getElementById('mobile-sticky-meta');
  const mobileDrawerBodyEl = document.getElementById('mobile-drawer-body');
  const copyBtn = document.getElementById('copy-link-btn');
  const copyStatus = document.getElementById('copy-link-status');
  const clearBtn = document.getElementById('clear-form-btn');
  const applyEstimatesBtn = document.getElementById('apply-estimates-btn');
  const zeroEstimatesBtn = document.getElementById('zero-estimates-btn');
  const frepBadge = document.getElementById('future-repair-badge');
  const esavBadge = document.getElementById('energy-savings-badge');
  const frepHint = document.getElementById('future-repair-hint');
  const esavHint = document.getElementById('energy-savings-hint');

  if (!form || !worksheetEl) return;

  const ageInput = form.querySelector<HTMLInputElement>('#system-age');
  const frepInput = form.querySelector<HTMLInputElement>('#future-annual-repair');
  const esavInput = form.querySelector<HTMLInputElement>('#annual-energy-savings');

  const DEFAULT_FREP_HINT =
    'Editable planning estimate based on age once entered (or leave at $0 if unsure; not a guaranteed fact).';
  const DEFAULT_ESAV_HINT =
    'Editable SEER2 kWh scenario estimate based on age once entered, or reset to $0 unless you verify utility bills.';

  const manualOverrides = {
    futureAnnualRepairCost: false,
    annualEnergySavings: false,
  };

  const setEstimateVisual = (
    field: 'futureAnnualRepairCost' | 'annualEnergySavings',
    active: boolean,
    basis?: string,
  ) => {
    if (field === 'futureAnnualRepairCost') {
      if (frepBadge) frepBadge.hidden = !active;
      if (frepHint) frepHint.textContent = active && basis ? `${basis} (editable estimate).` : DEFAULT_FREP_HINT;
    } else {
      if (esavBadge) esavBadge.hidden = !active;
      if (esavHint) esavHint.textContent = active && basis ? `${basis} (editable estimate).` : DEFAULT_ESAV_HINT;
    }
  };

  const syncAgeScenarioEstimates = (force = false) => {
    if (!ageInput || ageInput.value.trim() === '') return;
    const rawAge = Number(ageInput.value);
    if (!Number.isFinite(rawAge) || rawAge < 0 || rawAge > 60) return;

    const est = getScenarioEstimates(rawAge);
    if ((force || !manualOverrides.futureAnnualRepairCost) && frepInput) {
      frepInput.value = est.futureAnnualRepairCost.toLocaleString('en-US');
      setEstimateVisual('futureAnnualRepairCost', true, est.repairBasis);
    }
    if ((force || !manualOverrides.annualEnergySavings) && esavInput) {
      esavInput.value = est.annualEnergySavings.toLocaleString('en-US');
      setEstimateVisual('annualEnergySavings', true, est.energyBasis);
    }
  };

  const validateAll = initFormValidation(form);

  if (window.location.hash) {
    const decoded = decodeShareFragment(window.location.hash);
    if (decoded) {
      applyInputsToForm(form, decoded);
      manualOverrides.futureAnnualRepairCost = true;
      manualOverrides.annualEnergySavings = true;
      setEstimateVisual('futureAnnualRepairCost', false);
      setEstimateVisual('annualEnergySavings', false);
    }
  }

  const runUpdate = () => {
    const inputs = readCalculatorInputs(form);
    const result = calculateSecondOpinion(inputs);
    renderCalculationResult(result, {
      worksheetEl,
      mobileStickyVerdictEl,
      mobileStickyMetaEl,
      mobileDrawerBodyEl,
    });
  };

  let timer: ReturnType<typeof setTimeout> | undefined;
  const scheduleUpdate = () => {
    clearTimeout(timer);
    timer = setTimeout(runUpdate, 50);
  };

  ageInput?.addEventListener('input', () => {
    syncAgeScenarioEstimates(false);
  });

  frepInput?.addEventListener('input', () => {
    manualOverrides.futureAnnualRepairCost = true;
    setEstimateVisual('futureAnnualRepairCost', false);
  });

  esavInput?.addEventListener('input', () => {
    manualOverrides.annualEnergySavings = true;
    setEstimateVisual('annualEnergySavings', false);
  });

  applyEstimatesBtn?.addEventListener('click', () => {
    manualOverrides.futureAnnualRepairCost = false;
    manualOverrides.annualEnergySavings = false;
    syncAgeScenarioEstimates(true);
    runUpdate();
  });

  zeroEstimatesBtn?.addEventListener('click', () => {
    manualOverrides.futureAnnualRepairCost = true;
    manualOverrides.annualEnergySavings = true;
    if (frepInput) frepInput.value = '0';
    if (esavInput) esavInput.value = '0';
    setEstimateVisual('futureAnnualRepairCost', false);
    setEstimateVisual('annualEnergySavings', false);
    runUpdate();
  });

  form.addEventListener('input', scheduleUpdate);
  form.addEventListener('change', scheduleUpdate);
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    validateAll();
    runUpdate();
    document.getElementById('results-sheet')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });

  // Sample presets
  document.querySelectorAll<HTMLButtonElement>('[data-sample]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.sample as keyof typeof SAMPLE_SCENARIOS | undefined;
      if (!key || !SAMPLE_SCENARIOS[key]) return;
      manualOverrides.futureAnnualRepairCost = true;
      manualOverrides.annualEnergySavings = true;
      setEstimateVisual('futureAnnualRepairCost', false);
      setEstimateVisual('annualEnergySavings', false);
      applyInputsToForm(form, SAMPLE_SCENARIOS[key]);
      runUpdate();
    });
  });

  // Clear button
  clearBtn?.addEventListener('click', () => {
    form.reset();
    manualOverrides.futureAnnualRepairCost = false;
    manualOverrides.annualEnergySavings = false;
    setEstimateVisual('futureAnnualRepairCost', false);
    setEstimateVisual('annualEnergySavings', false);
    form.querySelectorAll<HTMLInputElement>('input[type="text"], input[type="number"]').forEach((el) => {
      el.classList.remove('user-invalid-fallback');
      el.setAttribute('aria-invalid', 'false');
    });
    const stayInput = form.querySelector<HTMLInputElement>('#stay-years');
    if (stayInput) stayInput.value = '5';
    if (frepInput) frepInput.value = '0';
    if (esavInput) esavInput.value = '0';
    runUpdate();
  });

  // Opt-in copy link (carries #fragment, never auto-syncs URL)
  copyBtn?.addEventListener('click', async () => {
    const inputs = readCalculatorInputs(form);
    const fragment = encodeShareFragment(inputs);
    const shareUrl = `${window.location.origin}${window.location.pathname}${fragment}`;
    try {
      await navigator.clipboard.writeText(shareUrl);
      if (copyStatus) copyStatus.textContent = 'Share link copied (stored in #fragment only).';
    } catch {
      window.location.hash = fragment;
      if (copyStatus) copyStatus.textContent = 'Share link placed in address bar.';
    }
    setTimeout(() => {
      if (copyStatus) copyStatus.textContent = '';
    }, 3000);
  });

  // Mobile sticky bar tap-to-expand drawer
  if (mobileToggleBtn && mobileDrawer && mobileStickyBar) {
    const setExpanded = (open: boolean) => {
      mobileToggleBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
      mobileDrawer.dataset.open = open ? 'true' : 'false';
      mobileDrawer.hidden = !open;
    };

    mobileToggleBtn.addEventListener('click', () => {
      const isOpen = mobileToggleBtn.getAttribute('aria-expanded') === 'true';
      setExpanded(!isOpen);
    });

    mobileDrawerBodyEl?.addEventListener('click', (e) => {
      const link = (e.target as HTMLElement | null)?.closest('a[href^="#"]');
      if (link) setExpanded(false);
    });
  }

  runUpdate();
}
