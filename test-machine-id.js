
const { machineIdSync } = require('node-machine-id');
const crypto = require('crypto');
const os = require('os');

console.log('--- Measuring Machine ID ---');

let id = '';
try {
    // Try native method first
    id = machineIdSync();
    console.log('[Method: Native] ID:', id);
} catch (e) {
    console.log('[Method: Native] Failed:', e.message);

    // Fallback method
    try {
        const hash = crypto.createHash('sha256').update(os.hostname() + os.arch() + os.cpus().length + os.userInfo().username).digest('hex');
        console.log('[Method: Fallback] ID:', hash);
    } catch (err) {
        console.log('Fallback failed', err);
    }
}

// Check against DB ID
const TARGET_ID = '9cefcfd23c9778dafd8f34f49d8d58d76e3ce3b3c76108fec87c8806256f6756';

if (id === TARGET_ID) {
    console.log('\n✅ MATCH! Local ID matches Database ID.');
} else {
    console.log('\n❌ MISMATCH!');
    console.log('Database Expects:', TARGET_ID);
    console.log('Local Calculated:', id);
}
