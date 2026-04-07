import * as vscode from 'vscode';
import * as fs from 'fs';
import type { Settings } from '../types';

// 설정 화면 정보를 settings.json에 저장/로드하는 서비스
export class SettingsService {
    private _settings: Settings;
    private _log: vscode.OutputChannel;

    constructor(log: vscode.OutputChannel, settings: Settings) {
        this._log = log;
        this._settings = settings;
    }

    get settings(): Settings {
        return { ...this._settings };
    }

    get projectRoot(): string {
        return this._settings.projectRoot;
    }

    // 폴더 선택 이벤트
    public async handleSelectFolder(onUpdate: () => void, target: string, currentPath?: string): Promise<void> {
        let defaultUri: vscode.Uri | undefined;
        if (currentPath && fs.existsSync(currentPath)) {
            defaultUri = vscode.Uri.file(currentPath);
        }

        const result = await vscode.window.showOpenDialog({
            canSelectFiles: false,
            canSelectFolders: true,
            canSelectMany: false,
            openLabel: '선택',
            defaultUri
        });

        if (result && result[0]) {
            this.setPath(
                target as 'gradle' | 'jdk' | 'tomcat',
                result[0].fsPath
            );
            onUpdate();
        }
    }

    // .vscode/settings.json에서 저장된 설정을 로드
    loadSavedSettings(): boolean {
        const config = vscode.workspace.getConfiguration();
        const pathKeys = ['jdk', 'tomcat', 'gradle'] as const;
        try {
            let allValid = true;
            for (const key of pathKeys) {
                const pathVal = config.get<string>(`shiDevWebHelper.${key}Path`);
                if (pathVal && fs.existsSync(pathVal)) {
                    this.setPath(key, pathVal);
                    this._log.appendLine(`[settings.json] ${key}Path: ${pathVal}`);
                } else {
                    allValid = false;
                }
            }
            return allValid;
        } catch (error) {
            this._log.appendLine('[settings.json] 설정 로드 실패: ' + error);
            console.error('[settings.json] 설정 로드 실패:', error);
        }
        return false;
    }

    // .vscode/settings.json에 설정을 저장 (jdk, gradle, tomcat 경로 저장)
    saveSettings(): void {
        try {
            const config = vscode.workspace.getConfiguration('shiDevWebHelper');
            const keys = ['gradlePath', 'jdkPath', 'tomcatPath'] as const;
            for (const key of keys) {
                const inspection = config.inspect(key);
                if (inspection?.globalValue !== undefined) {
                    config.update(key, undefined, vscode.ConfigurationTarget.Global);
                }
                config.update(key, this._settings[key], vscode.ConfigurationTarget.Workspace);
            }
            this._log.appendLine('설정 저장 완료');
        } catch (error) {
            vscode.window.showErrorMessage('설정 저장 실패');
        }
    }

    // 경로 설정 업데이트
    setPath(target: 'gradle' | 'jdk' | 'tomcat', value: string): void {
        switch (target) {
            case 'gradle':
                this._settings.gradlePath = value;
                break;
            case 'jdk':
                this._settings.jdkPath = value;
                break;
            case 'tomcat':
                this._settings.tomcatPath = value;
                break;
        }
    }

    // vscode 전역 설정 초기화
    public async initGlobalSettings(): Promise<void> {
        this._log.appendLine('vscode 전역 설정 초기화');
        const selection = await vscode.window.showInformationMessage('vscode 전역 설정(settings.json)을 초기화하시겠습니까?', '예', '아니오');
        if (selection === '아니오') return;
        const config = vscode.workspace.getConfiguration(); // settings.json 을 제어할 수 있는 config 얻어오기
        try {
            // vscode 내 프록시 설정
            const proxyValue = "http://60.200.254.1:9090";
            await config.update('http.proxy', proxyValue, vscode.ConfigurationTarget.Global);
            await config.update('http.proxyStrictSSL', false, vscode.ConfigurationTarget.Global);
            await config.update('http.noProxy', ['localhost', '127.0.0.1', '70.10.15.*', '*.sdsdev.co.kr', 'qa.shi-api.com', '60.101.107.90', '60.101.107.57', 'code.sdsdev.co.kr', 'sdsdev.co.kr'], vscode.ConfigurationTarget.Global);

            // 터미널 기본 프로필 설정
            await config.update('terminal.integrated.defaultProfile.windows', 'Command Prompt', vscode.ConfigurationTarget.Global);

            // 터미널 환경변수 설정
            const cmd_env = config.inspect<Record<string, string>>("terminal.integrated.env.windows");
            let envWindows = { ...(cmd_env?.globalValue || {}) }; // 기존 전역 값 가져오기 (없으면 빈 객체로 초기화)
            envWindows['HTTP_PROXY'] = proxyValue;
            envWindows['HTTPS_PROXY'] = proxyValue;
            envWindows['NO_PROXY'] = 'localhost|127.0.0.1|::1,70.10.15.*|*.sdsdev.co.kr|qa.shi-api.com|60.101.107.90|60.101.107.57|code.sdsdev.co.kr|sdsdev.co.kr';
            await config.update('terminal.integrated.env.windows', envWindows, vscode.ConfigurationTarget.Global);

            // 프라이빗 익스텐션 등록
            if (vscode.extensions.getExtension('garmin.private-extension-manager')) { // 확장 프로그램이 설치된 경우에만 접근 가능
                await config.update('privateExtensions.registries', [
                    {
                        name: '중공업 IT파트',
                        registry: 'http://qa.shi-api.com:7088/',
                        query: 'SHI-IT',
                        enablePagenation: false
                    },
                    {
                        name: '유용한 도구',
                        registry: 'http://qa.shi-api.com:7088/',
                        query: 'utils',
                        enablePagenation: false
                    }
                ], vscode.ConfigurationTarget.Global);
            }

            vscode.window.showInformationMessage('vscode 전역 설정 초기화 완료');
            this._log.appendLine('vscode 전역 설정 초기화 완료');
        } catch (error) {
            this._log.appendLine('vscode 전역 설정 초기화 실패: ' + error);
            vscode.window.showErrorMessage('vscode 전역 설정 초기화 실패: ' + error);
        }
    }
}
