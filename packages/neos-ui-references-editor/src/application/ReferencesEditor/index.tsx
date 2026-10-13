import React from 'react';
import {getReferencesSummary} from '../../infrastructure/http';
import {usePromise} from '@neos-project/framework-promise-react';
import {actions, selectors, useSelector} from '@neos-project/neos-ui-redux-store';
import {applyChannel$, discardChannel$} from '@neos-project/neos-ui-sagas/src/UI/Inspector';
import {ErrorView} from '@neos-project/neos-ui-error';
import {ReferencesItem, ReferencesItemSkeleton} from '../../presentation/ReferencesItem';
import {IReferences} from '../../domain';
import {translate} from '@neos-project/neos-ui-i18n';
import {useDispatch} from 'react-redux';
import {createDimensionSpacePointFromLegacyDimension} from '@neos-project/neos-ui-contentrepository/src/DimensionSpace';
import {ReferencesPropertiesDialog} from '../ReferencesPropertiesDialog';
import {useLatestState} from '@neos-project/framework-observable-react';
import {createState, State} from '@neos-project/framework-observable';
import {Editor} from '../../domain/Editor/Editor';
import {Icon} from '@neos-project/react-ui-components';
import {ReferencesPickerDialog} from '../ReferencesPickerDialog';
import {NeosContext} from '@neos-project/neos-ui-decorators';
import {StandaloneReferencesEditor} from './StandaloneReferencesEditor';
import {getTreeRestrictions, STARTING_POINT} from './treeRestrictions';
import style from './style.module.css';

// the inspector unmounts the editors when switching tabs, while a change is pending the editor state (incl. the presentation of added references) is kept here
const pendingEditorStates = new Map<string, State<Editor>>();

// the inspector passes a summary of the stored references, other places like the node creation dialog a list of node ids
const isInspectorValue = (value: unknown): value is {referencesCount: number} =>
    typeof value === 'object' && value !== null && !Array.isArray(value) && 'referencesCount' in value;

export const createReferencesEditor = () => (props: any) => isInspectorValue(props.value)
    ? <InspectorReferencesEditor {...props} />
    : <StandaloneReferencesEditor {...props} />;

