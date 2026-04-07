// ==================== Settings ====================
export interface Settings {
    projectRoot: string;
    gradlePath: string;
    jdkPath: string;
    tomcatPath: string;
}

// ==================== Validation ====================
export type ValidationStatus = 'pending' | 'validating' | 'valid' | 'warning' | 'invalid';

export interface ValidationItem {
    status: ValidationStatus;
    message: string;
    version?: string;
}

export interface ValidationState {
    isFirstLoaded: boolean;
    isValidating: boolean;
    allValid: boolean;
    projectValid: boolean;
    gradle: ValidationItem;
    jdk: ValidationItem;
    tomcat: ValidationItem;
    jdk_has_dcevm: boolean;
}

// ==================== Tomcat ====================
/** Tomcat 코어 상태 (자주 바뀌지 않는 값) */
export interface TomcatCoreState {
    initialized: boolean;
    contextRoot: string;
    port: number;
    portsBlocked: boolean;
    deployPath: string;
}

export interface TomcatRunningState {
    running: boolean;
    debugMode: boolean;
    initializing: boolean;
    starting: boolean;
    stopping: boolean;
}

/** UI에서 사용하는 Tomcat 전체 상태 */
export interface TomcatState extends TomcatCoreState, TomcatRunningState {
    isHotReloadMode: boolean;
}

// ==================== Messages ====================
export interface MessageFromExtension {
    type: string;
    settings?: Settings;
    validation?: ValidationState;
    tomcat?: TomcatState;
    isGradleRunning?: boolean;
    page?: string;
    changedFiles?: { java: string[], query: string[] };
    validationState?: ValidationState;
}

export interface ProjectSettingsOptions {
    hideSimpleFolder: boolean;
    hideExtFolder: boolean;
    initProjectFile: boolean;
}
