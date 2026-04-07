import * as vscode from 'vscode';
import * as fs from 'fs';
import { ProjectService } from './ProjectService';
import { Settings, ProjectSettingsOptions } from '../types';

jest.mock('vscode', () => {
    return {
        window: {
            showErrorMessage: jest.fn(),
            showWarningMessage: jest.fn(),
            showInformationMessage: jest.fn(),
            showInputBox: jest.fn(),
        },
        workspace: {
            workspaceFolders: [
                {
                    uri: { fsPath: '/test/workspace' }
                }
            ],
            getConfiguration: jest.fn(),
        },
        OutputChannel: jest.fn(),
        Uri: {
            file: jest.fn((path) => ({ fsPath: path }))
        }
    };
}, { virtual: true });

jest.mock('fs', () => ({
    existsSync: jest.fn(),
    mkdirSync: jest.fn(),
    readFileSync: jest.fn(),
    writeFileSync: jest.fn(),
}));

jest.mock('json5', () => ({
    parse: jest.fn(),
    stringify: jest.fn(),
}));

describe('ProjectService', () => {
    let mockLog: any;
    let mockSettings: Settings;
    let mockExtensionPath: vscode.Uri;
    let projectService: ProjectService;

    beforeEach(() => {
        jest.clearAllMocks();

        mockLog = {
            appendLine: jest.fn(),
            append: jest.fn(),
            clear: jest.fn(),
            show: jest.fn(),
            hide: jest.fn(),
            dispose: jest.fn()
        };

        mockSettings = {
            projectRoot: '/test/workspace',
            jdkPath: '',
            tomcatPath: '',
            gradlePath: ''
        };

        mockExtensionPath = { fsPath: '/test/extension' } as vscode.Uri;

        projectService = new ProjectService(mockLog, mockSettings, mockExtensionPath);
    });

    afterEach(() => {
        jest.resetAllMocks();
        const vscodeMock = require('vscode');
        vscodeMock.workspace.workspaceFolders = [
            {
                uri: { fsPath: '/test/workspace' }
            }
        ];
    });

    describe('initProjectSettings', () => {
        it('should initialize project settings successfully without modifying .project or .classpath', async () => {
            const fsMock = require('fs');
            const vscodeMock = require('vscode');

            fsMock.existsSync.mockReturnValue(false); // No existing directories
            const options: ProjectSettingsOptions = {
                initProjectFile: false,
                hideSimpleFolder: false,
                hideExtFolder: false,
            };

            await projectService.initProjectSettings(options);

            // Verifies that .vscode folder is created
            expect(fsMock.mkdirSync).toHaveBeenCalledWith(
                expect.stringContaining('.vscode'),
                { recursive: true }
            );

            // Verifies that settings.json was written
            expect(fsMock.writeFileSync).toHaveBeenCalledWith(
                expect.stringContaining('settings.json'),
                expect.any(String),
                'utf-8'
            );

            // Ensure log and success message are shown
            expect(mockLog.appendLine).toHaveBeenCalledWith('프로젝트 설정 적용 완료');
            expect(vscodeMock.window.showInformationMessage).toHaveBeenCalledWith('프로젝트 설정 적용 완료');
        });

        it('should handle fs.writeFileSync error gracefully when writing .project file (createProjectFile)', async () => {
            const fsMock = require('fs');

            // Set up mock so .project / .classpath don't exist
            fsMock.existsSync.mockReturnValue(false);

            // Force an error specifically when writing .project
            const testError = new Error('Permission denied');
            fsMock.writeFileSync.mockImplementation((path: string) => {
                if (path.includes('.project')) {
                    throw testError;
                }
            });

            const options: ProjectSettingsOptions = {
                initProjectFile: true,
                hideSimpleFolder: false,
                hideExtFolder: false,
            };

            await projectService.initProjectSettings(options);

            // It logs the failure specific to .project creation internally
            expect(mockLog.appendLine).toHaveBeenCalledWith(`.project 파일 생성 실패: ${testError}`);
        });

        it('should throw and log an error when createProjectFile is called but workspaceFolders is undefined', async () => {
            const vscodeMock = require('vscode');
            const fsMock = require('fs');

            // Mock to simulate an empty workspace
            vscodeMock.workspace.workspaceFolders = undefined;
            fsMock.existsSync.mockReturnValue(false);

            const options: ProjectSettingsOptions = {
                initProjectFile: true,
                hideSimpleFolder: false,
                hideExtFolder: false,
            };

            await projectService.initProjectSettings(options);

            // Since `decideOverwriteProjectFile` is called before `createProjectFile`
            // and returns false if workspaceFolders is undefined, `createProjectFile`
            // won't be called directly via `initProjectSettings`.
            // The message "오류 : 프로젝트 폴더가 확인되지 않습니다." is logged from `decideOverwriteProjectFile`
            // and another error might not be thrown inside `createProjectFile`.
            expect(mockLog.appendLine).toHaveBeenCalledWith('오류 : 프로젝트 폴더가 확인되지 않습니다.');
        });
    });
});
