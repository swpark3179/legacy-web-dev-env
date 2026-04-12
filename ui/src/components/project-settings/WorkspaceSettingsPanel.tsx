import React, { useState } from 'react';
import { Panel, Button, ButtonGroup } from '../common';
import type { ProjectSettingsOptions } from '../../types';

export const WorkspaceSettingsPanel: React.FC<{onApplySettings: (options: ProjectSettingsOptions) => void}> = ({ onApplySettings }) => {
    const [options, setOptions] = useState<ProjectSettingsOptions>({
        hideSimpleFolder: true,
        hideExtFolder: false,
        initProjectFile: true
    });

    const handleChange = (key: keyof ProjectSettingsOptions) => (e: React.ChangeEvent<HTMLInputElement>) => {
        setOptions((prev) => ({ ...prev, [key]: e.target.checked }));
    };

    return (
        <Panel title="VSCode 워크스페이스 설정">
            <p className="panel-description">
                .vscode/settings.json 설정
            </p>

            <div className="settings-options">
                <div className="option-item always-applied">
                    <span className="option-icon">✓</span>
                    <div className="option-content">
                        <span className="option-label">Gradle 및 JDK 설정 적용</span>
                    </div>
                </div>

                <label className="checkbox-option" htmlFor="hideSimpleFolder">
                    <input
                        id="hideSimpleFolder"
                        type="checkbox"
                        checked={options.hideSimpleFolder}
                        onChange={(e) => {
                            const checked = e.target.checked;
                            setOptions((prev) => ({
                                ...prev,
                                hideSimpleFolder: checked,
                                hideExtFolder: checked ? prev.hideExtFolder : false,
                            }));
                        }}
                    />
                    <div className="option-content">
                        <span className="option-label">기본 파일 숨기기</span>
                        <span className="option-desc">out, bin, .idea, .gradle 숨김</span>
                    </div>
                </label>

                <label className="checkbox-option sub-option" htmlFor="hideExtFolder">
                    <input
                        id="hideExtFolder"
                        type="checkbox"
                        checked={options.hideExtFolder}
                        onChange={(e) => {
                            const checked = e.target.checked;
                            setOptions((prev) => ({
                                ...prev,
                                hideExtFolder: checked,
                                hideSimpleFolder: checked ? true : prev.hideSimpleFolder,
                            }));
                        }}
                    />
                    <div className="option-content">
                        <span className="option-label">deploy, .tomcat, target 숨김</span>
                    </div>
                </label>

                <label className="checkbox-option" htmlFor="initProjectFile">
                    <input
                        id="initProjectFile"
                        type="checkbox"
                        checked={options.initProjectFile}
                        onChange={handleChange('initProjectFile')}
                    />
                    <div className="option-content">
                        <span className="option-label">java 플러그인을 위한 설정</span>
                        <span className="option-desc">.classpath, .project 파일 초기화</span>
                    </div>
                </label>
            </div>

            <ButtonGroup style={{ marginTop: '16px' }}>
                <Button onClick={() => onApplySettings(options)}>프로젝트 설정 초기화</Button>
            </ButtonGroup>
        </Panel>
    );
};