const InspectorReferencesEditor: React.FC<any> = (props) => {
    const workspaceName = useSelector(selectors.CR.Workspaces.personalWorkspaceNameSelector);
    const dimension = useSelector(selectors.CR.ContentDimensions.active);
    const selectedNodeId = useSelector(selectors.CR.Nodes.focusedSelector);
    const {globalRegistry} = React.useContext(NeosContext)!;
    const i18nRegistry = globalRegistry.get('i18n');
    const nodeTypesRegistry = globalRegistry.get('@neos-project/neos-ui-contentrepository');
    const dispatch = useDispatch();

    const pendingEditorStateKey = `${selectedNodeId?.contextPath}|${props.identifier}`;
    const hasPendingChange = useSelector(state => (state?.ui?.inspector?.transientChanges ?? []).some(
        (change: any) => change.type === 'Neos.Neos.Ui:Reference'
            && change.subject === selectedNodeId?.contextPath
            && change.payload.referenceName === props.identifier
    ));

    const editor$ = React.useMemo(() => {
        const pendingEditorState = pendingEditorStates.get(pendingEditorStateKey);
        if (pendingEditorState && hasPendingChange) {
            return pendingEditorState;
        }
        const newEditorState = createState(Editor.fromLoadingState(props.value.referencesCount));
        pendingEditorStates.set(pendingEditorStateKey, newEditorState);
        return newEditorState;
    }, [pendingEditorStateKey]);

    React.useEffect(() => {
        const subscription = editor$.subscribe({
            next: (editor) => {
                const change = editor.getChange(selectedNodeId!.contextPath, props.identifier);
                if (change) {
                    dispatch(actions.UI.Inspector.commitChange(change));
                }
            }
        });
        return subscription.unsubscribe;
    }, [editor$]);

    React.useEffect(() => {
        const subscription = applyChannel$.subscribe({
            next: () => {
                editor$.update(editor => editor.withApply())
            }
        });
        return subscription.unsubscribe;
    }, [editor$]);

    React.useEffect(() => {
        const subscription = discardChannel$.subscribe({
            next: () => {
                editor$.update(editor => editor.withDiscard())
            }
        });
        return subscription.unsubscribe;
    }, [editor$]);

    const editor = useLatestState(editor$);

    const fetch__referencesSummary = usePromise(async () => {
        if (!workspaceName || !dimension || !selectedNodeId?.identifier) {
            console.warn('Missing workspaceName, dimension or selectedNodeId');
            return null;
        }

        const result = await getReferencesSummary(
            workspaceName,
            dimension,
            selectedNodeId.identifier,
            props.identifier
        );

        if ('success' in result) {
            const references: IReferences = {};

            for (const reference of result.success.references) {
                const nodeId = reference.uri.substring('node://'.length); // todo hack
                references[nodeId] = {
                    targetNodeId: nodeId,
                    properties: reference.properties,
                    presentation: {
                        ...reference
                    }
                }
            }

            editor$.update(editor => editor.withReferencesAndConfiguration(
                references,
                result.success.constraints ?? {},
                result.success.propertySchema ?? {},
            ))

            return result.success;
        }

        if ('error' in result) {
            throw result.error;
        }

        return null;
    }, []);

    // todo props.value, should be size of references to fake initial height.

    const onEdit = React.useCallback((referenceTargetId: string) => editor$.update(editor => editor.withReferencePropertyEditing(referenceTargetId)), [editor$]);

    const onDelete = React.useCallback((referenceTargetId: string) => editor$.update(editor => editor.withRemovedReference(referenceTargetId)), [editor$]);

    const onMove = React.useCallback((fromIndex: number, toIndex: number) => editor$.update(editor => editor.withMovedReference(fromIndex, toIndex)), [editor$]);

    // navigating the content canvas would lose unapplied inspector changes
    const inspectorIsDirty = useSelector(selectors.UI.Inspector.isDirty);

    const onOpen = React.useCallback((referenceTargetId: string) => {
        if (!selectedNodeId || !dimension || !workspaceName || inspectorIsDirty) {
            return;
        }
        // todo let the backend deliver a preview uri (closest document for content nodes)
        const {contentRepositoryId} = JSON.parse(selectedNodeId.contextPath);
        const nodeAddress = JSON.stringify({
            contentRepositoryId,
            workspaceName,
            dimensionSpacePoint: createDimensionSpacePointFromLegacyDimension(dimension),
            aggregateId: referenceTargetId
        });
        dispatch(actions.UI.ContentCanvas.setSrc(`/neos/preview?node=${encodeURIComponent(nodeAddress)}`));
    }, [selectedNodeId, dimension, workspaceName, inspectorIsDirty]);

    const [isPickerOpen, setIsPickerOpen] = React.useState(false);

    const {allowedNodeTypes, baseNodeTypeFilter, maxItems} = getTreeRestrictions(editor.isLoading() ? {} : editor.getConstraints(), props.options);

    if (fetch__referencesSummary.error) {
        return <ErrorView error={fetch__referencesSummary.error} />;
    }

    // the node whose references are edited, shown as "source → target" when editing relation properties
    const sourceNodeType = selectedNodeId ? nodeTypesRegistry.getNodeType(selectedNodeId.nodeType) : null;
    const source = {
        icon: sourceNodeType?.ui?.icon || 'file',
        label: selectedNodeId?.label ?? '',
        nodeTypeLabel: sourceNodeType?.label ? i18nRegistry.translate(sourceNodeType.label) : undefined
    };
    const title = (props.label && i18nRegistry.translate(props.label))
        || translate('Neos.Neos.Ui:Main:referencesEditor.pickerTitle', 'Select references');

    const references = Object.values(editor.getReferences());
    const hasPropertySchema = Object.keys(editor.getPropertySchema()).length > 0;

    return (
        <>
            <div className={style.list}>
                {editor.isLoading()
                    ? new Array(editor.getLoadingReferencesCount()).fill(undefined).map((_, index) => <ReferencesItemSkeleton key={index} />)
                    : references.map((reference, index) => (
                        <ReferencesItem
                            key={reference.targetNodeId}
                            reference={reference}
                            index={index}
                            isSortable={references.length > 1}
                            hasPropertySchema={hasPropertySchema}
                            onMove={onMove}
                            onEdit={() => onEdit(reference.targetNodeId)}
                            onOpen={() => onOpen(reference.targetNodeId)}
                            openIsDisabled={inspectorIsDirty}
                            onRemove={() => onDelete(reference.targetNodeId)}
                        />
                    ))}
            </div>
            <button
                type="button"
                className={style.addButton}
                disabled={editor.isLoading() || !workspaceName || !dimension}
                onClick={() => setIsPickerOpen(true)}
            >
                <Icon icon="plus" />
                {translate('Neos.Neos.Ui:Main:referencesEditor.add', 'Add reference')}
            </button>
            {isPickerOpen && workspaceName && dimension ? (
                <ReferencesPickerDialog
                    title={title}
                    workspaceName={workspaceName}
                    dimensionValues={dimension}
                    startingPoint={STARTING_POINT}
                    allowedNodeTypes={allowedNodeTypes}
                    baseNodeTypeFilter={baseNodeTypeFilter}
                    propertySchema={editor.getPropertySchema()}
                    source={source}
                    maxItems={maxItems}
                    references={editor.getReferences()}
                    onCancel={() => setIsPickerOpen(false)}
                    onApply={pickedReferences => {
                        editor$.update(currentEditor => currentEditor.withReferences(pickedReferences));
                        setIsPickerOpen(false);
                    }}
                />
            ) : null}
            {
                editor.isReferencePropertyEditingOpen() && (
                    <ReferencesPropertiesDialog editor$={editor$} title={title} source={source} />
                )
            }
        </>
    );
};
