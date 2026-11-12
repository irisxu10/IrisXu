// Participant-facing interface: language, progressive hints, info panel,
// optional reflection. Contains no simulation logic.

import { t, translations } from './translations.js';

const HINT_FIRST_DELAY = 900;
const TOUCH_HINT_DELAY = 2500;
const WAIT_HINT_STILL = 2000;
const HINT_MAX_AGE = { approach: Infinity, touch: 8000, wait: 6000 };

export class ExhibitionUI {
  constructor({ lang = 'en', onLangChange, onReset, onFinish, onReflection, onOpenResearcher, onSound, onCondition }) {
    this.lang = lang;
    this.sound = 'off';
    this.cb = { onLangChange, onReset, onFinish, onReflection, onOpenResearcher, onSound, onCondition };
    this.condButtons = [...document.querySelectorAll('#conditionNav [data-condition]')];
    this.$ = (id) => document.getElementById(id);
    this.hintEl = this.$('hint');
    this.info = this.$('info');
    this.reflection = this.$('reflection');
    this.lastFocus = null;
    this.buildQuestions();
    this.bind();
    this.resetHints();
    this.applyLanguage();
  }

  bind() {
    this.$('langBtn').addEventListener('click', () => {
      this.lang = this.lang === 'en' ? 'zh' : 'en';
      this.applyLanguage();
      this.cb.onLangChange?.(this.lang);
    });
    this.$('soundBtn').addEventListener('click', () => this.cb.onSound?.());
    for (const b of this.condButtons) b.addEventListener('click', () => { if (!b.disabled) this.cb.onCondition?.(b.dataset.condition); });
    this.$('infoBtn').addEventListener('click', () => this.togglePanel(this.info, this.$('infoBtn')));
    this.$('infoClose').addEventListener('click', () => this.closePanel(this.info));
    this.$('openResearcher').addEventListener('click', () => { this.closePanel(this.info); this.cb.onOpenResearcher?.(); });
    this.$('resetBtn').addEventListener('click', () => { this.closePanel(this.reflection); this.cb.onReset?.(); });
    this.$('finishBtn').addEventListener('click', () => this.openReflection());
    this.$('reflectSkip').addEventListener('click', () => this.submitReflection(null));
    this.$('reflectForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const answers = {};
      this.reflection.querySelectorAll('textarea').forEach((ta, i) => { answers['q' + (i + 1)] = ta.value.trim(); });
      this.submitReflection(answers);
    });
    this.$('reflectContinue').addEventListener('click', () => this.closePanel(this.reflection));
  }

  buildQuestions() {
    const wrap = this.$('questions');
    const n = translations.en.questions.length;
    for (let i = 0; i < n; i++) {
      const id = 'q' + (i + 1);
      const label = document.createElement('label');
      label.htmlFor = id;
      label.dataset.i18n = `questions.${i}`;
      const ta = document.createElement('textarea');
      ta.id = id; ta.rows = 2;
      wrap.append(label, ta);
    }
  }

  applyLanguage() {
    const L = this.lang;
    document.documentElement.lang = L === 'zh' ? 'zh-CN' : 'en';
    document.title = t(L, 'docTitle');
    document.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(L, el.dataset.i18n); });
    document.querySelectorAll('[data-i18n-aria]').forEach((el) => { el.setAttribute('aria-label', t(L, el.dataset.i18nAria)); });
    this.$('langEn').classList.toggle('on', L === 'en');
    this.$('langZh').classList.toggle('on', L === 'zh');
    this.$('langBtn').setAttribute('aria-label', L === 'en' ? '切换到中文' : 'Switch to English');
    if (this.hint) this.hintEl.textContent = t(L, 'hints.' + this.hint);
    for (const b of this.condButtons) b.setAttribute('aria-label', `${t(L, 'conditionLabel')} ${b.dataset.condition}`);
    this.renderSound();
  }

  /** Participant selector: only ids are shown; `allowed` (Set) disables the rest when the order is locked. */
  setConditions(activeId, allowed) {
    for (const b of this.condButtons) {
      const id = b.dataset.condition;
      b.setAttribute('aria-pressed', String(id === activeId));
      b.disabled = !!allowed && !allowed.has(id);
    }
  }

  /** state: 'on' | 'off' | 'unavailable' */
  setSound(state) { this.sound = state; this.renderSound(); }

  renderSound() {
    const btn = this.$('soundBtn');
    const key = this.sound === 'on' ? 'soundOn' : this.sound === 'unavailable' ? 'soundUnavailable' : 'soundOff';
    btn.textContent = t(this.lang, key);
    btn.setAttribute('aria-pressed', String(this.sound === 'on'));
    btn.disabled = this.sound === 'unavailable';
  }

  // ---------- hints ----------
  resetHints() {
    this.hint = null; this.hintAge = 0; this.elapsed = 0;
    this.seen = { approach: false, touch: false, wait: false };
    this.approachedAt = null;
    this.hintEl.classList.remove('visible');
  }

  showHint(key) {
    this.hint = key; this.hintAge = 0; this.seen[key] = true;
    this.hintEl.textContent = t(this.lang, 'hints.' + key);
    this.hintEl.classList.add('visible');
  }

  hideHint() { this.hint = null; this.hintEl.classList.remove('visible'); }

  update(sim, dtMs) {
    this.elapsed += dtMs;
    const tot = sim.totals, near = sim.proximity > 0.3;
    if (near && this.approachedAt === null) { this.approachedAt = this.elapsed; this.seen.approach = true; }
    if (this.hint) {
      this.hintAge += dtMs;
      const done = (this.hint === 'approach' && near)
        || (this.hint === 'touch' && tot.contactEpisodes > 0)
        || this.hintAge > HINT_MAX_AGE[this.hint];
      if (done) this.hideHint();
      return;
    }
    if (!this.seen.approach && this.elapsed > HINT_FIRST_DELAY && tot.contactEpisodes === 0) this.showHint('approach');
    else if (!this.seen.touch && this.approachedAt !== null && tot.contactEpisodes === 0 && this.elapsed - this.approachedAt > TOUCH_HINT_DELAY) this.showHint('touch');
    else if (!this.seen.wait && tot.contactEpisodes >= 3 && !sim.grab && sim.stillMs > WAIT_HINT_STILL) this.showHint('wait');
  }

  // ---------- panels ----------
  anyPanelOpen() { return !this.info.hidden || !this.reflection.hidden; }

  togglePanel(panel, opener) { if (panel.hidden) this.openPanel(panel, opener); else this.closePanel(panel); }

  openPanel(panel, opener = document.activeElement) {
    this.lastFocus = opener;
    panel.hidden = false;
    if (panel === this.info) this.$('infoBtn').setAttribute('aria-expanded', 'true');
    requestAnimationFrame(() => panel.classList.add('open'));
    panel.querySelector('button, textarea, [tabindex]')?.focus();
  }

  closePanel(panel) {
    if (panel.hidden) return;
    panel.classList.remove('open');
    panel.hidden = true;
    if (panel === this.info) this.$('infoBtn').setAttribute('aria-expanded', 'false');
    this.lastFocus?.focus?.();
  }

  closeAll() { this.closePanel(this.info); this.closePanel(this.reflection); }

  openReflection() {
    this.closePanel(this.info);
    this.$('reflectForm').hidden = false;
    this.$('reflectThanks').hidden = true;
    this.cb.onFinish?.();
    this.openPanel(this.reflection, this.$('finishBtn'));
  }

  submitReflection(answers) {
    this.cb.onReflection?.(answers);
    this.$('reflectForm').hidden = true;
    this.$('reflectThanks').hidden = false;
    this.$('reflectContinue').focus();
  }

  clearReflection() { this.reflection.querySelectorAll('textarea').forEach((ta) => { ta.value = ''; }); }
}
