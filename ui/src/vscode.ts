import type { WebviewApi } from 'vscode-webview';

// VSCode webview에서 주입되는 함수 타입 선언
declare function acquireVsCodeApi(): WebviewApi<unknown>;

// VSCode API 인스턴스 (싱글톤)
let vscodeApi: WebviewApi<unknown> | undefined;

/**
 * VSCode API를 가져옵니다.
 * webview 외부에서 실행될 경우 mock 객체를 반환합니다.
 */
export function getVSCodeAPI(): WebviewApi<unknown> {
    if (vscodeApi) {
        return vscodeApi;
    }

    if (typeof acquireVsCodeApi === 'function') {
        vscodeApi = acquireVsCodeApi();
        return vscodeApi!;
    }
    // acquireVsCodeApi가 없을 때 (브라우저 개발 등): Extension과 통신하지 않는 mock 반환
    const mockApi: WebviewApi<unknown> = {
        postMessage(_message: unknown) {
            // no-op (브라우저에서 개발 시 Extension 없음)
        },
        getState() {
            return undefined;
        },
        setState<T>(newState: T): T {
            return newState;
        },
    };
    return mockApi;
}

/**
 * Extension으로 메시지를 전송합니다.
 */
export function postMessage(message: { type: string;[key: string]: unknown }) {
    getVSCodeAPI().postMessage(message);
}

/**
 * Extension으로부터 메시지 수신 리스너를 등록합니다.
 */
export function onMessage(callback: (message: unknown) => void): () => void {
    const handler = (event: MessageEvent) => {
        callback(event.data);
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
}
