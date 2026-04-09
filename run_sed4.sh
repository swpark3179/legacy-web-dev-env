sed -i 's/killProcessesOnTomcatPorts(): void {/async killProcessesOnTomcatPorts(): Promise<void> {/g' src/services/TomcatService.ts
