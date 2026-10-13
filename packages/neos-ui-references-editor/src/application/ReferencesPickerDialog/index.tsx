import React from 'react';
import {Button, Dialog} from '@neos-project/react-ui-components';
import {translate} from '@neos-project/neos-ui-i18n';
import {DimensionCombination} from '@neos-project/neos-ts-interfaces';
import {Tree, TreeNodeBreadcrumb, TreeNodeDTO} from '@neos-project/neos-ui-link-editor-custom-node-tree';
import {IReference, IReferences} from '../../domain';
import {ReferencesItem} from '../../presentation/ReferencesItem';
import {createReferencesTreeDataSource} from '../../infrastructure/http/tree';
import {RelationPropertiesDialog} from '../ReferencesPropertiesDialog';
import style from './style.module.css';

const INITIAL_LOADING_DEPTH = 4;

interface ReferencesPickerDialogProps {
    title: string;
    workspaceName: string;
    dimensionValues: DimensionCombination;
    startingPoint: string;
    allowedNodeTypes: string[];
    baseNodeTypeFilter: string;
    // relation properties can be edited, if a schema is given
    propertySchema?: Record<string, any>;
    source: {icon: string; label: string};
    maxItems?: number;
    references: IReferences;
    onApply(references: IReferences): void;
    onCancel(): void;
}

