#!/usr/bin/env node
/* ---------------------------------------------------------------------------
   Step 2 of the three in the header of firestore.rules: give real Firebase
   accounts a { staff: true, role: ... } custom claim, so the rules can tell a
   manager from a passer-by.

   This CANNOT run in the browser. Setting a custom claim is an Admin SDK
   operation and the Admin SDK holds a private key - the whole point is that the
   client cannot do it. That is why it is a script you run once from your own
   machine, not a feature of the app.

   ---------------------------------------------------------------------------
   BEFORE YOU RUN IT

   1. Firebase console -> Project settings -> Service accounts
      -> "Generate new private key". You get a .json file.

   2. Put that file somewhere OUTSIDE this repo. It is a root credential for the
      whole project: anyone holding it can read and rewrite every document,
      bypassing firestore.rules entirely. It must never be committed, pasted into
      a chat, or shipped to a client. .gitignore has serviceAccount*.json in it,
      but do not rely on that - keep it out of the folder.

   3. Create the staff accounts themselves: console -> Authentication -> Users
      -> Add user. Use their real work emails and set a temporary password each.

   4. npm install firebase-admin        (in tools/)

   ---------------------------------------------------------------------------
   RUN

     node tools/set-staff-claims.js --key /path/to/serviceAccount.json

   Add --dry to see exactly what it would do without touching anything. Do that
   first. Add --revoke <email> to strip someone's access when they leave.

   The claim lands on the account, not the session, so anyone already signed in
   keeps their old claim until their token refreshes - up to an hour. The script
   revokes refresh tokens to force that immediately, which signs them out.
--------------------------------------------------------------------------- */

'use strict';

// The three roles here must match SH.ROLE_VIEWS in assets/js/data.js. That object
// decides what the console renders; these claims decide what Firestore will accept.
// If they drift, someone sees a button that then fails on write, which is a worse
// bug than not seeing the button at all.
const STAFF = [
  { email: 'henry@sirhenrys.co.ke',   role: 'owner',   store: null,     name: 'Henry Achieng'  },
  { email: 'wanjiru@sirhenrys.co.ke', role: 'manager', store: 'cbd',    name: 'Wanjiru Mwangi' },
  { email: 'otieno@sirhenrys.co.ke',  role: 'floor',   store: 'west',   name: 'Otieno Kimani'  }
];

const VALID_ROLES = ['owner', 'manager', 'floor'];

function arg(name) {
  const i = process.argv.indexOf('--' + name);
  return i === -1 ? null : (process.argv[i + 1] || true);
}

async function main() {
  const dry = process.argv.includes('--dry');
  const revoke = arg('revoke');
  const keyPath = arg('key') || process.env.GOOGLE_APPLICATION_CREDENTIALS;

  if (!keyPath || keyPath === true) {
    console.error('Need a service account key.\n' +
      '  node tools/set-staff-claims.js --key /path/to/serviceAccount.json [--dry]\n' +
      'See the header of this file for how to get one.');
    process.exit(1);
  }

  let admin;
  try { admin = require('firebase-admin'); }
  catch (e) {
    console.error('firebase-admin is not installed. From tools/:  npm install firebase-admin');
    process.exit(1);
  }

  let cert;
  try { cert = require(require('path').resolve(keyPath)); }
  catch (e) { console.error('Could not read the key at ' + keyPath + ': ' + e.message); process.exit(1); }

  admin.initializeApp({ credential: admin.credential.cert(cert) });
  const auth = admin.auth();
  console.log('project: ' + cert.project_id + (dry ? '   [DRY RUN - nothing will be written]' : ''));

  // ---- revoking one person -------------------------------------------------
  if (revoke && revoke !== true) {
    const u = await auth.getUserByEmail(revoke).catch(() => null);
    if (!u) { console.error('No account for ' + revoke); process.exit(1); }
    if (dry) { console.log('would clear claims and sign out ' + revoke); return; }
    await auth.setCustomUserClaims(u.uid, null);
    await auth.revokeRefreshTokens(u.uid);
    console.log('revoked ' + revoke + ' - claims cleared, sessions ended');
    return;
  }

  // ---- granting ------------------------------------------------------------
  let ok = 0, missing = 0;
  for (const s of STAFF) {
    if (!VALID_ROLES.includes(s.role)) {
      console.error('  SKIP ' + s.email + ' - "' + s.role + '" is not one of ' + VALID_ROLES.join(', '));
      continue;
    }
    const user = await auth.getUserByEmail(s.email).catch(() => null);
    if (!user) {
      // Deliberately not creating accounts here. Creating one means choosing a
      // password, and a password chosen by a script is a password nobody changes.
      console.error('  MISSING ' + s.email + ' - create it in the console first (Authentication -> Users)');
      missing++;
      continue;
    }

    const claims = { staff: true, role: s.role, store: s.store };
    if (dry) {
      console.log('  would set ' + s.email + '  ->  ' + JSON.stringify(claims));
      ok++;
      continue;
    }
    await auth.setCustomUserClaims(user.uid, claims);
    // Claims attach to the account, not to a live session. Without this, anyone
    // already signed in keeps their old permissions for up to an hour.
    await auth.revokeRefreshTokens(user.uid);
    console.log('  set ' + s.email + '  ->  ' + JSON.stringify(claims));
    ok++;
  }

  console.log('\n' + ok + ' account(s) ' + (dry ? 'would be updated' : 'updated') +
              (missing ? ', ' + missing + ' missing' : ''));
  if (!dry && ok) {
    console.log('\nThey must sign out and back in for the claim to appear in their token.');
    console.log('Next: swap isSignedIn() for isStaff() on the write rules in firestore.rules,');
    console.log('then  firebase deploy --only firestore:rules');
  }
}

main().catch(e => { console.error(e.message || e); process.exit(1); });
