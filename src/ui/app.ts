import { calculateSecondOpinion } from '../engine/calculate';
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

  return {
    repairQuote: getDollar('repair-quote'),
    replacementQuote: getDollar('replacement-quote'),
    systemAge: getInt('system-age'),
    refrigerant,
    stayYears,
    futureAnnualRepairCost: getDollar('future-annual-repair') ?? 0,
    annualEnergySavings: getDollar('annual-energy-savings') ?? 0,
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

  if (!form || !worksheetEl) return;

  const validateAll = initFormValidation(form);

  if (window.location.hash) {
    const decoded = decodeShareFragment(window.location.hash);
    if (decoded) {
      applyInputsToForm(form, decoded);
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
      applyInputsToForm(form, SAMPLE_SCENARIOS[key]);
      runUpdate();
    });
  });

  // Clear button
  clearBtn?.addEventListener('click', () => {
    form.reset();
    form.querySelectorAll<HTMLInputElement>('input[type="text"], input[type="number"]').forEach((el) => {
      el.classList.remove('user-invalid-fallback');
      el.setAttribute('aria-invalid', 'false');
    });
    const stayInput = form.querySelector<HTMLInputElement>('#stay-years');
    if (stayInput) stayInput.value = '5';
    const frepInput = form.querySelector<HTMLInputElement>('#future-annual-repair');
    if (frepInput) frepInput.value = '0';
    const esavInput = form.querySelector<HTMLInputElement>('#annual-energy-savings');
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
