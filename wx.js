const axios = require('axios');
const fs = require('fs');
const path = require('path');

/**
 * WeChat QR Code Login class
 * Implements the login flow for WeChat Official Accounts
 */
class WeChatQRCodeLogin {
    constructor() {
        // Base URLs
        this.baseUrl = 'https://mp.weixin.qq.com';
        this.sessionid = null;
        this.hasStartLogin = false;
        // 设置保存二维码的路径
        this.qrCodeSavePath = path.join(__dirname, 'qrcode.png');
    }

    /**
     * Initialize the login process
     */
    async initialize() {
        try {
            // Generate session ID
            this.sessionid = this.generateSessionId();
            console.log(`Session ID: ${this.sessionid}`);

            // Step 1: Call pre-login API
            await this.callPreLoginAPI();

            // Step 2: Report metrics
            await this.reportMetrics();

            // Step 3: Start login process
            await this.startLogin();

            // Step 4: Get QR code URL and save the image
            const qrCodeUrl = await this.getQRCodeUrl();
            console.log(`QR Code URL: ${qrCodeUrl}`);
            console.log(`二维码已保存到: ${this.qrCodeSavePath}`);

            // Start polling for login status
            this.startPolling();

            return {
                sessionid: this.sessionid,
                qrCodeUrl,
                qrCodeSavePath: this.qrCodeSavePath
            };
        } catch (error) {
            console.error('Error initializing login process:', error);
            throw error;
        }
    }

    /**
     * Generate session ID
     */
    generateSessionId() {
        return new Date().getTime() + "" + Math.floor(Math.random() * 100);
    }

