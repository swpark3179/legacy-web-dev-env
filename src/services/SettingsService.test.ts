import * as vscode from 'vscode';
import * as fs from 'fs';
import { SettingsService } from './SettingsService';
import { Settings } from '../types';

jest.mock('vscode', () => {
    const ConfigurationTarget = {
        Global: 1,
        Workspace: 2,
        WorkspaceFolder: 3
    };

    const mockConfig = {
        get: jest.fn(),
        update: jest.fn(),
        inspect: jest.fn(),
    };

    return {
        ConfigurationTarget,
        window: {
            showErrorMessage: jest.fn(),
            showWarningMessage: jest.fn(),
            showInformationMessage: jest.fn(),
            showOpenDialog: jest.fn(),
        },
        workspace: {
            getConfiguration: jest.fn(() => mockConfig),
        },
        Uri: {
            file: jest.fn((path) => ({ fsPath: path })),
            parse: jest.fn((path) => ({ fsPath: path })),
        },
        extensions: {
            getExtension: jest.fn(),
        }
    };
}, { virtual: true });

jest.mock('fs', () => ({
    existsSync: jest.fn(),
}));

describe('SettingsService', () => {
    let mockLog: any;
    let mockSettings: Settings;
    let settingsService: SettingsService;
    let mockConfig: any;

    beforeEach(() => {
        jest.clearAllMocks();

        mockLog = {
            appendLine: jest.fn(),
        };

        mockSettings = {
            projectRoot: '/test/project',
            gradlePath: '/test/gradle',
            jdkPath: '/test/jdk',
            tomcatPath: '/test/tomcat',
        };

        settingsService = new SettingsService(mockLog, mockSettings);
        mockConfig = (vscode.workspace.getConfiguration as jest.Mock)();
    });

    it('should be initialized', () => {
        expect(settingsService).toBeDefined();
    });

    describe('loadSavedSettings', () => {
        it('should return false and log error when config.get throws', () => {
            const testError = new Error('Test Error');
            (mockConfig.get as jest.Mock).mockImplementation(() => {
                throw testError;
            });

            const result = settingsService.loadSavedSettings();

            expect(result).toBe(false);
            expect(mockLog.appendLine).toHaveBeenCalledWith('[settings.json] 설정 로드 실패: Error: Test Error');
        });

        it('should return true and update settings when all paths are valid', () => {
            (mockConfig.get as jest.Mock).mockReturnValue('/valid/path');
            (fs.existsSync as jest.Mock).mockReturnValue(true);

            const result = settingsService.loadSavedSettings();

            expect(result).toBe(true);
            expect(settingsService.settings.jdkPath).toBe('/valid/path');
            expect(settingsService.settings.tomcatPath).toBe('/valid/path');
            expect(settingsService.settings.gradlePath).toBe('/valid/path');
            expect(mockLog.appendLine).toHaveBeenCalledTimes(3);
        });

        it('should return false when some paths do not exist', () => {
            (mockConfig.get as jest.Mock).mockImplementation((key: string) => {
                if (key.includes('jdk')) return '/invalid/jdk';
                return '/valid/path';
            });
            (fs.existsSync as jest.Mock).mockImplementation((path: string) => {
                if (path === '/invalid/jdk') return false;
                return true;
            });

            const result = settingsService.loadSavedSettings();

            expect(result).toBe(false);
        });
    });

    describe('getters', () => {
        it('should return settings copy', () => {
            const settings = settingsService.settings;
            expect(settings).toEqual(mockSettings);
            expect(settings).not.toBe(mockSettings); // Should be a copy
        });

        it('should return projectRoot', () => {
            expect(settingsService.projectRoot).toBe(mockSettings.projectRoot);
        });
    });

    describe('setPath', () => {
        it('should update paths in internal settings', () => {
            settingsService.setPath('gradle', '/new/gradle');
            settingsService.setPath('jdk', '/new/jdk');
            settingsService.setPath('tomcat', '/new/tomcat');

            expect(settingsService.settings.gradlePath).toBe('/new/gradle');
            expect(settingsService.settings.jdkPath).toBe('/new/jdk');
            expect(settingsService.settings.tomcatPath).toBe('/new/tomcat');
        });
    });

    describe('handleSelectFolder', () => {
        it('should update path and call onUpdate when folder is selected', async () => {
            const onUpdate = jest.fn();
            (vscode.window.showOpenDialog as jest.Mock).mockResolvedValue([{ fsPath: '/selected/folder' }]);

            await settingsService.handleSelectFolder(onUpdate, 'jdk', '/current/path');

            expect(settingsService.settings.jdkPath).toBe('/selected/folder');
            expect(onUpdate).toHaveBeenCalled();
        });

        it('should NOT update path or call onUpdate when selection is cancelled', async () => {
            const onUpdate = jest.fn();
            (vscode.window.showOpenDialog as jest.Mock).mockResolvedValue(undefined);

            await settingsService.handleSelectFolder(onUpdate, 'jdk', '/current/path');

            expect(settingsService.settings.jdkPath).toBe(mockSettings.jdkPath);
            expect(onUpdate).not.toHaveBeenCalled();
        });
    });

    describe('saveSettings', () => {
        it('should update configurations and log completion', () => {
            (mockConfig.inspect as jest.Mock).mockReturnValue({ globalValue: 'someValue' });

            settingsService.saveSettings();

            expect(mockConfig.update).toHaveBeenCalledWith('gradlePath', undefined, vscode.ConfigurationTarget.Global);
            expect(mockConfig.update).toHaveBeenCalledWith('gradlePath', mockSettings.gradlePath, vscode.ConfigurationTarget.Workspace);
            expect(mockLog.appendLine).toHaveBeenCalledWith('설정 저장 완료');
        });

        it('should log error when configuration update fails', () => {
            (mockConfig.update as jest.Mock).mockImplementation(() => {
                throw new Error('Update Error');
            });

            settingsService.saveSettings();

            expect(vscode.window.showErrorMessage).toHaveBeenCalledWith('설정 저장 실패');
        });
    });

    describe('initGlobalSettings', () => {
        it('should NOT update anything if user selects "아니오"', async () => {
            (vscode.window.showInformationMessage as jest.Mock).mockResolvedValue('아니오');

            await settingsService.initGlobalSettings();

            expect(mockConfig.update).not.toHaveBeenCalled();
        });

        it('should update multiple configurations if user selects "예"', async () => {
            (vscode.window.showInformationMessage as jest.Mock).mockResolvedValue('예');
            (vscode.extensions.getExtension as jest.Mock).mockReturnValue({});

            await settingsService.initGlobalSettings();

            expect(mockConfig.update).toHaveBeenCalledWith('http.proxy', 'http://60.200.254.1:9090', vscode.ConfigurationTarget.Global);
            expect(mockConfig.update).toHaveBeenCalledWith('terminal.integrated.defaultProfile.windows', 'Command Prompt', vscode.ConfigurationTarget.Global);
            expect(mockConfig.update).toHaveBeenCalledWith('privateExtensions.registries', expect.any(Array), vscode.ConfigurationTarget.Global);
            expect(mockLog.appendLine).toHaveBeenCalledWith('vscode 전역 설정 초기화 완료');
        });

        it('should log error if initialization fails', async () => {
            (vscode.window.showInformationMessage as jest.Mock).mockResolvedValue('예');
            (mockConfig.update as jest.Mock).mockImplementation(() => {
                throw new Error('Init Error');
            });

            await settingsService.initGlobalSettings();

            expect(mockLog.appendLine).toHaveBeenCalledWith(expect.stringContaining('vscode 전역 설정 초기화 실패'));
            expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(expect.stringContaining('vscode 전역 설정 초기화 실패'));
        });
    });
});
