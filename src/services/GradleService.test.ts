import * as vscode from 'vscode';
import * as fs from 'fs';
import { spawn, execFileSync, ChildProcess } from 'child_process';
import { GradleService } from './GradleService';
import { Settings } from '../types';

jest.mock('vscode', () => ({
    window: {
        showErrorMessage: jest.fn(),
        showWarningMessage: jest.fn(),
    },
    OutputChannel: jest.fn(),
}), { virtual: true });

jest.mock('fs', () => ({
    existsSync: jest.fn(),
}));

jest.mock('child_process', () => ({
    spawn: jest.fn(),
    execFileSync: jest.fn(),
}));

describe('GradleService', () => {
    let mockLog: any;
    let mockSettings: Settings;
    let mockOnProcessComplete: jest.Mock;
    let gradleService: GradleService;

    beforeEach(() => {
        jest.clearAllMocks();

        mockLog = {
            clear: jest.fn(),
            show: jest.fn(),
            appendLine: jest.fn(),
        };

        mockSettings = {
            projectRoot: '/test/project',
            gradlePath: '/test/gradle',
            jdkPath: '/test/jdk',
            tomcatPath: '/test/tomcat',
        };

        mockOnProcessComplete = jest.fn();

        gradleService = new GradleService(mockLog, mockSettings, mockOnProcessComplete);

        // Mock fs.existsSync to return true by default
        (fs.existsSync as jest.Mock).mockReturnValue(true);
    });

    describe('runCommand', () => {
        it('should show error if settings are missing', () => {
            const invalidSettings = { ...mockSettings, gradlePath: '' };
            const service = new GradleService(mockLog, invalidSettings, mockOnProcessComplete);

            service.runCommand('test', 'Test Task');

            expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
                'Gradle, JDK 경로 또는 프로젝트 루트가 설정되지 않았습니다.'
            );
            expect(mockOnProcessComplete).toHaveBeenCalled();
        });

        it('should show warning if a process is already running', () => {
            const mockProcess = {
                stdout: { on: jest.fn() },
                stderr: { on: jest.fn() },
                on: jest.fn(),
            } as unknown as ChildProcess;

            (spawn as jest.Mock).mockReturnValue(mockProcess);

            // First run to start a process
            gradleService.runCommand('test1', 'Task 1');

            // Second run should hit the already running check
            gradleService.runCommand('test2', 'Task 2');

            expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(
                '이전 작업이 아직 실행 중입니다.'
            );
            // First one started successfully and returned, second one called warning and returned early (and called onProcessComplete)
            // But wait, the first one doesn't call onProcessComplete immediately because it's running.
            // Wait, let's see when onProcessComplete is called in first run... it's called on close/error event.
        });

        it('should show error if gradle executable is not found', () => {
            (fs.existsSync as jest.Mock).mockReturnValue(false);

            gradleService.runCommand('test', 'Test Task');

            expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
                expect.stringContaining('Gradle 실행 파일을 찾을 수 없습니다:')
            );
            expect(mockOnProcessComplete).toHaveBeenCalled();
        });

        it('should spawn process successfully and handle close event', () => {
            let closeCallback: (code: number) => void = () => {};
            let stdoutDataCallback: (data: Buffer) => void = () => {};

            const mockProcess = {
                stdout: { on: jest.fn((event, cb) => { if (event === 'data') stdoutDataCallback = cb; }) },
                stderr: { on: jest.fn() },
                on: jest.fn((event, cb) => { if (event === 'close') closeCallback = cb; }),
            } as unknown as ChildProcess;

            (spawn as jest.Mock).mockReturnValue(mockProcess);

            gradleService.runCommand('test', 'Test Task');

            expect(mockLog.clear).toHaveBeenCalled();
            expect(mockLog.show).toHaveBeenCalledWith(true);
            expect(spawn).toHaveBeenCalled();

            // Simulate stdout data
            stdoutDataCallback(Buffer.from('test output\n'));
            expect(mockLog.appendLine).toHaveBeenCalledWith('test output');

            // Simulate close
            closeCallback(0);

            expect(mockLog.appendLine).toHaveBeenCalledWith(expect.stringContaining('완료'));
            expect(mockOnProcessComplete).toHaveBeenCalled();

            // Should be able to run again
            gradleService.runCommand('test2', 'Task 2');
            expect(vscode.window.showWarningMessage).not.toHaveBeenCalled();
        });

        it('should handle process error', () => {
            let errorCallback: (err: Error) => void = () => {};

            const mockProcess = {
                stdout: { on: jest.fn() },
                stderr: { on: jest.fn() },
                on: jest.fn((event, cb) => { if (event === 'error') errorCallback = cb; }),
            } as unknown as ChildProcess;

            (spawn as jest.Mock).mockReturnValue(mockProcess);

            gradleService.runCommand('test', 'Test Task');

            errorCallback(new Error('spawn error'));

            expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
                'Test Task 실행 오류: spawn error'
            );
            expect(mockOnProcessComplete).toHaveBeenCalled();
        });
    });

    describe('stopGradle', () => {
        it('should do nothing if no process is running', () => {
            gradleService.stopGradle();
            expect(mockOnProcessComplete).toHaveBeenCalled();
        });

        it('should kill process using process.kill on non-win32 platforms', () => {
            const originalPlatform = process.platform;
            Object.defineProperty(process, 'platform', { value: 'linux' });

            const originalKill = process.kill;
            process.kill = jest.fn();

            const mockProcess = {
                pid: 12345,
                kill: jest.fn(),
                stdout: { on: jest.fn() },
                stderr: { on: jest.fn() },
                on: jest.fn(),
            } as unknown as ChildProcess;

            (spawn as jest.Mock).mockReturnValue(mockProcess);

            // Start a process
            gradleService.runCommand('test', 'Task');

            // Stop it
            gradleService.stopGradle();

            expect(process.kill).toHaveBeenCalledWith(12345, 'SIGKILL');
            expect(mockLog.appendLine).toHaveBeenCalledWith('[Gradle] 빌드 프로세스 강제 종료');
            expect(mockOnProcessComplete).toHaveBeenCalled();

            // Restore platform
            Object.defineProperty(process, 'platform', { value: originalPlatform });
            process.kill = originalKill;
        });

        it('should kill process using taskkill on win32 platform with PID validation', () => {
            const originalPlatform = process.platform;
            Object.defineProperty(process, 'platform', { value: 'win32' });

            const originalKill = process.kill;
            process.kill = jest.fn();

            const mockProcess = {
                pid: 12345,
                kill: jest.fn(),
                stdout: { on: jest.fn() },
                stderr: { on: jest.fn() },
                on: jest.fn(),
            } as unknown as ChildProcess;

            (spawn as jest.Mock).mockReturnValue(mockProcess);

            // Start a process
            gradleService.runCommand('test', 'Task');

            // Stop it
            gradleService.stopGradle();

            expect(execFileSync).toHaveBeenCalledWith(
                'taskkill',
                ['/PID', '12345', '/T', '/F'],
                { stdio: 'pipe', encoding: 'utf8' }
            );

            // Restore platform
            Object.defineProperty(process, 'platform', { value: originalPlatform });
            process.kill = originalKill;
        });
    });

    describe('buildClasses', () => {
        it('should run "classes" command', () => {
            const mockProcess = {
                stdout: { on: jest.fn() },
                stderr: { on: jest.fn() },
                on: jest.fn(),
            } as unknown as ChildProcess;
            (spawn as jest.Mock).mockReturnValue(mockProcess);

            gradleService.buildClasses();

            expect(spawn).toHaveBeenCalledWith(
                expect.any(String),
                expect.arrayContaining(['classes']),
                expect.any(Object)
            );
        });
    });

    describe('cleanProject', () => {
        it('should run "clean" command', () => {
            const mockProcess = {
                stdout: { on: jest.fn() },
                stderr: { on: jest.fn() },
                on: jest.fn(),
            } as unknown as ChildProcess;
            (spawn as jest.Mock).mockReturnValue(mockProcess);

            gradleService.cleanProject();

            expect(spawn).toHaveBeenCalledWith(
                expect.any(String),
                expect.arrayContaining(['clean']),
                expect.any(Object)
            );
        });
    });

    describe('buildClassesWithCallback', () => {
        it('should show error if settings are missing', () => {
            const invalidSettings = { ...mockSettings, gradlePath: '' };
            const service = new GradleService(mockLog, invalidSettings, mockOnProcessComplete);

            const callback = jest.fn();
            service.buildClassesWithCallback(callback);

            expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
                'Gradle, JDK 경로 또는 프로젝트 루트가 설정되지 않았습니다.'
            );
            expect(callback).toHaveBeenCalledWith(false);
        });

        it('should show warning if a process is already running', () => {
            const mockProcess = {
                stdout: { on: jest.fn() },
                stderr: { on: jest.fn() },
                on: jest.fn(),
            } as unknown as ChildProcess;

            (spawn as jest.Mock).mockReturnValue(mockProcess);

            gradleService.runCommand('test', 'Task');

            const callback = jest.fn();
            gradleService.buildClassesWithCallback(callback);

            expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(
                '이전 작업이 아직 실행 중입니다.'
            );
            expect(callback).toHaveBeenCalledWith(false);
        });

        it('should call callback with true on success', () => {
            let closeCallback: (code: number) => void = () => {};

            const mockProcess = {
                stdout: { on: jest.fn() },
                stderr: { on: jest.fn() },
                on: jest.fn((event, cb) => { if (event === 'close') closeCallback = cb; }),
            } as unknown as ChildProcess;

            (spawn as jest.Mock).mockReturnValue(mockProcess);

            const callback = jest.fn();
            gradleService.buildClassesWithCallback(callback);

            closeCallback(0);

            expect(callback).toHaveBeenCalledWith(true);
            expect(mockOnProcessComplete).toHaveBeenCalled();
        });

        it('should call callback with false on failure code', () => {
            let closeCallback: (code: number) => void = () => {};

            const mockProcess = {
                stdout: { on: jest.fn() },
                stderr: { on: jest.fn() },
                on: jest.fn((event, cb) => { if (event === 'close') closeCallback = cb; }),
            } as unknown as ChildProcess;

            (spawn as jest.Mock).mockReturnValue(mockProcess);

            const callback = jest.fn();
            gradleService.buildClassesWithCallback(callback);

            closeCallback(1);

            expect(callback).toHaveBeenCalledWith(false);
        });

        it('should call callback with false on process error', () => {
            let errorCallback: (err: Error) => void = () => {};

            const mockProcess = {
                stdout: { on: jest.fn() },
                stderr: { on: jest.fn() },
                on: jest.fn((event, cb) => { if (event === 'error') errorCallback = cb; }),
            } as unknown as ChildProcess;

            (spawn as jest.Mock).mockReturnValue(mockProcess);

            const callback = jest.fn();
            gradleService.buildClassesWithCallback(callback);

            errorCallback(new Error('test error'));

            expect(callback).toHaveBeenCalledWith(false);
        });

        it('should return false if gradle executable is not found', () => {
            (fs.existsSync as jest.Mock).mockReturnValue(false);

            const callback = jest.fn();
            gradleService.buildClassesWithCallback(callback);

            expect(callback).toHaveBeenCalledWith(false);
        });
    });
});
