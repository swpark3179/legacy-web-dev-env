import * as vscode from 'vscode';

type TomcatStatus = 'stopped' | 'running' | 'debugging' | 'stopping' | 'starting';

/**
 * Tomcat 상태를 VS Code 상태바 왼쪽에 표시
 * - Running: 녹색 아이콘 + "Running"
 * - Debugging: 노란색 아이콘 + "Debugging"
 * - Starting: 흰색 ↔ 녹색/노란색 1초 간격 깜빡임 (기동 완료 시 깜빡임 중지)
 * - Stopping: 빨간색-흰색 1초 간격 깜빡임 + "Stopping"
 */
export class TomcatStatusBar {
    private _item: vscode.StatusBarItem;
    private _status: TomcatStatus = 'stopped';
    private _blinkInterval?: NodeJS.Timeout;
    private _blinkPhase: boolean = false;
    private _startingDebugMode: boolean = false;
    private static readonly ITEM_ID = 'xplatform.tomcatStatus';
    private static readonly PRIORITY = 100;

    constructor() {
        this._item = vscode.window.createStatusBarItem(
            TomcatStatusBar.ITEM_ID,
            vscode.StatusBarAlignment.Left,
            TomcatStatusBar.PRIORITY
        );
    }

    update(running: boolean, debugMode: boolean, stopping: boolean, starting?: boolean): void {
        const prevStatus = this._status;
        const status: TomcatStatus = stopping ? 'stopping'
            : starting && running ? 'starting'
                : debugMode && running ? 'debugging'
                    : running ? 'running'
                        : 'stopped';
        this._status = status;

        if (prevStatus === 'stopping' && status !== 'stopping') this._stopBlink();
        if (prevStatus === 'starting' && status !== 'starting') this._stopBlink();

        if (status === 'stopped') {
            this._item.hide();
            return;
        }

        if (status === 'stopping') {
            this._startStoppingBlink();
        } else if (status === 'starting') {
            this._startingDebugMode = debugMode;
            this._startStartingBlink();
        } else {
            this._stopBlink();
            this._render(status);
        }
    }

    private _render(status: 'running' | 'debugging'): void {
        if (status === 'running') {
            this._item.text = '실행 중';
            this._item.color = '#4ec9b0';
            this._item.backgroundColor = undefined;
        } else {
            this._item.text = '실행 중(디버깅)';
            this._item.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
            this._item.color = undefined;
        }
        this._item.tooltip = status === 'running' ? 'Tomcat 서버 실행 중' : 'Tomcat 디버그 모드';
        this._item.show();
    }

    private _renderStopping(phase: boolean): void {
        this._item.text = '중지 중';
        if (phase) {
            this._item.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
            this._item.color = undefined;
        } else {
            this._item.backgroundColor = undefined;
            this._item.color = '#ffffff';
        }
        this._item.tooltip = 'Tomcat 서버 중지 중';
        this._item.show();
    }

    private _renderStarting(phase: boolean): void {
        const text = this._startingDebugMode ? '기동 중(디버깅)' : '기동 중';
        this._item.text = text;
        this._item.tooltip = this._startingDebugMode ? 'Tomcat 디버그 모드 기동 중' : 'Tomcat 서버 기동 중';
        if (phase) {
            if (this._startingDebugMode) {
                this._item.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
                this._item.color = undefined;
            } else {
                this._item.color = '#4ec9b0';
                this._item.backgroundColor = undefined;
            }
        } else {
            this._item.backgroundColor = undefined;
            this._item.color = '#ffffff';
        }
        this._item.show();
    }

    private _startStoppingBlink(): void {
        this._stopBlink();
        this._blinkPhase = true;
        this._renderStopping(this._blinkPhase);
        this._blinkInterval = setInterval(() => {
            this._blinkPhase = !this._blinkPhase;
            if (this._status === 'stopping') this._renderStopping(this._blinkPhase);
        }, 1000);
    }

    private _startStartingBlink(): void {
        this._stopBlink();
        this._blinkPhase = false;
        this._renderStarting(this._blinkPhase);
        this._blinkInterval = setInterval(() => {
            this._blinkPhase = !this._blinkPhase;
            if (this._status === 'starting') this._renderStarting(this._blinkPhase);
        }, 1000);
    }

    private _stopBlink(): void {
        if (this._blinkInterval) {
            clearInterval(this._blinkInterval);
            this._blinkInterval = undefined;
        }
    }

    dispose(): void {
        this._stopBlink();
        this._item.dispose();
    }
}
