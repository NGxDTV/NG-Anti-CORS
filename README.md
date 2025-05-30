# NG-Anti-CORS 1.2 🛡️ 

## The Ultimate CORS Enabler for Developers 🚀

![Version](https://img.shields.io/badge/version-1.2-blue)
![Chrome](https://img.shields.io/badge/Chrome-supported-green)
![Opera](https://img.shields.io/badge/Opera-supported-green)

**NG-Anti-CORS** is a powerful browser extension that allows CORS (Cross-Origin Resource Sharing) requests with just one click. The perfect developer tool for testing APIs and debugging applications in local environments! 🔧

## Features ✨

- **Easy to Use** 🖱️ - One-click activation for any domain
- **Domain-specific Control** 🌐 - Enable CORS requests only for specific domains
- **Advanced Fetch & XHR Support** 🔄 - Deep integration with browser request APIs
- **Preflight Control** 🛂 - Optional handling of CORS preflight requests
- **All HTTP Methods** 📡 - Support for GET, POST, PUT, PATCH, DELETE, OPTIONS, and more
- **Visual Indicators** 💡 - Color-coded icons show current status
- **Save Settings** 💾 - Retain your preferences even after browser restart
- **Customizable Notifications** 🔔 - Configure how and when notifications appear
- **Lightweight** 🪶 - Minimal impact on browser performance

## Installation 📥

1. **Chrome Web Store** (recommended):
   - Download the [latest Chrome / Opera release](https://chromewebstore.google.com/detail/ng-anti-cors/amlaedkdelmhjggadmigdcihfalbgpha)
   - Once approved, you'll be able to find it by searching for "NG-Anti-CORS"
   - Click "Add" and confirm the installation

2. **Manual Installation**:
   - Download the [latest release](https://github.com/NGxDTV/NG-Anti-CORS/releases)
   - Unzip the file to a folder
   - Open Chrome/Opera and navigate to `chrome://extensions/`
   - Enable "Developer mode" (top right)
   - Click "Load unpacked" and select the extracted folder

## Usage 🚀

1. Navigate to a website with CORS issues
2. Click on the NG-Anti-CORS icon in the toolbar
3. Enable the toggle for the current domain
4. Optional: Enable "Preflight Request handling" for advanced CORS scenarios
5. Optional: Check "Remember this setting for browser restart"
6. Reload the page - CORS requests are now allowed!

> **Note:** When the extension is not enabled for a domain, it doesn't modify the browser's default CORS behavior at all.

### Understanding CORS Modes

NG-Anti-CORS now features two operational modes for more granular control:

#### 1. Basic Mode (Default)
When you simply enable CORS for a domain, the extension will:
- Allow standard CORS for basic HTTP methods (GET, POST, HEAD)
- Work for most typical web requests and API calls
- Enable cross-origin access for simple content types

#### 2. Advanced Mode (with Preflight Handling)
When you enable both CORS and "Preflight Request handling", the extension will:
- Support advanced HTTP methods (PATCH, DELETE, PUT, OPTIONS, etc.)
- Handle complex requests with custom headers
- Process preflight (OPTIONS) requests automatically
- Support requests with credentials
- Enable all CORS features for complex APIs

**When to use Preflight Handling:**
- When working with RESTful APIs that use methods beyond GET/POST
- When your requests include custom headers
- When seeing errors related to "Method not allowed" in preflight responses
- When using authentication with cross-origin requests

## Adjusting Settings ⚙️

For advanced configurations:

1. Click on the NG-Anti-CORS icon
2. Select the "Settings" tab
3. Adjust notification duration and other options
4. Click "Save Settings"

## For Developers 👨‍💻

This plugin is especially useful for:

- Frontend developers working with APIs
- Testing web applications in local development environments
- Debugging CORS issues in production environments
- API integration and testing

## Troubleshooting 🔧

**Plugin not working?**

- Make sure the plugin is activated
- Check if CORS allowing is enabled for the current domain
- Completely reload the page (CTRL+F5)
- Check for errors in the developer tools (F12)
- Verify that the site is actually experiencing CORS issues that need to be bypassed

## Privacy and Security 🔒

**NG-Anti-CORS**:
- Collects **no** personal data
- Sends **no** information to remote servers
- Works completely locally in your browser
- Only stores your preferences for enabled domains

⚠️ **Security Notice**: This plugin is intended for development and testing purposes. Disable it when visiting sensitive websites as it affects the browser's security mechanisms.

## Version History 📝

### Version 1.2
- **Two-tier CORS Handling**: Separated basic CORS handling from advanced preflight handling
- **Fetch API Proxy**: Added intelligent Fetch API proxying that respects extension state
- **Method-based Control**: Basic methods (GET/POST) work with just CORS enabled, advanced methods (PATCH/DELETE/etc.) require preflight option
- **Advanced Preflight Handling**: New toggle specifically for managing CORS preflight (OPTIONS) requests
- **Better State Management**: Fixed issue where the extension was active even when disabled
- **Cross-component Communication**: Enhanced messaging between content scripts and background processes
- **Improved UI**: Added preflight toggle with helpful descriptions
- **Extended Method Support**: Now properly supports all HTTP methods including PATCH, HEAD, PROPFIND and more
- **Credentials Handling**: Correctly processes requests with credentials based on preflight setting
- **Comprehensive Error Handling**: Added detailed error reporting for troubleshooting

### Version 1.1
- **Critical Fix**: Corrected the core behavior of the extension. Previously, the extension was incorrectly blocking CORS when disabled. Now it correctly does not modify browser behavior when disabled.
- **Improved UI Labels**: Updated status messages and notifications to accurately reflect the extension's functionality

### Version 1.0
- Initial release

## Contributing 🤝

Contributions are welcome! If you want to help:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License 📄

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

Developed with ❤️ for the developer community
