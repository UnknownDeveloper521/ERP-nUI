import { execSync } from 'child_process';
console.log('🏗️  Building ERP Frontend...');
try {
  execSync('npx vite build', { stdio: 'inherit' });
  console.log('✅ Frontend build complete! Ready to deploy.');
} catch (e) {
  console.error('Build failed:', e.message);
  process.exit(1);
}
