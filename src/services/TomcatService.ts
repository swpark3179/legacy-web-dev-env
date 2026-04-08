import * as vscode from 'vscode';
import type { Settings, TomcatState } from '../types';
import path from 'path';
import * as fs from 'fs-extra';
import { spawn, execFileSync, type ChildProcess } from 'child_process';

// Tomcat 제어 서비스
export class TomcatService {
    private _log: vscode.OutputChannel;
    private _tomcatPath: string;
    private _settings: Settings;
    private _tomcatState: TomcatState;
    private _tomcatProcess?: ChildProcess;
    private _extensionPath: vscode.Uri;
    private _isDeveloperMode: boolean = false;
    private _onProcessClose?: () => void;

    constructor(log: vscode.OutputChannel, settings: Settings, tomcatState: TomcatState, extensionPath: vscode.Uri, onProcessClose?: () => void) {
        this._log = log;
        this._settings = settings;
        this._tomcatState = tomcatState;
        this._tomcatPath = path.join(this._settings.projectRoot, '.tomcat');
        this._extensionPath = extensionPath;
        this._onProcessClose = onProcessClose;
    }

    // Tomcat 상태 갱신
    updateTomcatState(newState: Partial<TomcatState>): void {
        this._tomcatState.contextRoot = newState.contextRoot || this._tomcatState.contextRoot;
        this._tomcatState.running = newState.running || this._tomcatState.running;
        this._tomcatState.debugMode = newState.debugMode || this._tomcatState.debugMode;
        this._tomcatState.initialized = newState.initialized || this._tomcatState.initialized;
    }

    // 변경된 파일을 실행 중인 Tomcat에 적용
    async applyChangedFilesToTomcat(changedFiles: { java: string[], query: string[], config: string[], static: string[] }): Promise<void> {
        const projectRoot = this._settings.projectRoot.replace(/\\/g, '/');
        const webappsPath = path.join(this._tomcatPath, 'webapps', this._tomcatState.contextRoot);
        const classesPath = path.join(webappsPath, 'WEB-INF', 'classes');
        let copiedCount = 0;

        this._log.show(true);
        this._log.appendLine('[배포 적용] 변경 파일 Tomcat 반영 시작...');

        const copyPromises: Promise<void>[] = [];

        // 1. Java .class 파일 복사 (inner class 포함)
        for (const javaFile of changedFiles.java) {
            const normalizedJavaFile = javaFile.replace(/\\/g, '/');
            const relativePath = normalizedJavaFile.replace(`${projectRoot}/src/java/`, '');
            const baseClassName = relativePath.replace(/\.java$/, '');
            const classDir = path.join(this._settings.projectRoot, 'target', 'classes', path.dirname(baseClassName));
            const baseName = path.basename(baseClassName);

            copyPromises.push((async () => {
                try {
                    const files = await fs.promises.readdir(classDir);
                    const matchingFiles = files.filter(f => f === `${baseName}.class` || f.startsWith(`${baseName}$`));

                    const classCopyPromises = matchingFiles.map(async classFile => {
                        const srcClassPath = path.join(classDir, classFile);
                        const destClassPath = path.join(classesPath, path.dirname(baseClassName), classFile);
                        const destDir = path.dirname(destClassPath);
                        await fs.promises.mkdir(destDir, { recursive: true });
                        await fs.promises.copyFile(srcClassPath, destClassPath);
                        copiedCount++;
                        this._log.appendLine(`  [Java] ${path.dirname(baseClassName)}/${classFile}`);
                    });
                    await Promise.all(classCopyPromises);
                } catch (err) {
                    if (err instanceof Error && 'code' in err && err.code === 'ENOENT') {
                        this._log.appendLine(`  [경고] class 디렉터리 없음: ${classDir}`);
                    } else {
                        throw err;
                    }
                }
            })());
        }

        // 2. Query 파일 복사
        for (const queryFile of changedFiles.query) {
            const normalizedQueryFile = queryFile.replace(/\\/g, '/');
            const relativePath = normalizedQueryFile.replace(`${projectRoot}/src/query/`, '');
            const destPath = path.join(classesPath, relativePath);
            const destDir = path.dirname(destPath);

            copyPromises.push((async () => {
                try {
                    await fs.promises.access(queryFile);
                    await fs.promises.mkdir(destDir, { recursive: true });
                    await fs.promises.copyFile(queryFile, destPath);
                    copiedCount++;
                    this._log.appendLine(`  [Query] ${relativePath}`);
                } catch (err) {
                    if (!(err instanceof Error && 'code' in err && err.code === 'ENOENT')) throw err;
                }
            })());
        }

        // 2-1. Config 파일 복사
        for (const configFile of changedFiles.config) {
            const normalizedConfigFile = configFile.replace(/\\/g, '/');
            const relativePath = normalizedConfigFile.replace(`${projectRoot}/src/config/`, '');
            const destPath = path.join(classesPath, relativePath);
            const destDir = path.dirname(destPath);

            copyPromises.push((async () => {
                try {
                    await fs.promises.access(configFile);
                    await fs.promises.mkdir(destDir, { recursive: true });
                    await fs.promises.copyFile(configFile, destPath);
                    copiedCount++;
                    this._log.appendLine(`  [Config] ${relativePath}`);
                } catch (err) {
                    if (!(err instanceof Error && 'code' in err && err.code === 'ENOENT')) throw err;
                }
            })());
        }

        // 3. Static(webapp) 파일 복사
        for (const staticFile of changedFiles.static) {
            const normalizedStaticFile = staticFile.replace(/\\/g, '/');
            const relativePath = normalizedStaticFile.replace(`${projectRoot}/src/webapp/`, '');
            const destPath = path.join(webappsPath, relativePath);
            const destDir = path.dirname(destPath);

            copyPromises.push((async () => {
                try {
                    await fs.promises.access(staticFile);
                    await fs.promises.mkdir(destDir, { recursive: true });
                    await fs.promises.copyFile(staticFile, destPath);
                    copiedCount++;
                    this._log.appendLine(`  [Static] ${relativePath}`);
                } catch (err) {
                    if (!(err instanceof Error && 'code' in err && err.code === 'ENOENT')) throw err;
                }
            })());
        }

        await Promise.all(copyPromises);

        this._log.appendLine(`[배포 적용] 완료 (${copiedCount}건 복사됨)`);
    }

