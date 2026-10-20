'use strict';

/**
 * Screen Translator feature flags and constants
 */

// v2: Live Video feature is planned for v2; disabled in v1.
const LIVE_VIDEO_ENABLED = false;

if (typeof window !== 'undefined' && typeof window.LIVE_VIDEO_ENABLED !== 'boolean') {
  window.LIVE_VIDEO_ENABLED = LIVE_VIDEO_ENABLED;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    LIVE_VIDEO_ENABLED
  };
}
