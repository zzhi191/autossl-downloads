const Core = require('@alicloud/pop-core');

class AliyunDnsProvider {
    constructor(config) {
        this.client = new Core({
            accessKeyId: config.accessKeyId,
            accessKeySecret: config.accessKeySecret,
            endpoint: 'https://alidns.aliyuncs.com',
            apiVersion: '2015-01-09'
        });
    }

    async createRecord({ domain, rr, value, type }) {
        console.log(`[Aliyun] 准备解析记录 [${type}]: ${rr}.${domain} -> ${value}`);
        
        try {
            // 1. 获取所有解析记录（防止模糊查询遗漏或分页问题）
            const describeParams = {
                "DomainName": domain,
                "PageSize": 100,
                "RRKeyWord": rr, // 缩小范围但仍需精细过滤
                "Type": type
            };
            
            const recordsResponse = await this.client.request('DescribeDomainRecords', describeParams, { method: 'POST' });
            const allRecords = recordsResponse.DomainRecords?.Record || [];
            // 处理 API 可能返回单个对象而非数组的情况
            const records = Array.isArray(allRecords) ? allRecords : [allRecords];

            // 2. 彻底清理环境：删除所有同名同类型的旧记录
            const matchingRecords = records.filter(r => r.RR === rr && r.Type === type);
            if (matchingRecords.length > 0) {
                console.log(`[Aliyun] 发现 ${matchingRecords.length} 条旧记录，开始清理...`);
                for (const record of matchingRecords) {
                    console.log(`[Aliyun] 正在删除旧记录: ${record.RecordId} (${record.Value})`);
                    try {
                        await this.client.request('DeleteDomainRecord', { "RecordId": record.RecordId }, { method: 'POST' });
                    } catch (err) {
                        console.warn(`[Aliyun] 删除记录 ${record.RecordId} 失败:`, err.message);
                    }
                }
                // 等待阿里云 API 状态同步
                console.log('[Aliyun] 等待 3 秒确保清理生效...');
                await new Promise(resolve => setTimeout(resolve, 3000));
            }

            // 3. 添加新记录
            const addParams = {
                "DomainName": domain,
                "RR": rr,
                "Type": type,
                "Value": value,
                "TTL": 600
            };
            const result = await this.client.request('AddDomainRecord', addParams, { method: 'POST' });
            console.log('[Aliyun] 记录已成功添加，RecordId:', result.RecordId);
            return result;
        } catch (e) {
            console.error('[Aliyun] createRecord 操作失败:', e);
            // 处理阿里云"上一个操作还未完成"的情况（参考原版 certd）
            if (e.code === 'LastOperationNotFinished') {
                console.log('[Aliyun] 上一个操作还未完成，5s后重试...');
                await new Promise(resolve => setTimeout(resolve, 5000));
                return this.createRecord({ domain, rr, value, type });
            }
            if (e.code === 'Forbidden.RAM' || e.message.includes('authorized')) {
                throw new Error(`阿里云权限不足: 请确保已授予 AliyunDNSFullAccess 权限。详细错误: ${e.message}`);
            }
            throw e;
        }
    }

    /**
     * 验证 DNS 记录是否已生效（通过阿里云 API 查询）
     */
    async verifyRecord(domain, rr, expectedValue) {
        try {
            const recordsResponse = await this.client.request('DescribeDomainRecords', {
                "DomainName": domain,
                "RRKeyWord": rr,
                "Type": "TXT",
                "PageSize": 100
            }, { method: 'POST' });
            
            const allRecords = recordsResponse.DomainRecords?.Record || [];
            const records = Array.isArray(allRecords) ? allRecords : [allRecords];
            
            // 检查是否有且仅有一条匹配的记录
            const matchingRecords = records.filter(r => r.RR === rr && r.Type === 'TXT');
            if (matchingRecords.length === 1 && matchingRecords[0].Value === expectedValue) {
                return true;
            }
            console.log(`[Aliyun] 验证结果: 找到 ${matchingRecords.length} 条记录，值: ${matchingRecords.map(r => r.Value).join(', ')}`);
            return false;
        } catch (e) {
            console.warn('[Aliyun] verifyRecord 查询失败:', e.message);
            return false;
        }
    }

    async removeRecord({ domain, rr, value, type }) {
        console.log(`[Aliyun] 开始清理解析记录 [${type}]: ${rr}.${domain} (Value: ${value})`);
        try {
            const describeParams = {
                "DomainName": domain,
                "RRKeyWord": rr,
                "Type": type
            };
            const recordsResponse = await this.client.request('DescribeDomainRecords', describeParams, { method: 'POST' });
            const allRecords = recordsResponse.DomainRecords?.Record || [];
            const records = Array.isArray(allRecords) ? allRecords : [allRecords];

            // 只要 RR 匹配就清理，确保不留痕迹
            const matchingRecords = records.filter(r => r.RR === rr && r.Type === type);
            for (const record of matchingRecords) {
                console.log(`[Aliyun] 正在删除记录: ${record.RecordId}`);
                await this.client.request('DeleteDomainRecord', { "RecordId": record.RecordId }, { method: 'POST' });
            }
        } catch (e) {
            console.warn('[Aliyun] removeRecord 过程中出现异常:', e.message);
        }
    }
}

module.exports = AliyunDnsProvider;
