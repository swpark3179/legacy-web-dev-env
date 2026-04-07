import type { MessageFromWebview, ProjectSettingsOptions } from '../types';

/**
 * 내부 엔진이 UI 액션을 처리하기 위해 필요한 API.
 * 웹뷰 메시지를 받아 해당 액션을 실행할 때 이 인터페이스를 통해 호출한다.
 */
export interface IWebviewActionEngine {
    initGlobalSettings(): unknown;
    sendState(): void;
    sendTomcatState(): void;
    handleInitProject(): Promise<void>;
    handleSelectFolder(target: string, currentPath?: string): Promise<void>;
    handleValidateAll(): Promise<void>;
    buildClasses(): void;
    cleanProject(): void;
    stopGradle(): void;
    initTomcat(contextRoot: string, port: number): Promise<void>;
    startTomcat(enableHotswap: boolean): Promise<void>;
    debugTomcat(enableHotswap: boolean): Promise<void>;
    stopTomcat(): Promise<void>;
    killTomcatPorts(): Promise<void>;
    handleApplyProjectSettings(options: ProjectSettingsOptions): Promise<void>;
    handleSetupHomeSettings(): Promise<void>;
    applyChangedFiles(): Promise<void>;
    log?(message: string): void;
}

/**
 * 웹뷰에서 전달된 메시지에 따라 내부 엔진 액션을 실행한다.
 * UI → 엔진 방향의 액션 전달용.
 */
export async function handleWebviewMessage(
    data: MessageFromWebview,
    engine: IWebviewActionEngine
): Promise<void> {
    switch (data.type) {
        case 'initProject':
            await engine.handleInitProject();
            engine.sendState();
            break;
        case 'selectFolder':
            await engine.handleSelectFolder(data.target, data.currentPath);
            break;
        case 'validateAll':
            await engine.handleValidateAll();
            break;
        case 'initGlobalSettings':
            engine.initGlobalSettings();
            break;
        case 'buildClasses':
            engine.buildClasses();
            break;
        case 'cleanProject':
            engine.cleanProject();
            break;
        case 'stopGradle':
            engine.stopGradle();
            break;
        case 'initTomcat':
            await engine.initTomcat(data.contextRoot, data.port);
            engine.sendTomcatState();
            break;
        case 'startTomcat':
            await engine.startTomcat(data.enableHotswap);
            engine.sendTomcatState();
            break;
        case 'debugTomcat':
            await engine.debugTomcat(data.enableHotswap);
            engine.sendTomcatState();
            break;
        case 'stopTomcat':
            await engine.stopTomcat();
            engine.sendTomcatState();
            break;
        case 'killTomcatPorts':
            await engine.killTomcatPorts();
            break;
        case 'applyProjectSettings':
            await engine.handleApplyProjectSettings(data.options);
            break;
        case 'setupHomeSettings':
            await engine.handleSetupHomeSettings();
            break;
        case 'applyChangedFiles':
            await engine.applyChangedFiles();
            break;
    }
}
