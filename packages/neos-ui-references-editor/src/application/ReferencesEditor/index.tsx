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
import {ReferencesPropertiesDialog} from '../ReferencesPropertiesDialog';
import {useLatestState} from '@neos-project/framework-observable-react';
import {createState, State} from '@neos-project/framework-observable';
import {Editor} from '../../domain/Editor/Editor';
import {Icon} from '@neos-project/react-ui-components';
import {ReferencesPickerDialog} from '../ReferencesPickerDialog';
import {NeosContext} from '@neos-project/neos-ui-decorators';
import style from './style.module.css';

// todo make configurable via editor options
const STARTING_POINT = '/<Neos.Neos:Sites>/';

// the inspector unmounts the editors when switching tabs, while a change is pending the editor state (incl. the presentation of added references) is kept here
const pendingEditorStates = new Map<string, State<Editor>>();

export const createReferencesEditor = () => (props) => {
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

    const [isPickerOpen, setIsPickerOpen] = React.useState(false);

    const constraints = editor.isLoading() ? {} : editor.getConstraints();
    const allowedNodeTypes = React.useMemo(() => {
        const fromConstraints = Object.entries(constraints?.nodeTypes ?? {})
            .filter(([nodeTypeName, isAllowed]) => nodeTypeName !== '*' && isAllowed === true)
            .map(([nodeTypeName]) => nodeTypeName);
        return fromConstraints.length > 0 ? fromConstraints : (props.options?.nodeTypes ?? []);
    }, [constraints, props.options?.nodeTypes]);
    const maxItems: number | undefined = constraints?.maxItems;
    // restrict the tree to documents and the referencable node types, so that e.g. content collections are not shown
    const baseNodeTypeFilter = allowedNodeTypes.length > 0 ? ['Neos.Neos:Document', ...allowedNodeTypes].join(',') : '';

    if (fetch__referencesSummary.error) {
        return <ErrorView error={fetch__referencesSummary.error} />;
    }

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
                    title={(props.label && i18nRegistry.translate(props.label))
                        || translate('Neos.Neos.Ui:Main:referencesEditor.pickerTitle', 'Select references')}
                    workspaceName={workspaceName}
                    dimensionValues={dimension}
                    startingPoint={STARTING_POINT}
                    allowedNodeTypes={allowedNodeTypes}
                    baseNodeTypeFilter={baseNodeTypeFilter}
                    hasPropertySchema={hasPropertySchema}
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
                    <ReferencesPropertiesDialog
                        editor$={editor$}
                        source={{
                            icon: (selectedNodeId && nodeTypesRegistry.getNodeType(selectedNodeId.nodeType)?.ui?.icon) || 'file',
                            label: selectedNodeId?.label ?? ''
                        }}
                    />
                )
            }
        </>
    );
};
