import { useState, useEffect, useMemo } from 'react';
import { onMessage } from '../vscode';
import { getVSCodeAPI } from '../vscode';
import type { Settings, ValidationState, TomcatCoreState, TomcatState, MessageFromExtension, TomcatRunningState } from '../types';
import { useAppActions, type PageKind } from './useAppActions';

interface TomcatDraftState {
    contextRoot: string;
    port: string;
}

interface PersistedWebviewState {
    currentPage: PageKind;
    tomcatDraft: TomcatDraftState;
    tomcatIsHotReloading: boolean;
}

const persistedState = getVSCodeAPI().getState() as Partial<PersistedWebviewState> | undefined;

const initialSettings: Settings = {
    projectRoot: '',
    gradlePath: '',
    jdkPath: '',
    tomcatPath: '',
};

const initialValidation: ValidationState = {
    isFirstLoaded: false,
    isValidating: false,
    allValid: false,
    projectValid: false,
    gradle: { status: 'pending', message: '' },
    jdk: { status: 'pending', message: '' },
    tomcat: { status: 'pending', message: '' },
    jdk_has_dcevm: false,
};

const initialTomcatCore: TomcatCoreState = {
    initialized: false,
    contextRoot: '',
    port: 8080,
    portsBlocked: false,
    deployPath: '',
};

const initialTomcatDraft: TomcatDraftState = {
    contextRoot: persistedState?.tomcatDraft?.contextRoot ?? '',
    port: persistedState?.tomcatDraft?.port ?? '8080',
};

const initialTomcatRunning: TomcatRunningState = {
    running: false,
    debugMode: false,
    initializing: false,
    starting: false,
    stopping: false,
};

// 앱 전역 상태 관리 훅
export function useAppState() {
    // 네비게이션
    const [currentPage, setCurrentPage] = useState<PageKind>(persistedState?.currentPage ?? 'settings');

    // 설정·검증
    const [settings, setSettings] = useState<Settings>(initialSettings);
    const [validation, setValidation] = useState<ValidationState>(initialValidation);

    // Tomcat: 코어는 한 덩어리, 자주 바뀌는 값은 별도 state
    const [tomcatCore, setTomcatCore] = useState<TomcatCoreState>(initialTomcatCore);
    const [tomcatRunning, setTomcatRunning] = useState<TomcatRunningState>(initialTomcatRunning);
    const [tomcatDraft, setTomcatDraft] = useState<TomcatDraftState>(initialTomcatDraft);
    const [tomcatIsHotReloading, setTomcatIsHotReloading] = useState(persistedState?.tomcatIsHotReloading ?? true);

    // 빌드
    const [isGradleRunning, setIsGradleRunning] = useState(false);

    // 변경 파일 (Tomcat 기동 중 감지)
    const [changedFiles, setChangedFiles] = useState<{ java: string[], query: string[], config: string[] }>({ java: [], query: [], config: [] });

    // Tomcat 상태 업데이트
    const tomcatStateUpdate = (tomcatStateMsg: TomcatState) => {
        setTomcatCore({
            initialized: tomcatStateMsg.initialized,
            contextRoot: tomcatStateMsg.contextRoot,
            port: tomcatStateMsg.port,
            portsBlocked: tomcatStateMsg.portsBlocked,
            deployPath: tomcatStateMsg.deployPath,
        });
        setTomcatRunning({
            running: tomcatStateMsg.running,
            debugMode: tomcatStateMsg.debugMode,
            initializing: tomcatStateMsg.initializing,
            starting: tomcatStateMsg.starting,
            stopping: tomcatStateMsg.stopping,
        });
        if (tomcatStateMsg.isHotReloadMode !== undefined) setTomcatIsHotReloading(tomcatStateMsg.isHotReloadMode);
        setTomcatDraft((prev) => ({
            contextRoot: tomcatStateMsg.initialized || !prev.contextRoot ? tomcatStateMsg.contextRoot : prev.contextRoot,
            port: tomcatStateMsg.initialized || !prev.port || prev.port === '8080' ? String(tomcatStateMsg.port || 8080) : prev.port,
        }));
    };

    useEffect(() => {
        getVSCodeAPI().setState({
            currentPage,
            tomcatDraft,
            tomcatIsHotReloading,
        } satisfies PersistedWebviewState);
    }, [currentPage, tomcatDraft, tomcatIsHotReloading]);

    // Extension으로부터 메시지 수신
    useEffect(() => {
        const unsubscribe = onMessage((message: unknown) => {
            const msg = message as MessageFromExtension;

            switch (msg.type) {
                case 'stateUpdate':
                    if (msg.settings) setSettings(msg.settings);
                    break;
                case 'mainStateUpdate':
                    if (msg.settings) setSettings(msg.settings);
                    if (msg.isGradleRunning !== undefined) setIsGradleRunning(msg.isGradleRunning);
                    if (msg.tomcat) tomcatStateUpdate(msg.tomcat);
                    if (msg.validation) setValidation(msg.validation);
                    if (msg.changedFiles) setChangedFiles(msg.changedFiles);
                    break;
                case 'navigateTo':
                    if (msg.validation) setValidation(msg.validation);
                    if (msg.validationState) setValidation(msg.validationState);
                    if (msg.page) setCurrentPage(msg.page as 'settings' | 'main' | 'project-settings');
                    break;
                case 'tomcatStateUpdate':
                    if (msg.tomcat) tomcatStateUpdate(msg.tomcat);
                    break;
                case 'changedFilesUpdate':
                    if (msg.changedFiles) setChangedFiles(msg.changedFiles);
                    break;
            }
        });
        return unsubscribe;
    }, []);

    const actions = useAppActions({
        setCurrentPage,
        setIsGradleRunning,
        setTomcatIsHotReloading,
        setTomcatDraftContextRoot: (value) => setTomcatDraft((prev) => ({ ...prev, contextRoot: value })),
        setTomcatDraftPort: (value) => setTomcatDraft((prev) => ({ ...prev, port: value })),
        setChangedFiles,
    });

    // 계층적 state
    const state = useMemo(() => ({
        navigation: { currentPage },
        settings,
        validation,
        build: { isGradleRunning },
        tomcat: {
            ...tomcatCore,
            ...tomcatRunning,
            isHotReloadMode: tomcatIsHotReloading,
        } as TomcatState,
        tomcatDraft,
        deploy: {
            changedFiles: changedFiles,
        },
    }), [
        currentPage,
        settings,
        validation,
        isGradleRunning,
        tomcatCore,
        tomcatRunning,
        tomcatDraft,
        tomcatIsHotReloading,
        changedFiles,
    ]);

    return { state, actions };
}

export type AppActions = ReturnType<typeof useAppState>['actions'];
export type AppState = ReturnType<typeof useAppState>['state'];
