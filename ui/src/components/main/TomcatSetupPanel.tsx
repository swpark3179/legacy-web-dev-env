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
    const isPortValid = Number.isInteger(port) && port >= 1024 && port <= 65535;

    const handleInit = () => {
        if (!isPortValid) return;
        actions.tomcat.initTomcat(state.tomcat.contextRoot, port);
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
                    style={{ width: '100px' }}
                />
                <Button
                    variant="icon"
                    disabled={isDisabled || !isPortValid}
                    onClick={handleInit}
                    title="Tomcat 초기화"
                    aria-label="Tomcat 초기화"
                >
                    <span className="icon">⚙</span>
                </Button>
            </div>
        </Panel>
    );
};
