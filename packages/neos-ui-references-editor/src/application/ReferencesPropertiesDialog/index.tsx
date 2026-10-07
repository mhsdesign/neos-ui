import * as React from 'react';

import {Button, Dialog, Icon} from '@neos-project/react-ui-components';

import {ErrorBoundary, ErrorView} from '@neos-project/neos-ui-error';

import EditorEnvelope from '@neos-project/neos-ui-editors/src/EditorEnvelope/index';

import {useLatestState} from '@neos-project/framework-observable-react';
import {useSelector} from '@neos-project/neos-ui-redux-store';
import {translate} from '@neos-project/neos-ui-i18n';
import {State} from '@neos-project/framework-observable';
import {Editor} from '../../domain/Editor/Editor';
import style from './style.module.css';

export const ReferencesPropertiesDialog: React.FC<{
    editor$: State<Editor>;
    source: {icon: string; label: string};
}> = ({editor$, source}) => {
    const editor = useLatestState(editor$);
    const target = editor.getReferenceInPropertyEditing()?.presentation;

    const dismiss = React.useCallback(() => editor$.update(editor => editor.withDismissedReferencePropertyEditing()), [editor$]);
    const apply = React.useCallback(() => editor$.update(editor => editor.withAppliedReferencePropertyEditing()), [editor$]);

    const isAuthenticated = useSelector(state => !state.system?.authenticationTimeout);

    if (!isAuthenticated) {
        return null;
    }

    return (
        <Dialog
            id="neos-ReferencesPropertiesDialog"
            isOpen={true}
            preventClosing={editor.isReferencePropertyEditingDirty()}
            onRequestClose={dismiss}
            title={
                <div className={style.title}>
                    <span className={style.node}>
                        <Icon icon={source.icon} />
                        <span className={style.nodeLabel}>{source.label}</span>
                    </span>
                    <Icon icon="long-arrow-alt-right" className={style.arrow} aria-label={translate('Neos.Neos.Ui:Main:referencesEditor.referencesTo', 'references')} />
                    <span className={style.node}>
                        <Icon icon={target?.icon ?? 'question'} className={style.targetIcon} />
                        <span className={style.nodeLabel}>{target?.label}</span>
                    </span>
                </div>
            }
            style="wide"
            autoFocus={true}
            actions={[
                <Button key="cancel" onClick={dismiss}>
                    {translate('Neos.Neos:Main:cancel', 'Cancel')}
                </Button>,
                <Button
                    key="apply"
                    style="success"
                    hoverStyle="success"
                    type="submit"
                    disabled={!editor.isReferencePropertyEditingDirty()}
                    onClick={apply}
                >
                    {translate('Neos.Neos:Main:apply', 'Apply')}
                </Button>
            ]}
        >
            <ErrorBoundary errorFallback={ErrorView}>
                <div className={style.body}>
                    {Object.entries(editor.getPropertySchema()).map(([propertyName, propertyConfiguration]: [string, any]) =>
                        <div key={propertyName} className={style.property}>
                            <EditorEnvelope
                                identifier={`${propertyName}--reference-dialog`}
                                label={propertyConfiguration?.ui?.label ?? propertyName}
                                editor={propertyConfiguration?.ui?.inspector?.editor}
                                helpMessage={propertyConfiguration?.ui?.help?.message || ''}
                                helpThumbnail={propertyConfiguration?.ui?.help?.thumbnail || ''}
                                options={propertyConfiguration?.ui?.inspector?.editorOptions}
                                commit={(value: unknown) => editor$.update(editor => editor.withReferenceProperty(propertyName, value))}
                                validationErrors={[]}
                                value={editor.getReferencePropertyValue(propertyName) ?? ''}
                            />
                        </div>
                    )}
                </div>
            </ErrorBoundary>
        </Dialog>
    );
};
