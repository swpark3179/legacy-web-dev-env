import React, { useState } from 'react';
import { Panel, Button, ButtonGroup, StatusIcon } from '../common';
import { AppActions, AppState } from '@/hooks/useAppState';
import { ChangedFilesModal } from './ChangedFilesModal';

export const TomcatControlPanel: React.FC<{ state: AppState, actions: AppActions }> = ({
    state,
    actions,
}) => {
    const [isChangedFilesOpen, setIsChangedFilesOpen] = useState(false);

    const getStatusText = () => {
        if (state.tomcat.stopping) return '중지중';
        if (state.tomcat.starting && state.tomcat.debugMode) return '기동중(디버깅)';
        if (state.tomcat.starting) return '기동중';
        if (!state.tomcat.running) return '중지됨';
        if (state.tomcat.debugMode) return '실행 중(디버깅)';
        return '실행 중';
    };

    const getStatusIconStatus = (): 'starting' | 'stopping' | 'running' | 'stopped' => {
        if (state.tomcat.stopping) return 'stopping';
        if (state.tomcat.starting) return 'starting';
        if (state.tomcat.running) return 'running';
        return 'stopped';
    };

    const isTransitioning = state.tomcat.starting || state.tomcat.stopping;

    if (state.tomcat.portsBlocked) {
        return (
            <Panel>
                <div className="panel-header">
                    <h3>Tomcat 서버 제어</h3>
                </div>
                <p className="panel-description">
                    {state.tomcat.port} 포트가 사용 중입니다. 포트를 종료하면 정상적으로 Tomcat을 사용할 수 있습니다.
                </p>
                <ButtonGroup>
                    <Button onClick={actions.tomcat.killTomcatPorts} variant="danger">
                        포트 종료
                    </Button>
                </ButtonGroup>
            </Panel>
        );
    }

    return (
        <Panel>
            <div className="panel-header">
                <div className="tomcat-header-left">
                    <h3>Tomcat 서버 제어</h3>
                </div>
                <div className={`status ${state.tomcat.running && !isTransitioning ? 'status-running' : ''}`}>
                    <StatusIcon status={getStatusIconStatus()} />
                    <span>{getStatusText()}</span>
                </div>
            </div>

            <div className="hot-reload-section">
                <label className="checkbox-label">
                    <input
                        type="checkbox"
                        checked={state.tomcat.isHotReloadMode && state.validation.jdk_has_dcevm}
                        disabled={state.tomcat.running || !state.validation.jdk_has_dcevm}
                        onChange={(e) => actions.tomcat.setStateIsHotReloading(e.target.checked)}
                    />
                    <span>Hot Reloading</span>
                </label>
            </div>

            <ButtonGroup>
                <Button
                    onClick={() => actions.tomcat.startTomcat(state.tomcat.isHotReloadMode && state.validation.jdk_has_dcevm)}
                    disabled={state.tomcat.running || state.tomcat.initializing || state.build.isGradleRunning || isTransitioning}
                    style={{ width: 'calc(33% - 5px)' }}
                >
                    시작
                </Button>
                <Button
                    onClick={() => actions.tomcat.debugTomcat(state.tomcat.isHotReloadMode && state.validation.jdk_has_dcevm)}
                    disabled={state.tomcat.running || state.tomcat.initializing || state.build.isGradleRunning || isTransitioning}
                    style={{ width: 'calc(33% - 5px)' }}
                >
                    디버그
                </Button>
                <Button
                    variant={state.tomcat.running ? 'danger' : 'secondary'}
                    onClick={actions.tomcat.stopTomcat}
                    disabled={(!state.tomcat.running && !state.tomcat.stopping) || state.tomcat.initializing || state.build.isGradleRunning || state.tomcat.stopping}
                    style={{ width: 'calc(33% - 5px)' }}
                >
                    중지
                </Button>
                {state.tomcat.running && (
                    <Button
                        variant="secondary"
                        className="header-btn"
                        onClick={() => setIsChangedFilesOpen(true)}
                        style={{ width: '100%' }}
                    >
                        변경파일 {`(${state.deploy.changedFiles.java.length + state.deploy.changedFiles.query.length + state.deploy.changedFiles.config.length}건)`}
                    </Button>
                )}
            </ButtonGroup>

            {/* Tomcat 실행 중 변경된 파일 목록 팝업 */}
            <ChangedFilesModal
                isOpen={isChangedFilesOpen}
                onClose={() => setIsChangedFilesOpen(false)}
                changedFiles={state.deploy.changedFiles}
                onApply={() => { actions.deploy.applyChangedFiles(); setIsChangedFilesOpen(false); }}
                isHotReloading={state.tomcat.isHotReloadMode}
            />
        </Panel>
    );
};
