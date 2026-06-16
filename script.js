(() => {
  const nav = document.querySelector('#primary-nav');
  const navToggle = document.querySelector('[data-nav-toggle]');
  const consultForm = document.querySelector('[data-consultation-form]');
  const feedback = document.querySelector('[data-form-feedback]');

  const setNavState = (isOpen) => {
    if (!nav || !navToggle) {
      return;
    }

    nav.classList.toggle('is-open', isOpen);
    nav.setAttribute('aria-hidden', String(!isOpen));
    navToggle.setAttribute('aria-expanded', String(isOpen));
  };

  if (nav && navToggle) {
    const isMobile = () => window.matchMedia('(max-width: 960px)').matches;

    const syncNavMode = () => {
      nav.classList.toggle('is-mobile-panel', isMobile());

      if (isMobile()) {
        nav.setAttribute('aria-hidden', String(!nav.classList.contains('is-open')));
      } else {
        nav.classList.remove('is-open');
        nav.setAttribute('aria-hidden', 'false');
        navToggle.setAttribute('aria-expanded', 'false');
      }
    };

    syncNavMode();

    navToggle.addEventListener('click', () => {
      setNavState(!nav.classList.contains('is-open'));
    });

    nav.addEventListener('click', (event) => {
      if (event.target instanceof HTMLAnchorElement && isMobile()) {
        setNavState(false);
      }
    });

    document.addEventListener('click', (event) => {
      if (!isMobile() || !nav.classList.contains('is-open')) {
        return;
      }

      const target = event.target;
      if (target instanceof Node && (nav.contains(target) || navToggle.contains(target))) {
        return;
      }

      setNavState(false);
    });

    window.addEventListener('resize', () => {
      syncNavMode();
    });
  }

  if (consultForm && feedback) {
    const phoneInput = consultForm.elements.namedItem('phone');
    const submitButton = consultForm.querySelector('button[type="submit"]');
    const fields = Array.from(consultForm.querySelectorAll('input, select, textarea'));
    const phonePattern = /^(0\d{9}|\+84\d{9})$/;
    let submitTimer = null;

    consultForm.addEventListener('submit', (event) => {
      event.preventDefault();

      feedback.hidden = true;
      feedback.classList.remove('is-success', 'is-error');

      fields.forEach((field) => {
        field.removeAttribute('aria-invalid');
      });

      if (phoneInput instanceof HTMLInputElement) {
        const normalizedPhone = phoneInput.value.trim().replace(/\s+/g, '');
        phoneInput.setCustomValidity(phonePattern.test(normalizedPhone) ? '' : 'Số điện thoại chưa đúng định dạng.');
      }

      let firstInvalid = null;
      fields.forEach((field) => {
        const valid = field.checkValidity();
        field.toggleAttribute('aria-invalid', !valid);

        if (!valid && !firstInvalid) {
          firstInvalid = field;
        }
      });

      if (!consultForm.checkValidity()) {
        consultForm.reportValidity();

        feedback.textContent = 'Vui lòng kiểm tra lại các trường bắt buộc trước khi gửi.';
        feedback.hidden = false;
        feedback.classList.add('is-error');

        if (firstInvalid instanceof HTMLElement) {
          firstInvalid.focus();
        }
        return;
      }

      if (phoneInput instanceof HTMLInputElement) {
        phoneInput.setCustomValidity('');
      }

      if (submitTimer) {
        window.clearTimeout(submitTimer);
      }

      const originalButtonLabel = submitButton instanceof HTMLButtonElement ? submitButton.textContent : '';

      if (submitButton instanceof HTMLButtonElement) {
        submitButton.disabled = true;
        submitButton.textContent = 'Đang gửi...';
      }

      submitTimer = window.setTimeout(() => {
        consultForm.reset();
        feedback.textContent = 'Đăng ký của bạn đã được ghi nhận. LEFT HAND sẽ liên hệ sớm nhất để tư vấn lộ trình phù hợp.';
        feedback.hidden = false;
        feedback.classList.add('is-success');

        if (submitButton instanceof HTMLButtonElement) {
          submitButton.disabled = false;
          submitButton.textContent = originalButtonLabel || 'Gửi đăng ký';
        }
      }, 650);
    });
  }
})();
