import React from 'react';
import { Header, Button } from '../components/common';
import {
    WorkspaceSettingsPanel,
    HomeSettingsPanel,
} from '../components/project-settings';
import { AppActions } from '@/hooks/useAppState';

const ProjectSettingsPage: React.FC<{actions: AppActions}> = ({ actions }) => {
    return (
        <>
            <Header title="프로젝트 설정">
                <Button
                    variant="secondary"
                    className="header-btn"
                    onClick={actions.navigation.goToMain}
                    title="뒤로"
                >
                    뒤로
                </Button>
            </Header>

            <WorkspaceSettingsPanel onApplySettings={actions.project.applyProjectSettings} />
            <HomeSettingsPanel onSetupHomeSettings={actions.project.setupHomeSettings} />
        </>
    );
};

export default ProjectSettingsPage;
