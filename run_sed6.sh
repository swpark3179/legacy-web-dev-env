sed -i 's/private _checkDeveloperMode(): boolean {/private async _checkDeveloperMode(): Promise<boolean> {/g' src/services/TomcatService.ts
sed -i 's/const output = execFileSync(/const { stdout: output } = await execFileAsync(/g' src/services/TomcatService.ts
