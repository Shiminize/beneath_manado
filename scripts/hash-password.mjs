import { hashPassword } from '../api/_lib/security.js';

const password = process.argv[2];

if (!password || password.length < 8) {
  console.error('Usage: npm run hash:password -- "at-least-8-characters"');
  process.exit(1);
}

console.log(await hashPassword(password));
