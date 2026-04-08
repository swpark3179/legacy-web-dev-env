import { useCallback } from 'react';
import { postMessage } from '../vscode';
import type { ProjectSettingsOptions } from '../types';

export type PageKind = 'settings' | 'main' | 'project-settings';

export interface UseAppActionsDeps {
    setCurrentPage: (page: PageKind) => void;
    setIsGradleRunning: (value: boolean) => void;
    setTomcatIsHotReloading: (value: boolean) => void;
    setChangedFiles: (value: { java: string[], query: string[] }) => void;
}

/**
 * Extension 메시지 전송 및 로컬 상태 업데이트 액션 훅.
 * actions는 도메인별로 계층화되어 있음 (navigation, settings, build, tomcat, deploy, project).
 */
export function useAppActions(deps: UseAppActionsDeps) {
    const {
        setCurrentPage,
        setIsGradleRunning,
        setTomcatIsHotReloading,
        setChangedFiles,
    } = deps;

    const navigation = {
        goToSettings: useCallback(() => {
            setCurrentPage('settings');
        }, [setCurrentPage]),
        goToMain: useCallback(() => {
            setCurrentPage('main');
        }, [setCurrentPage]),
        goToProjectSettings: useCallback(() => {
            setCurrentPage('project-settings');
        }, [setCurrentPage]),
    };

    const settings = {
        initProject: useCallback(() => {
            postMessage({ type: 'initProject' });
        }, []),
        initGlobalSettings: useCallback(() => {
            postMessage({ type: 'initGlobalSettings' });
        }, []),
        selectFolder: useCallback((target: string, currentPath?: string) => {
            postMessage({ type: 'selectFolder', target, currentPath });
        }, []),
        validateAll: useCallback(() => {
            postMessage({ type: 'validateAll' });
        }, []),
    };

    const build = {
        buildClasses: useCallback(() => {
            setIsGradleRunning(true);
            postMessage({ type: 'buildClasses' });
        }, [setIsGradleRunning]),
        cleanProject: useCallback(() => {
            setIsGradleRunning(true);
            postMessage({ type: 'cleanProject' });
        }, [setIsGradleRunning]),
        stopGradle: useCallback(() => {
            postMessage({ type: 'stopGradle' });
        }, []),
        applyLibrary: useCallback(() => {
            setIsGradleRunning(true);
            postMessage({ type: 'applyLibrary' });
        }, [setIsGradleRunning]),
    };

    const tomcat = {
        initTomcat: useCallback((contextRoot: string, port: number) => {
            postMessage({ type: 'initTomcat', contextRoot, port });
        }, []),
        startTomcat: useCallback((enableHotswap: boolean) => {
            postMessage({ type: 'startTomcat', enableHotswap });
        }, []),
        debugTomcat: useCallback((enableHotswap: boolean) => {
            postMessage({ type: 'debugTomcat', enableHotswap });
        }, []),
        stopTomcat: useCallback(() => {
            postMessage({ type: 'stopTomcat' });
        }, []),
        killTomcatPorts: useCallback(() => {
            postMessage({ type: 'killTomcatPorts' });
        }, []),
        setStateIsHotReloading: useCallback((value: boolean) => {
            setTomcatIsHotReloading(value);
        }, [setTomcatIsHotReloading]),
    };

    const deploy = {
        applyChangedFiles: useCallback(() => {
            setChangedFiles({ java: [], query: [] });
            postMessage({ type: 'applyChangedFiles' });
        }, [setChangedFiles]),
    };

    const project = {
        applyProjectSettings: useCallback((options: ProjectSettingsOptions) => {
            postMessage({ type: 'applyProjectSettings', options });
        }, []),
        setupHomeSettings: useCallback(() => {
            postMessage({ type: 'setupHomeSettings' });
        }, []),
    };

    return {
        navigation,
        settings,
        build,
        tomcat,
        deploy,
        project,
    };
}
