# gatewayui
Tweet downloader for macOS and Windows. Without API keys.

## Building
![Build/release](https://github.com/Vulpes-fox/gatewayui/workflows/Build/release/badge.svg)<br>
Releases are not signed, your operating system may show a warning when opening the application.

### Self building
To build the application yourself follow these steps:
#### 1. Install Node.js
#### 2. Install Yarn
```
npm install -g yarn
```
#### 3. Clone the repository
```
git clone https://github.com/Vulpes-fox/gatewayui.git
cd gatewayui
```
You can also download the source code directly from your browser and then navigate to the directory in the terminal / command line.
#### 4. Install node dependencies
```
npm install
```
#### 5. Compile SCSS
```
npm run build
```
#### 6. Build final application
```
yarn dist
```
