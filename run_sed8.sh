sed -i 's/this._tomcatService.areTomcatPortsInUse()/await this._tomcatService.areTomcatPortsInUse()/g' src/panels/UnifiedPanelProvider.ts
sed -i 's/this._tomcatService.killProcessesOnTomcatPorts()/await this._tomcatService.killProcessesOnTomcatPorts()/g' src/panels/UnifiedPanelProvider.ts
