const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const rootDir = 'd:/Monitoring/monitoring-app';
const desktopDir = path.join(rootDir, 'desktop-app');
const buildDir = path.join(desktopDir, 'SmartLab-Release/win-unpacked');
const resourcesDir = path.join(buildDir, 'resources');


function copyFolderSync(from, to) {
    if (!fs.existsSync(to)) fs.mkdirSync(to, { recursive: true });
    fs.readdirSync(from).forEach(element => {
        const fromPath = path.join(from, element);
        const toPath = path.join(to, element);
        if (fs.lstatSync(fromPath).isFile()) {
            fs.copyFileSync(fromPath, toPath);
        } else if (element !== 'node_modules' && element !== '.git' && element !== 'dist') {
            copyFolderSync(fromPath, toPath);
        }
    });
}

try {
    console.log('--- STARTING PORTABLE BUILD ---');

    // 1. Copy backend
    console.log('Copying backend source...');
    const bundledBackend = path.join(resourcesDir, 'backend');
    if (fs.existsSync(bundledBackend)) {
        fs.rmSync(bundledBackend, { recursive: true, force: true });
    }
    copyFolderSync(path.join(rootDir, 'backend'), bundledBackend);

    // 2. Copy desktop-app .env
    console.log('Copying desktop-app .env...');
    const desktopEnv = path.join(desktopDir, '.env');
    const targetEnv = path.join(resourcesDir, '.env');
    if (fs.existsSync(desktopEnv)) {
        fs.copyFileSync(desktopEnv, targetEnv);
    } else {
        console.warn('Warning: desktop-app/.env not found!');
    }

    // 3. Install production dependencies in bundled backend
    console.log('Installing backend node_modules (production)...');
    execSync('npm install --omit=dev', { cwd: bundledBackend, stdio: 'inherit' });

    // 3. (REMOVED) Copy activity_monitor.exe - We now use native PowerShell in main.js

    // 4. Verification
    console.log('Verifying resources structure:');
    const files = fs.readdirSync(resourcesDir);
    console.log(files);

    if (files.includes('backend')) {
        console.log('Resources look correct!');
    } else {
        throw new Error('Critical files missing from resources folder!');
    }


    // 5. Zipping
    console.log('Creating FINAL ZIP archive...');
    const zipPath = path.join(rootDir, 'CheckerTest.zip');
    // Using powershell for zipping as it's built-in on Windows
    const zipCmd = `powershell.exe -Command "Compress-Archive -Path '${buildDir}' -DestinationPath '${zipPath}' -Force"`;
    execSync(zipCmd);

    console.log('\n--- SUCCESS! ---');
    console.log('Final Build ready at: ' + zipPath);
} catch (err) {
    console.error('\n--- BUILD FAILED ---');
    console.error(err);
    process.exit(1);
}
