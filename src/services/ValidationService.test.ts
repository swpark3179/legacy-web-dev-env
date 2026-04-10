import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';
import { ValidationService } from './ValidationService';
import { ValidationState, Settings } from '../types';
import { EventEmitter } from 'events';

jest.mock('vscode', () => ({
    OutputChannel: jest.fn(),
}), { virtual: true });

jest.mock('fs', () => ({
    existsSync: jest.fn(),
    statSync: jest.fn(),
    readFileSync: jest.fn(),
    promises: {
        readFile: jest.fn(),
    },
}));

jest.mock('child_process', () => ({
    execFileSync: jest.fn(),
    spawn: jest.fn(),
}));

// Helper to mock child_process.spawn
function createMockSpawn(stdoutData: string, stderrData: string, closeCode: number, error?: Error) {
    const mockProcess: any = new EventEmitter();
    mockProcess.stdout = new EventEmitter();
    mockProcess.stderr = new EventEmitter();

    // Simulate async data emission
    setTimeout(() => {
        if (error) {
            mockProcess.emit('error', error);
        } else {
            if (stdoutData) mockProcess.stdout.emit('data', Buffer.from(stdoutData));
            if (stderrData) mockProcess.stderr.emit('data', Buffer.from(stderrData));
            mockProcess.emit('close', closeCode);
        }
    }, 0);

    return mockProcess;
}

