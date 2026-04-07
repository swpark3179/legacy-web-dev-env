import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { getNonce } from '../utils/nonce';

/**
 * Webview Provider 공통 베이스 클래스
 */
export abstract class WebviewProvider implements vscode.WebviewViewProvider {
    protected _view?: vscode.WebviewView;

    constructor(protected readonly _extensionUri: vscode.Uri) { }

    abstract resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken
    ): void;

    /**
     * React 빌드된 HTML을 가져옴
     */
    protected _getHtmlForWebview(webview: vscode.Webview): string {
        const distPath = path.join(this._extensionUri.fsPath, 'webview-dist');
        const indexPath = path.join(distPath, 'index.html');

        // 빌드된 파일이 있으면 사용
        if (fs.existsSync(indexPath)) {
            let html = fs.readFileSync(indexPath, 'utf-8');

            // asset 경로를 webview URI로 변환
            const assetsUri = webview.asWebviewUri(
                vscode.Uri.joinPath(this._extensionUri, 'webview-dist', 'assets')
            );

            // 상대 경로와 절대 경로 모두 처리
            html = html.replace(/src="\.\/assets\//g, `src="${assetsUri}/`);
            html = html.replace(/href="\.\/assets\//g, `href="${assetsUri}/`);
            html = html.replace(/src="\/assets\//g, `src="${assetsUri}/`);
            html = html.replace(/href="\/assets\//g, `href="${assetsUri}/`);

            // CSP 설정 추가
            const nonce = getNonce();
            const cspSource = webview.cspSource;

            // meta 태그 추가 (head 태그 바로 뒤에)
            const cspMeta = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${cspSource} 'unsafe-inline'; script-src ${cspSource} 'unsafe-inline'; font-src ${cspSource};">`;
            html = html.replace(/<head>/, `<head>\n    ${cspMeta}`);

            // script 태그에 nonce 추가 (type="module" 포함)
            html = html.replace(/<script /g, `<script nonce="${nonce}" `);

            return html;
        }

        // 빌드 파일이 없으면 개발용 메시지 표시
        return this._getFallbackHtml(webview);
    }

    /**
     * 빌드 파일이 없을 때의 폴백 HTML
     */
    protected _getFallbackHtml(webview: vscode.Webview): string {
        const nonce = getNonce();
        return `
<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline';">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>XPlatform Dev Helper</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            padding: 20px;
            color: var(--vscode-foreground);
            background-color: var(--vscode-sideBar-background);
        }
        .message {
            padding: 16px;
            background-color: var(--vscode-inputValidation-warningBackground);
            border: 1px solid var(--vscode-inputValidation-warningBorder);
            border-radius: 4px;
        }
        code {
            background-color: var(--vscode-textCodeBlock-background);
            padding: 2px 6px;
            border-radius: 3px;
        }
    </style>
</head>
<body>
    <div class="message">
        <h3>⚠️ React 빌드 필요</h3>
        <p>ui가 아직 빌드되지 않았습니다.</p>
        <p>다음 명령어를 실행해주세요:</p>
        <pre><code>cd ui && npm install && npm run build</code></pre>
    </div>
</body>
</html>`;
    }

    /**
     * Webview에 메시지 전송
     */
    protected _postMessage(message: unknown): void {
        if (this._view) {
            this._view.webview.postMessage(message);
        }
    }
}