    // Tomcat 서버 실행
    /** Windows 개발자 모드 활성 여부 */
    get isDeveloperMode(): boolean {
        return this._isDeveloperMode;
    }

    async runTomcat(_debugMode: boolean, _enableHotswap: boolean, onStartupComplete?: () => void, deployServiceFiles?: () => void | Promise<boolean>): Promise<void> {
        if (this._tomcatProcess) {
            throw Error('Tomcat이 이미 실행중입니다.');
        }
        if (!this._tomcatState.initialized) {
            throw Error('Tomcat이 초기화되지 않았습니다.');
        }
        const catalinaBat = path.join(this._settings.tomcatPath, 'bin', 'catalina.bat');
        if (!fs.existsSync(catalinaBat)) {
            throw Error(`catalina.bat을 찾을 수 없습니다: ${catalinaBat}`);
        }
        const tomcatContextRootPath = path.join(this._tomcatPath, 'webapps', this._tomcatState.contextRoot);
        if (!fs.existsSync(tomcatContextRootPath)) {
            throw Error('Tomcat 초기화를 먼저 수행하세요.');
        }
        // 개발자 모드 체크
        this._isDeveloperMode = this._checkDeveloperMode();
        this._log.clear();
        this._log.show(true);
        this._log.appendLine(`[Tomcat] 개발자 모드: ${this._isDeveloperMode ? '활성' : '비활성'}`);
        this._log.appendLine('[Tomcat] Tomcat 기동 시작...');
        await new Promise(resolve => setTimeout(resolve, 0)); // UI 반영 대기 (이벤트 루프 양보)
        // tomcat context root 폴더 하위 초기화
        fs.emptyDirSync(tomcatContextRootPath);
        // tomcat 기동에 필요한 프로젝트 구성 파일 배포 (완료 후 tomcat 기동)
        if (deployServiceFiles) await deployServiceFiles();
        // tomcat 기동 옵션 설정
        const javaOpts = this.get_java_opts(_debugMode, _enableHotswap);
        const env = {
            ...process.env,
            CATALINA_HOME: this._settings.tomcatPath,
            CATALINA_BASE: this._tomcatPath,
            JAVA_HOME: this._settings.jdkPath,
            CATALINA_OPTS: `${process.env.CATALINA_OPTS || ''} ${javaOpts}`.trim(),
            JAVA_TOOL_OPTIONS: `${process.env.JAVA_TOOL_OPTIONS || ''} -Dfile.encoding=UTF-8`.trim(),
        };
        // tomcat 기동 시작
        this._log.appendLine(`[Tomcat] catalina.bat run 실행... (${_debugMode ? '디버그 모드' : '일반 모드'})`);
        this._tomcatProcess = spawn(process.env.comspec || 'cmd.exe', ['/c', catalinaBat, 'run'], {
            cwd: path.join(this._settings.tomcatPath, 'bin'),
            env,
        });
        const startTime = new Date();
        const logStreamData = (data: Buffer) => {
            data.toString('utf8').split(/\r?\n/).forEach((line) => {
                if (line.trim()) {
                    this._log.appendLine(line);
                    if (line.includes('서버가') && line.includes('밀리초 내에 시작되었습니다')) {
                        const endTime = new Date();
                        const elapsedSec = Math.floor((endTime.getTime() - startTime.getTime()) / 1000);
                        const h = Math.floor(elapsedSec / 3600);
                        const m = Math.floor((elapsedSec % 3600) / 60);
                        const s = elapsedSec % 60;
                        const parts: string[] = [];
                        if (h > 0) parts.push(`${h}시간`);
                        if (m > 0) parts.push(`${m}분`);
                        parts.push(`${s}초`);
                        const elapsedStr = `${elapsedSec}초${(h > 0 || m > 0) ? ' (' + parts.join(' ') + ')' : ''}`;
                        this._log.appendLine('');
                        this._log.appendLine('============================================================');
                        this._log.appendLine(`*** Tomcat 기동 완료 (${(_debugMode) ? '디버그' : '일반'} 모드) ***`);
                        this._log.appendLine(_enableHotswap ? 'Hotswap 활성' : 'Hotswap 비활성');
                        this._log.appendLine(`Tomcat 기동 시간: ${endTime.toLocaleTimeString()} - 소요: ${elapsedStr}`);
                        this._log.appendLine(`URL : http://localhost:${this._tomcatState.port}/${this._tomcatState.contextRoot}`);
                        this._log.appendLine('============================================================');
                        if (_debugMode) this._attachJavaDebugger();
                        if (onStartupComplete) onStartupComplete();
                    }
                }
            });
        };
        this._tomcatProcess.stdout?.on('data', logStreamData);
        this._tomcatProcess.stderr?.on('data', logStreamData);
        this._tomcatProcess.on('close', (code) => {
            this._tomcatProcess = undefined;
            this._tomcatState.running = false;
            this._tomcatState.debugMode = false;
            this._log.appendLine(`[Tomcat] 프로세스 종료 (코드: ${code})`);
            this._onProcessClose?.();
        });
    }

