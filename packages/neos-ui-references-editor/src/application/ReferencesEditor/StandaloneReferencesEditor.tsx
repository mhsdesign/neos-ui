import React from 'react';
import {Icon} from '@neos-project/react-ui-components';
import {translate} from '@neos-project/neos-ui-i18n';
import {selectors, useSelector} from '@neos-project/neos-ui-redux-store';
import {NeosContext} from '@neos-project/neos-ui-decorators';
import {IReference} from '../../domain';
import {getNodeSummary} from '../../infrastructure/http/getNodeSummary';
import {ReferencesItem, ReferencesItemSkeleton} from '../../presentation/ReferencesItem';
import {ReferencesPickerDialog} from '../ReferencesPickerDialog';
import {getTreeRestrictions, STARTING_POINT} from './treeRestrictions';
import style from './style.module.css';

const CREATION_DIALOG_SUFFIX = '--creation-dialog';

/**
 * The references editor outside of the inspector, e.g. in the node creation dialog:
 * there is no node yet, so the selection is kept here and committed as list of node ids.
 *
 * todo support relation properties on node creation: the backend only accepts node ids for references
 *      (NodePropertyConversionService::convertNodeCreationElements) and writes them without properties
 *      (PromotedElementsCreationHandler via NodeReferencesForName::fromTargets). Both would have to accept
 *      {targetNodeId, properties} like the Reference change does, then the properties button can be shown here.
 */
export const StandaloneReferencesEditor: React.FC<any> = (props) => {
    const workspaceName = useSelector(selectors.CR.Workspaces.personalWorkspaceNameSelector);
    const dimension = useSelector(selectors.CR.ContentDimensions.active);
    const nodeTypeInCreation = useSelector(state => state?.ui?.nodeCreationDialog?.nodeType);
    const {globalRegistry} = React.useContext(NeosContext)!;
    const i18nRegistry = globalRegistry.get('i18n');
    const nodeTypesRegistry = globalRegistry.get('@neos-project/neos-ui-contentrepository');

    const initialNodeIds: string[] = Array.isArray(props.value) ? props.value : (props.value ? [props.value] : []);
    const [items, setItems] = React.useState<IReference[]>(() => initialNodeIds.map(targetNodeId => ({targetNodeId, properties: undefined})));
    const [isPickerOpen, setIsPickerOpen] = React.useState(false);

    // e.g. a default value: only ids are known, the presentation has to be loaded
    React.useEffect(() => {
        if (!workspaceName || !dimension) {
            return;
        }
        items.filter(item => !item.presentation).forEach(async ({targetNodeId}) => {
            const result = await getNodeSummary({nodeId: targetNodeId, dimensionValues: dimension, workspaceName});
            if ('success' in result) {
                setItems(currentItems => currentItems.map(item => item.targetNodeId === targetNodeId ? {...item, presentation: result.success} : item));
            }
        });
    }, []);

    const referenceName = String(props.identifier ?? '').replace(CREATION_DIALOG_SUFFIX, '');
    const constraints = nodeTypeInCreation
        // the constraints are part of the node type schema, but not of its typings
        ? (nodeTypesRegistry.getNodeType(nodeTypeInCreation)?.references?.[referenceName] as {constraints?: object} | undefined)?.constraints ?? {}
        : {};
    const {allowedNodeTypes, baseNodeTypeFilter, maxItems} = getTreeRestrictions(constraints, props.options);

    const commitItems = (nextItems: IReference[]) => {
        setItems(nextItems);
        props.commit(nextItems.map(item => item.targetNodeId));
    };

    const moveItem = (fromIndex: number, toIndex: number) => {
        if (toIndex < 0 || toIndex >= items.length) {
            return;
        }
        const nextItems = [...items];
        const [moved] = nextItems.splice(fromIndex, 1);
        nextItems.splice(toIndex, 0, moved);
        commitItems(nextItems);
    };

    return (
        <>
            <div className={style.list}>
                {items.map((item, index) => item.presentation ? (
                    <ReferencesItem
                        key={item.targetNodeId}
                        reference={item}
                        index={index}
                        isSortable={items.length > 1}
                        hasPropertySchema={false}
                        onMove={moveItem}
                        onRemove={() => commitItems(items.filter(other => other.targetNodeId !== item.targetNodeId))}
                    />
                ) : <ReferencesItemSkeleton key={item.targetNodeId} />)}
            </div>
            <button
                type="button"
                className={style.addButton}
                disabled={!workspaceName || !dimension}
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
                    hasPropertySchema={false}
                    maxItems={maxItems}
                    references={Object.fromEntries(items.map(item => [item.targetNodeId, item]))}
                    onCancel={() => setIsPickerOpen(false)}
                    onApply={pickedReferences => {
                        commitItems(Object.values(pickedReferences));
                        setIsPickerOpen(false);
                    }}
                />
            ) : null}
        </>
    );
};
