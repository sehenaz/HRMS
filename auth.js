// auth.js — Centralized authentication and session management for MEVTENCIA

/**
 * requireAuth(allowedRoles)
 * Call as the VERY FIRST <script> in <head> on every protected page.
 * - Runs synchronously before DOM renders → no content flash
 * - Also hooks pageshow to handle bfcache restore
 * - allowedRoles: array containing any of 'employee', 'admin', 'super'
 */
function requireAuth(allowedRoles) {
  function _check() {
    var empSession   = _parse('mev_employeeSession');
    var adminSession = _parse('mev_adminSession');
    var superSession = _parse('mev_superSession');

    var isEmployee = !!(empSession   && (empSession.empId   || empSession.id));
    var isAdmin    = !!(adminSession && (adminSession.id     || adminSession.admin_id));
    var isSuper    = !!(superSession && superSession.id)
                  || !!(adminSession && (adminSession.type === 'super' || adminSession.type === 'superadmin'));

    var hasAccess = false;
    if (allowedRoles.indexOf('employee') !== -1 && isEmployee) hasAccess = true;
    if (allowedRoles.indexOf('admin')    !== -1 && isAdmin)    hasAccess = true;
    if (allowedRoles.indexOf('super')    !== -1 && isSuper)    hasAccess = true;

    if (!hasAccess) {
      // Pick the right login target
      var target = 'index.html';
      if (allowedRoles.indexOf('super') !== -1 && allowedRoles.indexOf('admin') === -1 && allowedRoles.indexOf('employee') === -1) {
        target = 'SuperAdminLogin.html';
      } else if (allowedRoles.indexOf('admin') !== -1 && allowedRoles.indexOf('employee') === -1) {
        target = 'AdminLogin.html';
      } else if (allowedRoles.indexOf('employee') !== -1) {
        target = 'mev.html';
      }
      // Use replace() so this page is removed from history (Back button can't return here)
      window.location.replace(target);
      // Throw to stop any further JS on this page from running
      throw new Error('AUTH_REDIRECT');
    }
  }

  // 1. Run synchronously right now (before DOM renders)
  _check();

  // 2. Also run on every pageshow (catches bfcache restores — browser Back button)
  window.addEventListener('pageshow', function(event) {
    _check();
  });
}

/**
 * authLogout()
 * Call when any logout button is clicked.
 * Clears ALL sessions and navigates to index.html using replace()
 * so the protected page is removed from browser history.
 */
function authLogout() {
  // Clear all session keys
  localStorage.removeItem('mev_employeeSession');
  localStorage.removeItem('mev_adminSession');
  localStorage.removeItem('mev_superSession');
  localStorage.removeItem('mev_capturedPhoto');
  localStorage.removeItem('mev_capturedLocation');
  localStorage.removeItem('mev_captureAt');

  // Use replace() → removes current page from history stack
  // Back button will skip the protected page entirely
  window.location.replace('index.html');
}

/**
 * redirectIfLoggedIn(targetEmployee, targetAdmin, targetSuper)
 * Call on login pages (mev.html, AdminLogin.html, SuperAdminLogin.html, index.html).
 * If user is already authenticated, send them straight to their dashboard.
 */
function redirectIfLoggedIn(targetEmployee, targetAdmin, targetSuper) {
  var empSession   = _parse('mev_employeeSession');
  var adminSession = _parse('mev_adminSession');
  var superSession = _parse('mev_superSession');

  var isEmployee = !!(empSession   && (empSession.empId   || empSession.id));
  var isAdmin    = !!(adminSession && (adminSession.id     || adminSession.admin_id));
  var isSuper    = !!(superSession && superSession.id)
                || !!(adminSession && (adminSession.type === 'super' || adminSession.type === 'superadmin'));

  if (isSuper    && targetSuper)    { window.location.replace(targetSuper);    throw new Error('ALREADY_LOGGED_IN'); }
  if (isAdmin    && targetAdmin)    { window.location.replace(targetAdmin);    throw new Error('ALREADY_LOGGED_IN'); }
  if (isEmployee && targetEmployee) { window.location.replace(targetEmployee); throw new Error('ALREADY_LOGGED_IN'); }
}

/**
 * preventBackAfterLogout(allowedRoles)
 * Optional extra defense. Call after DOMContentLoaded on protected pages.
 * Pushes a history state so popstate fires when Back is pressed,
 * then re-checks auth and redirects if session is gone.
 */
function preventBackAfterLogout(allowedRoles) {
  history.pushState({ authProtected: true }, '');
  window.addEventListener('popstate', function() {
    try {
      requireAuth(allowedRoles);
      // If still valid, push again to keep guard in place
      history.pushState({ authProtected: true }, '');
    } catch(e) {
      // requireAuth already called window.location.replace() — do nothing
    }
  });
}

// Internal helper — safe JSON parse from localStorage
function _parse(key) {
  try { return JSON.parse(localStorage.getItem(key) || 'null'); }
  catch(e) { return null; }
}
