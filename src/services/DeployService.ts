import * as vscode from 'vscode';
import { ChangedFiles, Settings, TomcatState } from '../types';
import path from 'path';
import fs from 'fs';
import type { GradleService } from './GradleService';
import type { TomcatService } from './TomcatService';

export class DeployService {
    private _log: vscode.OutputChannel;
    private _settings: Settings;
    private _changedFiles: ChangedFiles;
    private _fileWatchers: vscode.FileSystemWatcher[];
    private _tomcatState: TomcatState;
    private _gradleService: GradleService;
    private _tomcatService: TomcatService;

    constructor(
        log: vscode.OutputChannel,
        settings: Settings,
        changedFiles: ChangedFiles,
        fileWatchers: vscode.FileSystemWatcher[],
        tomcatState: TomcatState,
        gradleService: GradleService,
        tomcatService: TomcatService
    ) {
        this._log = log;
        this._settings = settings;
        this._changedFiles = changedFiles;
        this._fileWatchers = fileWatchers;
        this._tomcatState = tomcatState;
        this._gradleService = gradleService;
        this._tomcatService = tomcatService;
    }

    // 파일 변경 감지 시작 (Tomcat 기동/디버그 시 호출)
    public startFileWatcher(_postMessage: (message: unknown) => void): void {
        this.stopFileWatcher();
        this._changedFiles.java.length = 0;
        this._changedFiles.query.length = 0;

        const projectRoot = this._settings.projectRoot;
        const dirs = [
            { pattern: new vscode.RelativePattern(projectRoot, 'src/java/**/*'), category: 'java' as const },
            { pattern: new vscode.RelativePattern(projectRoot, 'src/query/**/*'), category: 'query' as const },
            ...(!this._tomcatService.isDeveloperMode
                ? [{ pattern: new vscode.RelativePattern(projectRoot, 'src/webapp/**/*'), category: 'static' as const }]
                : []),
        ];

        for (const { pattern, category } of dirs) {
            const watcher = vscode.workspace.createFileSystemWatcher(pattern);
            watcher.onDidChange((uri: vscode.Uri) => this._fileChangedHandler(uri, _postMessage, category));
            watcher.onDidCreate((uri: vscode.Uri) => this._fileChangedHandler(uri, _postMessage, category));
            this._fileWatchers.push(watcher);
        }
        if (this._tomcatService.isDeveloperMode) {
            this._log.appendLine('[FileWatcher] 파일 변경 감지 시작 (src/java, src/query)');
        } else {
            this._log.appendLine('[FileWatcher] 파일 변경 감지 시작 (src/java, src/query, src/webapp)');
        }
    }

    // 파일 변경 핸들러
    private _fileChangedHandler(uri: vscode.Uri, _postMessage: (message: unknown) => void, category: string): void {
        const normalizedPath = uri.fsPath.replace(/\\/g, '/');
        if (normalizedPath.endsWith('.git')) return;

        // 정적 파일의 경우, 파일 변경 시 리스트화 하지 않고 즉시 복사
        if (category === 'static') {
            const relativePath = normalizedPath.replace(`${this._settings.projectRoot.replace(/\\/g, '/')}/src/webapp/`, '');
            const destPath = path.join(this._tomcatState.deployPath, relativePath);
            const destDir = path.dirname(destPath);
            if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
            if (fs.existsSync(normalizedPath)) {
                fs.copyFileSync(normalizedPath, destPath);
                return;
            }
        }

        // 변경 목록에 추가하고 ui 업데이트
        if (!this._changedFiles[category as keyof ChangedFiles].includes(normalizedPath)) {
            this._changedFiles[category as keyof ChangedFiles].push(normalizedPath);
            _postMessage({ type: 'changedFilesUpdate', changedFiles: this._changedFiles });
        }
    }

    // 파일 변경 감지 중지 (Tomcat 중지 시 호출)
    public stopFileWatcher(): void {
        for (const watcher of this._fileWatchers) {
            watcher.dispose();
        }
        this._fileWatchers = [];
    }