    /**
     * Call pre-login API
     */
    async callPreLoginAPI() {
        try {
            console.log('Calling pre-login API...');
            const response = await axios({
                method: 'post',
                url: `${this.baseUrl}/cgi-bin/bizlogin`,
                data: 'action=prelogin&fingerprint=967a5c902b755ed3c7e746b656e7e29e&token=&lang=zh_CN&f=json&ajax=1',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36',
                    'Referer': 'https://mp.weixin.qq.com/'
                }
            });


            console.log('Pre-login response:', response.data);
            return response.data;
        } catch (error) {
            console.error('Error calling pre-login API:', error);
            throw error;
        }
    }

    /**
     * Report metrics
     */
    async reportMetrics() {
        try {
            console.log('Reporting metrics...');
            const reportJson = {
                devicetype: 1,
                newsessionid: this.sessionid,
                optype: 1,
                page_state: 3,
                log_id: 19015
            };

            const response = await axios({
                method: 'post',
                url: `${this.baseUrl}/cgi-bin/webreport`,
                data: `reportjson=${encodeURIComponent(JSON.stringify(reportJson))}&fingerprint=967a5c902b755ed3c7e746b656e7e29e&token=&lang=zh_CN&f=json&ajax=1`,
                headers: {
                    "accept": "*/*",
                    "accept-language": "zh-CN,zh;q=0.9,en;q=0.8",
                    "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
                    "priority": "u=1, i",
                    "sec-ch-ua": "\"Google Chrome\";v=\"135\", \"Not-A.Brand\";v=\"8\", \"Chromium\";v=\"135\"",
                    "sec-ch-ua-mobile": "?0",
                    "sec-ch-ua-platform": "\"macOS\"",
                    "sec-fetch-dest": "empty",
                    "sec-fetch-mode": "cors",
                    "sec-fetch-site": "same-origin",
                    "x-requested-with": "XMLHttpRequest",
                    "Referer": "https://mp.weixin.qq.com/",
                    "Referrer-Policy": "strict-origin-when-cross-origin"
                }
            });

            console.log('Report metrics response:', response.data);
            return response.data;
        } catch (error) {
            console.error('Error reporting metrics:', error);
            throw error;
        }
    }

    /**
     * Start login process
     */
    async startLogin() {
        try {
            console.log('Starting login process...');
            const loginData = `userlang=zh_CN&redirect_url=&login_type=3&sessionid=${this.sessionid}&lang=zh_CN&f=json&ajax=1&fingerprint=967a5c902b755ed3c7e746b656e7e29e&token=`;

            const response = await axios({
                method: 'post',
                url: `${this.baseUrl}/cgi-bin/bizlogin?action=startlogin`,
                data: loginData,
                headers: {
                    "accept": "*/*",
                    "accept-language": "zh-CN,zh;q=0.9,en;q=0.8",
                    "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
                    "priority": "u=1, i",
                    "sec-ch-ua": "\"Google Chrome\";v=\"135\", \"Not-A.Brand\";v=\"8\", \"Chromium\";v=\"135\"",
                    "sec-ch-ua-mobile": "?0",
                    "sec-ch-ua-platform": "\"macOS\"",
                    "sec-fetch-dest": "empty",
                    "sec-fetch-mode": "cors",
                    "sec-fetch-site": "same-origin",
                    "x-requested-with": "XMLHttpRequest",
                    "Referer": "https://mp.weixin.qq.com/",
                    "Referrer-Policy": "strict-origin-when-cross-origin",
                    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36"
                }
            });

            console.log('Start login response:', response.data);

            if (response.data.base_resp && response.data.base_resp.ret === 0) {
                this.hasStartLogin = true;
            }

            return response.data;
        } catch (error) {
            console.error('Error starting login:', error);
            throw error;
        }
    }

    /**
     * Get QR code URL and download the image
     */
    async getQRCodeUrl() {
        const random = new Date().getTime();
        const qrCodeUrl = `${this.baseUrl}/cgi-bin/scanloginqrcode?action=getqrcode&random=${random}`;

        try {
            // 下载二维码图片
            console.log('下载二维码图片...');
            const response = await axios({
                method: 'get',
                url: qrCodeUrl,
                responseType: 'arraybuffer',  // 指定响应类型为二进制数据
                headers: {
                    "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
                    "accept-language": "zh-CN,zh;q=0.9,en;q=0.8",
                    "referer": "https://mp.weixin.qq.com/",
                    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36"
                }
            });

            // 将图片数据保存到文件
            fs.writeFileSync(this.qrCodeSavePath, Buffer.from(response.data));
            console.log(`二维码已保存到: ${this.qrCodeSavePath}`);

            return qrCodeUrl;
        } catch (error) {
            console.error('Error downloading QR code:', error);
            // 如果下载失败，仍然返回URL
            return qrCodeUrl;
        }
    }

    /**
     * Check login status
     */
    async checkLoginStatus() {
        try {
            if (!this.hasStartLogin) {
                console.log('Login process has not started yet');
                return {status: -1, statusText: 'not_started'};
            }

            console.log('Checking login status...');
            const response = await axios({
                method: 'get',
                url: `${this.baseUrl}/cgi-bin/scanloginqrcode?action=ask&fingerprint=967a5c902b755ed3c7e746b656e7e29e&token=&lang=zh_CN&f=json&ajax=1`,
                headers: {
                    "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
                    "accept-language": "zh-CN,zh;q=0.9,en;q=0.8",
                    "referer": "https://mp.weixin.qq.com/",
                },
            });
            console.log('Login status response:', response.data);

            // Process status
            let statusText = 'unknown';
            const status = response.data;

            if (status.status === 0) {
                statusText = 'not_scanned';
            } else if (status.status === 4) {
                statusText = 'scanned_not_confirmed';
            } else if (status.status === 1) {
                statusText = 'login_successful';
            }

            return {
                ...status,
                statusText
            };
        } catch (error) {
            console.error('Error checking login status:', error);
            throw error;
        }
    }

    /**
     * Start polling for login status
     */
    startPolling() {
        console.log('Starting polling for login status...');

        // Check login status every 2 seconds
        const interval = setInterval(async () => {
            try {
                const status = await this.checkLoginStatus();

                console.log(`Login status: ${status.statusText}`);

                // If login successful, stop polling
                if (status.statusText === 'login_successful') {
                    console.log('Login successful! Stopping polling...');
                    clearInterval(interval);

                    // Handle successful login
                    this.handleLoginSuccess(status);
                }
            } catch (error) {
                console.error('Error polling login status:', error);
            }
        }, 2000);

        // Stop polling after 2 minutes (QR code typically expires after 1-2 minutes)
        setTimeout(() => {
            clearInterval(interval);
            console.log('Polling stopped due to timeout. QR code may have expired.');
        }, 120000);
    }

    /**
     * Handle successful login
     */
    handleLoginSuccess(status) {
        console.log('Login successful!');
        console.log('User category:', status.user_category);
        console.log('Account size:', status.acct_size);

        // Additional operations after successful login can be added here
        // For example, redirect to dashboard, fetch user info, etc.
    }

    /**
     * Refresh QR code
     */
    async refreshQRCode() {
        const qrCodeUrl = await this.getQRCodeUrl();
        console.log(`Refreshed QR Code URL: ${qrCodeUrl}`);
        console.log(`刷新的二维码已保存到: ${this.qrCodeSavePath}`);
        return qrCodeUrl;
    }
}

// 使用示例
async function runExample() {
    try {
        const wechatLogin = new WeChatQRCodeLogin();
        const result = await wechatLogin.initialize();

        console.log('请使用微信扫描以下二维码:');
        console.log(`二维码URL: ${result.qrCodeUrl}`);
        console.log(`二维码已保存到: ${result.qrCodeSavePath}`);

        // 状态将自动轮询
    } catch (error) {
        console.error('运行示例时出错:', error);
    }
}

// 如果此脚本直接执行，则运行示例
if (require.main === module) {
    runExample();
}

module.exports = WeChatQRCodeLogin;