export const ReferencesPickerDialog: React.FC<ReferencesPickerDialogProps> = (props) => {
    const initialNodeIds = React.useMemo(() => Object.keys(props.references), []);
    const [items, setItems] = React.useState<IReference[]>(() => Object.values(props.references));
    const [editingNodeId, setEditingNodeId] = React.useState<string | null>(null);
    const hasPropertySchema = Object.keys(props.propertySchema ?? {}).length > 0;
    // selecting a node again that was deselected in this dialog restores it with its relation properties
    const deselectedReferences = React.useRef<Record<string, IReference>>({});

    // the initially selected nodes are only used to expand the tree, so (de)selecting does not reload it
    const dataSource = React.useMemo(() => createReferencesTreeDataSource({
        workspaceName: props.workspaceName,
        dimensionValues: props.dimensionValues,
        startingPoint: props.startingPoint,
        loadingDepth: INITIAL_LOADING_DEPTH,
        baseNodeTypeFilter: props.baseNodeTypeFilter,
        allowedNodeTypes: props.allowedNodeTypes,
        selectedNodeIds: initialNodeIds
    }), []);

    const itemIds = items.map(item => item.targetNodeId);
    // order, selection and relation properties are compared
    const serialize = (references: IReference[]) => JSON.stringify(references.map(({targetNodeId, properties}) => [targetNodeId, properties ?? null]));
    const initialSerialization = React.useMemo(() => serialize(Object.values(props.references)), []);
    const isDirty = serialize(items) !== initialSerialization;
    const editingItem = items.find(item => item.targetNodeId === editingNodeId);

    const selectNode = (treeNode: TreeNodeDTO, ancestors: TreeNodeBreadcrumb[]) => setItems(currentItems => {
        if (currentItems.some(item => item.targetNodeId === treeNode.nodeAggregateIdentifier)) {
            return currentItems;
        }
        const deselectedReference = deselectedReferences.current[treeNode.nodeAggregateIdentifier];
        if (deselectedReference) {
            return [...currentItems, deselectedReference];
        }
        return [...currentItems, {
            targetNodeId: treeNode.nodeAggregateIdentifier,
            properties: undefined,
            presentation: {
                icon: treeNode.icon,
                label: treeNode.label,
                uri: `node://${treeNode.nodeAggregateIdentifier}`,
                // the sites root node is not part of the breadcrumbs, see GetReferencesSummaryQueryHandler
                breadcrumbs: [...ancestors.slice(1), {icon: treeNode.icon, label: treeNode.label}]
            }
        }];
    });

    const deselectNode = (nodeId: string) => setItems(currentItems => {
        const deselectedItem = currentItems.find(item => item.targetNodeId === nodeId);
        if (deselectedItem) {
            deselectedReferences.current[nodeId] = deselectedItem;
        }
        return currentItems.filter(item => item.targetNodeId !== nodeId);
    });

    const moveItem = (fromIndex: number, toIndex: number) => setItems(currentItems => {
        if (toIndex < 0 || toIndex >= currentItems.length) {
            return currentItems;
        }
        const nextItems = [...currentItems];
        const [moved] = nextItems.splice(fromIndex, 1);
        nextItems.splice(toIndex, 0, moved);
        return nextItems;
    });

    const apply = () => props.onApply(Object.fromEntries(items.map(item => [item.targetNodeId, item])));

    return (
        <>
            <Dialog
                id="neos-ReferencesPickerDialog"
                isOpen={true}
                style="jumbo"
                autoFocus={true}
                // like the link editor: with unapplied changes, clicking outside or pressing escape shakes the dialog instead of closing it
                preventClosing={isDirty}
                onRequestClose={props.onCancel}
                title={<span className={style.title}>{props.title}</span>}
                actions={[
                    <Button key="cancel" onClick={props.onCancel}>
                        {translate('Neos.Neos:Main:cancel', 'Cancel')}
                    </Button>,
                    <Button key="apply" style="success" hoverStyle="success" disabled={!isDirty} onClick={apply}>
                        {translate('Neos.Neos:Main:apply', 'Apply')}
                    </Button>
                ]}
            >
                <div className={style.body}>
                    <div className={style.treeColumn}>
                        <Tree
                            dataSource={dataSource}
                            selectedNodeIds={itemIds}
                            newlySelectedNodeIds={itemIds.filter(id => !initialNodeIds.includes(id))}
                            allowDeselect={true}
                            hideRootNode={true}
                            canSelect={!props.maxItems || items.length < props.maxItems}
                            options={{enableSearch: true, enableNodeTypeFilter: true}}
                            onSelect={selectNode}
                            onDeselect={deselectNode}
                        />
                    </div>

                    <div className={style.listColumn}>
                        <div className={style.listHeader}>
                            <strong>{translate('Neos.Neos.Ui:Main:referencesEditor.selectedHeader', 'Selected')}</strong>
                            <span className={style.listCount}> · {props.maxItems ? `${items.length} / ${props.maxItems}` : items.length}</span>
                        </div>
                        <div className={style.list}>
                            {items.length === 0 ? (
                                <p className={style.listEmpty}>{translate('Neos.Neos.Ui:Main:referencesEditor.nothingSelected', 'Nothing selected yet. Pick nodes in the tree.')}</p>
                            ) : items.map((item, index) => (
                                <ReferencesItem
                                    key={item.targetNodeId}
                                    reference={item}
                                    index={index}
                                    isSortable={items.length > 1}
                                    hasPropertySchema={hasPropertySchema}
                                    isNew={!initialNodeIds.includes(item.targetNodeId)}
                                    onMove={moveItem}
                                    onEdit={() => setEditingNodeId(item.targetNodeId)}
                                    onRemove={() => deselectNode(item.targetNodeId)}
                                />
                            ))}
                        </div>
                    </div>
                </div>
            </Dialog>
            {/* rendered after the picker, so it is stacked above it */}
            {editingItem && props.propertySchema ? (
                <RelationPropertiesDialog
                    source={props.source}
                    target={editingItem.presentation}
                    propertySchema={props.propertySchema}
                    initialProperties={editingItem.properties}
                    onCancel={() => setEditingNodeId(null)}
                    onApply={properties => {
                        setItems(currentItems => currentItems.map(item => item.targetNodeId === editingItem.targetNodeId ? {...item, properties} : item));
                        setEditingNodeId(null);
                    }}
                />
            ) : null}
        </>
    );
};