    private get_java_opts(_debugMode: boolean, _enableHotswap: boolean): string {
        const javaOpts: string[] = [];
        javaOpts.push('-Dfile.encoding=UTF-8');
        javaOpts.push('-Duser.language=ko');
        javaOpts.push('-Duser.country=KR');
        if (_enableHotswap) {
            const agentJarPath = path.join(this._extensionPath.fsPath, 'resources', 'hotswap-agent-1.4.1.jar');
            if (!fs.existsSync(agentJarPath)) {
                this._log.appendLine(`Hotswap Agent jar 파일을 찾을 수 없습니다: ${agentJarPath}`);
            } else {
                javaOpts.push('-XXaltjvm=dcevm');
                javaOpts.push(`-javaagent:${agentJarPath}`);
                this._log.appendLine(`Hotswap Agent jar 파일을 사용합니다: ${agentJarPath}`);
            }
        }
        if (_debugMode) {
            const DEBUG_PORT = 5005;
            javaOpts.push(`-agentlib:jdwp=transport=dt_socket,server=y,suspend=n,address=${DEBUG_PORT}`);
            this._log.appendLine(`Debug 모드 활성화, 디버그 포트: ${DEBUG_PORT} (VS Code에서 localhost:${DEBUG_PORT}로 접속)`);
        }
        return javaOpts.join(' ');
    }

