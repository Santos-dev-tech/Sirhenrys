/* ---------------------------------------------------------------------------
   The last three lines of the app, moved out of index.html.

   They used to be an inline <script> at the bottom of the page. That single tag
   was the only thing standing between this site and a script-src of 'self' with
   nothing else on it: allow one inline script and you have written
   'unsafe-inline', and 'unsafe-inline' is what turns an injected string into
   running code. A hash would also have worked, but a hash has to be recomputed
   and copied into two headers every time these lines change, and the first time
   somebody forgets, the whole app stops booting on the live site only.

   A file costs one request that is cached forever and cannot fall out of step.
--------------------------------------------------------------------------- */
(function () {
  'use strict';
  Motion.boot();
  SHSync.start();
  SHAuth.start();
})();
