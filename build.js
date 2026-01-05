import { execSync } from 'child_process';

console.log('🏗️  Building ERP Application...');

try {
  // Run the complete build script that outputs to dist/index.cjs
  execSync('npx tsx script/build.ts', { stdio: 'inherit' });
  console.log('✅ Build complete! Ready to deploy.');
} catch (e) {
  console.error('Build failed:', e.message);
  process.exit(1);
}
