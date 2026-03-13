const fs = require('fs');
const { execSync } = require('child_process');

try {
  const envStr = fs.readFileSync('.env', 'utf8');
  envStr.split(/\r?\n/).forEach(line => {
    if (!line.trim() || line.startsWith('#')) return;
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      const key = match[1];
      let val = match[2];
      
      // Trim quotes if present
      if (val.startsWith('"') && val.endsWith('"')) {
          val = val.slice(1, -1);
      }
      
      // Trim any residual whitespace or carriage returns
      val = val.trim();
      
      console.log(`Uploading cleanly: ${key}`);
      
      try {
        execSync(`npx vercel env rm ${key} production --yes`, { stdio: 'ignore' });
      } catch (e) {
        // Ignore if it doesn't exist
      }
      
      execSync(`npx vercel env add ${key} production`, { input: val, stdio: ['pipe', 'inherit', 'inherit'] });
    }
  });
  
  // Also add AUTH_SECRET for NextAuth v5 compatibility
  console.log('Uploading securely: AUTH_SECRET');
  try { execSync(`npx vercel env rm AUTH_SECRET production --yes`, { stdio: 'ignore' }); } catch(e){}
  execSync(`npx vercel env add AUTH_SECRET production`, { input: "secret_token_1234567890_cmagic1", stdio: ['pipe', 'inherit', 'inherit'] });
  
  console.log("All environment variables pushed cleanly!");
} catch (error) {
  console.error(error);
}
