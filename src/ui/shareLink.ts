import type { CalculatorInputs, RefrigerantType } from '../engine/types';

function isValidRefrigerant(val: string | null): val is RefrigerantType {
  return val === 'r22' || val === 'r410a' || val === 'r32' || val === 'unsure';
}

/**
 * Encodes current calculator inputs into an opt-in URL #fragment.
 * Never touches window.location automatically unless the user clicks Copy Link.
 */
export function encodeShareFragment(inputs: CalculatorInputs): string {
  const params = new URLSearchParams();
  if (inputs.repairQuote !== null) params.set('rep', String(Math.round(inputs.repairQuote)));
  if (inputs.replacementQuote !== null) {
    params.set('repl', String(Math.round(inputs.replacementQuote)));
  }
  if (inputs.systemAge !== null) params.set('age', String(Math.round(inputs.systemAge)));
  if (inputs.refrigerant !== null) params.set('ref', inputs.refrigerant);
  params.set('stay', String(Math.round(inputs.stayYears)));
  if (inputs.futureAnnualRepairCost > 0) {
    params.set('frep', String(Math.round(inputs.futureAnnualRepairCost)));
  }
  if (inputs.annualEnergySavings > 0) {
    params.set('esav', String(Math.round(inputs.annualEnergySavings)));
  }
  return `#${params.toString()}`;
}

export function decodeShareFragment(
  hash: string,
): Partial<CalculatorInputs> | null {
  const raw = hash.startsWith('#') ? hash.slice(1) : hash;
  if (!raw || !raw.includes('=')) return null;

  const params = new URLSearchParams(raw);
  const out: Partial<CalculatorInputs> = {};

  const parseWhole = (key: string, min: number, max: number): number | undefined => {
    const val = params.get(key);
    if (val === null || val.trim() === '') return undefined;
    const n = Number(val);
    if (!Number.isFinite(n) || n < min || n > max) return undefined;
    return Math.round(n);
  };

  const rep = parseWhole('rep', 0, 100000);
  if (rep !== undefined) out.repairQuote = rep;

  const repl = parseWhole('repl', 1, 200000);
  if (repl !== undefined) out.replacementQuote = repl;

  const age = parseWhole('age', 0, 60);
  if (age !== undefined) out.systemAge = age;

  const ref = params.get('ref');
  if (isValidRefrigerant(ref)) out.refrigerant = ref;

  const stay = parseWhole('stay', 1, 20);
  if (stay !== undefined) out.stayYears = stay;

  const frep = parseWhole('frep', 0, 50000);
  if (frep !== undefined) out.futureAnnualRepairCost = frep;

  const esav = parseWhole('esav', 0, 50000);
  if (esav !== undefined) out.annualEnergySavings = esav;

  return Object.keys(out).length > 0 ? out : null;
}
