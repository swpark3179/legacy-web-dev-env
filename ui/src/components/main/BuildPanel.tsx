import React from 'react';
import { Panel, Button, ButtonGroup } from '../common';
import { AppState } from '@/hooks/useAppState';

export const BuildPanel: React.FC<{
    onBuildClasses: () => void;
    onCleanProject: () => void;
    onStopGradle: () => void;
    onApplyLibrary: () => void;
    state: AppState;
}> = ({ onBuildClasses, onCleanProject, onStopGradle, onApplyLibrary, state }) => {
    const { isGradleRunning } = state.build;

    const headerRight = (
        <Button
            variant="secondary"
            className="header-btn"
            onClick={onApplyLibrary}
            disabled={isGradleRunning || state.tomcat.initializing}
            title="라이브러리 적용"
        >
            라이브러리 적용
        </Button>
    );

    return (
        <Panel title="빌드" className="build-panel" headerRight={headerRight}>
            <div className="build-panel-content">
                <ButtonGroup>
                    <Button
                        onClick={onBuildClasses}
                        disabled={isGradleRunning || state.tomcat.initializing}
                        style={{ width: 'calc(50% - 5px)' }}
                    >
                        빌드(classes)
                    </Button>
                    <Button
                        variant="secondary"
                        onClick={onCleanProject}
                        disabled={isGradleRunning || state.tomcat.initializing}
                        style={{ width: 'calc(50% - 5px)' }}
                    >
                        초기화(clean)
                    </Button>
                </ButtonGroup>
                {isGradleRunning && (
                    <div className="build-stop-wrapper">
                        <Button
                            className="build-stop-btn"
                            onClick={onStopGradle}
                            title="빌드 중지"
                        >
                            중지
                        </Button>
                    </div>
                )}
            </div>
        </Panel>
    );
};
