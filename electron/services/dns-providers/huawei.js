const core = require("@huaweicloud/huaweicloud-sdk-core");
const dns = require("@huaweicloud/huaweicloud-sdk-dns");

class HuaweiDnsProvider {
    constructor(config) {
        // 华为云需要 AccessKeyId, AccessKeySecret
        const credentials = new core.auth.BasicCredentials()
            .withAk(config.accessKeyId)
            .withSk(config.accessKeySecret);
        // ProjectId 也是 BasicCredentials 有时需要的，但 DNS 是 Global，可能不需要 specific project
        // 如果报错 ProjectId missing，我们需要想办法获取或默认。
        // 通常 DNS 可以在 global endpoint 使用。

        this.client = dns.DnsClient.newBuilder()
            .withCredential(credentials)
            .withEndpoint("dns.myhuaweicloud.com")
            .build();
    }

    async getZoneId(domain) {
        // 查询公网 Zone
        const request = new dns.ListPublicZonesRequest();
        // 模糊查询还是精确？SDK文档显示 name 为过滤条件
        request.name = domain;

        try {
            const response = await this.client.listPublicZones(request);
            if (response.zones && response.zones.length > 0) {
                // 寻找精确匹配 (华为云 Zone 名称通常带点，如 "example.com.")
                const target = domain.endsWith('.') ? domain : domain + '.';
                const zone = response.zones.find(z => z.name === target);
                return zone ? zone.id : null;
            }
        } catch (e) {
            console.error('[Huawei] GetZoneId Error:', e.message);
        }
        return null;
    }

    async createRecord({ domain, rr, type, value }) {
        try {
            const zoneId = await this.getZoneId(domain);
            if (!zoneId) {
                throw new Error(`在华为云未找到域名 ${domain} 的托管 Zone`);
            }

            const body = new dns.CreateRecordSetRequestBody();
            // 华为云要求完整域名，以点结尾
            body.name = `${rr}.${domain}.`;
            body.type = type;
            body.records = [value];
            // TTL 默认 300
            body.ttl = 300;

            const request = new dns.CreateRecordSetRequest();
            request.zoneId = zoneId;
            request.body = body;

            await this.client.createRecordSet(request);
            console.log(`[Huawei] 记录创建成功: ${rr}.${domain} -> ${value}`);
        } catch (err) {
            // 检查是否重复
            if (err.message && (err.message.includes('already exists') || err.message.includes('Conflicting'))) {
                console.log('[Huawei] 记录已存在，跳过');
                return;
            }
            throw new Error(`华为云添加解析失败: ${err.message}`);
        }
    }

    async removeRecord({ domain, rr, type, value }) {
        try {
            const zoneId = await this.getZoneId(domain);
            if (!zoneId) return; // Zone 不存在则无需清理

            // 这里需要列出所有记录集来找到对应的 ID
            const request = new dns.ListRecordSetsByZoneRequest();
            request.zoneId = zoneId;
            request.name = `${rr}.${domain}.`; // 过滤名称

            const response = await this.client.listRecordSetsByZone(request);
            if (response.recordsets) {
                for (const rs of response.recordsets) {
                    // 匹配类型和值
                    // rs.records 是数组 (TXT可能有多个值)
                    if (rs.type === type) {
                        // 如果 value 为空则删除该记录集，或者匹配 value
                        if (!value || rs.records.includes(value)) {
                            const delReq = new dns.DeleteRecordSetRequest();
                            delReq.zoneId = zoneId;
                            delReq.recordsetId = rs.id;
                            await this.client.deleteRecordSet(delReq);
                            console.log(`[Huawei] 记录删除成功: ${rs.id}`);
                        }
                    }
                }
            }
        } catch (err) {
            console.warn(`[Huawei] 删除解析失败 (非阻断性): ${err.message}`);
        }
    }
}

module.exports = HuaweiDnsProvider;
