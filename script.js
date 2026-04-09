document.addEventListener('DOMContentLoaded', () => {

  /* ===========================
     MOBILE HAMBURGER MENU
     =========================== */
  const hamburger = document.getElementById('hamburger');
  const navLinks = document.getElementById('navLinks');

  hamburger.addEventListener('click', () => {
    hamburger.classList.toggle('active');
    navLinks.classList.toggle('active');
  });

  navLinks.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      hamburger.classList.remove('active');
      navLinks.classList.remove('active');
    });
  });

  /* ===========================
     NAVBAR SCROLL EFFECT
     =========================== */
  const header = document.querySelector('.header');
  window.addEventListener('scroll', () => {
    header.classList.toggle('scrolled', window.scrollY > 50);
  });

  /* ===========================
     TESTIMONIAL SLIDER
     =========================== */
  const cards = document.querySelectorAll('.testimonial-card');
  const dots = document.querySelectorAll('.testimonial-dots .dot');
  const prevBtn = document.querySelector('.testimonial-nav-btn.prev');
  const nextBtn = document.querySelector('.testimonial-nav-btn.next');
  let current = 0;

  function showSlide(index) {
    cards.forEach(c => c.classList.remove('active'));
    dots.forEach(d => d.classList.remove('active'));

    current = (index + cards.length) % cards.length;
    cards[current].classList.add('active');
    if (dots[current]) dots[current].classList.add('active');
  }

  if (prevBtn && nextBtn) {
    prevBtn.addEventListener('click', () => showSlide(current - 1));
    nextBtn.addEventListener('click', () => showSlide(current + 1));
  }

  dots.forEach((dot, i) => {
    dot.addEventListener('click', () => showSlide(i));
  });

  /* ===========================
     SCROLL REVEAL ANIMATIONS
     =========================== */
  const animElements = document.querySelectorAll(
    '.service-card, .destination-card, .step, .testimonial-card.active, .subscribe-card'
  );

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15 }
  );

  animElements.forEach(el => {
    el.classList.add('animate-in');
    observer.observe(el);
  });

});
