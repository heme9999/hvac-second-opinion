import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { calculateSecondOpinion, getScenarioEstimates } from '../src/engine/calculate';
import { decodeShareFragment, encodeShareFragment } from '../src/ui/shareLink';

describe('calculateSecondOpinion', () => {
  it('returns incomplete placeholder state when required inputs are missing', () => {
    const res = calculateSecondOpinion({
      repairQuote: null,
      replacementQuote: null,
      systemAge: null,
      refrigerant: null,
      stayYears: 5,
      futureAnnualRepairCost: 0,
      annualEnergySavings: 0,
    });
    expect(res.ready).toBe(false);
    expect(res.verdict).toBe('incomplete');
    expect(res.checks).toHaveLength(0);
  });

  it('triggers Check C hard flag when age > 12 and refrigerant is R-22', () => {
    const res = calculateSecondOpinion({
      repairQuote: 300,
      replacementQuote: 9800,
      systemAge: 13,
      refrigerant: 'r22',
      stayYears: 5,
      futureAnnualRepairCost: 0,
      annualEnergySavings: 0,
    });
    expect(res.ready).toBe(true);
    expect(res.verdict).toBe('replace');
    const checkC = res.checks.find((c) => c.id === 'C');
    expect(checkC?.fired).toBe(true);
    expect(
      res.contractorQuestions.some((q) => q.includes('new line set and R-410A/R-32')),
    ).toBe(true);
  });

  it('does not trigger Check C at age === 12 with R-22', () => {
    const res = calculateSecondOpinion({
      repairQuote: 350,
      replacementQuote: 9000,
      systemAge: 12,
      refrigerant: 'r22',
      stayYears: 5,
      futureAnnualRepairCost: 0,
      annualEnergySavings: 0,
    });
    const checkC = res.checks.find((c) => c.id === 'C');
    expect(checkC?.fired).toBe(false);
    expect(res.verdict).toBe('repair');
  });

  it('returns repair when checks A, B, D all favor repair and Check C does not fire', () => {
    const res = calculateSecondOpinion({
      repairQuote: 450,
      replacementQuote: 9500,
      systemAge: 7,
      refrigerant: 'r410a',
      stayYears: 5,
      futureAnnualRepairCost: 150,
      annualEnergySavings: 100,
    });
    expect(res.verdict).toBe('repair');
    expect(res.repairTotal).toBe(1200);
    expect(res.replacementTotal).toBe(9000);
    expect(res.differenceDollars).toBe(7800);
    expect(res.cheaperOption).toBe('repair');
    expect(res.flipPerYearDollars).toBe(Math.round((9500 - 450) / 5));
  });

  it('returns borderline when exactly 1 of A, B, D favors replace and Check C is clear', () => {
    const res = calculateSecondOpinion({
      repairQuote: 650,
      replacementQuote: 9800,
      systemAge: 14,
      refrigerant: 'r410a',
      stayYears: 5,
      futureAnnualRepairCost: 0,
      annualEnergySavings: 0,
    });
    const checkA = res.checks.find((c) => c.id === 'A');
    expect(checkA?.fired).toBe(true);
    expect(checkA?.arithmetic).toContain('14 years × $650 = $9,100');
    expect(res.verdict).toBe('borderline');
    expect(res.verdictDetail).toContain('Either is defensible');
  });

  it('returns replace when 2 or more of checks A, B, D favor replace', () => {
    const res = calculateSecondOpinion({
      repairQuote: 5200,
      replacementQuote: 9500,
      systemAge: 10,
      refrigerant: 'r410a',
      stayYears: 5,
      futureAnnualRepairCost: 400,
      annualEnergySavings: 300,
    });
    expect(res.verdict).toBe('replace');
    expect(res.checks.find((c) => c.id === 'A')?.fired).toBe(true);
    expect(res.checks.find((c) => c.id === 'B')?.fired).toBe(true);
  });

  it('emits explicit short-stay note and cheaper-repair question for 1-2 year horizons', () => {
    const res = calculateSecondOpinion({
      repairQuote: 1200,
      replacementQuote: 9000,
      systemAge: 11,
      refrigerant: 'r410a',
      stayYears: 2,
      futureAnnualRepairCost: 0,
      annualEnergySavings: 0,
    });
    expect(res.isShortStay).toBe(true);
    expect(res.contractorQuestions).toHaveLength(3);
    expect(res.stayHorizonNote).toContain('will not pay for itself in 1–2 years');
    expect(
      res.contractorQuestions.some((q) =>
        q.includes('cheaper repair that gets me through 2 years safely'),
      ),
    ).toBe(true);
  });

  it('returns Borderline instead of hard Replace for 1-year R-22 short stay when Check D favors repair and caps questions at 3', () => {
    const res = calculateSecondOpinion({
      repairQuote: 1450,
      replacementQuote: 9800,
      systemAge: 14,
      refrigerant: 'r22',
      stayYears: 1,
      futureAnnualRepairCost: 0,
      annualEnergySavings: 0,
    });
    expect(res.isShortStay).toBe(true);
    expect(res.verdict).toBe('borderline');
    expect(res.cheaperOption).toBe('repair');
    expect(res.differenceDollars).toBe(8350);
    expect(res.checks.find((c) => c.id === 'C')?.fired).toBe(true);
    expect(res.contractorQuestions).toHaveLength(3);
    expect(
      res.contractorQuestions.some((q) =>
        q.includes('cheaper repair that gets me through 1 year safely'),
      ),
    ).toBe(true);
  });

  it('always returns strictly 3 questions even when R-22, near-50%, and short-stay triggers all fire', () => {
    const res = calculateSecondOpinion({
      repairQuote: 4200,
      replacementQuote: 9800,
      systemAge: 14,
      refrigerant: 'r22',
      stayYears: 2,
      futureAnnualRepairCost: 0,
      annualEnergySavings: 0,
    });
    expect(res.contractorQuestions).toHaveLength(3);
  });

  it('surfaces an Age 0 sanity warning and warranty guidance when systemAge === 0', () => {
    const res = calculateSecondOpinion({
      repairQuote: 450,
      replacementQuote: 9500,
      systemAge: 0,
      refrigerant: 'r410a',
      stayYears: 5,
      futureAnnualRepairCost: 0,
      annualEnergySavings: 0,
    });
    expect(res.ageWarningNote).not.toBeNull();
    expect(res.ageWarningNote).toContain('under 1 year old');
    expect(res.checks.find((c) => c.id === 'A')?.arithmetic).toContain('age 0 zeroes out Check A');
    expect(res.verdict).toBe('repair');
    expect(res.verdictDetail).toContain('warranty');
  });

  it('computes age/SEER2 scenario estimates, names triggered checks in verdictHeadline, and surfaces end-of-stay horizon + estimate disclosure', () => {
    expect(getScenarioEstimates(3)).toMatchObject({ futureAnnualRepairCost: 0, annualEnergySavings: 0 });
    expect(getScenarioEstimates(8)).toMatchObject({ futureAnnualRepairCost: 150, annualEnergySavings: 0 });
    expect(getScenarioEstimates(12)).toMatchObject({ futureAnnualRepairCost: 350, annualEnergySavings: 80 });
    expect(getScenarioEstimates(14)).toMatchObject({ futureAnnualRepairCost: 550, annualEnergySavings: 80 });
    expect(getScenarioEstimates(16)).toMatchObject({ futureAnnualRepairCost: 550, annualEnergySavings: 170 });

    const borderlineRes = calculateSecondOpinion({
      repairQuote: 1200,
      replacementQuote: 8500,
      systemAge: 14,
      refrigerant: 'r410a',
      stayYears: 5,
      futureAnnualRepairCost: 0,
      annualEnergySavings: 0,
    });
    expect(borderlineRes.verdict).toBe('borderline');
    expect(borderlineRes.verdictHeadline).toBe('Borderline — Check A ($5,000 Rule) Triggered');
    expect(borderlineRes.horizonAgeNote).toContain('age 19');
    expect(borderlineRes.checkDEstimateNote).toBeNull();

    const estReplaceRes = calculateSecondOpinion({
      repairQuote: 1200,
      replacementQuote: 8500,
      systemAge: 14,
      refrigerant: 'r22',
      stayYears: 5,
      futureAnnualRepairCost: 550,
      annualEnergySavings: 80,
      usingEstimatedFutureRepair: true,
      usingEstimatedEnergySavings: true,
    });
    expect(estReplaceRes.verdict).toBe('replace');
    expect(estReplaceRes.verdictHeadline).toContain('Lean Replace —');
    expect(estReplaceRes.verdictHeadline).toContain('Check A ($5,000 Rule)');
    expect(estReplaceRes.verdictHeadline).toContain('Check C (R-22 Flag)');
    expect(estReplaceRes.checkDEstimateNote).toContain('Scenario estimates active');

    const clearRes = calculateSecondOpinion({
      repairQuote: 300,
      replacementQuote: 8500,
      systemAge: 8,
      refrigerant: 'r410a',
      stayYears: 5,
      futureAnnualRepairCost: 0,
      annualEnergySavings: 0,
    });
    expect(clearRes.verdict).toBe('repair');
    expect(clearRes.verdictHeadline).toBe('Lean Repair — All 4 Checks Clear');
  });

  it('round-trips share fragment cleanly without personal data', () => {
    const input = {
      repairQuote: 1450,
      replacementQuote: 9800,
      systemAge: 14,
      refrigerant: 'r22' as const,
      stayYears: 6,
      futureAnnualRepairCost: 300,
      annualEnergySavings: 200,
    };
    const frag = encodeShareFragment(input);
    expect(frag.startsWith('#')).toBe(true);
    expect(decodeShareFragment(frag)).toEqual(input);
  });
});

