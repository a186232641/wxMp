/**
 * 微信公众平台二维码登录完整实现
 *
 * 这个脚本实现了微信公众平台的扫码登录流程，包括:
 * 1. 获取登录二维码
 * 2. 定期检查二维码扫描状态
 * 3. 完成登录流程
 *
 * 使用axios处理HTTP请求，jimp解析二维码图片
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');
const {jimp} = require('jimp');
const jsQR = require('jsqr');

// 二维码扫描状态枚举
const QrCodeScanState = {
    UN_KNOW: -1,  // 未知结果
    WAIT_SCAN: 0, // 等待扫描
    DONE: 1,      // 已确认结果，扫描完成
    EXPIRE: 3,    // 二维码过期
    SCAN: 4,      // 扫描中，等待用户确认

    // 根据状态码获取状态
    statusOf(status) {
        const states = [
            { status: -1, name: 'UN_KNOW' },
            { status: 0, name: 'WAIT_SCAN' },
            { status: 1, name: 'DONE' },
            { status: 3, name: 'EXPIRE' },
            { status: 4, name: 'SCAN' }
        ];

        const state = states.find(s => s.status === status);
        return state ? state.name : 'UN_KNOW';
    }
};

// 微信账号类，存储登录状态和信息
class WxAccount {
    constructor(name = '') {
        this.name = name;
        this.htmlPageCookies = '';
        this.htmlPageToken = '';
    }

    setHtmlPageCookies(cookies) {
        this.htmlPageCookies = cookies;
    }

    getHtmlPageCookies() {
        return this.htmlPageCookies;
    }

    setHtmlPageToken(token) {
        this.htmlPageToken = token;
    }

    getHtmlPageToken() {
        return this.htmlPageToken;
    }
}

// 微信登录工具类
class WxLoginUtil {
    constructor() {
        this.MP_WEIXIN_QQ_COM = 'https://mp.weixin.qq.com';
        this.BIZLOGIN_URL = this.MP_WEIXIN_QQ_COM + '/cgi-bin/bizlogin';
    }

    /**
     * 获取cookie字符串中的指定cookie值
     * @param {string} cookies Cookie字符串
     * @param {string} name Cookie名称
     * @returns {string} Cookie值
     */
    getCookieValue(cookies, name) {
        const match = cookies.match(new RegExp(`${name}=([^;]+)`));
        return match ? match[1] : '';
    }

    /**
     * 合并Cookie字符串
     * @param {string} oldCookies 旧的Cookie字符串
     * @param {Object} response Axios响应对象
     * @returns {string} 合并后的Cookie字符串
     */
    getCookie(response, oldCookies) {
        // 提取旧cookie为集合
        const cookieSet = oldCookies
            .split(';')
            .map(s => s.trim())
            .filter(s => s !== '')
            .reduce((set, cookie) => {
                set.add(cookie);
                return set;
            }, new Set());

        // 添加新cookie
        const setCookieHeaders = response.headers['set-cookie'] || [];
        setCookieHeaders.forEach(cookieStr => {
            if (!cookieStr.includes('EXPIRED')) {
                const cookie = cookieStr.includes(';') ? cookieStr.split(';')[0].trim() : cookieStr.trim();
                cookieSet.add(cookie);
            }
        });

        // 转换回字符串
        return Array.from(cookieSet).join('; ');
    }

    /**
     * 预登录，获取初始Cookie
     * @param {string} cookies 初始Cookie字符串，如果没有可以为空
     * @returns {Promise<string>} 更新后的Cookie字符串
     */
    async prelogin(cookies) {
        try {
            const response = await axios({
                method: 'POST',
                url: this.BIZLOGIN_URL,
                headers: {
                    'Cookie': cookies,
                    'Referer': this.MP_WEIXIN_QQ_COM,
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                data: 'action=prelogin&fingerprint=967a5c902b755ed3c7e746b656e7e29e&token=&lang=zh_CN&f=json&ajax=1'
            });

            console.log('预登录响应:', response.data);
            return this.getCookie(response, cookies);
        } catch (error) {
            console.error('预登录失败:', error.message);
            throw error;
        }
    }

    /**
     * 开始登录流程
     * @param {string} cookies Cookie字符串
     * @returns {Promise<string>} 更新后的Cookie字符串
     */
    async startlogin(cookies) {
        try {
            const response = await axios({
                method: 'POST',
                url: this.MP_WEIXIN_QQ_COM + '/cgi-bin/bizlogin?action=startlogin',
                headers: {
                    'Cookie': cookies,
                    'Referer': this.MP_WEIXIN_QQ_COM,
                    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
                },
                data: `userlang=zh_CN&redirect_url=&login_type=3&sessionid=${Date.now()}0&token=&lang=zh_CN&f=json&ajax=1`
            });

            console.log('开始登录响应:', response.data);
            return this.getCookie(response, cookies);
        } catch (error) {
            console.error('开始登录失败:', error.message);
            throw error;
        }
    }

    /**
     * 获取随机的wxuin
     * @returns {string} 随机生成的wxuin
     */
    getNewWxUin() {
        return process.hrtime.bigint().toString().substring(2);
    }

    /**
     * 获取并解析登录二维码
     * @param {WxAccount} wxAccount 微信账号对象
     * @returns {Promise<string>} 二维码解析出的链接
     */
    async getQRCodeDecodeLink(wxAccount) {
        try {
            let cookies = wxAccount.getHtmlPageCookies() || '';

            // 确保cookies中包含wxuin
            if (!cookies.includes('wxuin')) {
                const wxuin = this.getNewWxUin();
                cookies = cookies + `; wxuin=${wxuin}`;
            }

            // 请求二维码图片
            const response = await axios({
                method: 'GET',
                url: `https://mp.weixin.qq.com/cgi-bin/scanloginqrcode?action=getqrcode&random=${Date.now()}`,
                headers: {
                    'Cookie': cookies,
                    'Referer': this.MP_WEIXIN_QQ_COM
                },
                responseType: 'arraybuffer'
            });

            // 更新cookie
            cookies = this.getCookie(response, cookies);
            wxAccount.setHtmlPageCookies(cookies);

            // 保存二维码图片
            const qrcodePath = path.join(__dirname, 'qrcodeInfo.png');
            fs.writeFileSync(qrcodePath, response.data);
            console.log('二维码图片已保存至:', qrcodePath);

            // 解析二维码
            const qrcodeInfo = await this.decodeQRCode(qrcodePath);
            console.log('二维码解析结果:', qrcodeInfo);

            return qrcodeInfo;
        } catch (error) {
            console.error('获取二维码失败:', error.message);
            throw error;
        }
    }

    /**
     * 解析二维码图片
     * @param {string} imagePath 二维码图片路径
     * @returns {Promise<string>} 解析结果
     */
    async decodeQRCode(imagePath) {
        try {
            // 读取图片
            const image = await jimp.read(imagePath);

            // 获取图片数据
            const { data, width, height } = image.bitmap;

            // 使用jsQR解析二维码
            const qrCode = jsQR(data, width, height);

            if (qrCode) {
                return qrCode.data;
            } else {
                throw new Error('无法解析二维码');
            }
        } catch (error) {
            console.error('解析二维码失败:', error.message);
            throw error;
        }
    }

    /**
     * 检查二维码扫描状态
     * @param {string} cookies Cookie字符串
     * @returns {Promise<string>} 扫描状态
     */
    async scanloginqrcodeAck(cookies) {
        try {
            const response = await axios({
                method: 'GET',
                url: 'https://mp.weixin.qq.com/cgi-bin/scanloginqrcode?action=ask&token=&lang=zh_CN&f=json&ajax=1',
                headers: {
                    'Cookie': cookies,
                    'Referer': this.MP_WEIXIN_QQ_COM
                }
            });

            console.log('检查扫码状态响应:', response.data);

            const jsonObject = response.data;
            const baseResp = jsonObject.base_resp;

            if (baseResp && baseResp.ret === 0) {
                const status = jsonObject.status;
                return QrCodeScanState.statusOf(status);
            } else {
                console.warn('检查扫码结果失败, 结果=', jsonObject);
                return QrCodeScanState.statusOf(-1);
            }
        } catch (error) {
            console.error('检查扫码状态失败:', error.message);
            return QrCodeScanState.statusOf(-1);
        }
    }

    /**
     * 完成登录流程
     * @param {string} cookies Cookie字符串
     * @returns {Promise<Object>} 登录结果，包含cookies和token
     */
    async login(cookies) {
        try {
            const response = await axios({
                method: 'POST',
                url: 'https://mp.weixin.qq.com/cgi-bin/bizlogin?action=login',
                headers: {
                    'Cookie': cookies,
                    'Referer': this.MP_WEIXIN_QQ_COM,
                    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
                },
                data: 'userlang=zh_CN&redirect_url=&cookie_forbidden=0&cookie_cleaned=1&plugin_used=0&login_type=3&token=&lang=zh_CN&f=json&ajax=1'
            });

            console.log('登录响应:', response.data);

            const jsonObject = response.data;
            const loginCookies = this.getCookie(response, cookies);
            const result = { cookies: loginCookies };

            if (response.status === 200) {
                const redirectUrl = jsonObject.redirect_url;
                if (redirectUrl) {
                    // 从redirect_url中提取token
                    const tokenMatch = redirectUrl.match(/\\D+(\\d+)\\D*/);
                    const token = tokenMatch ? tokenMatch[1] : '';
                    result.token = token;

                    // 访问重定向URL
                    const redirectResponse = await axios({
                        method: 'GET',
                        url: this.MP_WEIXIN_QQ_COM + redirectUrl,
                        headers: {
                            'Cookie': cookies,
                            'Referer': redirectUrl
                        }
                    });

                    if (redirectResponse.status !== 200) {
                        result.errorMsg = redirectResponse.data;
                    }
                }
            }

            return result;
        } catch (error) {
            console.error('登录失败:', error.message);
            throw error;
        }
    }

    /**
     * 强制获取登录二维码并完成整个登录流程
     * @param {WxAccount} wxAccount 微信账号对象
     * @returns {Promise<Object>} 登录结果
     */
    async completeLoginProcess(wxAccount) {
        try {
            // 初始化获取cookie
            const initResponse = await axios.get(this.MP_WEIXIN_QQ_COM, {
                maxRedirects: 5
            });

            let cookie = this.getCookie(initResponse, '');
            console.log('初始Cookie:', cookie);

            // 预登录
            cookie = await this.prelogin(cookie);
            console.log('预登录后Cookie:', cookie);

            // 开始登录
            cookie = await this.startlogin(cookie);
            console.log('开始登录后Cookie:', cookie);

            // 更新账号的Cookie
            wxAccount.setHtmlPageCookies(cookie);

            // 获取二维码
            const qrCodeLink = await this.getQRCodeDecodeLink(wxAccount);
            console.log('二维码链接:', qrCodeLink);

            // 获取更新后的Cookie
            cookie = wxAccount.getHtmlPageCookies();

            // 定期检查二维码扫描状态
            console.log('请使用微信扫描二维码进行登录...');
            let qrCodeScanState;
            let retryCount = 0;
            const maxRetries = 120; // 最多等待120次，每次1秒，即2分钟

            do {
                // 等待1秒后再检查
                await new Promise(resolve => setTimeout(resolve, 1000));

                // 检查二维码扫描状态
                qrCodeScanState = await this.scanloginqrcodeAck(cookie);
                console.log(`当前状态 (${retryCount + 1}/${maxRetries}):`, qrCodeScanState);

                retryCount++;
                if (retryCount >= maxRetries) {
                    throw new Error('等待扫码超时，请重新获取二维码');
                }
            } while (qrCodeScanState !== 'DONE' && qrCodeScanState !== 'UN_KNOW');

            // 完成登录
            console.log('扫码完成，正在完成登录...');
            const loginResult = await this.login(cookie);
            console.log('登录结果:', loginResult);

            // 更新账号信息
            wxAccount.setHtmlPageCookies(loginResult.cookies);
            if (loginResult.token) {
                wxAccount.setHtmlPageToken(loginResult.token);
            }

            return loginResult;
        } catch (error) {
            console.error('登录流程失败:', error.message);
            throw error;
        }
    }

    /**
     * 检查cookie是否已过期
     * @param {WxAccount} wxAccount 微信账号对象
     * @returns {Promise<boolean>} true表示未过期，false表示已过期
     */
    async cookieIsNotExpire(wxAccount) {
        try {
            const cookies = wxAccount.getHtmlPageCookies();
            if (!cookies) return false;

            const response = await axios({
                method: 'GET',
                url: this.MP_WEIXIN_QQ_COM,
                headers: {
                    'Cookie': cookies
                },
                maxRedirects: 5
            });

            const body = response.data;

            // 检查返回页面中是否包含token
            const tokenRegex = /[ ]+token: '(\d+)',$/gm;
            const tokenMatch = tokenRegex.exec(body);

            if (tokenMatch && tokenMatch[1]) {
                wxAccount.setHtmlPageToken(tokenMatch[1]);
                return true;
            }

            return false;
        } catch (error) {
            console.error('检查cookie过期失败:', error.message);
            return false;
        }
    }
}

