sed -i 's/await execFileAsync('"'"'taskkill'"'"', \['"'"'\/PID'"'"', pid.toString(), '"'"'\/F'"'"'\], { stdio: '"'"'pipe'"'"' });/await execFileAsync('"'"'taskkill'"'"', \['"'"'\/PID'"'"', pid.toString(), '"'"'\/F'"'"'\]);/g' src/services/TomcatService.ts
sed -i 's/await execFileAsync(/await execFileAsync(/g' src/services/TomcatService.ts
