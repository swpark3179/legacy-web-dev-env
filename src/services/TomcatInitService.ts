import * as vscode from 'vscode';
import path from 'path';
import * as fs from 'fs-extra';
import cpy from 'cpy';
import { Settings, TomcatState } from '../types';
import { execFileSync } from 'child_process';

interface CpyProgressEvent {
    percent: number;
    totalFiles: number;
    completedFiles: number;
}

// Tomcat 초기화 서비스
export class TomcatInitService {
    private _log: vscode.OutputChannel;
    private _tomcatState: TomcatState;
    private _settings: Settings;
    private _tomcatPath: string;
    private _extensionPath: vscode.Uri;

    constructor(log: vscode.OutputChannel, settings: Settings, tomcatState: TomcatState, extensionPath: vscode.Uri) {
        this._log = log;
        this._tomcatState = tomcatState;
        this._settings = settings;
        this._tomcatPath = path.join(this._settings.projectRoot, '.tomcat');
        this._extensionPath = extensionPath;
    }

    // Tomcat 초기화
    async initTomcat(contextRoot: string, port: number): Promise<boolean> {
        try {
            if (!contextRoot) {
                vscode.window.showErrorMessage('Context Root가 비어있습니다.');
                return false;
            }
            // .tomcat 폴더가 존재한다면 삭제
            if (fs.pathExistsSync(this._tomcatPath)) {
                try { await this.cleanFolderSafe(this._tomcatPath); }
                catch (err) { throw new Error('파일 삭제 도중 오류 발생'); }
            }
            // tomcat 기동에 필요한 폴더 생성
            fs.emptyDirSync(this._tomcatPath);
            fs.mkdirSync(path.join(this._tomcatPath, 'conf'));
            fs.mkdirSync(path.join(this._tomcatPath, 'webapps'));
            fs.mkdirSync(path.join(this._tomcatPath, 'logs'));
            fs.mkdirSync(path.join(this._tomcatPath, 'temp'));
            fs.mkdirSync(path.join(this._tomcatPath, 'work'));
            fs.mkdirSync(path.join(this._tomcatPath, 'webapps', contextRoot));
            // state 업데이트 (server.xml 생성 전에 적용)
            this._tomcatState.contextRoot = contextRoot;
            this._tomcatState.port = port;
            // tomcat 기동에 필수적인 파일 생성
            this.createServerXml();
            this.createContextXml();
            Promise.all([
                cpy(path.join(this._settings.tomcatPath, 'conf', 'web.xml'), path.join(this._tomcatPath, 'conf')),
                cpy(path.join(this._settings.tomcatPath, 'conf', 'logging.properties'), path.join(this._tomcatPath, 'conf')),
                cpy(path.join(this._settings.tomcatPath, 'conf', 'catalina.properties'), path.join(this._tomcatPath, 'conf')),
                cpy(path.join(this._settings.tomcatPath, 'conf', 'tomcat-users.xml'), path.join(this._tomcatPath, 'conf')),
            ]);
            // 마무리
            this._tomcatState.initialized = true;
            this._log.appendLine(`Tomcat 초기화 완료 (Context Root: ${contextRoot}, Port: ${port})`);
            return true;
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            this._log.appendLine(`Tomcat 초기화 실패: ${errorMessage}`);
            return false;
        }
    }

