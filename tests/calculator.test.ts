import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { calculateSecondOpinion } from '../src/engine/calculate';
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
    expect(res.stayHorizonNote).toContain('will not pay for itself in 1–2 years');
    expect(
      res.contractorQuestions.some((q) =>
        q.includes('cheaper repair that gets me through 2 years safely'),
      ),
    ).toBe(true);
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
      expect(wordCount).toBeGreaterThanOrEqual(800);
      expect(wordCount).toBeLessThanOrEqual(1200);
    });
  }

  it('homepage has one H1, FAQPage + WebApplication JSON-LD, and verified pages', () => {
    const allPages = [
      'index.html',
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

    const homeHtml = fs.readFileSync(path.join(distDir, 'index.html'), 'utf-8');
    expect(homeHtml).toContain('"@type":"WebApplication"');
    expect(homeHtml).toContain('"@type":"FAQPage"');
    expect(homeHtml).not.toContain('Homewyse');

    const contactHtml = fs.readFileSync(path.join(distDir, 'contact/index.html'), 'utf-8');
    expect(contactHtml).toContain('mailto:');
    expect(contactHtml).not.toContain('<form');
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
