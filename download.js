/**
 * 模拟微信公众平台二维码请求的Node.js脚本
 *
 * 这个脚本使用axios发送请求来获取微信公众平台的登录二维码
 * 并将二维码图片保存到本地
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

// 创建一个异步函数来执行请求
async function fetchWechatQRCode() {
    try {
        // 生成一个随机数，类似于原始请求中的random参数
        const randomParam = Date.now();
        let cookie ="ua_id=p4R7PUHrOUw9AP7JAAAAAOtTsz34yO9Roh8k5rLLSsQ=; _qimei_uuid42=18b1e0b0d15100a5699842c97630a75cd27dcfd637; _qimei_fingerprint=43eebbcba408005d45fafd3bd8cd7b0c; _qimei_q36=; _qimei_h38=8cc884f5699842c97630a75c03000009818b1e; wxuin=39953027426791; pgv_pvid=7495067106; mm_lang=zh_CN; _clck=3964811679|1|fvj|0; xid=a7c37d70b930a3437e1e90206a398ddd; _clsk=15nu932|1746076141136|1|1|mp.weixin.qq.com/weheat-agent/payload/record; uuid=3ab0c09c948fc6179bbe696a9cfe9e9d; uuid=e3de0a409d4da315830f80ab2d747a06"
        // 构建请求URL
        const url = `https://mp.weixin.qq.com/cgi-bin/scanloginqrcode?action=getqrcode&random=${randomParam}`;

        // 构建请求头，模拟浏览器环境
        const headers =   {
            "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,/;q=0.8,application/signed-exchange;v=b3;q=0.7",
                "accept-language": "zh-CN,zh;q=0.9,en;q=0.8",
                "cache-control": "max-age=0",
                "priority": "u=0, i",
                "sec-ch-ua": "\"Google Chrome\";v=\"135\", \"Not-A.Brand\";v=\"8\", \"Chromium\";v=\"135\"",
                "sec-ch-ua-mobile": "?0",
                "sec-ch-ua-platform": "\"macOS\"",
                "sec-fetch-dest": "document",
                "sec-fetch-mode": "navigate",
                "sec-fetch-site": "none",
                "sec-fetch-user": "?1",
                "upgrade-insecure-requests": "1",
                "cookie": "ptcz=8ee1dee6c008eb87c055ba8f466e38a668452404e25ea763a81c495c21be7135; ua_id=p4R7PUHrOUw9AP7JAAAAAOtTsz34yO9Roh8k5rLLSsQ=; qimeiuuid42=18b1e0b0d15100a5699842c97630a75cd27dcfd637; qimeifingerprint=43eebbcba408005d45fafd3bd8cd7b0c; qimeiq36=; qimeih38=8cc884f5699842c97630a75c03000009818b1e; wxuin=39953027426791; pgv_pvid=7495067106; mm_lang=zh_CN; *clck=3964811679|1|fvj|0; xid=1d88897e745b192ff15b4d402429ea5d; *clsk=1mhpmx8|1746083222976|1|1|mp.weixin.qq.com/weheat-agent/payload/record; uuid=1cf67c41a4ea865563f49211ec61e6d2"
        };
        // 配置请求选项
        const options = {
            method: 'GET',
            url: url,
            headers: headers,
            responseType: 'arraybuffer', // 重要：使用arraybuffer接收二进制图片数据
            timeout: 10000 // 设置10秒超时
        };

        console.log('正在请求微信二维码...');

        // 发送请求
        const response = await axios(options);

        // 检查响应状态
        if (response.status === 200) {
            console.log('二维码获取成功，正在保存...');

            // 将二进制数据保存为图片文件
            const qrCodePath = path.join(__dirname, 'wechat_qrcode.jpg');
            fs.writeFileSync(qrCodePath, response.data);

            console.log(`二维码已保存到: ${qrCodePath}`);
            console.log('注意：该二维码可能有时效性，请尽快使用');
        } else {
            console.error(`请求失败，状态码: ${response.status}`);
        }
    } catch (error) {
        console.error('请求发生错误:');

        if (error.response) {
            // 服务器返回了错误状态码
            console.error(`状态码: ${error.response.status}`);
            console.error(`响应头: ${JSON.stringify(error.response.headers, null, 2)}`);
        } else if (error.request) {
            // 请求已发送但没有收到响应
            console.error('未收到服务器响应');
        } else {
            // 请求配置出错
            console.error(`错误信息: ${error.message}`);
        }

        console.error(`请求配置: ${JSON.stringify(error.config, null, 2)}`);
    }
}

// 创建一个更完整的版本，包括检查二维码状态和获取登录结果
async function completeWechatLoginProcess() {
    try {
        // 第一步：获取二维码
        await fetchWechatQRCode();

        console.log('\n二维码已生成，请使用微信扫描登录');
        console.log('注意：由于这只是模拟请求，所以无法完成完整的登录流程');
        console.log('实际应用中，您需要实现以下步骤:');
        console.log('1. 定期检查二维码扫描状态');
        console.log('2. 获取授权后的登录信息');
        console.log('3. 处理登录成功后的会话管理');

    } catch (error) {
        console.error('登录流程发生错误:', error);
    }
}

// 执行程序
console.log('=== 微信公众平台二维码登录模拟 ===');
completeWechatLoginProcess();

/**
 * 使用说明:
 * 1. 安装所需依赖: npm install axios
 * 2. 运行此脚本: node wechat_qrcode.js
 * 3. 脚本会下载二维码并保存为 wechat_qrcode.jpg
 *
 * 注意事项:
 * - 这个脚本只模拟了请求过程，没有实现完整的登录流程
 * - 在实际应用中，您需要实现定期检查二维码状态的逻辑
 * - 生成的二维码有时效性，通常需要在短时间内使用
 * - 请勿将此脚本用于非法用途
 */