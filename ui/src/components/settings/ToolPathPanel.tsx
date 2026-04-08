import React from 'react';
import type { Settings, ValidationState } from '../../types';
import { Panel, Button } from '../common';

export const ToolPathPanel: React.FC<{settings: Settings, validation: ValidationState, onSelectFolder: Function}> = ({settings,validation,onSelectFolder}) => {
    const renderPathInput = (
        label: string,
        target: 'gradle' | 'jdk' | 'tomcat',
        placeholder: string
    ) => {
        const path = settings[`${target}Path` as keyof Settings];
        const validationItem = validation[target];

        const inputId = `tool-path-${target}`;
        return (
            <div className="form-group">
                <label htmlFor={inputId}>{label}</label>
                <div className="form-row">
                    <input
                        id={inputId}
                        type="text"
                        value={path}
                        placeholder={placeholder}
                        readOnly
                    />
                    <Button
                        className="browse-btn"
                        onClick={() => onSelectFolder(target, path)}
                        aria-label={`${label} 찾아보기`}
                    >
                        찾아보기
                    </Button>
                </div>
                {validationItem.message && (
                    <div className={`validation-message ${validationItem.status}`} role="alert">
                        {validationItem.message}
                    </div>
                )}
            </div>
        );
    };

    return (
        <Panel title="도구 경로">
            {renderPathInput('Gradle 경로 (6.9.x만 지원)', 'gradle', 'Gradle 설치 폴더 선택')}
            {renderPathInput('JDK 경로 (OpenJDK 1.8.x만 지원)', 'jdk', 'JDK 설치 폴더 선택')}
            {renderPathInput('Tomcat 경로 (8.5.x 또는 9.0.x)', 'tomcat', 'Tomcat 설치 폴더 선택')}
        </Panel>
    );
};
