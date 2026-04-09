sed -i 's/this._isDeveloperMode = this._checkDeveloperMode();/this._isDeveloperMode = await this._checkDeveloperMode();/g' src/services/TomcatService.ts
