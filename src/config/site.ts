export const SITE = {
  name: 'HVAC Second Opinion',
  shortName: 'HVAC Second Opinion',
  url: 'https://hvac-second-opinion.pages.dev',
  email: 'peter@hvacsecondopinion.org',
  author: 'Peter',
  lastUpdated: '2026-11-14',
  googleSiteVerification: 'wMz2VDeMwD8R6yiCgJIqFD_wM2wSzrSEauzvCtzKHyw',
  disclaimer:
    'Estimates only, not a professional diagnosis. Gas, electrical and carbon-monoxide safety decisions need a licensed pro. Prices vary by region and install complexity.',
} as const;

export interface GuideLink {
  readonly href: string;
  readonly slug: string;
  readonly title: string;
  readonly shortTitle: string;
  readonly summary: string;
  readonly badge: string;
}

export const GUIDES: readonly GuideLink[] = [
  {
    href: '/guides/how-to-read-hvac-quote/',
    slug: 'how-to-read-hvac-quote',
    title: 'How to Read an HVAC Quote: Line Items, Missing Scope, and Red Flags',
    shortTitle: 'How to Read an HVAC Quote',
    summary:
      'Audit permits, EPA 608 refrigerant recovery, line-set sizing, thermostat wiring, and plenum transitions before you sign.',
    badge: 'GUIDE 01',
  },
  {
    href: '/guides/5000-rule/',
    slug: '5000-rule',
    title: 'The $5,000 Rule and 50% Rule Explained: Where Rules of Thumb Break',
    shortTitle: 'The $5,000 Rule & 50% Rule',
    summary:
      'Why age × repair and the 50% replacement ratio work only as quick screening checks—and when holding-cost math overrides both.',
    badge: 'GUIDE 02',
  },
  {
    href: '/guides/r22-refrigerant/',
    slug: 'r22-refrigerant',
    title: 'R-22 Refrigerant Phase-Out: What It Means for Older AC Systems',
    shortTitle: 'R-22 Phase-Out & Refrigerants',
    summary:
      'EPA banned R-22 production and import on Jan 1, 2020. Learn how reclaimed supply, AIM Act R-410A phasedowns, and R-454B / R-32 change repair math.',
    badge: 'GUIDE 03',
  },
  {
    href: '/guides/seer2-explained/',
    slug: 'seer2-explained',
    title: 'SEER2 Explained: DOE Minimums, Real Bill Savings, and 2026 Rebates',
    shortTitle: 'SEER2 Efficiency & Savings',
    summary:
      'Official DOE 10 CFR 430.32 regional minimums, ENERGY STAR heat pump thresholds, SEER vs. SEER2 math, and why expired 25C credits push focus to DSIRE.',
    badge: 'GUIDE 04',
  },
  {
    href: '/guides/how-to-vet-hvac-contractor/',
    slug: 'how-to-vet-hvac-contractor',
    title: 'How to Vet an HVAC Contractor: Licenses, Manual J, and Written Bids',
    shortTitle: 'How to Vet a Contractor',
    summary:
      'Verify state licensing, demand an ACCA Manual J load calculation instead of square-foot guesswork, and compare parts vs. labor warranties.',
    badge: 'GUIDE 05',
  },
  {
    href: '/guides/signs-your-hvac-is-dying/',
    slug: 'signs-your-hvac-is-dying',
    title: 'Signs Your HVAC System Is Dying vs. Worth One More Repair',
    shortTitle: 'Signs Your HVAC Is Dying',
    summary:
      'Separate immediate safety shutdowns and failed compressors from inexpensive wear items like capacitors, contactors, and condensate switches.',
    badge: 'GUIDE 06',
  },
] as const;

export const NAV_LINKS = [
  { href: '/', label: 'Calculator' },
  { href: '/guides/', label: 'Field Guides' },
  { href: '/about/', label: 'About' },
  { href: '/privacy/', label: 'Privacy' },
  { href: '/contact/', label: 'Contact' },
] as const;
