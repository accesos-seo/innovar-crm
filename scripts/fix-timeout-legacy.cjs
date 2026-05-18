const fs = require('fs');

function fixFiles() {
  const { execSync } = require('child_process');
  
  try {
    const files = execSync('find src/hooks -name "*.ts"').toString().split('\n').filter(Boolean);
    
    files.forEach(file => {
      let content = fs.readFileSync(file, 'utf8');
      
      const pattern1 = /catch\s*\(err\)\s*\{\s*console\.warn\("Network\/Supabase Info:",\s*err\);\s*return\s*\{\s*data:\s*\[\],\s*count:\s*0\s*\};\s*\}/g;
      const pattern2 = /catch\s*\(err\)\s*\{\s*console\.warn\("Network\/Supabase Info:",\s*err\);\s*return\s*\[\];\s*\}/g;
      
      let modified = false;
      if (pattern1.test(content)) {
        content = content.replace(pattern1, 'catch (err: any) { console.warn("Supabase Info:", err); throw err; }');
        modified = true;
      }
      if (pattern2.test(content)) {
        content = content.replace(pattern2, 'catch (err: any) { console.warn("Supabase Info:", err); throw err; }');
        modified = true;
      }
      
      if (modified) {
        fs.writeFileSync(file, content);
        console.log(`Fixed ${file}`);
      }
    });
  } catch (e) {
    console.error(e);
  }
}

fixFiles();
