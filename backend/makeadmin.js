#!/usr/bin/env node
/**
 * makeadmin.js — Promote an existing user to admin by email.
 *
 * Usage:
 *   cd backend
 *   node makeadmin "user@example.com"
 *
 * Optional flags:
 *   --demote      Set role back to 'user'
 *   --protect     Also set isProtected = true (cannot be deleted)
 *   --unprotect   Set isProtected = false
 *   --activate    Also set status to 'active'
 */

require('dotenv').config();
const mongoose = require('mongoose');

const args = process.argv.slice(2);
const flags = new Set(args.filter(a => a.startsWith('--')));
const positional = args.filter(a => !a.startsWith('--'));
const email = (positional[0] || '').trim().toLowerCase();

if (!email) {
  console.error('❌ Email is required.');
  console.error('Usage: node makeadmin "user@example.com" [--demote] [--protect] [--unprotect] [--activate]');
  process.exit(1);
}
if (!/^\S+@\S+\.\S+$/.test(email)) {
  console.error(`❌ "${email}" does not look like a valid email.`);
  process.exit(1);
}

const mongoUri = process.env.MONGODB_URI;
if (!mongoUri) {
  console.error('❌ MONGODB_URI is not set. Make sure .env is present in the backend folder.');
  process.exit(1);
}

(async () => {
  try {
    console.log(`🔌 Connecting to MongoDB...`);
    await mongoose.connect(mongoUri);
    console.log(`✅ Connected.`);

    const User = require('./models/User');

    const user = await User.findOne({ email });
    if (!user) {
      console.error(`❌ No user found with email "${email}".`);
      console.error(`   Tip: the user must register/sign up first, then run this command to promote them.`);
      process.exit(2);
    }

    const before = {
      role: user.role,
      status: user.status,
      isProtected: user.isProtected
    };

    const targetRole = flags.has('--demote') ? 'user' : 'admin';
    user.role = targetRole;

    if (flags.has('--protect'))   user.isProtected = true;
    if (flags.has('--unprotect')) user.isProtected = false;
    if (flags.has('--activate'))  user.status = 'active';

    await user.save();

    const after = {
      role: user.role,
      status: user.status,
      isProtected: user.isProtected
    };

    console.log('');
    console.log(`👤 ${user.email}`);
    console.log(`   id:          ${user._id}`);
    console.log(`   username:    ${user.username || '(none)'}`);
    console.log('');
    console.log(`   role:        ${before.role}  →  ${after.role}${before.role === after.role ? '  (unchanged)' : ''}`);
    console.log(`   status:      ${before.status}  →  ${after.status}${before.status === after.status ? '  (unchanged)' : ''}`);
    console.log(`   isProtected: ${before.isProtected}  →  ${after.isProtected}${before.isProtected === after.isProtected ? '  (unchanged)' : ''}`);
    console.log('');

    if (after.role === 'admin') {
      console.log(`✅ ${user.email} is now an ADMIN.`);
    } else {
      console.log(`✅ ${user.email} is now a regular user.`);
    }
  } catch (err) {
    console.error('❌ Error:', err.message || err);
    process.exit(1);
  } finally {
    await mongoose.disconnect().catch(() => {});
  }
})();
