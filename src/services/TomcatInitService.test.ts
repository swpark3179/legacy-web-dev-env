import { TomcatInitService } from './TomcatInitService';
import * as vscode from 'vscode';
import * as fs from 'fs-extra';
import cpy from 'cpy';
import { Settings, TomcatState } from '../types';
import path from 'path';

// Mock dependencies
jest.mock('vscode', () => ({
    OutputChannel: jest.fn(),
    ProgressLocation: {
        Notification: 15
    },
    Uri: {
        file: jest.fn((path) => ({ fsPath: path }))
    },
    window: {
        showErrorMessage: jest.fn(),
        withProgress: jest.fn().mockImplementation(async (options, task) => {
            const progress = { report: jest.fn() };
            return task(progress);
        })
    }
}), { virtual: true });

jest.mock('fs-extra', () => ({
    pathExistsSync: jest.fn(),
    emptyDirSync: jest.fn(),
    emptyDir: jest.fn(),
    mkdirSync: jest.fn(),
    writeFileSync: jest.fn(),
    readFileSync: jest.fn(),
    ensureDirSync: jest.fn(),
    copy: jest.fn(),
    existsSync: jest.fn(),
    removeSync: jest.fn(),
    symlinkSync: jest.fn(),
    readdirSync: jest.fn()
}));

jest.mock('cpy', () => jest.fn().mockResolvedValue([]));

jest.mock('child_process', () => ({
    execFileSync: jest.fn()
}));

