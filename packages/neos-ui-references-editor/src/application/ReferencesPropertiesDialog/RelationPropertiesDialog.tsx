import * as React from 'react';

import {Button, Dialog, Icon} from '@neos-project/react-ui-components';
import {ErrorBoundary, ErrorView} from '@neos-project/neos-ui-error';
import EditorEnvelope from '@neos-project/neos-ui-editors/src/EditorEnvelope/index';
import {useSelector} from '@neos-project/neos-ui-redux-store';
import {translate} from '@neos-project/neos-ui-i18n';
import style from './style.module.css';

export interface RelationPropertiesDialogProps {
    source: {icon: string; label: string};
    target?: {icon: string; label: string};
    propertySchema: Record<string, any>;
    initialProperties: Record<string, unknown> | null | undefined;
    onApply(properties: Record<string, unknown>): void;
    onCancel(): void;
}

/**
 * Edits the properties of one reference ("source → target"), the changes are kept as draft until applied
 */
export const RelationPropertiesDialog: React.FC<RelationPropertiesDialogProps> = (props) => {
    const [draft, setDraft] = React.useState<Record<string, unknown>>(() => ({...(props.initialProperties ?? {})}));
    const isDirty = JSON.stringify(draft) !== JSON.stringify({...(props.initialProperties ?? {})});

    const isAuthenticated = useSelector(state => !state.system?.authenticationTimeout);
    if (!isAuthenticated) {
        return null;
    }

    return (
        <Dialog
            id="neos-ReferencesPropertiesDialog"
            isOpen={true}
            preventClosing={isDirty}
            onRequestClose={props.onCancel}
            title={
                <div className={style.title}>
                    <span className={style.node}>
                        <Icon icon={props.source.icon} />
                        <span className={style.nodeLabel}>{props.source.label}</span>
                    </span>
                    <Icon icon="long-arrow-alt-right" className={style.arrow} aria-label={translate('Neos.Neos.Ui:Main:referencesEditor.referencesTo', 'references')} />
                    <span className={style.node}>
                        <Icon icon={props.target?.icon ?? 'question'} className={style.targetIcon} />
                        <span className={style.nodeLabel}>{props.target?.label}</span>
                    </span>
                </div>
            }
            style="wide"
            autoFocus={true}
            actions={[
                <Button key="cancel" onClick={props.onCancel}>
                    {translate('Neos.Neos:Main:cancel', 'Cancel')}
                </Button>,
                <Button
                    key="apply"
                    style="success"
                    hoverStyle="success"
                    type="submit"
                    disabled={!isDirty}
                    onClick={() => props.onApply(draft)}
                >
                    {translate('Neos.Neos:Main:apply', 'Apply')}
                </Button>
            ]}
        >
            <ErrorBoundary errorFallback={ErrorView}>
                <div className={style.body}>
                    {Object.entries(props.propertySchema).map(([propertyName, propertyConfiguration]: [string, any]) =>
                        <div key={propertyName} className={style.property}>
                            <EditorEnvelope
                                identifier={`${propertyName}--reference-dialog`}
                                label={propertyConfiguration?.ui?.label ?? propertyName}
                                editor={propertyConfiguration?.ui?.inspector?.editor}
                                helpMessage={propertyConfiguration?.ui?.help?.message || ''}
                                helpThumbnail={propertyConfiguration?.ui?.help?.thumbnail || ''}
                                options={propertyConfiguration?.ui?.inspector?.editorOptions}
                                commit={(value: unknown) => setDraft(currentDraft => ({...currentDraft, [propertyName]: value}))}
                                validationErrors={[]}
                                value={draft[propertyName] ?? ''}
                            />
                        </div>
                    )}
                </div>
            </ErrorBoundary>
        </Dialog>
    );
};
