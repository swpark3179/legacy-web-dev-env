import * as vscode from 'vscode';
import { UnifiedPanelProvider } from './panels';

export function activate(context: vscode.ExtensionContext) {
    // 통합 패널 프로바이더 생성
    const panelProvider = new UnifiedPanelProvider(context.extensionUri, context);

    // Webview 뷰 프로바이더 등록
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(
            'dev-web-helper.settingsView',
            panelProvider
        )
    );

    // 설정 패널 표시 명령어 등록
    const showSettingsCommand = vscode.commands.registerCommand(
        'dev-web-helper.showSettings',
        () => {
            vscode.commands.executeCommand('workbench.view.extension.web-sidebar');
        }
    );

    context.subscriptions.push(showSettingsCommand);
}

export function deactivate() { }

