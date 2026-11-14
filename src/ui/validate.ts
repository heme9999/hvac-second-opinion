export function parseWholeDollarInput(raw: string): number | null {
  const cleaned = raw.replace(/[$,\s]/g, '');
  if (!cleaned) return null;
  const num = Number(cleaned);
  if (!Number.isFinite(num) || num < 0) return null;
  return Math.round(num);
}

/**
 * Sets up post-interaction validation following modern-web-guidance:
 * - Initializes fields with aria-invalid="false"
 * - Defers visual and ARIA error reporting until blur / submit
 * - Clears errors on input as soon as the field becomes valid
 * - Uses a single polite live region for error announcements
 */
export function initFormValidation(form: HTMLFormElement): () => boolean {
  const announcer = document.createElement('div');
  announcer.setAttribute('aria-live', 'polite');
  announcer.className = 'visually-hidden';
  document.body.append(announcer);

  let announceTimer: ReturnType<typeof setTimeout> | undefined;
  let announcedField: Element | null = null;
  const dirtyState = new WeakMap<Element, { interacted: boolean; blurred: boolean }>();

  const linkError = (el: HTMLElement, shown: boolean): void => {
    const errorId = el.dataset.error;
    if (!errorId) return;
    const current = (el.getAttribute('aria-describedby') || '')
      .split(/\s+/)
      .filter((id) => id && id !== errorId);
    if (shown) current.push(errorId);
    if (current.length > 0) el.setAttribute('aria-describedby', current.join(' '));
    else el.removeAttribute('aria-describedby');
  };

  const checkFieldValid = (el: HTMLInputElement): boolean => {
    if (el.dataset.wholeDollar !== undefined) {
      const val = el.value.trim();
      if (!val) return !el.required;
      const parsed = parseWholeDollarInput(val);
      if (parsed === null) return false;
      const min = el.dataset.min ? Number(el.dataset.min) : 0;
      const max = el.dataset.max ? Number(el.dataset.max) : Infinity;
      return parsed >= min && parsed <= max;
    }
    return el.validity.valid;
  };

  const syncField = (el: HTMLInputElement, shouldAnnounce = false, forceShow = false): boolean => {
    const valid = checkFieldValid(el);
    const state = dirtyState.get(el) || { interacted: false, blurred: false };
    const shouldReveal = forceShow || state.blurred;

    if (!valid && shouldReveal) {
      el.classList.add('user-invalid-fallback');
      el.setAttribute('aria-invalid', 'true');
      linkError(el, true);
      if (shouldAnnounce && el.dataset.error) {
        const errEl = document.getElementById(el.dataset.error);
        const labelText = el.labels?.[0]?.textContent?.trim() || 'Field';
        if (errEl) {
          clearTimeout(announceTimer);
          announcer.textContent = '';
          announcedField = el;
          announceTimer = setTimeout(() => {
            announcer.textContent = `${labelText}: ${errEl.textContent?.trim() || 'Invalid entry'}`;
          }, 400);
        }
      }
    } else {
      el.classList.remove('user-invalid-fallback');
      el.setAttribute('aria-invalid', 'false');
      linkError(el, false);
      if (announcedField === el) {
        clearTimeout(announceTimer);
        announcer.textContent = '';
      }
    }
    return valid;
  };

  const inputs = Array.from(form.querySelectorAll<HTMLInputElement>('input[type="text"], input[type="number"]'));
  for (const input of inputs) {
    input.setAttribute('aria-invalid', 'false');
  }

  form.addEventListener(
    'blur',
    (e) => {
      const target = e.target;
      if (!(target instanceof HTMLInputElement) || target.type === 'radio') return;
      const state = dirtyState.get(target) || { interacted: false, blurred: false };
      state.blurred = true;
      dirtyState.set(target, state);
      if (state.interacted) {
        syncField(target, true, true);
      }
    },
    true,
  );

  form.addEventListener('input', (e) => {
    const target = e.target;
    if (!(target instanceof HTMLInputElement) || target.type === 'radio') return;
    const state = dirtyState.get(target) || { interacted: false, blurred: false };
    state.interacted = true;
    dirtyState.set(target, state);
    if (state.blurred) {
      syncField(target, false, true);
    }
  });

  return () => {
    let firstInvalid: HTMLInputElement | null = null;
    for (const input of inputs) {
      dirtyState.set(input, { interacted: true, blurred: true });
      const ok = syncField(input, false, true);
      if (!ok && !firstInvalid) {
        firstInvalid = input;
      }
    }
    if (firstInvalid) {
      firstInvalid.focus();
      return false;
    }
    return true;
  };
}
