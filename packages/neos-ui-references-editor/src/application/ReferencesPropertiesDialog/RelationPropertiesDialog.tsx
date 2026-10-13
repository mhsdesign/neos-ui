import * as React from 'react';
import cx from 'classnames';

import {Button, Dialog, Icon} from '@neos-project/react-ui-components';
import {ErrorBoundary, ErrorView} from '@neos-project/neos-ui-error';
import EditorEnvelope from '@neos-project/neos-ui-editors/src/EditorEnvelope/index';
import {useSelector} from '@neos-project/neos-ui-redux-store';
import {translate} from '@neos-project/neos-ui-i18n';
import {IReference} from '../../domain';
import style from './style.module.css';

type Properties = Record<string, unknown>;

export interface RelationPropertiesDialogProps {
    title: string;
    source: {icon: string; label: string; nodeTypeLabel?: string};
    // all references, the list on the right switches between them
    references: IReference[];
    initialTargetNodeId: string;
    propertySchema: Record<string, any>;
    // only the references whose properties were changed
    onApply(propertiesByTargetNodeId: Record<string, Properties>): void;
    onCancel(): void;
}

const hasPropertyValues = (properties: Properties | undefined): boolean =>
    Boolean(properties) && Object.values(properties!).some(value => value !== null && value !== undefined && value !== '');

/**
 * Edits the properties of the references, read from left to right:
 * the source node ("from"), the properties of the relation and the referenced nodes ("to"),
 * where the selected one is expanded. The changes are kept as drafts per reference until applied.
 */
export const RelationPropertiesDialog: React.FC<RelationPropertiesDialogProps> = (props) => {
    const initialProperties = React.useMemo(
        () => Object.fromEntries(props.references.map(reference => [reference.targetNodeId, {...(reference.properties ?? {})}])),
        []
    );
    const [drafts, setDrafts] = React.useState<Record<string, Properties>>(initialProperties);
    const [selectedTargetNodeId, setSelectedTargetNodeId] = React.useState(() =>
        props.references.some(reference => reference.targetNodeId === props.initialTargetNodeId)
            ? props.initialTargetNodeId
            : props.references[0]?.targetNodeId
    );

    const changedTargetNodeIds = Object.keys(drafts).filter(targetNodeId => JSON.stringify(drafts[targetNodeId]) !== JSON.stringify(initialProperties[targetNodeId]));
    const isDirty = changedTargetNodeIds.length > 0;
    const draft = drafts[selectedTargetNodeId] ?? {};

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
            title={<span className={style.title}>{props.title}</span>}
            // grows with its three columns, "wide" would be too narrow for them
            style="auto"
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
                    onClick={() => props.onApply(Object.fromEntries(changedTargetNodeIds.map(targetNodeId => [targetNodeId, drafts[targetNodeId]])))}
                >
                    {translate('Neos.Neos:Main:apply', 'Apply')}
                </Button>
            ]}
        >
            <ErrorBoundary errorFallback={ErrorView}>
                <div className={style.layout}>
                    <div className={cx(style.column, style.source)}>
                        <span className={style.caption}>{translate('Neos.Neos.Ui:Main:referencesEditor.source', 'From')}</span>
                        <span className={style.sourceNode}>
                            <span className={style.sourceIcon}><Icon icon={props.source.icon} /></span>
                            <span>{props.source.label}</span>
                        </span>
                        {props.source.nodeTypeLabel ? <span className={style.sourceNodeType}>{props.source.nodeTypeLabel}</span> : null}
                    </div>

                    <div className={cx(style.column, style.relation)}>
                        <span className={style.caption}>{translate('Neos.Neos.Ui:Main:referencesEditor.relation', 'Relation')}</span>
                        {Object.entries(props.propertySchema).map(([propertyName, propertyConfiguration]: [string, any]) =>
                            <div key={`${selectedTargetNodeId}-${propertyName}`} className={style.property}>
                                <EditorEnvelope
                                    identifier={`${propertyName}--reference-dialog`}
                                    label={propertyConfiguration?.ui?.label ?? propertyName}
                                    editor={propertyConfiguration?.ui?.inspector?.editor}
                                    helpMessage={propertyConfiguration?.ui?.help?.message || ''}
                                    helpThumbnail={propertyConfiguration?.ui?.help?.thumbnail || ''}
                                    options={propertyConfiguration?.ui?.inspector?.editorOptions}
                                    commit={(value: unknown) => setDrafts(currentDrafts => ({
                                        ...currentDrafts,
                                        [selectedTargetNodeId]: {...currentDrafts[selectedTargetNodeId], [propertyName]: value}
                                    }))}
                                    validationErrors={[]}
                                    value={draft[propertyName] ?? ''}
                                />
                            </div>
                        )}
                    </div>

                    <div className={cx(style.column, style.targets)}>
                        <span className={style.caption}>{translate('Neos.Neos.Ui:Main:referencesEditor.target', 'To')} · {props.references.length}</span>
                        <div className={style.targetList}>
                            {props.references.map(reference => {
                                const isSelected = reference.targetNodeId === selectedTargetNodeId;
                                return (
                                    <button
                                        key={reference.targetNodeId}
                                        type="button"
                                        className={cx(style.target, {[style.targetIsSelected]: isSelected})}
                                        aria-pressed={isSelected}
                                        onClick={() => setSelectedTargetNodeId(reference.targetNodeId)}
                                    >
                                        <span className={style.targetHead}>
                                            <span className={style.targetIcon}>
                                                <Icon icon={reference.presentation?.icon ?? 'question'} />
                                                {hasPropertyValues(drafts[reference.targetNodeId]) ? <span className={style.badge}><Icon icon="list" /></span> : null}
                                            </span>
                                            <span className={style.targetLabel}>{reference.presentation?.label ?? reference.targetNodeId}</span>
                                        </span>
                                        <span className={style.targetPath}>
                                            {reference.presentation?.breadcrumbs.slice(0, -1).map(({label}) => label).join(' › ')}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </ErrorBoundary>
        </Dialog>
    );
};
