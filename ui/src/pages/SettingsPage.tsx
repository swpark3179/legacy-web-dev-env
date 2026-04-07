import React from 'react';
import { Header, Button } from '../components/common';
import { ProjectInfoPanel, ToolPathPanel, ValidationPanel } from '../components/settings';
import { AppActions, AppState } from '@/hooks/useAppState';

const SettingsPage: React.FC<{state: AppState, actions: AppActions}> = ({ state, actions }) => {
    return (
        <>
            <Header title="환경 설정">
                <Button variant="secondary" className="header-btn" onClick={actions.settings.initGlobalSettings} title="프로젝트 설정">전역 설정 초기화</Button>
                {state.validation.allValid && <Button variant="secondary" className="header-btn" onClick={actions.navigation.goToMain} title="뒤로">뒤로</Button>}
            </Header>

            <ProjectInfoPanel
                settings={state.settings}
                validation={state.validation}
            />

            <ToolPathPanel
                settings={state.settings}
                validation={state.validation}
                onSelectFolder={actions.settings.selectFolder}
            />

            <ValidationPanel
                settings={state.settings}
                validation={state.validation}
                onValidateAll={actions.settings.validateAll}
            />
        </>
    );
};

export default SettingsPage;