    // 폴더 비우기 (재시도 로직 포함)
    private async cleanFolderSafe(targetPath: string, maxRetries = 2) {
        const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                this._log.appendLine(`폴더 비우기 시도... (${targetPath})`);
                await fs.emptyDir(targetPath);
                return;
            } catch (error: unknown) {
                const isRetryable = error instanceof Error && 'code' in error && (error.code === 'EBUSY' || error.code === 'EPERM');
                if (attempt > maxRetries) throw error;
                if (isRetryable) {
                    this._log.appendLine(`[EBUSY 감지] 파일이 사용 중입니다. 2초 뒤 재시도합니다... (${attempt}/${maxRetries})`);
                    await wait(2000);
                }
                else throw error;
            }
        }
    }

    // 파일 복사 (진행률 표시)
    private async copyWithProgress(type: string, src: string, dest: string, pattern: string | string[]) {
        fs.ensureDirSync(dest);
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: `[${type}] 파일 복사 중...`,
            cancellable: false,
        }, async (progress) => {
            progress.report({ message: '준비 중...', increment: 0 });
            let lastPercentage = 0;
            await cpy(pattern, dest, {
                cwd: `${src}`,
                overwrite: true,
                concurrency: 300,
                onProgress: (event: CpyProgressEvent) => {
                    const currentPercentage = Math.round(event.percent * 100);
                    const diff = currentPercentage - lastPercentage;
                    lastPercentage = currentPercentage;
                    progress.report({
                        message: `${event.completedFiles} / ${event.totalFiles} 파일 복사 중... (${currentPercentage}%)`,
                        increment: diff
                    });
                }
            });
        });
    }

    // 서비스 파일 배포 (성공 시 true return)
    public async deployServiceFiles(contextRoot: string, isDeveloperMode: boolean = false): Promise<boolean> {
        const _deployPath = path.join(this._tomcatPath, 'webapps', contextRoot);
        const srcClassesPath = path.join(this._settings.projectRoot, 'target', 'classes');
        const srcQueryPath = path.join(this._settings.projectRoot, 'src', 'query');
        const srcConfigPath: string = path.join(this._settings.projectRoot, 'src', 'config');
        const webappPath = path.join(this._settings.projectRoot, 'src', 'webapp');
        const projectLibPath = path.join(this._settings.projectRoot, '.vscode', 'lib');
        const tomcatLibPath = path.join(_deployPath, 'WEB-INF', 'lib');
        const targetClassesPath = path.join(_deployPath, 'WEB-INF', 'classes');
        if (!fs.pathExistsSync(srcClassesPath)) {
            this._log.appendLine(`[경고] 빌드된 class 파일을 찾을 수 없습니다: ${srcClassesPath}`);
            return false;
        }
        const start_time = Date.now();
        this._log.show(true);
        this._log.appendLine('[배포] 서비스 파일 복사 시작');
        await Promise.all([
            isDeveloperMode
                ? this._createStaticSymlinks(webappPath, _deployPath)
                : this.copyWithProgress('정적 파일', webappPath, _deployPath, ['**/*', '!**/WEB-INF/lib']),
            this.copyWithProgress('Java', srcClassesPath, targetClassesPath, '**/*.class*'),
            this.copyWithProgress('Query', srcQueryPath, targetClassesPath, '**/*'),
            this.copyWithProgress('Config', srcConfigPath, targetClassesPath, '**/*'),
            this.copyWithProgress('Lib', projectLibPath, tomcatLibPath, '**/*'),
        ]);
        const end_time = Date.now();
        this._log.appendLine(`[배포] 서비스 파일 복사 완료 (${((end_time - start_time) / 1000).toFixed(2)}초)`);
        // vscode 확장 프로그램 내 lib가 있으면 복사
        const extensionLibPath = path.join(this._extensionPath.fsPath, 'resources', 'lib');
        if (fs.pathExistsSync(extensionLibPath)) await fs.copy(extensionLibPath, tomcatLibPath, { overwrite: true });
        if (this._tomcatState.isHotReloadMode) this.createHotSwapAgentProperties(_deployPath);
        this._tomcatState.deployPath = _deployPath;
        return true;
    }

    // server.xml 파일 생성 (설정된 포트 반영)
    private createServerXml(): void {
        const serverXml = `<?xml version="1.0" encoding="UTF-8"?>
<Server port="8005" shutdown="SHUTDOWN">
  <Listener className="org.apache.catalina.startup.VersionLoggerListener" />
  <Listener className="org.apache.catalina.core.AprLifecycleListener" />
  <Listener className="org.apache.catalina.core.JreMemoryLeakPreventionListener" />
  <Listener className="org.apache.catalina.mbeans.GlobalResourcesLifecycleListener" />
  <Listener className="org.apache.catalina.core.ThreadLocalLeakPreventionListener" />

  <GlobalNamingResources>
    <Resource name="UserDatabase" auth="Container"
              type="org.apache.catalina.UserDatabase"
              description="User database that can be updated and saved"
              factory="org.apache.catalina.users.MemoryUserDatabaseFactory"
              pathname="conf/tomcat-users.xml" />
  </GlobalNamingResources>

  <Service name="Catalina">
    <Connector port="${this._tomcatState.port}" protocol="HTTP/1.1" connectionTimeout="20000" redirectPort="8443" maxParameterCount="1000" />
    <Engine name="Catalina" defaultHost="localhost">
      <Realm className="org.apache.catalina.realm.LockOutRealm">
        <Realm className="org.apache.catalina.realm.UserDatabaseRealm" resourceName="UserDatabase"/>
      </Realm>
      <Host name="localhost"  appBase="webapps" unpackWARs="true" autoDeploy="true">
        <Context path="/${this._tomcatState.contextRoot}" docBase="${this._tomcatPath.replace(/\\/g, '/')}/webapps/${this._tomcatState.contextRoot}" />
        <Valve className="org.apache.catalina.valves.AccessLogValve" directory="logs" prefix="localhost_access_log" suffix=".txt" pattern="%h %l %u %t &quot;%r&quot; %s %b" />
      </Host>
    </Engine>
  </Service>
</Server>
`;
        fs.writeFileSync(path.join(this._tomcatPath, 'conf', 'server.xml'), serverXml, 'utf8');
    }

    // context.xml 파일 생성
    private createContextXml(): void {
        const contextXml = `<?xml version="1.0" encoding="UTF-8"?>
<Context>
    <WatchedResource>WEB-INF/web.xml</WatchedResource>
    <WatchedResource>\${catalina.base}/conf/web.xml</WatchedResource>
    <JarScanner>
        <JarScanFilter defaultTldScan="true" />
    </JarScanner>
    <Resources cachingAllowed="true" cacheMaxSize="100000" />
</Context>
`;
        fs.writeFileSync(path.join(this._tomcatPath, 'conf', 'context.xml'), contextXml, 'utf8');
    }

    // hotswap-agent.properties 파일 생성
    private createHotSwapAgentProperties(_deployPath: string): void {
        const fileContent = `extraClasspath=${_deployPath.replace(/\\/g, '/')}/WEB-INF/classes
autoHotswap=true
plugin.spring=true
spring.bean_refresh=true`;
        fs.writeFileSync(path.join(_deployPath, 'WEB-INF', 'classes', 'hotswap-agent.properties'), fileContent, 'utf8');
    }

    /** 개발자 모드: 정적 파일 복사 대신 심볼릭 링크 생성 (WEB-INF/lib 제외) */
    private async _createStaticSymlinks(webappPath: string, deployPath: string): Promise<void> {
        if (!fs.pathExistsSync(webappPath)) return;
        const entries = fs.readdirSync(webappPath, { withFileTypes: true });
        for (const entry of entries) {
            const srcFull = path.join(webappPath, entry.name);
            const destFull = path.join(deployPath, entry.name);
            if (entry.name === 'WEB-INF') {
                fs.ensureDirSync(destFull);
                const webInfEntries = fs.readdirSync(srcFull, { withFileTypes: true });
                for (const wi of webInfEntries) {
                    if (wi.name === 'lib') continue;
                    const wiSrc = path.join(srcFull, wi.name);
                    const wiDest = path.join(destFull, wi.name);
                    if (fs.existsSync(wiDest)) fs.removeSync(wiDest);
                    fs.symlinkSync(wiSrc, wiDest, wi.isDirectory() ? 'junction' : 'file');
                }
                continue;
            }
            if (fs.existsSync(destFull)) fs.removeSync(destFull);
            fs.symlinkSync(srcFull, destFull, entry.isDirectory() ? 'junction' : 'file');
        }
        this._log.appendLine(`[배포] 정적 파일 심볼릭 링크 생성 완료`);
    }
}