    // tomcat 기동 중 변경된 파일을 로컬 서버에 적용
    public async applyChangedFiles(): Promise<void> {
        const hasJavaChanges = this._changedFiles.java.length > 0;
        this._log.show(true);
        this._log.appendLine('[배포 적용] 변경 파일 Tomcat 반영 시작...');

        if (hasJavaChanges) {
            this._log.appendLine('[배포 적용] Java 파일 변경 있음. gradle classes 실행 후 복사합니다.');
            return new Promise<void>((resolve) => {
                this._gradleService.buildClassesWithCallback(async (success) => {
                    if (success) {
                        this._log.appendLine('[배포 적용] gradle classes 성공. 복사 단계 진행.');
                    } else {
                        this._log.appendLine('[배포 적용] gradle classes 실패. 복사 단계는 그대로 진행합니다.');
                    }
                    await this._doCopyAndClear();
                    resolve();
                });
            });
        } else {
            await this._doCopyAndClear();
        }
    }

    // 복사 수행 후 변경 목록 초기화
    private async _doCopyAndClear(): Promise<void> {
        const classesPath = path.join(this._tomcatState.deployPath, 'WEB-INF', 'classes');
        const copyPromises: Promise<void>[] = [];

        // 1. Java .class 파일 복사 (inner class 포함)
        for (const javaFile of this._changedFiles.java) {
            const normalizedJavaFile = javaFile.replace(/\\/g, '/');
            const relativePath = normalizedJavaFile.replace(`${this._settings.projectRoot.replace(/\\/g, '/')}/src/java/`, '');
            const baseClassName = relativePath.replace(/\.java$/, '');
            const classDir = path.join(this._settings.projectRoot, 'target', 'classes', path.dirname(baseClassName));
            const baseName = path.basename(baseClassName);

            copyPromises.push((async () => {
                try {
                    const files = await fs.promises.readdir(classDir);
                    const matchingFiles = files.filter(f => f === `${baseName}.class` || f.startsWith(`${baseName}$`));
                    const classCopyPromises = matchingFiles.map(async classFile => {
                        const srcClassPath = path.join(classDir, classFile);
                        const destClassPath = path.join(classesPath, path.dirname(baseClassName), classFile);
                        const destDir = path.dirname(destClassPath);
                        await fs.promises.mkdir(destDir, { recursive: true });
                        await fs.promises.copyFile(srcClassPath, destClassPath);
                        this._log.appendLine(`  [Java] ${path.dirname(baseClassName)}/${classFile} 복사됨`);
                    });
                    await Promise.all(classCopyPromises);
                } catch (err: any) {
                    if (err.code === 'ENOENT') {
                        this._log.appendLine(`  [경고] class 디렉터리 없음: ${classDir} 복사 건너뜀`);
                    } else {
                        throw err;
                    }
                }
            })());
        }

        // 2. Query 파일 복사
        for (const queryFile of this._changedFiles.query) {
            const normalizedQueryFile = queryFile.replace(/\\/g, '/');
            const relativePath = normalizedQueryFile.replace(`${this._settings.projectRoot.replace(/\\/g, '/')}/src/query/`, '');
            const destPath = path.join(classesPath, relativePath);
            const destDir = path.dirname(destPath);

            copyPromises.push((async () => {
                try {
                    await fs.promises.mkdir(destDir, { recursive: true });
                    await fs.promises.copyFile(queryFile, destPath);
                    this._log.appendLine(`  [Query] ${relativePath} 복사됨`);
                } catch (err: any) {
                    if (err.code !== 'ENOENT') throw err;
                }
            })());
        }

        await Promise.all(copyPromises);
        this._log.appendLine('[배포 적용] 변경 파일 Tomcat 반영 완료.');
        this._changedFiles.java.length = 0;
        this._changedFiles.query.length = 0;
    }
}