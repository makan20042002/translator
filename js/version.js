// Single version source of truth (written from package.json by build scripts)
(function () {
  'use strict';
  var v = '1.0.0';
  if (typeof window !== 'undefined') window.MAKAN_VERSION = v;
  if (typeof self !== 'undefined') self.MAKAN_VERSION = v;
})();