    // Tomcat 시작
    async startTomcat(_enableHotswap: boolean, onStartupComplete?: () => void, deployServiceFiles?: () => void | Promise<boolean>): Promise<void> {
        try {
            this.runTomcat(false, _enableHotswap, onStartupComplete, deployServiceFiles);
        } catch (error) {
            this._tomcatState.running = false;
            this._tomcatState.debugMode = false;
            const errorMessage = error instanceof Error ? error.message : String(error);
            this._log.appendLine(`Tomcat 시작 실패: ${errorMessage}`);
            vscode.window.showErrorMessage(`Tomcat 시작 실패: ${errorMessage}`);
        }
    }

    // Tomcat 디버그 모드 시작
    async debugTomcat(_enableHotswap: boolean, onStartupComplete?: () => void, deployServiceFiles?: () => void | Promise<boolean>): Promise<void> {
        try {
            this.runTomcat(true, _enableHotswap, onStartupComplete, deployServiceFiles);
        } catch (error) {
            this._tomcatState.running = false;
            this._tomcatState.debugMode = false;
            const errorMessage = error instanceof Error ? error.message : String(error);
            vscode.window.showErrorMessage(`Tomcat 디버그 시작 실패: ${errorMessage}`);
        }
    }

    // Tomcat 중지
    async stopTomcat(): Promise<void> {
        try {
            this._log.show(true);
            if (!this._tomcatState.running && !this._tomcatProcess) {
                this._log.appendLine('Tomcat이 실행 중이지 않습니다.');
                return;
            }
            const catalinaBat = path.join(this._settings.tomcatPath, 'bin', 'catalina.bat');
            if (!fs.existsSync(catalinaBat)) {
                this._log.appendLine(`catalina.bat을 찾을 수 없습니다: ${catalinaBat}`);
                return;
            }
            const env = {
                ...process.env,
                CATALINA_HOME: this._settings.tomcatPath,
                CATALINA_BASE: this._tomcatPath,
                JAVA_HOME: this._settings.jdkPath,
            };
            this._log.appendLine('[Tomcat] catalina.bat stop 실행...');
            const stopProcess = spawn(process.env.comspec || 'cmd.exe', ['/c', catalinaBat, 'stop'], {
                cwd: path.join(this._settings.tomcatPath, 'bin'),
                env,
            });
            const logStreamData = (data: Buffer) => {
                data.toString().split(/\r?\n/).forEach((line) => {
                    if (line.trim()) this._log.appendLine(line);
                });
            };
            stopProcess.stdout?.on('data', logStreamData);
            stopProcess.stderr?.on('data', logStreamData);
            stopProcess.on('close', (code) => {
                if (code === 0) {
                    this._log.appendLine('[Tomcat] 중지 명령 완료');
                } else if (this._tomcatProcess) {
                    this._log.appendLine('[Tomcat] 중지 명령 실패, 프로세스 강제 종료');
                    this._tomcatProcess.kill();
                }
            });
            this._log.appendLine('Tomcat 중지 명령 실행됨');
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            this._log.appendLine(`Tomcat 중지 실패: ${errorMessage}`);
            vscode.window.showErrorMessage(`Tomcat 중지 실패: ${errorMessage}`);
        }
    }

    // 실행 중인 Tomcat 프로세스 즉시 강제 종료 (기동 중 상태에서 빠른 종료용, Windows: taskkill)
    killTomcatProcess(): void {
        const proc = this._tomcatProcess;
        if (proc?.pid) {
            try {
                const pid = Number(proc.pid);
                if (Number.isInteger(pid) && pid > 0) {
                    execFileSync('taskkill', ['/PID', pid.toString(), '/T', '/F'], { stdio: 'pipe', encoding: 'utf8' });
                }
            } catch {
                try {
                    proc.kill('SIGKILL');
                } catch {
                    // 무시
                }
            }
            this._tomcatProcess = undefined;
            this._tomcatState.running = false;
            this._tomcatState.debugMode = false;
            this._log.appendLine('[Tomcat] 프로세스 즉시 종료됨');
        }
    }

