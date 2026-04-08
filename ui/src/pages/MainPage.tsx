import { Header, Button } from '../components/common';
import { BuildPanel, TomcatSetupPanel, TomcatControlPanel } from '../components/main';
import { AppActions, AppState } from '@/hooks/useAppState';

const MainPage: React.FC<{ state: AppState, actions: AppActions }> = ({ state, actions }) => {
    return (
        <>
            <Header title="">
                <Button variant="secondary" className="header-btn" onClick={actions.navigation.goToProjectSettings} title="프로젝트 설정">프로젝트</Button>
                <Button variant="secondary" className="header-btn" onClick={actions.navigation.goToSettings} title="환경 설정">설정</Button>
            </Header>

            <BuildPanel
                onBuildClasses={actions.build.buildClasses}
                onCleanProject={actions.build.cleanProject}
                onStopGradle={actions.build.stopGradle}
                onApplyLibrary={actions.build.applyLibrary}
                state={state}
            />

            <TomcatSetupPanel state={state} actions={actions} />

            <TomcatControlPanel state={state} actions={actions} />
        </>
    );
};

export default MainPage;
