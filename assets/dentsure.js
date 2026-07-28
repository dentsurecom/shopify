/* ==========================================================================
   DentSure — theme behaviour
   Everything is a custom element so sections re-initialise themselves when the
   theme editor re-renders them, with no shopify:section:load plumbing.
   ========================================================================== */

(function () {
  'use strict';

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* --------------------------------------------------------------------
     Header — measures its own height (the hero uses it to continue the
     decorative ring across the seam), mega menu, and the mobile drawer.
     -------------------------------------------------------------------- */

  class DsHeader extends HTMLElement {
    connectedCallback() {
      this.measure = this.measure.bind(this);
      this.measure();
      window.addEventListener('resize', this.measure);

      this.setupMega();
      this.setupDrawer();
    }

    disconnectedCallback() {
      window.removeEventListener('resize', this.measure);
      if (this._closeTimer) clearTimeout(this._closeTimer);
    }

    measure() {
      var h = this.offsetHeight;
      if (h) document.documentElement.style.setProperty('--ds-header-h', h + 'px');
    }

    setupMega() {
      var item = this.querySelector('[data-mega-item]');
      if (!item) return;
      var trigger = item.querySelector('[data-mega-trigger]');
      var self = this;

      var open = function () {
        clearTimeout(self._closeTimer);
        item.classList.add('is-open');
        if (trigger) trigger.setAttribute('aria-expanded', 'true');
      };
      var close = function (delay) {
        clearTimeout(self._closeTimer);
        self._closeTimer = setTimeout(function () {
          item.classList.remove('is-open');
          if (trigger) trigger.setAttribute('aria-expanded', 'false');
        }, delay || 0);
      };

      item.addEventListener('mouseenter', open);
      item.addEventListener('mouseleave', function () { close(180); });
      item.addEventListener('focusin', open);
      item.addEventListener('focusout', function (e) {
        if (!item.contains(e.relatedTarget)) close(0);
      });

      if (trigger) {
        trigger.addEventListener('click', function (e) {
          e.preventDefault();
          if (item.classList.contains('is-open')) close(0); else open();
        });
      }

      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') close(0);
      });
    }

    setupDrawer() {
      var toggle = this.querySelector('[data-drawer-open]');
      var drawer = this.querySelector('[data-drawer]');
      var overlay = this.querySelector('[data-drawer-overlay]');
      var closeBtn = this.querySelector('[data-drawer-close]');
      if (!toggle || !drawer) return;

      var setOpen = function (open) {
        drawer.classList.toggle('is-open', open);
        if (overlay) overlay.classList.toggle('is-open', open);
        toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
        document.body.style.overflow = open ? 'hidden' : '';
        if (open) {
          var first = drawer.querySelector('a, button');
          if (first) first.focus();
        }
      };

      toggle.addEventListener('click', function () {
        setOpen(!drawer.classList.contains('is-open'));
      });
      if (closeBtn) closeBtn.addEventListener('click', function () { setOpen(false); toggle.focus(); });
      if (overlay) overlay.addEventListener('click', function () { setOpen(false); });
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && drawer.classList.contains('is-open')) setOpen(false);
      });
    }
  }

  /* --------------------------------------------------------------------
     Scanner showcase — hotspots auto-tour every few seconds; clicking a dot
     or a callout jumps there and stops the tour.
     -------------------------------------------------------------------- */

  class DsScanner extends HTMLElement {
    connectedCallback() {
      this.features = Array.prototype.slice.call(this.querySelectorAll('[data-feature]'));
      this.hotspots = Array.prototype.slice.call(this.querySelectorAll('[data-hotspot]'));
      if (!this.features.length) return;

      this.index = 0;
      this.auto = this.getAttribute('data-autoplay') !== 'false' && !reduceMotion;
      this.interval = parseInt(this.getAttribute('data-interval'), 10) || 3500;

      var self = this;
      var pick = function (i) {
        self.select(i);
        self.stop();
      };

      this.features.concat(this.hotspots).forEach(function (el) {
        el.addEventListener('click', function () {
          pick(parseInt(el.getAttribute('data-index'), 10) || 0);
        });
      });

      this.select(0);
      if (this.auto) this.start();
    }

    disconnectedCallback() { this.stop(); }

    select(i) {
      this.index = i;
      this.features.forEach(function (el, n) {
        el.classList.toggle('is-active', n === i);
      });
      this.hotspots.forEach(function (el, n) {
        el.classList.toggle('is-active', n === i);
        el.setAttribute('aria-pressed', n === i ? 'true' : 'false');
      });
    }

    start() {
      var self = this;
      this.stop();
      this._timer = setInterval(function () {
        self.select((self.index + 1) % self.features.length);
      }, this.interval);
    }

    stop() { if (this._timer) clearInterval(this._timer); }
  }

  /* --------------------------------------------------------------------
     Stat counters — count up (or down) once the row scrolls into view.
     -------------------------------------------------------------------- */

  class DsCounter extends HTMLElement {
    connectedCallback() {
      this.items = Array.prototype.slice.call(this.querySelectorAll('[data-count-to]'));
      if (!this.items.length) return;

      if (reduceMotion || !('IntersectionObserver' in window)) {
        this.paint(1);
        return;
      }

      this.paint(0);
      var self = this;
      this._io = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting || self._done) return;
          self._done = true;
          self.run();
          self._io.disconnect();
        });
      }, { threshold: 0.4 });
      this._io.observe(this);
    }

    disconnectedCallback() { if (this._io) this._io.disconnect(); }

    run() {
      var self = this;
      var start = performance.now();
      var duration = 1400;
      var tick = function (now) {
        var x = Math.min(1, (now - start) / duration);
        self.paint(1 - Math.pow(1 - x, 3));
        if (x < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }

    paint(progress) {
      this.items.forEach(function (el) {
        var to = parseFloat(el.getAttribute('data-count-to'));
        var decimals = parseInt(el.getAttribute('data-count-decimals'), 10) || 0;
        var prefix = el.getAttribute('data-count-prefix') || '';
        var suffix = el.getAttribute('data-count-suffix') || '';
        var down = el.getAttribute('data-count-direction') === 'down';
        var value = down ? to * (1 - progress) : to * progress;
        var text = decimals ? value.toFixed(decimals) : String(Math.round(value));
        el.textContent = prefix + text + suffix;
      });
    }
  }

  /* --------------------------------------------------------------------
     Testimonial rail — arrows plus a slow auto-advance.
     -------------------------------------------------------------------- */

  class DsRail extends HTMLElement {
    connectedCallback() {
      this.track = this.querySelector('[data-rail-track]');
      this.cards = Array.prototype.slice.call(this.querySelectorAll('[data-rail-card]'));
      if (!this.track || !this.cards.length) return;

      this.index = 0;
      this.interval = parseInt(this.getAttribute('data-interval'), 10) || 6000;

      var self = this;
      var prev = this.querySelector('[data-rail-prev]');
      var next = this.querySelector('[data-rail-next]');
      if (prev) prev.addEventListener('click', function () { self.go(self.index - 1, true); });
      if (next) next.addEventListener('click', function () { self.go(self.index + 1, true); });

      this.resize = this.resize.bind(this);
      window.addEventListener('resize', this.resize);
      this.resize();

      if (!reduceMotion) this.start(this.interval);
    }

    disconnectedCallback() {
      window.removeEventListener('resize', this.resize);
      this.stop();
    }

    /* The rail peeks off the right edge, so the last position is the one that
       still fills the viewport rather than the final card. */
    maxIndex() {
      var viewport = this.querySelector('[data-rail-viewport]');
      if (!viewport) return this.cards.length - 1;
      var visible = Math.max(1, Math.floor(viewport.offsetWidth / this.step()));
      return Math.max(0, this.cards.length - visible);
    }

    step() {
      var card = this.cards[0];
      var gap = parseFloat(getComputedStyle(this.track).columnGap || '24') || 24;
      return card.offsetWidth + gap;
    }

    resize() { this.go(Math.min(this.index, this.maxIndex()), false); }

    go(i, manual) {
      var max = this.maxIndex();
      if (i > max) i = 0;
      if (i < 0) i = max;
      this.index = i;
      this.track.style.transform = 'translateX(' + -(i * this.step()) + 'px)';
      if (manual) this.start(this.interval * 2);
    }

    start(ms) {
      var self = this;
      this.stop();
      this._timer = setInterval(function () { self.go(self.index + 1, false); }, ms);
    }

    stop() { if (this._timer) clearInterval(this._timer); }
  }

  /* --------------------------------------------------------------------
     Feature steps — hover to highlight, auto-cycling otherwise.
     -------------------------------------------------------------------- */

  class DsSteps extends HTMLElement {
    connectedCallback() {
      this.steps = Array.prototype.slice.call(this.querySelectorAll('[data-step]'));
      if (!this.steps.length) return;

      this.index = 0;
      this.interval = parseInt(this.getAttribute('data-interval'), 10) || 3000;
      this.auto = this.getAttribute('data-autoplay') !== 'false' && !reduceMotion;

      var self = this;
      this.steps.forEach(function (el, i) {
        var focus = function () {
          self.select(i);
          if (self.auto) self.start(self.interval * 2);
        };
        el.addEventListener('mouseenter', focus);
        el.addEventListener('focus', focus);
        el.addEventListener('click', focus);
      });

      this.select(0);
      if (this.auto) this.start(this.interval);
    }

    disconnectedCallback() { this.stop(); }

    select(i) {
      this.index = i;
      this.steps.forEach(function (el, n) { el.classList.toggle('is-active', n === i); });
    }

    start(ms) {
      var self = this;
      this.stop();
      this._timer = setInterval(function () {
        self.select((self.index + 1) % self.steps.length);
      }, ms);
    }

    stop() { if (this._timer) clearInterval(this._timer); }
  }

  /* --------------------------------------------------------------------
     Scroll reveal
     -------------------------------------------------------------------- */

  function initReveal(scope) {
    var targets = (scope || document).querySelectorAll('.ds-reveal:not(.is-visible)');
    if (!targets.length) return;

    if (reduceMotion || !('IntersectionObserver' in window)) {
      Array.prototype.forEach.call(targets, function (el) { el.classList.add('is-visible'); });
      return;
    }

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        io.unobserve(entry.target);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

    Array.prototype.forEach.call(targets, function (el) { io.observe(el); });
  }

  /* --------------------------------------------------------------------
     Autoplaying background video — iOS needs muted set in JS as well.
     -------------------------------------------------------------------- */

  function initVideos(scope) {
    var videos = (scope || document).querySelectorAll('video[data-autoplay]');
    Array.prototype.forEach.call(videos, function (video) {
      video.muted = true;
      var played = video.play();
      if (played && played.catch) played.catch(function () {});
    });
  }

  /* --------------------------------------------------------------------
     Boot
     -------------------------------------------------------------------- */

  function define(name, ctor) {
    if (!customElements.get(name)) customElements.define(name, ctor);
  }

  define('ds-header', DsHeader);
  define('ds-scanner', DsScanner);
  define('ds-counter', DsCounter);
  define('ds-rail', DsRail);
  define('ds-steps', DsSteps);

  function boot(scope) {
    initReveal(scope);
    initVideos(scope);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { boot(document); });
  } else {
    boot(document);
  }

  document.addEventListener('shopify:section:load', function (event) { boot(event.target); });
})();
