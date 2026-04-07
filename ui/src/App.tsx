import { useAppState } from './hooks/useAppState';
import SettingsPage from './pages/SettingsPage';
import MainPage from './pages/MainPage';
import ProjectSettingsPage from './pages/ProjectSettingsPage';
import { useEffect } from 'react';

function App() {
    const { state, actions } = useAppState();

    useEffect(() => {
        actions.settings.initProject();
    }, []);

    if (!state.validation.isFirstLoaded) {
        return (
            <div className="app loading-state">
                <div className="loading-spinner" aria-hidden="true" />
                <span className="loading-text">로딩 중...</span>
            </div>
        );
    }

    const renderPage = () => {
        switch (state.navigation.currentPage) {
            case 'main':
                return <MainPage state={state} actions={actions} />;
            case 'project-settings':
                return <ProjectSettingsPage actions={actions} />;
            case 'settings':
            default:
                return <SettingsPage state={state} actions={actions} />;
        }
    };

    return <div className="app">{renderPage()}</div>;
}

export default App;
