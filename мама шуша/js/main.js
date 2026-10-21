/* Mama Shosha - page behaviour (vanilla JS, no dependencies) */
(function () {
  'use strict';

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var isPhone = window.matchMedia('(max-width: 767px)');

  /* ---------- Updates banner ---------- */
  var banner = document.getElementById('update-banner');
  var bannerClose = document.querySelector('[data-banner-close]');
  if (banner && bannerClose) {
    bannerClose.addEventListener('click', function () { banner.hidden = true; });
  }

  /* ---------- Mobile navigation ---------- */
  var header = document.getElementById('site-header');
  var burger = document.querySelector('[data-burger]');
  var nav = document.getElementById('main-nav');

  function setNav(open) {
    header.classList.toggle('nav-open', open);
    burger.setAttribute('aria-expanded', String(open));
    burger.setAttribute('aria-label', open ? 'סגירת תפריט הניווט' : 'פתיחת תפריט הניווט');
  }
  if (header && burger && nav) {
    burger.addEventListener('click', function () { setNav(!header.classList.contains('nav-open')); });
    nav.addEventListener('click', function (e) { if (e.target.closest('a')) setNav(false); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && header.classList.contains('nav-open')) { setNav(false); burger.focus(); }
    });
    document.addEventListener('click', function (e) {
      if (header.classList.contains('nav-open') && !header.contains(e.target)) setNav(false);
    });
    isPhone.addEventListener('change', function () { setNav(false); });
  }

  /* ---------- Current section in the navigation ---------- */
  if (nav && 'IntersectionObserver' in window) {
    var navLinks = {};
    nav.querySelectorAll('a[href^="#"]').forEach(function (a) { navLinks[a.getAttribute('href').slice(1)] = a; });
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        Object.keys(navLinks).forEach(function (id) {
          var current = id === entry.target.id;
          navLinks[id].classList.toggle('is-current', current);
          if (current) navLinks[id].setAttribute('aria-current', 'true'); else navLinks[id].removeAttribute('aria-current');
        });
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    document.querySelectorAll('main > section[id]').forEach(function (s) { spy.observe(s); });
  }

  /* ---------- Slideshows ---------- */
  document.querySelectorAll('[data-slider]').forEach(function (slider) {
    var slides = Array.prototype.slice.call(slider.querySelectorAll('.slide'));
    var dotsBox = document.querySelector(slider.getAttribute('data-dots'));
    var delay = parseInt(slider.getAttribute('data-autoplay'), 10) || 0;
    var index = 0, timer = null, dots = [];
    if (slides.length < 2) return;

    function show(i) {
      index = (i + slides.length) % slides.length;
      slides.forEach(function (s, n) {
        s.classList.toggle('is-active', n === index);
        s.setAttribute('aria-hidden', String(n !== index));
      });
      dots.forEach(function (d, n) { d.setAttribute('aria-current', String(n === index)); });
    }
    function stop() { if (timer) { clearInterval(timer); timer = null; } }
    function play() {
      stop();
      if (delay && !reduceMotion) timer = setInterval(function () { show(index + 1); }, delay);
    }

    if (dotsBox) {
      slides.forEach(function (_, n) {
        var dot = document.createElement('button');
        dot.type = 'button';
        dot.className = 'dot';
        dot.setAttribute('aria-label', 'תמונה ' + (n + 1) + ' מתוך ' + slides.length);
        dot.addEventListener('click', function () { show(n); play(); });
        dotsBox.appendChild(dot);
        dots.push(dot);
      });
      dotsBox.addEventListener('focusin', stop);
      dotsBox.addEventListener('focusout', play);
    }

    /* swipe: in RTL the next slide comes in from the left, so a swipe to the right moves forward */
    var startX = null;
    slider.addEventListener('touchstart', function (e) { startX = e.touches[0].clientX; stop(); }, { passive: true });
    slider.addEventListener('touchend', function (e) {
      if (startX === null) return;
      var dx = e.changedTouches[0].clientX - startX;
      if (Math.abs(dx) > 40) show(index + (dx > 0 ? 1 : -1));
      startX = null;
      play();
    }, { passive: true });

    slider.addEventListener('mouseenter', stop);
    slider.addEventListener('mouseleave', play);
    document.addEventListener('visibilitychange', function () { if (document.hidden) stop(); else play(); });

    show(0);
    play();
  });

  /* ---------- Menu accordions ---------- */
  document.querySelectorAll('[data-accordions]').forEach(function (group) {
    var items = Array.prototype.slice.call(group.querySelectorAll('.accordion'));

    function set(item, open) {
      item.classList.toggle('is-open', open);
      item.querySelector('.accordion-head').setAttribute('aria-expanded', String(open));
    }
    /* phones: the block starts as a list of categories */
    if (isPhone.matches) items.forEach(function (item) { set(item, false); });
    items.forEach(function (item) {
      item.querySelector('.accordion-head').addEventListener('click', function () {
        var open = !item.classList.contains('is-open');
        /* one category at a time */
        if (open) items.forEach(function (other) { if (other !== item) set(other, false); });
        set(item, open);
        /* phones: once the panels have settled, bring the opened card up under the header */
        if (open && isPhone.matches) setTimeout(function () {
          item.scrollIntoView({ block: 'start', behavior: reduceMotion ? 'auto' : 'smooth' });
        }, 420);
      });
    });
  });

  /* ---------- Menu picture viewer ---------- */
  var viewer = document.getElementById('menu-viewer');
  var viewerOpen = document.querySelector('[data-viewer-open]');
  if (viewer && viewerOpen) {
    var stage = viewer.querySelector('[data-viewer-stage]');
    var pages = viewer.querySelector('[data-viewer-pages]');
    var portrait = window.matchMedia('(orientation: portrait)');
    var PAGE_RATIO = 1190 / 1684, MAX_SCALE = 4, scale = 1;

    /* width of the two pages at 1x: as large as possible while a whole page still fits in the window */
    var fitWidth = function () {
      var st = getComputedStyle(stage);
      var w = stage.clientWidth - parseFloat(st.paddingLeft) - parseFloat(st.paddingRight);
      var h = stage.clientHeight - parseFloat(st.paddingTop) - parseFloat(st.paddingBottom);
      var cols = portrait.matches ? 1 : 2;
      var gap = parseFloat(getComputedStyle(pages).columnGap) || 0;
      return Math.max(0, Math.min(w, cols * h * PAGE_RATIO + (cols - 1) * gap));
    };

    /* the zoom changes the real width of the pages, so panning is ordinary scrolling (finger, wheel, scrollbars, arrow keys);
       x, y: the window point that stays under the finger / cursor (default: the middle of the stage);
       fx, fy: the point of the pages (fractions of their size) to put there (default: the one under x, y now) */
    var zoom = function (next, x, y, fx, fy) {
      var before = pages.getBoundingClientRect();
      if (x === undefined) {
        var box = stage.getBoundingClientRect();
        x = box.left + box.width / 2; y = box.top + box.height / 2;
      }
      if (fx === undefined) {
        fx = before.width ? (x - before.left) / before.width : 0.5;
        fy = before.height ? (y - before.top) / before.height : 0;
      }
      scale = Math.min(MAX_SCALE, Math.max(1, next));
      pages.style.width = fitWidth() * scale + 'px';
      viewer.classList.toggle('is-zoomed', scale > 1);
      var after = pages.getBoundingClientRect();
      /* a positive scrollLeft step moves the content left in RTL as well */
      stage.scrollLeft += after.left + fx * after.width - x;
      stage.scrollTop += after.top + fy * after.height - y;
      /* back at 1x with both pages fitting the window: do not leave their tops cut off */
      if (scale === 1 && pages.offsetHeight <= stage.clientHeight) {
        var cut = pages.getBoundingClientRect().top - stage.getBoundingClientRect().top - parseFloat(getComputedStyle(stage).paddingTop);
        if (cut < 0) stage.scrollTop += cut;
      }
    };

    viewerOpen.addEventListener('click', function () {
      if (!viewer.showModal) { window.location.href = pages.querySelector('img').src; return; }
      viewer.showModal();
      zoom(1);
      stage.scrollTop = 0;
    });
    viewer.querySelectorAll('[data-viewer-zoom]').forEach(function (button) {
      button.addEventListener('click', function () {
        zoom(button.getAttribute('data-viewer-zoom') === 'in' ? scale * 1.5 : scale / 1.5);
      });
    });
    window.addEventListener('resize', function () { if (viewer.open) zoom(scale); });

    /* mouse: a click zooms in at that point / back out; dragging a zoomed page pans it
       (on touch screens a tap does nothing, so a stray tap cannot undo a pinch) */
    var drag = null, lastPointer = 'mouse';
    pages.addEventListener('pointerdown', function (e) {
      lastPointer = e.pointerType;
      if (e.pointerType !== 'mouse' || e.button !== 0 || scale === 1) return;
      drag = { x: e.clientX, y: e.clientY, moved: false };
      e.preventDefault();
    });
    window.addEventListener('pointermove', function (e) {
      if (!drag) return;
      var dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (!drag.moved && Math.abs(dx) + Math.abs(dy) < 6) return;
      drag.moved = true;
      viewer.classList.add('is-dragging');
      stage.scrollLeft -= dx; stage.scrollTop -= dy;
      drag.x = e.clientX; drag.y = e.clientY;
    });
    window.addEventListener('pointerup', function () {
      if (drag && drag.moved) setTimeout(function () { drag = null; }, 0); else drag = null;
      viewer.classList.remove('is-dragging');
    });
    pages.addEventListener('click', function (e) {
      if (!e.target.closest('img') || lastPointer === 'touch' || (drag && drag.moved)) return;
      zoom(scale > 1 ? 1 : 2.5, e.clientX, e.clientY);
    });

    /* touch: two-finger pinch zooms around the fingers and pans with them; the point of the menu that was between
       the fingers at the start is kept between them, so a scroll the browser already began cannot add up with it */
    var pinch = null;
    var spread = function (t) { return Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY); };
    var middle = function (t) { return { x: (t[0].clientX + t[1].clientX) / 2, y: (t[0].clientY + t[1].clientY) / 2 }; };
    stage.addEventListener('touchstart', function (e) {
      if (e.touches.length !== 2) return;
      var m = middle(e.touches), box = pages.getBoundingClientRect();
      pinch = { d: spread(e.touches), s: scale, fx: (m.x - box.left) / box.width, fy: (m.y - box.top) / box.height };
    }, { passive: true });
    stage.addEventListener('touchmove', function (e) {
      if (!pinch || e.touches.length !== 2) return;
      if (e.cancelable) e.preventDefault();
      var m = middle(e.touches);
      zoom(pinch.s * spread(e.touches) / pinch.d, m.x, m.y, pinch.fx, pinch.fy);
    }, { passive: false });
    stage.addEventListener('touchend', function (e) { if (e.touches.length < 2) pinch = null; });
    stage.addEventListener('touchcancel', function () { pinch = null; });

    /* trackpad pinch and Ctrl + mouse wheel (Chrome, Edge, Firefox) */
    stage.addEventListener('wheel', function (e) {
      if (!e.ctrlKey) return;
      e.preventDefault();
      zoom(scale * Math.exp(-e.deltaY * 0.01), e.clientX, e.clientY);
    }, { passive: false });
    /* Safari: trackpad pinch on a Mac; on iPhone/iPad it only stops the whole page from zooming (the touch code above zooms) */
    var gestureStart = 1;
    viewer.addEventListener('gesturestart', function (e) { e.preventDefault(); gestureStart = scale; });
    viewer.addEventListener('gesturechange', function (e) {
      e.preventDefault();
      if (!pinch) zoom(gestureStart * e.scale, e.clientX, e.clientY);
    });

    viewer.querySelector('[data-viewer-close]').addEventListener('click', function () { viewer.close(); });
    /* a click on the dimmed area around the window closes it too */
    viewer.addEventListener('click', function (e) { if (e.target === viewer) viewer.close(); });
    viewer.addEventListener('close', function () { viewerOpen.focus({ preventScroll: true }); });
  }

  /* ---------- External links from js/config.js ---------- */
  var links = (window.MAMA_SHOSHA && window.MAMA_SHOSHA.links) || {};
  var toast = document.getElementById('toast');
  var toastTimer = null;

  function notify(text) {
    if (!toast) return;
    toast.textContent = text;
    toast.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toast.classList.remove('is-visible'); }, 3200);
  }
  function resolve(key) {
    var value = (links[key] || '').trim();
    if (!value) return '';
    if (key === 'whatsapp') return 'https://wa.me/' + value.replace(/\D/g, '');
    return value;
  }

  document.querySelectorAll('[data-link]').forEach(function (el) {
    var url = resolve(el.getAttribute('data-link'));
    if (url) {
      el.href = url;
      el.target = '_blank';
      el.rel = 'noopener';
    } else {
      el.addEventListener('click', function (e) {
        e.preventDefault();
        notify('הקישור יתעדכן בקרוב');
      });
    }
  });
})();