// 主函数
async function main() {
    try {
        // 创建微信账号对象
        const wxAccount = new WxAccount('测试账号');
        const wxLoginUtil = new WxLoginUtil();

        console.log('=== 微信公众平台二维码登录 ===');

        // 检查是否有保存的Cookie
        if (fs.existsSync('wx_cookies.json')) {
            try {
                const savedData = JSON.parse(fs.readFileSync('wx_cookies.json', 'utf8'));
                wxAccount.setHtmlPageCookies(savedData.cookies);
                wxAccount.setHtmlPageToken(savedData.token);

                console.log('发现保存的登录状态，正在验证有效性...');
                const isValid = await wxLoginUtil.cookieIsNotExpire(wxAccount);

                if (isValid) {
                    console.log('已有的登录状态有效，无需重新登录');
                    console.log('Token:', wxAccount.getHtmlPageToken());
                    return;
                } else {
                    console.log('已有的登录状态已过期，需要重新登录');
                }
            } catch (error) {
                console.error('读取保存的Cookie失败:', error.message);
            }
        }

        // 执行完整登录流程
        console.log('开始登录流程...');
        const loginResult = await wxLoginUtil.completeLoginProcess(wxAccount);

        // 保存登录状态
        fs.writeFileSync(
            'wx_cookies.json',
            JSON.stringify({
                cookies: wxAccount.getHtmlPageCookies(),
                token: wxAccount.getHtmlPageToken()
            }, null, 2)
        );

        console.log('=== 登录成功 ===');
        console.log('Token:', wxAccount.getHtmlPageToken());
        console.log('登录状态已保存至 wx_cookies.json');
    } catch (error) {
        console.error('程序执行失败:', error.message);
    }
}

// 执行主程序
main().catch(console.error);

/**
 * 使用说明:
 * 1. 安装所需依赖:
 *    npm install axios jimp jsqr
 *
 * 2. 保存此文件为 wx-login.js
 *
 * 3. 运行脚本:
 *    node wx-login.js
 *
 * 4. 脚本会保存二维码到当前目录的qrcodeInfo.png
 *
 * 5. 使用微信扫描二维码完成登录
 *
 * 6. 登录成功后，登录状态将保存在 wx_cookies.json 文件中
 *
 * 注意事项:
 * - 二维码有效期通常为2分钟，请及时扫描
 * - 登录后的Cookie通常有效期为几天
 * - 本代码仅供学习和参考，请勿用于非法用途
 */