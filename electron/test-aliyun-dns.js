/**
 * 阿里云 DNS 诊断工具
 * 用于检查和清理 ACME 验证记录
 */

const Core = require('@alicloud/pop-core');
const psl = require('psl');

// 从环境变量或命令行参数获取
const accessKeyId = process.argv[2] || process.env.ALIYUN_ACCESS_KEY_ID;
const accessKeySecret = process.argv[3] || process.env.ALIYUN_ACCESS_KEY_SECRET;
const domain = process.argv[4] || 'qiniu.29do.com';

if (!accessKeyId || !accessKeySecret) {
    console.error('用法: node test-aliyun-dns.js <AccessKeyId> <AccessKeySecret> [domain]');
    process.exit(1);
}

const client = new Core({
    accessKeyId,
    accessKeySecret,
    endpoint: 'https://alidns.aliyuncs.com',
    apiVersion: '2015-01-09'
});

async function main() {
    console.log(`\n===== 检查域名: ${domain} =====`);
    
    const parsed = psl.parse(domain);
    const mainDomain = parsed.domain;
    const subDomain = parsed.subdomain;
    const rr = subDomain ? `_acme-challenge.${subDomain}` : '_acme-challenge';
    
    console.log(`主域名: ${mainDomain}`);
    console.log(`子域名: ${subDomain || '(无)'}`);
    console.log(`ACME 记录名: ${rr}`);
    
    // 1. 查询所有记录
    console.log(`\n===== 查询所有解析记录 =====`);
    try {
        const response = await client.request('DescribeDomainRecords', {
            "DomainName": mainDomain,
            "PageSize": 100
        }, { method: 'POST' });
        
        const allRecords = response.DomainRecords?.Record || [];
        console.log(`总共找到 ${allRecords.length} 条记录\n`);
        
        // 过滤出 ACME 相关的记录
        const acmeRecords = allRecords.filter(r => r.RR && r.RR.includes('_acme-challenge'));
        
        if (acmeRecords.length === 0) {
            console.log('✅ 没有发现 ACME 验证记录');
        } else {
            console.log(`⚠️  发现 ${acmeRecords.length} 条 ACME 验证记录：\n`);
            acmeRecords.forEach((record, index) => {
                console.log(`记录 ${index + 1}:`);
                console.log(`  RecordId: ${record.RecordId}`);
                console.log(`  RR: ${record.RR}`);
                console.log(`  Type: ${record.Type}`);
                console.log(`  Value: ${record.Value}`);
                console.log(`  Status: ${record.Status}`);
                console.log('');
            });
            
            // 询问是否删除
            console.log('是否删除这些记录? (yes/no)');
            const readline = require('readline').createInterface({
                input: process.stdin,
                output: process.stdout
            });
            
            readline.question('> ', async (answer) => {
                if (answer.toLowerCase() === 'yes') {
                    console.log('\n===== 开始删除记录 =====');
                    for (const record of acmeRecords) {
                        try {
                            await client.request('DeleteDomainRecord', {
                                "RecordId": record.RecordId
                            }, { method: 'POST' });
                            console.log(`✅ 已删除: ${record.RR} (${record.RecordId})`);
                        } catch (e) {
                            console.error(`❌ 删除失败: ${record.RR} - ${e.message}`);
                        }
                    }
                    console.log('\n✅ 清理完成！');
                } else {
                    console.log('已取消');
                }
                readline.close();
            });
        }
    } catch (e) {
        console.error('查询失败:', e.message);
        process.exit(1);
    }
}

main();
