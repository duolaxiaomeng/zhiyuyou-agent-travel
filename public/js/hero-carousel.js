(function () {
  "use strict";

  var root = document.getElementById("heroCarousel");
  if (!root) return;

  var slides = root.querySelectorAll(".hero-slide");
  var dots = root.querySelectorAll(".hero-dot");
  var btnPrev = root.querySelector(".hero-carousel-btn--prev");
  var btnNext = root.querySelector(".hero-carousel-btn--next");
  var total = slides.length;
  var index = 0;
  var timer = null;
  var intervalMs = 6000;
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function setSlide(i) {
    index = (i + total) % total;
    slides.forEach(function (el, j) {
      var active = j === index;
      el.classList.toggle("is-active", active);
      el.setAttribute("aria-hidden", active ? "false" : "true");
    });
    dots.forEach(function (d, j) {
      d.classList.toggle("is-active", j === index);
      d.setAttribute("aria-selected", j === index ? "true" : "false");
    });
  }

  function next() {
    setSlide(index + 1);
  }

  function prev() {
    setSlide(index - 1);
  }

  function startTimer() {
    if (reduceMotion || total <= 1) return;
    stopTimer();
    timer = window.setInterval(next, intervalMs);
  }

  function stopTimer() {
    if (timer) {
      window.clearInterval(timer);
      timer = null;
    }
  }

  if (btnNext) btnNext.addEventListener("click", function () {
    next();
    startTimer();
  });
  if (btnPrev) btnPrev.addEventListener("click", function () {
    prev();
    startTimer();
  });

  dots.forEach(function (d, j) {
    d.addEventListener("click", function () {
      setSlide(j);
      startTimer();
    });
  });

  root.addEventListener("mouseenter", stopTimer);
  root.addEventListener("mouseleave", startTimer);
  root.addEventListener("focusin", stopTimer);
  root.addEventListener("focusout", startTimer);

  document.addEventListener("visibilitychange", function () {
    if (document.hidden) stopTimer();
    else startTimer();
  });

  window.matchMedia("(prefers-reduced-motion: reduce)").addEventListener("change", function (e) {
    reduceMotion = e.matches;
    if (reduceMotion) stopTimer();
    else startTimer();
  });

  setSlide(0);
  startTimer();
})();
