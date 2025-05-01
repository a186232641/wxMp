const axios = require('axios');
const FormData = require('form-data');
const qs = require('querystring');
const {promisify} = require('util');
const path = require("path");
const fs = require("fs");
const sleep = promisify(setTimeout);
const jsQR = require('jsqr');
const { Jimp } = require("jimp");
const MP_WEIXIN_QQ_COM = 'https://mp.weixin.qq.com';
const BIZLOGIN_URL = MP_WEIXIN_QQ_COM + '/cgi-bin/bizlogin';
const QR_CODE_URL = 'https://mp.weixin.qq.com/cgi-bin/scanloginqrcode?action=getqrcode&random=';
const QR_CODE_ACK_URL = 'https://mp.weixin.qq.com/cgi-bin/scanloginqrcode?action=ask&token=&lang=zh_CN&f=json&ajax=1';
const LOGIN_URL = 'https://mp.weixin.qq.com/cgi-bin/bizlogin?action=login';

// 二维码扫描状态枚举
const QrCodeScanState = {
    UN_KNOW: -1,  // 未知结果
    WAIT_SCAN: 0, // 等待扫描
    DONE: 1,      // 已确认结果，扫描完成
    EXPIRE: 3,    // 二维码过期
    SCAN: 4,      // 扫描中，等待用户确认

    // 根据状态码获取状态名称
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

/**
 * Extract cookies from response headers and merge with existing cookies
 */
function getCookie(response, oldCookies) {
    const cookieSet = new Set(
        oldCookies.split(';')
            .map(s => s.trim())
            .filter(s => s.length > 0)
    );

    const setCookieHeaders = response.headers['set-cookie'] || [];
    setCookieHeaders
        .filter(s => !s.includes('EXPIRED'))
        .map(s => s.includes(';') ? s.split(';')[0].trim() : s.trim())
        .forEach(cookie => cookieSet.add(cookie));

    return Array.from(cookieSet).join('; ');
}

/**
 * Generate a new wxuin ID
 */
function getNewWxUin() {
    return String(process.hrtime.bigint()).substring(2);
}

/**
 * Pre-login step
 */
async function prelogin(cookies) {
    const response = await axios({
        method: 'post',
        url: BIZLOGIN_URL,
        headers: {
            'Cookie': cookies,
            'Referer': MP_WEIXIN_QQ_COM,
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        data: qs.stringify({
            action: 'prelogin',
            fingerprint: '967a5c902b755ed3c7e746b656e7e29e',
            token: '',
            lang: 'zh_CN',
            f: 'json',
            ajax: 1
        })
    });

    console.log('Prelogin response:', response.data);
    return getCookie(response, cookies);
}

/**
 * Start login process
 */
async function startlogin(cookies) {
    const response = await axios({
        method: 'post',
        url: 'https://mp.weixin.qq.com/cgi-bin/bizlogin?action=startlogin',
        headers: {
            'Cookie': cookies,
            'Referer': MP_WEIXIN_QQ_COM,
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
        },
        data: qs.stringify({
            userlang: 'zh_CN',
            redirect_url: '',
            login_type: 3,
            sessionid: Date.now() + '0',
            token: '',
            lang: 'zh_CN',
            f: 'json',
            ajax: 1
        })
    });

    console.log('Startlogin response:', response.data);
    return getCookie(response, cookies);
}

/**
 * 获取登录二维码解析的链接，将在10分钟后过期
 * @param {string} cookies - 现有的cookie字符串
 * @returns {Promise<Object>} - 解析出的二维码信息（登录链接）和更新后的cookies
 */
async function getQRCodeDecodeLink(cookies) {
    try {
        // 获取cookies，如果为空则使用空字符串
        cookies = cookies || "";

        // 检查cookies中是否包含wxuin
        if (!cookies.includes("wxuin")) {
            cookies = cookies + "; wxuin=" + getNewWxUin();
        }
        // 生成一个随机数，类似于原始请求中的random参数
        const randomParam = Date.now();

        // 构建请求URL
        const url = `https://mp.weixin.qq.com/cgi-bin/scanloginqrcode?action=getqrcode&random=${randomParam}`;

        // 构建请求头，模拟浏览器环境
        const headers = {
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
            "cookie": cookies
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

            // 更新cookies
            cookies = getCookie(response, cookies);

            try {
                // 解析二维码
                const image = await Jimp.read(qrCodePath);
                const { data, width, height } = image.bitmap;

                // 使用jsQR解析二维码
                const qrCode = jsQR(data, width, height);

                if (qrCode) {
                    console.log('✓ 二维码解析成功!');
                    return {
                        data: qrCode.data,
                        cookies
                    };
                } else {
                    console.log('✗ 无法识别二维码');
                    return { cookies };
                }
            } catch (error) {
                console.error('解析二维码失败:', error);
                // 即使解析失败也返回更新后的cookies
                return { cookies };
            }
        } else {
            console.error(`请求失败，状态码: ${response.status}`);
            return { cookies };
        }
    } catch (error) {
        console.error('获取二维码失败:', error);
        console.error(error.stack);
        return { cookies: cookies };
    }
}

/**
 * 检查二维码扫描状态
 * @param {string} cookies - Cookie字符串
 * @returns {Promise<number>} - 扫描状态码
 */
async function scanloginqrcodeAck(cookies) {
    try {
        const response = await axios({
            method: 'GET',
            url: QR_CODE_ACK_URL,
            headers: {
                'Cookie': cookies,
                'Referer': MP_WEIXIN_QQ_COM
            }
        });

        console.log('检查扫码状态响应:', response.data);

        const jsonObject = response.data;
        const baseResp = jsonObject.base_resp;

        if (baseResp && baseResp.ret === 0) {
            const status = jsonObject.status;
            console.log('当前状态:', QrCodeScanState.statusOf(status));
            return status;
        } else {
            console.warn('检查扫码结果失败, 结果=', jsonObject);
            return -1; // 返回未知状态的状态码
        }
    } catch (error) {
        console.error('检查扫码状态失败:', error.message);
        return -1;
    }
}

/**
 * Complete login after QR code is scanned
 */
async function login(cookies) {
    try {
        const response = await axios({
            method: 'post',
            url: LOGIN_URL,
            headers: {
                'Cookie': cookies,
                'Referer': MP_WEIXIN_QQ_COM,
                'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
            },
            data: qs.stringify({
                userlang: 'zh_CN',
                redirect_url: '',
                cookie_forbidden: 0,
                cookie_cleaned: 1,
                plugin_used: 0,
                login_type: 3,
                token: '',
                lang: 'zh_CN',
                f: 'json',
                ajax: 1
            })
        });

        const data = response.data;
        const loginCookies = getCookie(response, cookies);

        const result = {
            cookies: loginCookies
        };

        if (response.status === 200 && data.redirect_url) {
            // Extract token from redirect URL
            const tokenMatch = data.redirect_url.match(/\D+(\d+)\D*/);
            if (tokenMatch && tokenMatch[1]) {
                result.token = tokenMatch[1];
            }

            // Make a final request to the redirect URL
            const redirectUrl = MP_WEIXIN_QQ_COM + data.redirect_url;
            const redirectResponse = await axios({
                method: 'get',
                url: redirectUrl,
                headers: {
                    'Cookie': cookies,
                    'Referer': redirectUrl
                }
            });

            if (redirectResponse.status !== 200) {
                result.errorMsg = redirectResponse.data;
            }
        }

        return result;
    } catch (error) {
        console.error('Error during login:', error);
        return {error: error.message};
    }
}

/**
 * 定期检查二维码扫描状态
 * @param {string} cookies Cookie字符串
 * @returns {Promise<{status: number, cookies: string}>} 最终的扫描状态和cookies
 */
async function checkQrCodeStatus(cookies) {
    // 最大检查次数 (2分钟超时，每3秒检查一次)
    const MAX_ATTEMPTS = 40;
    let attempts = 0;
    let scanState;

    console.log('开始监控二维码扫描状态...');

    do {
        try {
            // 调用API检查状态
            scanState = await scanloginqrcodeAck(cookies);
            attempts++;

            // 打印当前状态
            const statusName = QrCodeScanState.statusOf(scanState);
            console.log(`检查 ${attempts}/${MAX_ATTEMPTS}: 二维码状态为 ${statusName}`);

            // 检查是否达到终止条件
            if (scanState === QrCodeScanState.DONE) {
                console.log('扫码登录成功!');
                break;
            } else if (scanState === QrCodeScanState.EXPIRE) {
                console.log('二维码已过期，请重新获取');
                break;
            } else if (attempts >= MAX_ATTEMPTS) {
                console.log('等待超时，请重新获取二维码');
                break;
            }

            // 等待3秒后再次检查
            await sleep(3000);
        } catch (error) {
            console.error('检查扫码状态时出错:', error);
            scanState = QrCodeScanState.UN_KNOW;
            break;
        }
    } while (scanState !== QrCodeScanState.DONE);

    return { status: scanState, cookies };
}

/**
 * Create a GET request to MP_WEIXIN_QQ_COM with cookies and follow redirects
 * @param {string} cookies - Cookies to include in the request
 * @returns {Promise<string>} - Updated cookies
 */
async function getMainPage(cookies) {
    try {
        const response = await axios({
            method: 'get',
            url: MP_WEIXIN_QQ_COM,
            headers: {
                'Cookie': cookies
            },
            maxRedirects: 5 // Equivalent to setFollowRedirects(true)
        });

        const updatedCookies = getCookie(response, cookies);
        console.log('获取到的cookies:', updatedCookies);
        return updatedCookies;
    } catch (error) {
        console.error('Error getting main page:', error);
        throw error;
    }
}

/**
 * 完整的登录流程
 * @param {string} initialCookies - 初始Cookie，可选
 * @returns {Promise<Object>} - 登录结果
 */
async function wxLogin(initialCookies = '') {
    try {
        console.log('=== 开始微信公众平台登录流程 ===');

        // 1. 获取主页并初始化cookies
        console.log('1. 获取主页和初始cookies');
        let cookies = await getMainPage(initialCookies);

        // 2. 预登录
        console.log('2. 执行预登录');
        cookies = await prelogin(cookies);

        // 3. 开始登录流程
        console.log('3. 开始登录流程');
        cookies = await startlogin(cookies);

        // 4. 获取并解析二维码
        console.log('4. 获取登录二维码');
        const qrResult = await getQRCodeDecodeLink(cookies);
        cookies = qrResult.cookies;
        const qrUrl = qrResult.data;

        if (!qrUrl) {
            console.error('获取二维码失败或解析失败');
            return { success: false, error: '二维码获取失败' };
        }

        console.log('二维码内容:', qrUrl);
        console.log('请使用微信扫描二维码完成登录');

        // 5. 定期检查二维码扫描状态
        console.log('5. 等待扫码...');
        const checkResult = await checkQrCodeStatus(cookies);

        if (checkResult.status !== QrCodeScanState.DONE) {
            console.error('扫码登录失败');
            return {
                success: false,
                error: '扫码失败',
                status: QrCodeScanState.statusOf(checkResult.status),
                cookies: checkResult.cookies
            };
        }

        // 6. 完成登录
        console.log('6. 完成登录');
        const loginResult = await login(checkResult.cookies);

        console.log('=== 登录流程结束 ===');

        return {
            success: !loginResult.error,
            ...loginResult
        };
    } catch (error) {
        console.error('登录流程出错:', error);
        return { success: false, error: error.message };
    }
}

// 使用示例
async function main() {
    // 可以使用之前保存的cookies
    let oldCookie = "ptcz=8ee1dee6c008eb87c055ba8f466e38a668452404e25ea763a81c495c21be7135; ua_id=p4R7PUHrOUw9AP7JAAAAAOtTsz34yO9Roh8k5rLLSsQ=; qimeiuuid42=18b1e0b0d15100a5699842c97630a75cd27dcfd637; qimeifingerprint=43eebbcba408005d45fafd3bd8cd7b0c; qimeiq36=; qimeih38=8cc884f5699842c97630a75c03000009818b1e; wxuin=39953027426791; pgv_pvid=7495067106; mm_lang=zh_CN; *clck=3964811679|1|fvj|0; xid=1d88897e745b192ff15b4d402429ea5d; *clsk=1mhpmx8|1746083222976|1|1|mp.weixin.qq.com/weheat-agent/payload/record; uuid=1cf67c41a4ea865563f49211ec61e6d2";

    // 开始登录流程
    const loginResult = await wxLogin(oldCookie);

    if (loginResult.success) {
        console.log('登录成功!');
        console.log('Token:', loginResult.token);

        // 将登录凭证保存到文件中
        fs.writeFileSync(
            'wx_login_info.json',
            JSON.stringify({
                cookies: loginResult.cookies,
                token: loginResult.token,
                time: new Date().toISOString()
            }, null, 2)
        );
        console.log('登录信息已保存到wx_login_info.json');
    } else {
        console.error('登录失败:', loginResult.error);
    }
}

// 如果直接运行此文件，则执行main函数
if (require.main === module) {
    main().catch(error => {
        console.error('程序执行失败:', error);
    });
}