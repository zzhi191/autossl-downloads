const tencentcloud = require("tencentcloud-sdk-nodejs");
const DnspodClient = tencentcloud.dnspod.v20210323.Client;

class TencentDnsProvider {
    constructor(config) {
        this.config = config;
        this.client = new DnspodClient({
            credential: {
                secretId: config.accessKeyId,
                secretKey: config.accessKeySecret,
            },
            region: "",
            profile: {
                httpProfile: {
                    endpoint: "dnspod.tencentcloudapi.com",
                },
            },
        });
    }

    async createRecord({ domain, rr, type, value }) {
        try {
            const params = {
                Domain: domain,
                SubDomain: rr,
                RecordType: type,
                RecordLine: '默认',
                Value: value
            };
            await this.client.CreateRecord(params);
            console.log(`[Tencent] 创建记录成功: ${rr}.${domain} -> ${value}`);
        } catch (err) {
            // 记录已存在错误处理
            if (err.message && (err.message.includes('Duplicate') || err.message.includes('记录已经存在'))) {
                console.log('[Tencent] 记录已存在，跳过创建');
                return;
            }
            throw new Error(`腾讯云添加解析失败: ${err.message}`);
        }
    }

    async removeRecord({ domain, rr, type, value }) {
        try {
            // 1. 查询记录列表获取 RecordId
            const listRes = await this.client.DescribeRecordList({
                Domain: domain,
                SubDomain: rr,
                RecordType: type
            });

            if (listRes.RecordList && listRes.RecordList.length > 0) {
                let deletedCount = 0;
                for (const record of listRes.RecordList) {
                    // 精确匹配记录值，或者 value 为 null 时删除所有同名记录
                    if (!value || record.Value === value) {
                        await this.client.DeleteRecord({
                            Domain: domain,
                            RecordId: record.RecordId
                        });
                        deletedCount++;
                        console.log(`[Tencent] 删除记录成功: ID=${record.RecordId}`);
                    }
                }
                if (deletedCount === 0) {
                    console.log('[Tencent] 未找到匹配的记录值，无需删除');
                }
            } else {
                console.log('[Tencent] 记录不存在，无需删除');
            }
        } catch (err) {
            console.warn(`[Tencent] 删除解析失败 (非阻断性): ${err.message}`);
        }
    }
}

module.exports = TencentDnsProvider;