    // 사용자가 입력한 포트가 사용 중인지 확인
    areTomcatPortsInUse(): boolean {
        const ports = [this._tomcatState.port];
        try {
            const output = execFileSync('netstat', ['-ano'], { encoding: 'utf8' });
            for (const port of ports) {
                const lines = output.split(/\r?\n/).filter((l) => l.includes(`:${port}`) && l.includes('LISTENING'));
                if (lines.length > 0) return true;
            }
        } catch (error) {
            this._log.appendLine(`[Tomcat] 포트 확인 중 오류 발생: ${this._normalizeErrorMessage(error)}`);
        }
        return false;
    }

    // 사용자가 입력한 포트로 리스닝 중인 프로세스를 찾아 강제 종료
    killProcessesOnTomcatPorts(): void {
        const ports = [this._tomcatState.port];
        const pids = new Set<number>();
        try {
            const output = execFileSync('netstat', ['-ano'], { encoding: 'utf8' });
            for (const port of ports) {
                const lines = output.split(/\r?\n/).filter((l) => l.includes(`:${port}`));
                for (const line of lines) {
                    const parts = line.trim().split(/\s+/);
                    const pid = parseInt(parts[parts.length - 1], 10);
                    if (!isNaN(pid) && pid > 0) pids.add(pid);
                }
            }
            for (const pid of pids) {
                try {
                    if (Number.isInteger(pid) && pid > 0) {
                        execFileSync('taskkill', ['/PID', pid.toString(), '/F'], { stdio: 'pipe' });
                        this._log.show(true);
                        this._log.appendLine(`[Tomcat] 포트 프로세스 종료 (PID: ${pid})`);
                    }
                } catch {
                    // ignore error
                }
            }
            this._tomcatState.portsBlocked = false;
        } catch (error) {
            this._log.appendLine(`[Tomcat] 포트 프로세스 종료 실패: ${this._normalizeErrorMessage(error)}`);
        }
    }

    /** Windows CP949 등으로 깨져 보이는 오류 메시지를 UTF-8로 안전하게 변환 */
    private _normalizeErrorMessage(error: unknown): string {
        const raw = error instanceof Error ? error.message : String(error);
        try {
            return Buffer.from(raw, 'latin1').toString('cp949' as BufferEncoding);
        } catch {
            return raw.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
        }
    }

    /** Windows 개발자 모드 활성 여부를 레지스트리에서 확인 */
    private _checkDeveloperMode(): boolean {
        try {
            const output = execFileSync(
                'reg',
                ['query', 'HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\AppModelUnlock', '/v', 'AllowDevelopmentWithoutDevLicense'],
                { encoding: 'utf8', stdio: 'pipe' }
            );
            return /REG_DWORD\s+0x1/i.test(output);
        } catch {
            return false;
        }
    }

    /** Tomcat 디버그 포트(5005)에 VS Code Java 디버거 자동 연결 */
    private async _attachJavaDebugger(): Promise<void> {
        const folder = vscode.workspace.workspaceFolders?.[0];
        const config = {
            type: 'java',
            request: 'attach',
            name: 'Tomcat 디버그 (자동 연결)',
            hostName: 'localhost',
            port: 5005,
        };
        try {
            const started = await vscode.debug.startDebugging(folder, config);
            if (!started) {
                this._log.appendLine('[디버그] Java 디버거 연결 실패. Extension Pack for Java 설치 후 다시 시도해 보세요.');
                vscode.window.showInformationMessage(
                    'Java 디버거 자동 연결에 실패했습니다. Extension Pack for Java를 설치해 주세요.',
                    '확장 설치'
                ).then((btn) => {
                    if (btn === '확장 설치') vscode.commands.executeCommand('workbench.extensions.search', 'vscjava.vscode-java-pack');
                });
            } else {
                this._log.appendLine('[디버그] Tomcat 디버그 포트(5005)에 자동 연결됨');
            }
        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            this._log.appendLine(`[디버그] 연결 오류: ${msg}`);
        }
    }
}
