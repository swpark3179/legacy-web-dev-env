import React, { useState } from 'react';
import { Panel, Button } from '../common';
import { AppActions, AppState } from '@/hooks/useAppState';

export const TomcatSetupPanel: React.FC<{ state: AppState, actions: AppActions }> = ({ state, actions }) => {
    const [port, setPort] = useState<number>(state.tomcat.port || 7001);
    const isDisabled = state.tomcat.running || state.tomcat.initializing || state.build.isGradleRunning;

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
                    type="number"
                    id="tomcatPortInput"
                    value={port}
                    min={1024}
                    max={65535}
                    disabled={isDisabled}
                    onChange={(e) => setPort(parseInt(e.target.value, 10) || 7001)}
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
