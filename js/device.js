/* ==========================================================================
   MAKAN Translate — Phone Device Detection
   ========================================================================== */

(function () {
  'use strict';

  function isPhone() {
    // Windows desktop app is never a phone
    if (typeof window !== 'undefined' && window.makanDesktop && window.makanDesktop.isDesktop) {
      return false;
    }
    if (typeof navigator === 'undefined') return false;

    var ua = navigator.userAgent || '';

    // iPad and Android tablets are NOT phones
    if (/iPad/i.test(ua)) return false;
    // Android tablets have Android without Mobile
    if (/Android/i.test(ua) && !/Mobile/i.test(ua)) return false;
    // Generic tablet indicators
    if (/Tablet|PlayBook|Silk/i.test(ua)) return false;

    // Check Client Hints: navigator.userAgentData.mobile === true
    if (navigator.userAgentData && typeof navigator.userAgentData.mobile === 'boolean') {
      if (navigator.userAgentData.mobile === true) {
        return true;
      }
    }

    // Check user agent: Android + Mobile, iPhone or iPod
    if (/Android/i.test(ua) && /Mobile/i.test(ua)) return true;
    if (/iPhone|iPod/i.test(ua)) return true;

    return false;
  }

  function applyPhoneClass() {
    if (typeof document !== 'undefined' && document.documentElement) {
      if (isPhone()) {
        document.documentElement.classList.add('is-phone');
      } else {
        document.documentElement.classList.remove('is-phone');
      }
    }
  }

  // Apply immediately upon execution
  applyPhoneClass();

  // Re-check after DOM is ready in case makanDesktop or other properties were defined
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', applyPhoneClass);
    }
  }

  // Expose on window
  if (typeof window !== 'undefined') {
    window.isPhone = isPhone;
    window.applyPhoneClass = applyPhoneClass;
  }
  if (typeof globalThis !== 'undefined') {
    globalThis.isPhone = isPhone;
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { isPhone: isPhone, applyPhoneClass: applyPhoneClass };
  }
})();
