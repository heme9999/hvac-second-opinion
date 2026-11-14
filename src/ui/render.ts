import { formatDollars } from '../engine/calculate';
import type { CalculationResult } from '../engine/types';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export interface RenderTargets {
  worksheetEl: HTMLElement;
  mobileStickyVerdictEl: HTMLElement | null;
  mobileStickyMetaEl: HTMLElement | null;
  mobileDrawerBodyEl: HTMLElement | null;
}

function getVerdictBadgeClass(verdict: CalculationResult['verdict']): string {
  if (verdict === 'replace') return 'verdict-badge verdict-replace';
  if (verdict === 'repair') return 'verdict-badge verdict-repair';
  if (verdict === 'borderline') return 'verdict-badge verdict-borderline';
  return 'verdict-badge verdict-pending';
}

function getVerdictTagText(verdict: CalculationResult['verdict']): string {
  if (verdict === 'replace') return 'REPLACE';
  if (verdict === 'repair') return 'REPAIR';
  if (verdict === 'borderline') return 'BORDERLINE';
  return 'PENDING';
}

export function renderCalculationResult(
  result: CalculationResult,
  targets: RenderTargets,
): void {
  const {
    worksheetEl,
    mobileStickyVerdictEl,
    mobileStickyMetaEl,
    mobileDrawerBodyEl,
  } = targets;

  // Update mobile sticky bar & drawer
  if (mobileStickyVerdictEl && mobileStickyMetaEl && mobileDrawerBodyEl) {
    if (!result.ready) {
      mobileStickyVerdictEl.textContent = 'Awaiting Quotes';
      mobileStickyMetaEl.textContent = 'Enter repair + replace quotes to run 4 checks';
      mobileDrawerBodyEl.innerHTML = `
        <p class="field-note" style="margin-bottom: 0.75rem;">
          Enter your repair quote, replacement quote, system age, and refrigerant to see your holding-cost comparison and all four checks here.
        </p>
        <a href="#calc-worksheet" class="btn btn-secondary" style="width: 100%;">Go to Quote Sheet</a>
      `;
    } else {
      mobileStickyVerdictEl.textContent = result.verdictHeadline;
      mobileStickyMetaEl.textContent =
        result.cheaperOption === 'even'
          ? `Net ${formatDollars(result.repairTotal)} even`
          : `${result.cheaperOption === 'replace' ? 'Replace' : 'Repair'} saves ${formatDollars(result.differenceDollars)} · Tap for breakdown`;

      const mobileChecksHtml = result.checks
        .map(
          (check) => `
          <div class="mobile-check-row">
            <span class="check-status ${check.fired ? 'check-fired' : 'check-clear'}">
              ${check.fired ? 'FIRED' : 'CLEAR'}
            </span>
            <div>
              <strong>Check ${check.id}:</strong>
              <span class="tabular">${escapeHtml(check.arithmetic)}</span>
            </div>
          </div>`,
        )
        .join('');

      const ageNoteMobileHtml = result.ageWarningNote
        ? `<div class="stay-callout" role="note" style="margin-bottom: 0.75rem;">
             <strong>Age 0 Warranty &amp; Input Check:</strong> ${escapeHtml(result.ageWarningNote)}
           </div>`
        : '';

      mobileDrawerBodyEl.innerHTML = `
        <div class="totals-compare" style="margin-bottom: 0.75rem;">
          <div class="total-cell">
            <span class="total-label">Repair Total</span>
            <strong class="total-figure tabular">${formatDollars(result.repairTotal)}</strong>
          </div>
          <div class="total-cell">
            <span class="total-label">Replace Total</span>
            <strong class="total-figure tabular">${formatDollars(result.replacementTotal)}</strong>
          </div>
          <div class="total-cell">
            <span class="total-label">Net Difference</span>
            <strong class="total-figure accent tabular">${formatDollars(result.differenceDollars)}</strong>
          </div>
        </div>
        ${ageNoteMobileHtml}
        <p class="field-note" style="margin-bottom: 0.75rem;">${escapeHtml(result.firedChecksSummary)}</p>
        <div class="mobile-checks-list">${mobileChecksHtml}</div>
        <p class="field-note" style="margin-top: 0.75rem;">${escapeHtml(result.flipExplanation)}</p>
        <a href="#results-sheet" class="btn btn-primary" style="width: 100%; margin-top: 0.75rem;">Jump to Full Worksheet</a>
      `;
    }
  }

  // Placeholder state before user enters required values
  if (!result.ready) {
    worksheetEl.innerHTML = `
      <div class="sheet-header">
        <div>
          <span class="sheet-kicker">ESTIMATE WORKSHEET</span>
          <h2 class="sheet-title">Second Opinion Audit</h2>
        </div>
        <span class="${getVerdictBadgeClass('incomplete')}">${getVerdictTagText('incomplete')}</span>
      </div>

      <div class="placeholder-state">
        <p class="placeholder-lead">
          Enter your <strong>repair quote</strong>, <strong>replacement quote</strong>, <strong>system age</strong>, and <strong>refrigerant type</strong> on the left to generate a line-by-line decision sheet.
        </p>
        <p class="field-note">
          Or tap one of the sample cases above the form (“14-yr R-22 ($1,450 vs $9,800)”, “6-yr R-410A ($480 vs $9,200)”, or “10-yr Short Stay ($1,100 vs $8,500)”) to inspect how the four checks behave.
        </p>
      </div>

      <div class="checks-preview" aria-label="Checks that will run">
        <h3>4 Checks That Will Run Automatically</h3>
        <table class="estimate-table">
          <thead>
            <tr>
              <th>Check</th>
              <th>Rule</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">Check A</th>
              <td>$5,000 rule (age × repair quote)</td>
              <td class="tabular">— Waiting</td>
            </tr>
            <tr>
              <th scope="row">Check B</th>
              <td>50% rule (repair ÷ replacement quote)</td>
              <td class="tabular">— Waiting</td>
            </tr>
            <tr>
              <th scope="row">Check C</th>
              <td>Hard flag (age &gt; 12 AND R-22 refrigerant)</td>
              <td class="tabular">— Waiting</td>
            </tr>
            <tr>
              <th scope="row">Check D</th>
              <td>Holding-cost comparison over your stay horizon</td>
              <td class="tabular">— Waiting</td>
            </tr>
          </tbody>
        </table>
      </div>
    `;
    return;
  }

  const checksRowsHtml = result.checks
    .map(
      (check) => `
      <tr class="${check.fired ? 'row-fired' : ''}">
        <th scope="row">
          <div class="check-name">${escapeHtml(check.title)}</div>
          <div class="check-why">${escapeHtml(check.explanation)}</div>
        </th>
        <td data-label="Status">
          <span class="check-status ${check.fired ? 'check-fired' : 'check-clear'}">
            ${check.fired ? '▲ FIRED' : '○ NOT FIRED'}
          </span>
        </td>
        <td data-label="Arithmetic" class="tabular arithmetic-cell">
          ${escapeHtml(check.arithmetic)}
        </td>
      </tr>`,
    )
    .join('');

  const questionsHtml = result.contractorQuestions
    .map((q) => `<li>${escapeHtml(q)}</li>`)
    .join('');

  const stayNoteHtml = result.stayHorizonNote
    ? `<div class="stay-callout" role="note">
         <strong>Short Stay Horizon:</strong> ${escapeHtml(result.stayHorizonNote)}
       </div>`
    : '';

  const ageNoteHtml = result.ageWarningNote
    ? `<div class="stay-callout" role="note">
         <strong>Age 0 Warranty &amp; Input Check:</strong> ${escapeHtml(result.ageWarningNote)}
       </div>`
    : '';

  worksheetEl.innerHTML = `
    <div class="sheet-header">
      <div>
        <span class="sheet-kicker">ESTIMATE WORKSHEET</span>
        <h2 class="sheet-title">${escapeHtml(result.verdictHeadline)}</h2>
      </div>
      <span class="${getVerdictBadgeClass(result.verdict)}">${getVerdictTagText(result.verdict)}</span>
    </div>

    <p class="verdict-detail">${escapeHtml(result.verdictDetail)}</p>
    <p class="fired-summary"><strong>Check Summary:</strong> ${escapeHtml(result.firedChecksSummary)}</p>

    ${ageNoteHtml}
    ${stayNoteHtml}

    <div class="totals-compare" aria-label="Holding cost comparison">
      <div class="total-cell">
        <span class="total-label">Repair Holding Total</span>
        <strong class="total-figure tabular">${formatDollars(result.repairTotal)}</strong>
      </div>
      <div class="total-cell">
        <span class="total-label">Replace Net Total</span>
        <strong class="total-figure tabular">${formatDollars(result.replacementTotal)}</strong>
      </div>
      <div class="total-cell">
        <span class="total-label">${
          result.cheaperOption === 'replace'
            ? 'Replace Saves'
            : result.cheaperOption === 'repair'
              ? 'Repair Saves'
              : 'Difference'
        }</span>
        <strong class="total-figure accent tabular">${formatDollars(result.differenceDollars)}</strong>
      </div>
    </div>

    <h3>Line-by-Line Audit (All 4 Checks)</h3>
    <div tabindex="0" role="region" aria-label="Four calculation checks" class="table-wrapper">
      <table class="estimate-table audit-table">
        <thead>
          <tr>
            <th>Check</th>
            <th>Outcome</th>
            <th>Exact Arithmetic</th>
          </tr>
        </thead>
        <tbody>
          ${checksRowsHtml}
        </tbody>
      </table>
    </div>

    <div class="flip-box">
      <h3>What Would Flip This Answer</h3>
      <p class="tabular" style="margin-bottom: 0;">${escapeHtml(result.flipExplanation)}</p>
    </div>

    <div class="questions-box">
      <h3>3 Questions to Ask Your Contractor</h3>
      <ol>${questionsHtml}</ol>
    </div>
  `;
}
