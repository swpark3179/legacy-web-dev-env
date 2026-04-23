import React, { useState } from 'react';
import { Panel, Button } from '../common';
import { AppActions, AppState } from '@/hooks/useAppState';
import { TomcatInitModal } from './TomcatInitModal';

export const TomcatSetupPanel: React.FC<{ state: AppState, actions: AppActions }> = ({ state, actions }) => {
    const [isInitModalOpen, setIsInitModalOpen] = useState(false);
    const isDisabled = state.tomcat.running || state.tomcat.initializing || state.build.isGradleRunning;
    const port = Number.parseInt(state.tomcatDraft.port, 10);
    const isPortValid = state.tomcatDraft.port !== '' && Number.isInteger(port) && port >= 1024 && port <= 65535;
    const isContextRootValid = state.tomcatDraft.contextRoot.trim().length > 0;

    const handleInit = () => {
        if (!isContextRootValid || !isPortValid) return;
        actions.tomcat.initTomcat(state.tomcatDraft.contextRoot.trim(), port);
        setIsInitModalOpen(false);
    };

    const getDisabledReason = () => {
        if (state.tomcat.running) return 'Tomcat이 이미 실행 중입니다.';
        if (state.tomcat.initializing) return 'Tomcat 초기화 중입니다.';
        if (state.build.isGradleRunning) return '빌드 실행 중입니다.';
        return 'Tomcat 초기화 설정';
    };

    return (
        <>
            <Panel title="Tomcat 환경 설정">
                <div className="context-root-section">
                    <label htmlFor="contextRootInput">context root</label>
                    <input
                        type="text"
                        id="contextRootInput"
                        value={state.tomcatDraft.contextRoot}
                        readOnly
                        disabled
                        placeholder="초기화 시 입력"
                    />
                </div>
                <div className="context-root-section" style={{ marginTop: '8px' }}>
                    <label htmlFor="tomcatPortInput">port</label>
                    <input
                        type="text"
                        id="tomcatPortInput"
                        value={state.tomcatDraft.port}
                        readOnly
                        disabled
                        placeholder="8080"
                        style={{ width: '100px' }}
                    />
                    <Button
                        variant="icon"
                        disabled={isDisabled}
                        onClick={() => setIsInitModalOpen(true)}
                        title={getDisabledReason()}
                        aria-label="Tomcat 초기화 설정"
                    >
                        <span className="icon">⚙</span>
                    </Button>
                </div>
                <div className="input-hint" style={{ marginLeft: '45px', marginTop: '4px' }}>
                    context root와 port는 초기화 버튼에서 설정합니다.
                </div>
            </Panel>

            <TomcatInitModal
                isOpen={isInitModalOpen}
                contextRoot={state.tomcatDraft.contextRoot}
                port={state.tomcatDraft.port}
                isBusy={isDisabled}
                onClose={() => setIsInitModalOpen(false)}
                onConfirm={handleInit}
                onChangeContextRoot={actions.tomcat.setDraftContextRoot}
                onChangePort={actions.tomcat.setDraftPort}
            />
        </>
    );
};
