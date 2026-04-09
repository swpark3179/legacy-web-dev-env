sed -i 's/areTomcatPortsInUse(): boolean {/async areTomcatPortsInUse(): Promise<boolean> {/g' src/services/TomcatService.ts
