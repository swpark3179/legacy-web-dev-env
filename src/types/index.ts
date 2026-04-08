// ==================== Settings ====================
export interface Settings {
    projectRoot: string;
    gradlePath: string;
    jdkPath: string;
    tomcatPath: string;
}

// ==================== Validation ====================
export type ValidationStatus = 'pending' | 'validating' | 'valid' | 'warning' | 'invalid';
export type ChangedFiles = { java: string[], query: string[], config: string[] };

export interface ValidationItem {
    status: ValidationStatus;
    message: string;
    version?: string;
}

export interface ProjectValidation {
    valid: boolean;
    message: string;
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
export interface TomcatState {
    initialized: boolean;
    contextRoot: string;
    port: number;
    running: boolean;
    debugMode: boolean;
    portsBlocked: boolean;
    deployPath: string;
    initializing: boolean;
    starting: boolean;
    stopping: boolean;
    isHotReloadMode: boolean;
}

// ==================== Project Settings Options ====================
export interface ProjectSettingsOptions {
    hideSimpleFolder: boolean;
    hideExtFolder: boolean;
    initProjectFile: boolean;
}

// ==================== Messages ====================
export type MessageFromWebview =
    | { type: 'initProject' }
    | { type: 'selectFolder'; target: string; currentPath?: string }
    | { type: 'validateAll' }
    | { type: 'initGlobalSettings' }
    | { type: 'buildClasses' }
    | { type: 'cleanProject' }
    | { type: 'stopGradle' }
    | { type: 'initTomcat'; contextRoot: string; port: number }
    | { type: 'startTomcat'; enableHotswap: boolean }
    | { type: 'debugTomcat'; enableHotswap: boolean }
    | { type: 'stopTomcat' }
    | { type: 'killTomcatPorts' }
    | { type: 'applyProjectSettings'; options: ProjectSettingsOptions }
    | { type: 'setupHomeSettings' }
    | { type: 'applyChangedFiles' };

export type MessageFromExtension =
    | { type: 'stateUpdate'; settings: Settings }
    | { type: 'mainStateUpdate'; settings?: Settings; isGradleRunning?: boolean; tomcat?: TomcatState; validation?: ValidationState; changedFiles?: ChangedFiles }
    | { type: 'navigateTo'; page: string; validation?: ValidationState; validationState?: ValidationState }
    | { type: 'tomcatStateUpdate'; tomcat: TomcatState }
    | { type: 'changedFilesUpdate'; changedFiles: ChangedFiles };
