const Database = require('better-sqlite3');
const crypto = require('crypto');
const os = require('os');
const path = require('path');

const ENCRYPTION_KEY = crypto.createHash('sha256')
  .update(os.hostname() + 'certd-electron-secret-key')
  .digest();

function decrypt(encrypted) {
  if (!encrypted) return '';
  try {
    const parts = encrypted.split(':');
    const iv = Buffer.from(parts[0], 'hex');
    const encryptedText = parts[1];
    const decipher = crypto.createDecipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (error) {
    return 'DECRYPT_FAILED';
  }
}

const db = new Database('/Users/zhangzhi-mac/Library/Application Support/certd-electron/certd.db');
const row = db.prepare("SELECT private_key FROM servers WHERE id = '1765197887634'").get();

if (row && row.private_key) {
    const key = decrypt(row.private_key);
    console.log('--- KEY INFO ---');
    console.log('Length:', key.length);
    console.log('Start:', JSON.stringify(key.substring(0, 50)));
    console.log('End:', JSON.stringify(key.substring(key.length - 50)));
    console.log('First 5 lines:');
    const lines = key.split(/\r?\n/);
    lines.slice(0, 5).forEach((l, i) => console.log(`${i}: [${l.length}] ${JSON.stringify(l)}`));
    console.log('--- END ---');
} else {
    console.log('No key found');
}