describe('ValidationService', () => {
    let mockLog: any;
    let mockValidationState: ValidationState;
    let validationService: ValidationService;

    beforeEach(() => {
        jest.clearAllMocks();

        mockLog = {
            appendLine: jest.fn(),
        };

        mockValidationState = {
            isFirstLoaded: true,
            isValidating: false,
            allValid: false,
            projectValid: false,
            gradle: { status: 'invalid', message: '' },
            jdk: { status: 'invalid', message: '' },
            tomcat: { status: 'invalid', message: '' },
            jdk_has_dcevm: false,
        };

        validationService = new ValidationService(mockLog, mockValidationState);
    });

    describe('setAsValidated', () => {
        let settings: Settings;

        beforeEach(() => {
            settings = {
                projectRoot: '/root',
                gradlePath: '/gradle',
                jdkPath: '/jdk',
                tomcatPath: '/tomcat',
            };
        });

        it('should validate gradle if path exists', () => {
            validationService.setAsValidated(settings);
            expect(mockValidationState.gradle.status).toBe('valid');
            expect(mockValidationState.gradle.message).toBe('저장된 설정 로드됨');
        });

        it('should validate jdk and set dcevm if alternative jvm exists', () => {
            (fs.existsSync as jest.Mock).mockImplementation((pathStr) => {
                return pathStr.includes('dcevm');
            });

            validationService.setAsValidated(settings);
            expect(mockValidationState.jdk.status).toBe('valid');
            expect(mockValidationState.jdk_has_dcevm).toBe(true);
            expect(mockValidationState.jdk.message).toBe('저장된 설정 로드됨 (DCEVM)');
        });

        it('should validate jdk but no dcevm if alternative jvm does not exist', () => {
            (fs.existsSync as jest.Mock).mockReturnValue(false);

            validationService.setAsValidated(settings);
            expect(mockValidationState.jdk.status).toBe('valid');
            expect(mockValidationState.jdk_has_dcevm).toBe(false);
            expect(mockValidationState.jdk.message).toBe('저장된 설정 로드됨 (DCEVM 미설치)');
        });

        it('should validate tomcat if path exists', () => {
            validationService.setAsValidated(settings);
            expect(mockValidationState.tomcat.status).toBe('valid');
            expect(mockValidationState.tomcat.message).toBe('저장된 설정 로드됨');
        });

        it('should set allValid to true if all are valid and projectValid is true', () => {
            mockValidationState.projectValid = true;
            validationService.setAsValidated(settings);
            expect(mockValidationState.allValid).toBe(true);
        });
    });

    describe('validateProjectStructure', () => {
        it('should set projectValid false if projectRoot is empty', async () => {
            await validationService.validateProjectStructure('');
            expect(mockValidationState.projectValid).toBe(false);
        });

        it('should set projectValid true if web.xml exists and display-name is parseable', async () => {
            (fs.existsSync as jest.Mock).mockReturnValue(true);
            (fs.statSync as jest.Mock).mockReturnValue({ isFile: () => true });
            (fs.promises.readFile as jest.Mock).mockResolvedValue('<display-name>myapp</display-name>');

            await validationService.validateProjectStructure('/project');
            expect(mockValidationState.projectValid).toBe(true);
        });

        it('should set projectValid false if web.xml does not exist', async () => {
            (fs.existsSync as jest.Mock).mockReturnValue(false);

            await validationService.validateProjectStructure('/project');
            expect(mockValidationState.projectValid).toBe(false);
        });

        it('should set projectValid false if web.xml is not a file', async () => {
            (fs.existsSync as jest.Mock).mockReturnValue(true);
            (fs.statSync as jest.Mock).mockReturnValue({ isFile: () => false });

            await validationService.validateProjectStructure('/project');
            expect(mockValidationState.projectValid).toBe(false);
        });

        it('should set projectValid false if web.xml has no display-name', async () => {
            (fs.existsSync as jest.Mock).mockReturnValue(true);
            (fs.statSync as jest.Mock).mockReturnValue({ isFile: () => true });
            (fs.promises.readFile as jest.Mock).mockResolvedValue('<web-app><servlet></servlet></web-app>');

            await validationService.validateProjectStructure('/project');
            expect(mockValidationState.projectValid).toBe(false);
        });
    });

    describe('validateGradle', () => {
        it('should return invalid if gradlePath is empty', async () => {
            const result = await validationService.validateGradle('');
            expect(result.status).toBe('invalid');
            expect(result.message).toBe('Gradle 경로가 설정되지 않음');
        });

        it('should return invalid if gradle executable is not found', async () => {
            (fs.existsSync as jest.Mock).mockReturnValue(false);

            const result = await validationService.validateGradle('/gradle');
            expect(result.status).toBe('invalid');
            expect(result.message).toContain('찾을 수 없음');
        });

        it('should return valid if version starts with 6.9', async () => {
            (fs.existsSync as jest.Mock).mockReturnValue(true);
            (spawn as jest.Mock).mockReturnValue(createMockSpawn('Gradle 6.9.1', '', 0));

            const result = await validationService.validateGradle('/gradle');
            expect(result.status).toBe('valid');
            expect(result.message).toBe('Gradle 6.9.1');
            expect(result.version).toBe('6.9.1');
        });

        it('should return invalid if version does not start with 6.9', async () => {
            (fs.existsSync as jest.Mock).mockReturnValue(true);
            (spawn as jest.Mock).mockReturnValue(createMockSpawn('Gradle 7.0.0', '', 0));

            const result = await validationService.validateGradle('/gradle');
            expect(result.status).toBe('invalid');
            expect(result.message).toContain('(6.9.x 필요)');
        });

        it('should handle version check failure (exception)', async () => {
            (fs.existsSync as jest.Mock).mockReturnValue(true);
            (spawn as jest.Mock).mockReturnValue(createMockSpawn('', '', 1, new Error('command failed')));

            const result = await validationService.validateGradle('/gradle');
            expect(result.status).toBe('invalid');
            expect(result.message).toBe('command failed');
        });

        it('should handle missing version match', async () => {
            (fs.existsSync as jest.Mock).mockReturnValue(true);
            (spawn as jest.Mock).mockReturnValue(createMockSpawn('some output without version', '', 0));

            const result = await validationService.validateGradle('/gradle');
            expect(result.status).toBe('invalid');
            expect(result.message).toBe('Gradle 버전을 확인할 수 없습니다.');
            expect(mockLog.appendLine).toHaveBeenCalledWith('Gradle 버전 확인 실패');
        });
    });

    describe('validateJdk', () => {
        it('should return invalid if jdkPath is empty', async () => {
            const result = await validationService.validateJdk('');
            expect(result.status).toBe('invalid');
            expect(result.message).toBe('JDK 경로가 설정되지 않음');
        });

        it('should return invalid if java executable is not found', async () => {
            (fs.existsSync as jest.Mock).mockReturnValue(false);

            const result = await validationService.validateJdk('/jdk');
            expect(result.status).toBe('invalid');
            expect(result.message).toContain('찾을 수 없음');
        });

        it('should return valid if version is 1.8 and set dcevm state', async () => {
            (fs.existsSync as jest.Mock).mockImplementation((pathStr: string) => {
                if (pathStr.includes('java') || pathStr.includes('java.exe')) return true;
                if (pathStr.includes('dcevm')) return true;
                return false;
            });
            (spawn as jest.Mock).mockReturnValue(createMockSpawn('', 'java version "1.8.0_291"', 0));

            const result = await validationService.validateJdk('/jdk');
            expect(result.status).toBe('valid');
            expect(result.version).toBe('1.8.0_291');
            expect(result.message).toContain('DCEVM');
            expect(mockValidationState.jdk_has_dcevm).toBe(true);
        });

        it('should return valid without dcevm if version is 1.8 and dcevm is missing', async () => {
            (fs.existsSync as jest.Mock).mockImplementation((pathStr: string) => {
                if (pathStr.includes('java') || pathStr.includes('java.exe')) return true;
                return false;
            });
            (spawn as jest.Mock).mockReturnValue(createMockSpawn('version "1.8.0_291"', '', 0));

            const result = await validationService.validateJdk('/jdk');
            expect(result.status).toBe('valid');
            expect(result.message).toContain('DCEVM 미설치');
            expect(mockValidationState.jdk_has_dcevm).toBe(false);
        });

        it('should return invalid if version is not 1.8', async () => {
            (fs.existsSync as jest.Mock).mockImplementation((pathStr: string) => {
                if (pathStr.includes('java') || pathStr.includes('java.exe')) return true;
                return false;
            });
            (spawn as jest.Mock).mockReturnValue(createMockSpawn('version "11.0.12"', '', 0));

            const result = await validationService.validateJdk('/jdk');
            expect(result.status).toBe('invalid');
            expect(result.message).toContain('(1.8.x 필요)');
        });

        it('should handle missing version match in output', async () => {
            (fs.existsSync as jest.Mock).mockImplementation((pathStr: string) => {
                if (pathStr.includes('java') || pathStr.includes('java.exe')) return true;
                return false;
            });
            (spawn as jest.Mock).mockReturnValue(createMockSpawn('unrecognized output', '', 0));

            const result = await validationService.validateJdk('/jdk');
            expect(result.status).toBe('invalid');
            expect(result.message).toBe('JDK 버전을 확인할 수 없습니다.');
        });

        it('should handle version check failure (exception)', async () => {
            (fs.existsSync as jest.Mock).mockImplementation((pathStr: string) => {
                if (pathStr.includes('java') || pathStr.includes('java.exe')) return true;
                return false;
            });
            (spawn as jest.Mock).mockReturnValue(createMockSpawn('', '', 1, new Error('spawn failed')));

            const result = await validationService.validateJdk('/jdk');
            expect(result.status).toBe('invalid');
            expect(result.message).toBe('spawn failed');
        });
    });

    describe('validateTomcat', () => {
        it('should return invalid if tomcatPath is empty', async () => {
            const result = await validationService.validateTomcat('');
            expect(result.status).toBe('invalid');
            expect(result.message).toBe('Tomcat 경로가 설정되지 않음');
        });

        it('should return invalid if catalina script is not found', async () => {
            (fs.existsSync as jest.Mock).mockReturnValue(false);

            const result = await validationService.validateTomcat('/tomcat');
            expect(result.status).toBe('invalid');
            expect(result.message).toContain('catalina 스크립트를 찾을 수 없음');
        });

        it('should return invalid if server.xml is not found', async () => {
            (fs.existsSync as jest.Mock).mockImplementation((pathStr: string) => {
                if (pathStr.includes('catalina')) return true;
                return false;
            });

            const result = await validationService.validateTomcat('/tomcat');
            expect(result.status).toBe('invalid');
            expect(result.message).toContain('server.xml을 찾을 수 없음');
        });

        it('should return valid if version is 9.0', async () => {
            (fs.existsSync as jest.Mock).mockReturnValue(true);
            (fs.promises.readFile as jest.Mock).mockResolvedValue('Apache Tomcat Version 9.0.52');

            const result = await validationService.validateTomcat('/tomcat');
            expect(result.status).toBe('valid');
            expect(result.version).toBe('9.0.52');
            expect(result.message).toContain('Tomcat 9.0.52');
        });

        it('should return valid if version is 8.5', async () => {
            (fs.existsSync as jest.Mock).mockReturnValue(true);
            (fs.promises.readFile as jest.Mock).mockResolvedValue('Apache Tomcat Version 8.5.70');

            const result = await validationService.validateTomcat('/tomcat');
            expect(result.status).toBe('valid');
            expect(result.version).toBe('8.5.70');
            expect(result.message).toContain('Tomcat 8.5.70');
        });

        it('should return invalid if version is not 9.0 or 8.5', async () => {
            (fs.existsSync as jest.Mock).mockReturnValue(true);
            (fs.promises.readFile as jest.Mock).mockResolvedValue('Apache Tomcat Version 10.0.0');

            const result = await validationService.validateTomcat('/tomcat');
            expect(result.status).toBe('invalid');
            expect(result.message).toContain('(9.0.x 또는 8.5.x 필요)');
        });

        it('should handle missing version in RELEASE-NOTES', async () => {
            (fs.existsSync as jest.Mock).mockReturnValue(true);
            (fs.promises.readFile as jest.Mock).mockResolvedValue('Some other content');

            const result = await validationService.validateTomcat('/tomcat');
            expect(result.status).toBe('invalid');
        });

        it('should handle missing RELEASE-NOTES file', async () => {
            (fs.existsSync as jest.Mock).mockImplementation((pathStr: string) => {
                if (pathStr.includes('RELEASE-NOTES')) return false;
                return true;
            });

            const result = await validationService.validateTomcat('/tomcat');
            expect(result.status).toBe('invalid');
        });

        it('should handle fs.readFileSync exception', async () => {
            (fs.existsSync as jest.Mock).mockReturnValue(true);
            (fs.promises.readFile as jest.Mock).mockImplementation(() => {
                throw new Error('read error');
            });

            const result = await validationService.validateTomcat('/tomcat');
            expect(result.status).toBe('invalid');
            expect(result.message).toBe('read error');
        });
    });

    describe('validateAll', () => {
        let settings: Settings;
        let onUpdateMock: jest.Mock;
        let postProcessMock: jest.Mock;

        beforeEach(() => {
            settings = {
                projectRoot: '/project',
                gradlePath: '/gradle',
                jdkPath: '/jdk',
                tomcatPath: '/tomcat',
            };
            onUpdateMock = jest.fn();
            postProcessMock = jest.fn();

            // Mock individual validate functions to run quickly and synchronously for this test
            jest.spyOn(validationService, 'validateGradle').mockResolvedValue({ status: 'valid', message: 'Gradle OK' });
            jest.spyOn(validationService, 'validateJdk').mockResolvedValue({ status: 'valid', message: 'JDK OK' });
            jest.spyOn(validationService, 'validateTomcat').mockResolvedValue({ status: 'valid', message: 'Tomcat OK' });
        });

        it('should update statuses and call callbacks', async () => {
            mockValidationState.projectValid = true;

            await validationService.validateAll(settings, onUpdateMock, postProcessMock);

            expect(validationService.validateGradle).toHaveBeenCalledWith('/gradle');
            expect(validationService.validateJdk).toHaveBeenCalledWith('/jdk');
            expect(validationService.validateTomcat).toHaveBeenCalledWith('/tomcat');

            expect(onUpdateMock).toHaveBeenCalledTimes(2); // Initial + 1 final update

            expect(mockValidationState.allValid).toBe(true);
            expect(mockValidationState.isValidating).toBe(false);
            expect(postProcessMock).toHaveBeenCalled();
        });

        it('should not call postProcess if allValid is false due to invalid gradle', async () => {
            mockValidationState.projectValid = true;
            jest.spyOn(validationService, 'validateGradle').mockResolvedValue({ status: 'invalid', message: 'Bad' });

            await validationService.validateAll(settings, onUpdateMock, postProcessMock);

            expect(mockValidationState.allValid).toBe(false);
            expect(postProcessMock).not.toHaveBeenCalled();
        });

        it('should call postProcess if gradle is warning but others valid', async () => {
            mockValidationState.projectValid = true;
            jest.spyOn(validationService, 'validateGradle').mockResolvedValue({ status: 'warning', message: 'Warn' });

            await validationService.validateAll(settings, onUpdateMock, postProcessMock);

            expect(mockValidationState.allValid).toBe(true);
            expect(postProcessMock).toHaveBeenCalled();
        });

        it('should not call postProcess if project is invalid', async () => {
            mockValidationState.projectValid = false;

            await validationService.validateAll(settings, onUpdateMock, postProcessMock);

            expect(mockValidationState.allValid).toBe(false);
            expect(postProcessMock).not.toHaveBeenCalled();
        });
    });
});
