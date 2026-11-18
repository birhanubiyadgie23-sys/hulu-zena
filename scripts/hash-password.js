import { randomBytes, scrypt as scryptCallback } from 'node:crypto';
import { promisify } from 'node:util';
const scrypt=promisify(scryptCallback);
const password=process.argv[2];
if(!password||password.length<12){console.error('Usage: npm run hash-password -- "a-long-unique-password" (minimum 12 characters)');process.exit(1);}
const salt=randomBytes(16).toString('hex');
const hash=await scrypt(password,salt,64);
console.log(`scrypt$${salt}$${hash.toString('hex')}`);