describe('Content, SEO, and design constraints on built dist/', () => {
  const distDir = path.resolve(process.cwd(), 'dist');

  it('ensures dist/ exists before running artifact assertions', () => {
    expect(fs.existsSync(path.join(distDir, 'index.html'))).toBe(true);
  });

  const guideSlugs = [
    'how-to-read-hvac-quote',
    '5000-rule',
    'r22-refrigerant',
    'seer2-explained',
    'how-to-vet-hvac-contractor',
    'signs-your-hvac-is-dying',
  ];

  for (const slug of guideSlugs) {
    it(`guide /guides/${slug}/ has 800-1200 words, one H1, and ~155 char meta description`, () => {
      const htmlPath = path.join(distDir, 'guides', slug, 'index.html');
      const html = fs.readFileSync(htmlPath, 'utf-8');

      const h1Matches = html.match(/<h1[\s>]/g) ?? [];
      expect(h1Matches).toHaveLength(1);

      const descMatch = html.match(/<meta\s+name="description"\s+content="([^"]+)"/i);
      expect(descMatch).not.toBeNull();
      const descLen = descMatch![1]!.length;
      expect(descLen).toBeGreaterThanOrEqual(130);
      expect(descLen).toBeLessThanOrEqual(165);

      const mainMatch = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
      expect(mainMatch).not.toBeNull();
      const textOnly = mainMatch![1]!
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&[a-z0-9#]+;/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      const wordCount = textOnly.split(' ').filter(Boolean).length;
      expect(wordCount).toBeGreaterThanOrEqual(850);
      expect(wordCount).toBeLessThanOrEqual(1200);
      expect(html).toContain('"@type":"FAQPage"');
      expect(html).toContain('Last updated:');
      expect(html).toContain('2026-11-24');

      const imgMatch = html.match(/<img[^>]+src="(\/images\/[^"]+\.svg)"/i);
      expect(imgMatch).not.toBeNull();
      const svgDiskPath = path.join(distDir, imgMatch![1]!.replace(/^\//, ''));
      expect(fs.existsSync(svgDiskPath)).toBe(true);
    });
  }

  it('homepage has one H1, FAQPage + WebApplication JSON-LD, 404 page, external sources, and verified pages', () => {
    const allPages = [
      'index.html',
      '404.html',
      'about/index.html',
      'privacy/index.html',
      'contact/index.html',
      'guides/index.html',
      ...guideSlugs.map((s) => `guides/${s}/index.html`),
    ];

    for (const rel of allPages) {
      const html = fs.readFileSync(path.join(distDir, rel), 'utf-8');
      expect(html.match(/<h1[\s>]/g) ?? []).toHaveLength(1);
      const descMatch = html.match(/<meta\s+name="description"\s+content="([^"]+)"/i);
      expect(descMatch).not.toBeNull();
      expect(descMatch![1]!.length).toBeGreaterThanOrEqual(130);
      expect(descMatch![1]!.length).toBeLessThanOrEqual(165);
    }

    const notFoundHtml = fs.readFileSync(path.join(distDir, '404.html'), 'utf-8');
    expect(notFoundHtml).toContain('<h1>404 — Page Not Found</h1>');

    const homeHtml = fs.readFileSync(path.join(distDir, 'index.html'), 'utf-8');
    expect(homeHtml).toContain('"@type":"WebApplication"');
    expect(homeHtml).toContain('"@type":"FAQPage"');
    expect(homeHtml).toContain('Repair or Replace? Enter Your Quote');
    expect(homeHtml).toContain('When to Replace vs Repair Your HVAC');
    expect(homeHtml).not.toContain('Homewyse');
    expect(homeHtml).toContain('/images/fig-01-decision-matrix.svg');
    expect(fs.existsSync(path.join(distDir, 'images/fig-01-decision-matrix.svg'))).toBe(true);

    const guidesHubHtml = fs.readFileSync(path.join(distDir, 'guides/index.html'), 'utf-8');
    expect((guidesHubHtml.match(/<h2[\s>]/g) ?? []).length).toBeGreaterThanOrEqual(6);
    const guidesHubMain = guidesHubHtml.match(/<main[^>]*>([\s\S]*?)<\/main>/i)![1]!
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&[a-z0-9#]+;/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    const guidesHubWords = guidesHubMain.split(' ').filter(Boolean).length;
    expect(guidesHubWords).toBeGreaterThanOrEqual(600);
    expect(guidesHubWords).toBeLessThanOrEqual(850);

    const contactHtml = fs.readFileSync(path.join(distDir, 'contact/index.html'), 'utf-8');
    expect(contactHtml).toContain('mailto:mayday0064@gmail.com');
    expect(contactHtml).toContain('3 business days');
    expect(contactHtml).toContain('deleted immediately');
    expect(contactHtml).not.toContain('<form');

    const aboutHtml = fs.readFileSync(path.join(distDir, 'about/index.html'), 'utf-8');
    expect(aboutHtml).toContain('Primary Sources');
    for (const domain of ['ecfr.gov', 'epa.gov', 'energystar.gov', 'dsireusa.org', 'irs.gov']) {
      expect(aboutHtml).toContain(domain);
    }

    const privacyHtml = fs.readFileSync(path.join(distDir, 'privacy/index.html'), 'utf-8');
    expect(privacyHtml).toContain('Effective Date:');

    const combinedDistHtml = allPages
      .map((rel) => fs.readFileSync(path.join(distDir, rel), 'utf-8'))
      .join('\n');
    for (const domain of ['ecfr.gov', 'epa.gov', 'energystar.gov', 'dsireusa.org', 'irs.gov']) {
      expect(combinedDistHtml).toContain(domain);
    }
  });

  it('built CSS obeys zero border-radius, zero box-shadow, and zero gradients', () => {
    const astroDir = path.join(distDir, '_astro');
    const cssFiles = fs.readdirSync(astroDir).filter((f: string) => f.endsWith('.css'));
    expect(cssFiles.length).toBeGreaterThan(0);
    for (const file of cssFiles) {
      const css = fs.readFileSync(path.join(astroDir, file), 'utf-8');
      expect(css).not.toContain('box-shadow:');
      const nonZeroShadow = /box-shadow\s*:\s*(?!none\b)/i.test(css);
      expect(nonZeroShadow).toBe(false);
      expect(css).not.toMatch(/linear-gradient|radial-gradient/i);
      const nonZeroRadius = /border-radius\s*:\s*(?!0\b)/i.test(css);
      expect(nonZeroRadius).toBe(false);
    }
  });
});
