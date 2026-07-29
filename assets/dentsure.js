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
        // Focus the panel itself, not its first link — focusing the logo made
        // browsers (sometimes) draw the focus ring and slide out the wordmark.
        if (open) drawer.focus();
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
      this.setupTurn();
    }

    disconnectedCallback() {
      this.stop();
      if (this._stopTurn) this._stopTurn();
    }

    /* Scroll-linked turn — the stage (image, disc, and hotspots as one plane)
       swings around the y-axis as the section crosses the viewport, so the
       scanner appears to slowly turn while you scroll. Progress is measured
       on the untransformed element to keep the mapping stable. */
    setupTurn() {
      if (reduceMotion) return;
      var stage = this.querySelector('.ds-scanner__stage');
      if (!stage) return;

      var self = this;
      var ticking = false;

      var paint = function () {
        ticking = false;
        var rect = self.getBoundingClientRect();
        var vh = window.innerHeight || document.documentElement.clientHeight;
        if (rect.bottom < 0 || rect.top > vh) return;
        var p = (vh - rect.top) / (vh + rect.height);
        p = Math.max(0, Math.min(1, p));
        var swing = p - 0.5; // -0.5 entering the viewport, 0 centred, 0.5 leaving
        stage.style.transform =
          'perspective(1100px) rotateY(' + swing * 28 + 'deg) rotate(' + swing * 8 + 'deg)';
      };

      var onScroll = function () {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(paint);
      };

      window.addEventListener('scroll', onScroll, { passive: true });
      window.addEventListener('resize', onScroll);
      this._stopTurn = function () {
        window.removeEventListener('scroll', onScroll);
        window.removeEventListener('resize', onScroll);
      };
      paint();
    }

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
     Testimonial rail — arrows and swipe/drag; it only moves when asked.
     -------------------------------------------------------------------- */

  class DsRail extends HTMLElement {
    connectedCallback() {
      this.track = this.querySelector('[data-rail-track]');
      this.cards = Array.prototype.slice.call(this.querySelectorAll('[data-rail-card]'));
      if (!this.track || !this.cards.length) return;

      this.index = 0;

      var self = this;
      var prev = this.querySelector('[data-rail-prev]');
      var next = this.querySelector('[data-rail-next]');
      if (prev) prev.addEventListener('click', function () { self.go(self.index - 1); });
      if (next) next.addEventListener('click', function () { self.go(self.index + 1); });

      this.setupDrag();

      this.resize = this.resize.bind(this);
      window.addEventListener('resize', this.resize);
      this.resize();
    }

    /* Pointer dragging — the rail can be swiped on touch screens and pulled
       with the mouse. The threshold separates drags from taps, and a real
       drag swallows the card link's click so letting go doesn't navigate. */
    setupDrag() {
      var viewport = this.querySelector('[data-rail-viewport]');
      if (!viewport || !window.PointerEvent) return;

      var self = this;
      var pointerId = null;
      var startX = 0;
      var startOffset = 0;
      var offset = 0;
      var moved = false;

      var offsetFor = function (i) { return -(i * self.step()); };

      // The cards are links full of images, both natively draggable: without
      // this, a mouse drag starts the browser's link-drag ghost and cancels
      // the pointer stream before the swipe ever begins.
      viewport.addEventListener('dragstart', function (e) { e.preventDefault(); });

      viewport.addEventListener('pointerdown', function (e) {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        pointerId = e.pointerId;
        startX = e.clientX;
        startOffset = offsetFor(self.index);
        moved = false;
      });

      viewport.addEventListener('pointermove', function (e) {
        if (e.pointerId !== pointerId) return;
        var dx = e.clientX - startX;
        if (!moved) {
          if (Math.abs(dx) < 6) return;
          moved = true;
          viewport.setPointerCapture(pointerId);
          self.track.style.transition = 'none';
        }
        offset = startOffset + dx;
        var min = offsetFor(self.maxIndex());
        // Pulling past either end drags at a third speed instead of stopping.
        if (offset > 0) offset = offset / 3;
        else if (offset < min) offset = min + (offset - min) / 3;
        self.track.style.transform = 'translateX(' + offset + 'px)';
      });

      var release = function (e) {
        if (e.pointerId !== pointerId) return;
        pointerId = null;
        if (!moved) return;
        self.track.style.transition = '';
        var nearest = Math.round(-offset / self.step());
        // A short flick that doesn't reach the halfway point still advances.
        var dx = e.clientX - startX;
        if (nearest === self.index && Math.abs(dx) > 40) nearest += dx < 0 ? 1 : -1;
        self.go(Math.max(0, Math.min(self.maxIndex(), nearest)));
      };
      viewport.addEventListener('pointerup', release);
      viewport.addEventListener('pointercancel', release);

      viewport.addEventListener('click', function (e) {
        if (!moved) return;
        e.preventDefault();
        e.stopPropagation();
        moved = false;
      }, true);
    }

    disconnectedCallback() {
      window.removeEventListener('resize', this.resize);
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

    resize() { this.go(Math.min(this.index, this.maxIndex())); }

    go(i) {
      var max = this.maxIndex();
      if (i > max) i = 0;
      if (i < 0) i = max;
      this.index = i;
      this.track.style.transform = 'translateX(' + -(i * this.step()) + 'px)';
      // Touch layouts have no hover, so the CSS enlarges the current card via
      // this class instead.
      this.cards.forEach(function (card, n) {
        card.classList.toggle('is-active', n === i);
      });
    }
  }

  /* --------------------------------------------------------------------
     Feature steps — hover to highlight, auto-cycling otherwise.
     -------------------------------------------------------------------- */

  class DsSteps extends HTMLElement {
    connectedCallback() {
      this.steps = Array.prototype.slice.call(this.querySelectorAll('[data-step]'));
      if (!this.steps.length) return;

      // Media frames live in the sibling panel; steps without their own
      // frame fall back to the base image.
      var panel = this.closest('.ds-mediatext');
      this.frames = panel
        ? Array.prototype.slice.call(panel.querySelectorAll('[data-step-media]'))
        : [];

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

      // On phones the steps become a swipe row: the snapped card drives the
      // selection (and the media crossfade), so the timer stays out of it —
      // auto-cycling would highlight an off-screen card.
      if (window.matchMedia('(max-width: 749px)').matches) {
        this.auto = false;
        if ('IntersectionObserver' in window) {
          this._io = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
              if (!entry.isIntersecting) return;
              var idx = self.steps.indexOf(entry.target);
              if (idx > -1) self.select(idx);
            });
          }, { root: this, threshold: 0.65 });
          this.steps.forEach(function (el) { self._io.observe(el); });
        }
      }

      this.select(0);
      if (this.auto) this.start(this.interval);
    }

    disconnectedCallback() {
      this.stop();
      if (this._io) this._io.disconnect();
    }

    select(i) {
      this.index = i;
      this.steps.forEach(function (el, n) { el.classList.toggle('is-active', n === i); });

      if (this.frames.length > 1) {
        var key = String(i);
        var matched = false;
        this.frames.forEach(function (frame) {
          var match = frame.getAttribute('data-step-media') === key;
          if (match) matched = true;
          frame.classList.toggle('is-active', match);
        });
        if (!matched) {
          this.frames.forEach(function (frame) {
            if (frame.getAttribute('data-step-media') === 'base') frame.classList.add('is-active');
          });
        }
      }
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
     Snap carousels — the phone layout turns these lists into scroll-snap
     rows; mark the card snapped into view so CSS can enlarge it (the
     touch counterpart of the desktop hover).
     -------------------------------------------------------------------- */

  function initSnapCarousels(scope) {
    var lists = (scope || document).querySelectorAll('.ds-services, .ds-timeline, .ds-plans, .ds-cols, .ds-matlist');
    Array.prototype.forEach.call(lists, function (list) {
      if (list._snapIO || !('IntersectionObserver' in window)) return;
      var cards = list.children;
      if (!cards.length) return;
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          entry.target.classList.toggle('is-active', entry.isIntersecting);
        });
      }, { root: list, threshold: 0.65 });
      Array.prototype.forEach.call(cards, function (card) { io.observe(card); });
      list._snapIO = io;
    });
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
    initSnapCarousels(scope);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { boot(document); });
  } else {
    boot(document);
  }

  document.addEventListener('shopify:section:load', function (event) { boot(event.target); });
})();
