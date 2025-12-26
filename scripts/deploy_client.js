const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const rootDir = path.resolve(__dirname, '..');
const clientDir = path.join(rootDir, 'client');
const publicDir1 = path.join(rootDir, 'public');
const publicDir2 = path.join(rootDir, 'server/server/public');

if (!fs.existsSync(clientDir)) {
  console.log('Client directory not found, skipping build.');
  process.exit(0);
}

console.log('Installing client dependencies...');
try {
    execSync('npm install', { cwd: clientDir, stdio: 'inherit' });
} catch (e) {
    console.error('npm install failed', e);
    process.exit(1);
}

console.log('Building client...');
try {
    execSync('npm run build', { cwd: clientDir, stdio: 'inherit' });
} catch (e) {
    console.error('npm run build failed', e);
    process.exit(1);
}

console.log('Copying build artifacts to public directories...');

// Simple recursive copy function
function copyDir(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

const distDir = path.join(clientDir, 'dist');
if (fs.existsSync(distDir)) {
    console.log(`Copying to ${publicDir1}...`);
    copyDir(distDir, publicDir1);
    
    console.log(`Copying to ${publicDir2}...`);
    // Ensure parent dir exists
    if (!fs.existsSync(path.dirname(publicDir2))) {
        fs.mkdirSync(path.dirname(publicDir2), { recursive: true });
    }
    copyDir(distDir, publicDir2);
    
    console.log('Client deployment complete.');
} else {
    console.error('Client build directory (dist) not found!');
    process.exit(1);
}
