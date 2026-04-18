import React, { useState } from 'react';
import { Panel, Button } from '../common';
import { AppActions, AppState } from '@/hooks/useAppState';

export const TomcatSetupPanel: React.FC<{ state: AppState, actions: AppActions }> = ({ state, actions }) => {
    const [portStr, setPortStr] = useState<string>(String(state.tomcat.port || 8080));
    const isDisabled = state.tomcat.running || state.tomcat.initializing || state.build.isGradleRunning;

    // 입력값 필터링 및 숫자 변환
    const handlePortChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value.replace(/[^0-9]/g, '');
        setPortStr(value);
    };

    const port = parseInt(portStr, 10);
    // 포트 유효성 검사 (1024 ~ 65535)
    const isPortValid = portStr === '' ? false : Number.isInteger(port) && port >= 1024 && port <= 65535;

    const handleInit = () => {
        if (!isPortValid) return;
        actions.tomcat.initTomcat(state.tomcat.contextRoot, port);
    };

    const getDisabledReason = () => {
        if (!isPortValid) return '포트 번호는 1024에서 65535 사이여야 합니다.';
        if (state.tomcat.running) return 'Tomcat이 이미 실행 중입니다.';
        if (state.tomcat.initializing) return 'Tomcat 초기화 중입니다.';
        if (state.build.isGradleRunning) return '빌드 실행 중입니다.';
        return 'Tomcat 초기화';
    };

    return (
        <Panel title="Tomcat 환경 설정">
            <div className="context-root-section">
                <label htmlFor="contextRootInput">context root</label>
                <input
                    type="text"
                    id="contextRootInput"
                    value={state.tomcat.contextRoot}
                    readOnly
                    disabled
                />
            </div>
            <div className="context-root-section" style={{ marginTop: '8px' }}>
                <label htmlFor="tomcatPortInput">port</label>
                <input
                    type="text"
                    id="tomcatPortInput"
                    value={portStr}
                    disabled={isDisabled}
                    onChange={handlePortChange}
                    style={{ width: '100px', borderColor: !isPortValid ? 'var(--vscode-testing-iconFailed, #f14c4c)' : undefined }}
                    aria-invalid={!isPortValid}
                    aria-describedby={!isPortValid ? "port-error-msg" : undefined}
                />
                <Button
                    variant="icon"
                    disabled={isDisabled || !isPortValid}
                    onClick={handleInit}
                    title={getDisabledReason()}
                    aria-label="Tomcat 초기화"
                >
                    <span className="icon" aria-hidden="true">⚙</span>
                </Button>
            </div>
            {!isPortValid && (
                <div id="port-error-msg" className="validation-message invalid" role="alert" style={{ marginLeft: '45px', marginTop: '4px' }}>
                    포트 번호는 1024~65535 사이여야 합니다.
                </div>
            )}
        </Panel>
    );
};
