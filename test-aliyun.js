const { AliyunDnsProvider } = require('@certd/plugin-aliyun');

const accessKeyId = process.argv[2] || process.env.ALIYUN_ACCESS_KEY_ID;
const accessKeySecret = process.argv[3] || process.env.ALIYUN_ACCESS_KEY_SECRET;

if (!accessKeyId || !accessKeySecret) {
    console.error('用法: node test-aliyun.js <AccessKeyId> <AccessKeySecret>');
    process.exit(1);
}

async function test() {
    console.log('Initializing Aliyun DNS Provider...');
    try {
        const provider = new AliyunDnsProvider();
        provider.access = {
            accessKeyId,
            accessKeySecret
        };

        if (provider.onInstance) await provider.onInstance();

        console.log('Connecting to Aliyun...');
        const result = await provider.getDomainList();
        console.log('✅ Connection Successful!');
        console.log('Found domains:', result ? result.length : 0);
    } catch (e) {
        console.error('❌ Connection Failed:', e.message);
        console.error('Initial error object:', e);
    }
}

test();
