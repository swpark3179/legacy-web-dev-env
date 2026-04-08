import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { WebviewProvider } from './WebviewProvider';
import { SettingsService, ValidationService, TomcatService, GradleService, ProjectService } from '../services';
import type { ChangedFiles, MessageFromWebview, Settings, TomcatState, ValidationState } from '../types';
import { handleWebviewMessage, type IWebviewActionEngine } from './WebviewActionEngine';
import { TomcatStatusBar } from '../utils/TomcatStatusBar';
import { TomcatInitService } from '../services/TomcatInitService';
import { DeployService } from '../services/DeployService';

// 콘솔 출력 채널
const OUTPUT_CHANNEL_NAME = '레거시 웹 통합 개발환경';

// 통합 패널 프로바이더
export class UnifiedPanelProvider extends WebviewProvider {
    private _settingsService: SettingsService;
    private _projectService: ProjectService;
    private _validationService: ValidationService;
    private _gradleService: GradleService;
    private _tomcatService: TomcatService;
    private _tomcatInitService: TomcatInitService;
    private _deployService: DeployService;
    private _tomcatStatusBar: TomcatStatusBar;
    private _settings: Settings;
    private _validation: ValidationState;
    private _tomcatState: TomcatState;
    private _log = vscode.window.createOutputChannel(OUTPUT_CHANNEL_NAME);

    private _stoppingTimeout?: NodeJS.Timeout;
    private _fileWatchers: vscode.FileSystemWatcher[] = [];
    private _changedFiles: ChangedFiles = { java: [], query: [], config: [] };

    constructor(extensionUri: vscode.Uri, context?: vscode.ExtensionContext) {
        super(extensionUri);

        this._settings = {
            projectRoot: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '',
            gradlePath: '',
            jdkPath: '',
            tomcatPath: '',
        };

        this._validation = {
            isFirstLoaded: false,
            isValidating: false,
            allValid: false,
            projectValid: false,
            gradle: { status: 'pending', message: '' },
            jdk: { status: 'pending', message: '' },
            tomcat: { status: 'pending', message: '' },
            jdk_has_dcevm: false,
        };

        this._tomcatState = {
            initialized: false,
            contextRoot: '',
            port: 7001,
            running: false,
            debugMode: false,
            portsBlocked: false,
            deployPath: '',
            initializing: false,
            starting: false,
            stopping: false,
            isHotReloadMode: true,
        };

        this._settingsService = new SettingsService(this._log, this._settings);
        this._validationService = new ValidationService(this._log, this._validation);
        this._tomcatService = new TomcatService(this._log, this._settings, this._tomcatState, this._extensionUri, () => {
            this._tomcatState.starting = false;
            this._updateTomcatStatusBar();
            this._sendTomcatState();
        });
        this._tomcatInitService = new TomcatInitService(this._log, this._settings, this._tomcatState, this._extensionUri);
        this._gradleService = new GradleService(this._log, this._settings, () => this._notifyGradleComplete());
        this._projectService = new ProjectService(this._log, this._settings, this._extensionUri);
        this._deployService = new DeployService(this._log, this._settings, this._changedFiles, this._fileWatchers, this._tomcatState, this._gradleService, this._tomcatService);
        this._tomcatStatusBar = new TomcatStatusBar();
        if (context) {
            context.subscriptions.push(this._tomcatStatusBar);
            context.subscriptions.push(new vscode.Disposable(() => this.dispose()));
        }
    }

    /** 확장 비활성화(VS Code 종료 등) 시 호출. FileWatcher 등 리소스 해제 */
    public dispose(): void {
        this._deployService.stopFileWatcher();
    }

