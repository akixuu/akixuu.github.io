(function () {
  'use strict';

  if (window.__photoGalleryBound) return;
  window.__photoGalleryBound = true;

  var modal = null;
  var image = null;
  var caption = null;
  var prevBtn = null;
  var nextBtn = null;
  var items = [];
  var index = 0;

  function ensureModal() {
    modal = document.getElementById('photo-gallery-lightbox');
    if (modal) {
      image = document.getElementById('photo-gallery-lightbox-image');
      caption = document.getElementById('photo-gallery-lightbox-caption');
      prevBtn = modal.querySelector('[data-gallery-prev]');
      nextBtn = modal.querySelector('[data-gallery-next]');
      return modal;
    }

    var wrap = document.createElement('div');
    wrap.innerHTML =
      '<div class="modal fade photo-gallery-lightbox" id="photo-gallery-lightbox" tabindex="-1" aria-hidden="true">' +
        '<div class="modal-dialog modal-dialog-centered modal-xl">' +
          '<div class="modal-content photo-gallery-lightbox-content">' +
            '<button type="button" class="photo-gallery-lightbox-nav photo-gallery-lightbox-prev" data-gallery-prev aria-label="Previous photo">' +
              '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15.5 4.5 8 12l7.5 7.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
            '</button>' +
            '<figure class="photo-gallery-lightbox-figure mb-0">' +
              '<img id="photo-gallery-lightbox-image" class="photo-gallery-lightbox-image" src="" alt="">' +
              '<figcaption id="photo-gallery-lightbox-caption" class="photo-gallery-lightbox-caption"></figcaption>' +
            '</figure>' +
            '<button type="button" class="photo-gallery-lightbox-nav photo-gallery-lightbox-next" data-gallery-next aria-label="Next photo">' +
              '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8.5 4.5 16 12l-7.5 7.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
            '</button>' +
          '</div>' +
        '</div>' +
      '</div>';

    modal = wrap.firstElementChild;
    document.body.appendChild(modal);
    image = document.getElementById('photo-gallery-lightbox-image');
    caption = document.getElementById('photo-gallery-lightbox-caption');
    prevBtn = modal.querySelector('[data-gallery-prev]');
    nextBtn = modal.querySelector('[data-gallery-next]');

    modal.addEventListener('hidden.bs.modal', function () {
      if (!image) return;
      image.removeAttribute('src');
      image.alt = '';
      if (caption) caption.textContent = '';
      items = [];
    });

    modal.addEventListener('click', function (event) {
      if (event.target.closest('[data-gallery-prev], [data-gallery-next]')) return;
      if (event.target === image) return;
      hide();
    });

    prevBtn.addEventListener('click', function (event) {
      event.preventDefault();
      event.stopPropagation();
      step(-1);
    });

    nextBtn.addEventListener('click', function (event) {
      event.preventDefault();
      event.stopPropagation();
      step(1);
    });

    return modal;
  }

  function show() {
    ensureModal();
    if (window.bootstrap && bootstrap.Modal) {
      bootstrap.Modal.getOrCreateInstance(modal).show();
    }
  }

  function hide() {
    if (!modal) return;
    if (window.bootstrap && bootstrap.Modal) {
      bootstrap.Modal.getOrCreateInstance(modal).hide();
    }
  }

  function render() {
    if (!image || !items.length) return;
    var item = items[index];
    var src = item.getAttribute('data-gallery-src') || '';
    var alt = item.getAttribute('data-gallery-alt') || '';
    image.src = src;
    image.alt = alt;
    if (caption) caption.textContent = (index + 1) + ' / ' + items.length;

    var many = items.length > 1;
    prevBtn.hidden = !many;
    nextBtn.hidden = !many;
  }

  function step(delta) {
    if (!items.length) return;
    index = (index + delta + items.length) % items.length;
    render();
  }

  function openFrom(trigger) {
    var gallery = trigger.closest('[data-gallery]');
    if (!gallery) return;
    items = Array.prototype.slice.call(gallery.querySelectorAll('[data-gallery-src]'));
    index = Math.max(0, items.indexOf(trigger));
    ensureModal();
    render();
    show();
  }

  document.addEventListener('click', function (event) {
    var trigger = event.target.closest('[data-gallery-src]');
    if (!trigger) return;
    event.preventDefault();
    openFrom(trigger);
  });

  document.addEventListener('keydown', function (event) {
    if (!modal || !modal.classList.contains('show')) return;
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      step(-1);
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      step(1);
    }
  });
})();