describe('TomcatInitService', () => {
    let service: TomcatInitService;
    let mockLog: vscode.OutputChannel;
    let mockSettings: Settings;
    let mockTomcatState: TomcatState;
    let mockExtensionUri: vscode.Uri;

    beforeEach(() => {
        jest.clearAllMocks();

        mockLog = {
            appendLine: jest.fn(),
            show: jest.fn(),
            name: 'test',
            append: jest.fn(),
            replace: jest.fn(),
            clear: jest.fn(),
            hide: jest.fn(),
            dispose: jest.fn()
        };

        mockSettings = {
            projectRoot: '/test/projectRoot',
            gradlePath: '/test/gradlePath',
            jdkPath: '/test/jdkPath',
            tomcatPath: '/test/tomcatPath'
        };

        mockTomcatState = {
            initialized: false,
            contextRoot: 'testRoot',
            port: 7001,
            running: false,
            debugMode: false,
            portsBlocked: false,
            deployPath: '/test/deployPath',
            initializing: false,
            starting: false,
            stopping: false,
            isHotReloadMode: false
        };

        mockExtensionUri = vscode.Uri.file('/test/extensionPath');
        service = new TomcatInitService(mockLog, mockSettings, mockTomcatState, mockExtensionUri);
    });

    describe('initTomcat', () => {
        it('should return false if contextRoot is empty', async () => {
            const result = await service.initTomcat('', 7001);
            expect(result).toBe(false);
            expect(vscode.window.showErrorMessage).toHaveBeenCalledWith('Context Root가 비어있습니다.');
        });

        it('should successfully initialize tomcat when .tomcat does not exist', async () => {
            (fs.pathExistsSync as jest.Mock).mockReturnValue(false);

            const result = await service.initTomcat('myRoot', 8080);

            expect(result).toBe(true);
            expect(fs.emptyDirSync).toHaveBeenCalled();
            expect(fs.mkdirSync).toHaveBeenCalledWith(path.join('/test/projectRoot/.tomcat', 'conf'));
            expect(fs.writeFileSync).toHaveBeenCalledWith(
                path.join('/test/projectRoot/.tomcat', 'conf', 'server.xml'),
                expect.stringContaining('port="8080"'),
                'utf8'
            );
            expect(fs.writeFileSync).toHaveBeenCalledWith(
                path.join('/test/projectRoot/.tomcat', 'conf', 'context.xml'),
                expect.any(String),
                'utf8'
            );
            expect(mockTomcatState.contextRoot).toBe('myRoot');
            expect(mockTomcatState.port).toBe(8080);
            expect(mockTomcatState.initialized).toBe(true);
        });

        it('should clean existing .tomcat folder on init', async () => {
            (fs.pathExistsSync as jest.Mock).mockReturnValue(true);
            (fs.emptyDir as jest.Mock).mockResolvedValue(undefined);

            const result = await service.initTomcat('myRoot', 7001);

            expect(result).toBe(true);
            expect(fs.emptyDir).toHaveBeenCalledWith(path.join('/test/projectRoot', '.tomcat'));
        });

        it('should retry on EBUSY during cleanFolderSafe', async () => {
            (fs.pathExistsSync as jest.Mock).mockReturnValue(true);
            const mockError: any = new Error('EBUSY error');
            mockError.code = 'EBUSY';
            (fs.emptyDir as jest.Mock)
                .mockRejectedValueOnce(mockError)
                .mockResolvedValueOnce(undefined);

            const result = await service.initTomcat('myRoot', 7001);

            expect(result).toBe(true);
            expect(fs.emptyDir).toHaveBeenCalledTimes(2);
            expect(mockLog.appendLine).toHaveBeenCalledWith(expect.stringContaining('[EBUSY 감지]'));
        });

        it('should return false on initialization error', async () => {
            (fs.pathExistsSync as jest.Mock).mockImplementation(() => {
                throw new Error('Some IO error');
            });

            const result = await service.initTomcat('myRoot', 7001);

            expect(result).toBe(false);
            expect(mockLog.appendLine).toHaveBeenCalledWith('Tomcat 초기화 실패: Some IO error');
        });
    });

    describe('deployServiceFiles', () => {
        beforeEach(() => {
            (fs.pathExistsSync as jest.Mock).mockImplementation((filepath) => {
                if (filepath.endsWith(path.join('target', 'classes'))) return true;
                return false;
            });
            (fs.readFileSync as jest.Mock).mockReturnValue('');
        });

        it('should return false if srcClassesPath does not exist', async () => {
            (fs.pathExistsSync as jest.Mock).mockReturnValue(false);
            const result = await service.deployServiceFiles('myRoot');
            expect(result).toBe(false);
            expect(mockLog.appendLine).toHaveBeenCalledWith(expect.stringContaining('[경고] 빌드된 class 파일을 찾을 수 없습니다'));
        });

        it('should copy all files in default mode', async () => {
            (fs.pathExistsSync as jest.Mock).mockImplementation((filepath) => {
                if (filepath.endsWith(path.join('target', 'classes'))) return true;
                if (filepath.endsWith(path.join('resources', 'lib'))) return false;
                return false;
            });

            const result = await service.deployServiceFiles('myRoot');

            expect(result).toBe(true);
            expect(cpy).toHaveBeenCalledWith(
                ['**/*', '!**/WEB-INF/lib'],
                expect.any(String),
                expect.objectContaining({ cwd: path.join('/test/projectRoot', 'src', 'webapp') })
            );
            expect(cpy).toHaveBeenCalledWith(
                '**/*.class*',
                expect.any(String),
                expect.objectContaining({ cwd: path.join('/test/projectRoot', 'target', 'classes') })
            );
            expect(mockTomcatState.deployPath).toBe(path.join('/test/projectRoot', '.tomcat', 'webapps', 'myRoot'));
        });

        it('should create static symlinks in developer mode', async () => {
            (fs.pathExistsSync as jest.Mock).mockImplementation((filepath) => {
                if (filepath.endsWith(path.join('target', 'classes'))) return true;
                if (filepath.endsWith(path.join('src', 'webapp'))) return true;
                return false;
            });
            (fs.readdirSync as jest.Mock).mockReturnValue([
                { name: 'test.html', isDirectory: () => false },
                { name: 'WEB-INF', isDirectory: () => true }
            ]);

            const result = await service.deployServiceFiles('myRoot', true);

            expect(result).toBe(true);
            expect(fs.readdirSync).toHaveBeenCalled();
            expect(fs.symlinkSync).toHaveBeenCalled();
        });

        it('should copy extension lib if exists', async () => {
            (fs.pathExistsSync as jest.Mock).mockImplementation((filepath) => {
                if (filepath.endsWith(path.join('target', 'classes'))) return true;
                if (filepath.endsWith(path.join('resources', 'lib'))) return true;
                return false;
            });

            const result = await service.deployServiceFiles('myRoot');

            expect(result).toBe(true);
            expect(fs.copy).toHaveBeenCalledWith(
                path.join('/test/extensionPath', 'resources', 'lib'),
                expect.any(String),
                { overwrite: true }
            );
        });

        it('should create hotswap-agent.properties when isHotReloadMode is true', async () => {
            mockTomcatState.isHotReloadMode = true;

            const result = await service.deployServiceFiles('myRoot');

            expect(result).toBe(true);
            expect(fs.writeFileSync).toHaveBeenCalledWith(
                expect.stringContaining('hotswap-agent.properties'),
                expect.stringContaining('autoHotswap=true'),
                'utf8'
            );
        });
    });
});