    // UI 로딩이 완료되었을 때 최초 1회 수행
    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        _context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken
    ): void {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [
                this._extensionUri,
                vscode.Uri.joinPath(this._extensionUri, 'webview-dist'),
            ]
        };

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

        webviewView.webview.onDidReceiveMessage(async (data: MessageFromWebview) => {
            await (data => handleWebviewMessage(data, this._getActionEngine()))(data);
        });
    }

    // UI → 내부 엔진 액션 전달용 엔진 객체
    private _getActionEngine(): IWebviewActionEngine {
        return {
            handleInitProject: () => this._handleInitProject(),
            sendState: () => this._sendState(),
            sendTomcatState: () => this._sendTomcatState(),
            handleSelectFolder: (target, currentPath) =>
                this._settingsService.handleSelectFolder(() => this._sendState(), target, currentPath),
            handleValidateAll: () =>
                this._validationService.validateAll(
                    this._settings,
                    () => this._sendState(),
                    () => {
                        this._settingsService.saveSettings();
                        // 검증 완료 시 항상 프로젝트 설정 초기화 수행
                        this._projectService.initProjectSettings({ hideSimpleFolder: true, hideExtFolder: false, initProjectFile: true });
                        this._postMessage({ type: 'navigateTo', page: 'main' });
                    }
                ),
            initGlobalSettings: () =>
                this._settingsService.initGlobalSettings(),
            buildClasses: () =>
                this._gradleService.buildClasses(),
            cleanProject: () =>
                this._gradleService.cleanProject(),
            stopGradle: () =>
                this._gradleService.stopGradle(),
            initTomcat: async (contextRoot, port) => {
                this._tomcatState.initializing = true;
                this._log.show(true);
                this._log.appendLine('Tomcat 초기화 시작');
                this._postMessage({ type: 'tomcatStateUpdate', tomcat: this._tomcatState });
                await new Promise(resolve => setTimeout(resolve, 0));
                await this._tomcatInitService.initTomcat(contextRoot, port);
                this._tomcatState.initializing = false;
                this._postMessage({ type: 'tomcatStateUpdate', tomcat: this._tomcatState });
                return Promise.resolve();
            },
            startTomcat: (enableHotswap) => {
                this._tomcatState.starting = true;
                this._tomcatState.running = true;
                this._tomcatState.debugMode = false;
                this._tomcatState.isHotReloadMode = enableHotswap;
                this._sendTomcatState();
                this._updateTomcatStatusBar();
                this._deployService.startFileWatcher((msg) => this._postMessage(msg));
                this._tomcatService.startTomcat(enableHotswap, () => {
                    this._tomcatState.starting = false;
                    this._updateTomcatStatusBar();
                    this._sendTomcatState();
                }, () => this._tomcatInitService.deployServiceFiles(this._tomcatState.contextRoot, this._tomcatService.isDeveloperMode));
                return Promise.resolve();
            },
            debugTomcat: async (enableHotswap) => {
                this._tomcatState.starting = true;
                this._tomcatState.running = true;
                this._tomcatState.debugMode = true;
                this._tomcatState.isHotReloadMode = enableHotswap;
                this._sendTomcatState();
                this._updateTomcatStatusBar();
                this._deployService.startFileWatcher((msg) => this._postMessage(msg));
                await this._tomcatService.debugTomcat(
                    enableHotswap,
                    () => {
                        this._tomcatState.starting = false;
                        this._updateTomcatStatusBar();
                        this._sendTomcatState();
                    },
                    () => this._tomcatInitService.deployServiceFiles(this._tomcatState.contextRoot, this._tomcatService.isDeveloperMode)
                );
            },
            stopTomcat: async () => {
                this._tomcatState.stopping = true;
                this._tomcatState.running = false;
                this._tomcatState.debugMode = false;
                this._sendTomcatState();
                this._updateTomcatStatusBar();
                await new Promise(resolve => setTimeout(resolve, 0));
                if (this._tomcatState.starting) {
                    this._tomcatService.killTomcatProcess();
                } else {
                    await this._tomcatService.stopTomcat();
                    this._tomcatService.killProcessesOnTomcatPorts();
                }
                this._tomcatState.starting = false;
                this._deployService.stopFileWatcher();
                if (this._stoppingTimeout) clearTimeout(this._stoppingTimeout);
                this._stoppingTimeout = setTimeout(() => {
                    this._tomcatState.stopping = false;
                    this._stoppingTimeout = undefined;
                    this._updateTomcatStatusBar();
                    this._sendTomcatState();
                }, 2500);
                return Promise.resolve();
            },
            killTomcatPorts: () => {
                this._tomcatService.killProcessesOnTomcatPorts();
                this._tomcatState.running = false;
                this._tomcatState.debugMode = false;
                this._updateTomcatStatusBar();
                this._postMessage({ type: 'tomcatStateUpdate', tomcat: this._tomcatState });
                return Promise.resolve();
            },
            handleApplyProjectSettings: (options) =>
                this._projectService.initProjectSettings(options),
            handleSetupHomeSettings: () =>
                this._projectService.handleApplyHomeSettings(),
            applyChangedFiles: async () => {
                await this._deployService.applyChangedFiles();
                this._postMessage({ type: 'changedFilesUpdate', changedFiles: this._changedFiles });
            },
            log: (message) => this._log.appendLine(message),
        };
    }

    private _sendTomcatState(): void {
        this._postMessage({ type: 'tomcatStateUpdate', tomcat: this._tomcatState });
    }

    // 패널이 최초 열렸을 때 수행 - 프로젝트 구조 검증 및 도구 준비 여부에 따라 페이지 이동
    private async _handleInitProject(): Promise<void> {
        if (this._validation.isFirstLoaded) {
            if (this._validation.allValid) this._postMessage({ type: 'navigateTo', page: 'main', validation: this._validation });
            return;
        }
        this._validation.isFirstLoaded = true;
        this._validationService.validateProjectStructure(this._settingsService.projectRoot);
        if (this._settingsService.loadSavedSettings()) this._validationService.setAsValidated(this._settingsService.settings);
        this._syncStateFromServerXml();
        if (!this._tomcatState.initialized || !this._tomcatState.contextRoot) {
            this._syncContextRootFromWebXml();
        }
        if (!this._tomcatState.running && this._tomcatService.areTomcatPortsInUse()) this._tomcatState.portsBlocked = true;
        this._updateTomcatStatusBar();
        if (this._validation.allValid) this._postMessage({ type: 'navigateTo', page: 'main', validationState: this._validation });
    }

    // server.xml에서 contextRoot와 port를 읽어 _tomcatState에 반영
    private _syncStateFromServerXml(): void {
        const tomcatDir = path.join(this._settings.projectRoot, '.tomcat');
        const serverXmlPath = path.join(tomcatDir, 'conf', 'server.xml');
        if (!fs.existsSync(tomcatDir) || !fs.existsSync(serverXmlPath)) return;
        try {
            const content = fs.readFileSync(serverXmlPath, 'utf8');
            // context root 읽기
            const contextMatch = content.match(/<Context\b[^>]*\spath\s*=\s*["']([^"']*)["']/);
            if (contextMatch && contextMatch[1]) {
                this._tomcatState.contextRoot = contextMatch[1].replace(/^\//, '');
                this._tomcatState.initialized = true;
            }
            // port 읽기
            const portMatch = content.match(/<Connector\b[^>]*\sport\s*=\s*["'](\d+)["']/);
            if (portMatch && portMatch[1]) {
                this._tomcatState.port = parseInt(portMatch[1], 10);
            }
        } catch (error: unknown) {
            this._log.appendLine(`server.xml 파싱 실패: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    // 프로젝트 web.xml의 <display-name>을 읽어 _tomcatState.contextRoot에 반영 (server.xml 미반영 시 fallback)
    private _syncContextRootFromWebXml(): void {
        const webXmlPath = path.join(this._settings.projectRoot, 'src', 'webapp', 'WEB-INF', 'web.xml');
        if (!fs.existsSync(webXmlPath)) return;
        try {
            const content = fs.readFileSync(webXmlPath, 'utf8');
            const match = content.match(/<display-name>\s*([\s\S]*?)\s*<\/display-name>/);
            if (match && match[1] !== undefined) {
                this._tomcatState.contextRoot = match[1].trim();
            }
        } catch (error: unknown) {
            this._log.appendLine(`web.xml 파싱 실패: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    private _updateTomcatStatusBar(): void {
        this._tomcatStatusBar.update(
            this._tomcatState.running,
            this._tomcatState.debugMode,
            this._tomcatState.stopping,
            this._tomcatState.starting
        );
    }

    private _notifyGradleComplete(): void {
        this._postMessage({
            type: 'mainStateUpdate',
            isGradleRunning: false,
            settings: this._settings,
        });
    }

    // 내부 엔진에 있는 설정값들을 UI로 전달
    private _sendState(): void {
        this._updateTomcatStatusBar();
        this._postMessage({
            type: 'mainStateUpdate',
            settings: this._settingsService.settings,
            tomcat: this._tomcatState,
            validation: this._validation,
            changedFiles: this._changedFiles,
        });
    }
}
