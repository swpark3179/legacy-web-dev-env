import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { DeployService } from './DeployService';
import { ChangedFiles, Settings, TomcatState } from '../types';
import type { GradleService } from './GradleService';
import type { TomcatService } from './TomcatService';

jest.mock('vscode', () => ({
    OutputChannel: jest.fn(),
    workspace: {
        createFileSystemWatcher: jest.fn(),
    },
    RelativePattern: jest.fn(),
    Uri: {
        file: jest.fn(),
    }
}), { virtual: true });

jest.mock('fs', () => {
    return {
        existsSync: jest.fn(),
        mkdirSync: jest.fn(),
        copyFileSync: jest.fn(),
        promises: {
            readdir: jest.fn(),
            mkdir: jest.fn(),
            copyFile: jest.fn(),
        }
    };
});

describe('DeployService', () => {
    let mockLog: any;
    let mockSettings: Settings;
    let mockChangedFiles: ChangedFiles;
    let mockFileWatchers: any[];
    let mockTomcatState: TomcatState;
    let mockGradleService: any;
    let mockTomcatService: any;
    let deployService: DeployService;

    beforeEach(() => {
        jest.clearAllMocks();

        mockLog = {
            appendLine: jest.fn(),
            show: jest.fn(),
        };

        mockSettings = {
            projectRoot: '/project',
            gradlePath: '/gradle',
            jdkPath: '/jdk',
            tomcatPath: '/tomcat',
        };

        mockChangedFiles = {
            java: [],
            query: [],
            config: [],
        };

        mockFileWatchers = [];

        mockTomcatState = {
            initialized: true,
            contextRoot: '/',
            port: 8080,
            running: false,
            debugMode: false,
            portsBlocked: false,
            deployPath: '/tomcat/webapps/ROOT',
            initializing: false,
            starting: false,
            stopping: false,
            isHotReloadMode: false,
        };

        mockGradleService = {
            buildClassesWithCallback: jest.fn((callback) => callback(true)),
        };

        mockTomcatService = {
            isDeveloperMode: true,
        };

        deployService = new DeployService(
            mockLog,
            mockSettings,
            mockChangedFiles,
            mockFileWatchers,
            mockTomcatState,
            mockGradleService as any,
            mockTomcatService as any
        );
    });

    describe('_doCopyAndClear', () => {
        it('should correctly re-throw error if fs.promises.copyFile fails with an error other than ENOENT for Query files', async () => {
            // Setup
            const dummyQueryFile = '/project/src/query/TestQuery.xml';
            mockChangedFiles.query.push(dummyQueryFile);

            // Mock fs.promises.mkdir to succeed
            (fs.promises.mkdir as jest.Mock).mockResolvedValue(undefined);

            // Mock fs.promises.copyFile to throw an error with code !== 'ENOENT'
            const testError = new Error('Permission denied');
            (testError as any).code = 'EACCES';
            (fs.promises.copyFile as jest.Mock).mockRejectedValue(testError);

            // Act & Assert
            // _doCopyAndClear is private, but it's called by applyChangedFiles.
            // When applyChangedFiles is called with query changes only, it goes directly to _doCopyAndClear.
            await expect(deployService.applyChangedFiles()).rejects.toThrow('Permission denied');
        });

        it('should ignore ENOENT error when copying query files', async () => {
            // Setup
            const dummyQueryFile = '/project/src/query/TestQuery.xml';
            mockChangedFiles.query.push(dummyQueryFile);

            // Mock fs.promises.mkdir to succeed
            (fs.promises.mkdir as jest.Mock).mockResolvedValue(undefined);

            // Mock fs.promises.copyFile to throw ENOENT
            const enoentError = new Error('No such file or directory');
            (enoentError as any).code = 'ENOENT';
            (fs.promises.copyFile as jest.Mock).mockRejectedValue(enoentError);

            // Act
            await deployService.applyChangedFiles();

            // Assert
            expect(mockChangedFiles.query).toHaveLength(0); // Should be cleared on success
            // If it reaches here, it didn't throw
        });
    });
});
