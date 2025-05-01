const WeChatQRCodeLogin = require('./wx');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const qrcode = require('qrcode-terminal');

/**
 * Test the WeChat QR Code login flow
 */
async function testWeChatLogin() {
    try {
        console.log('=== Testing WeChat QR Code Login ===');

        // Initialize login
        const wechatLogin = new WeChatQRCodeLogin();
        const loginInfo = await wechatLogin.initialize();

        // Display QR Code URL
        console.log('\nQR Code URL:');
        console.log(loginInfo.qrCodeUrl);

        // Download and save QR code image (optional)
        await downloadQRCode(loginInfo.qrCodeUrl);

        // Display QR code in terminal (requires qrcode-terminal package)
        await displayQRCodeInTerminal(loginInfo.qrCodeUrl);

        console.log('\nScanning test started. Please scan the QR code with WeChat.');
        console.log('The script will automatically check the login status every 2 seconds...');
        console.log('Press Ctrl+C to exit\n');

        // Login status will be checked automatically by the polling mechanism in the class
    } catch (error) {
        console.error('Error in test:', error);
    }
}

/**
 * Download and save QR code image
 * @param {string} url QR code URL
 */
async function downloadQRCode(url) {
    try {
        console.log('\nDownloading QR code image...');

        const response = await axios({
            method: 'get',
            url: url,
            responseType: 'arraybuffer'
        });

        const outputDir = path.join(__dirname, 'output');
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir);
        }

        const filePath = path.join(outputDir, 'qrcode.png');
        fs.writeFileSync(filePath, response.data);

        console.log(`QR code image saved to: ${filePath}`);
    } catch (error) {
        console.error('Error downloading QR code:', error);
    }
}

/**
 * Display QR code in terminal
 * @param {string} url URL to encode as QR code
 */
async function displayQRCodeInTerminal(url) {
    try {
        console.log('\nDisplaying QR code in terminal:');

        // Extract the actual URL content from the QR code
        // You'll need to make an actual request and scan the response to get this
        console.log('Note: This is displaying the URL of the QR code, not its content.');
        console.log('To display the actual content, you would need to extract it from the QR code first.');

        // For demonstration, we'll just use the QR code URL
        qrcode.generate(url, { small: true });
    } catch (error) {
        console.error('Error displaying QR code in terminal:', error);
    }
}

// Run the test
testWeChatLogin();