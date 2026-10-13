/*
 * This file is part of the Neos.Neos.Ui package.
 *
 * (c) Contributors of the Neos Project - www.neos.io
 *
 * This package is Open Source Software. For the full copyright and license
 * information, please view the LICENSE file which was distributed with this
 * source code.
 */
import React from 'react';
import cx from 'classnames';

import {translate} from '@neos-project/neos-ui-i18n';

import {TreeDataSource, TreeNodeDTO} from '../domain';
import {TreeSkeleton} from '../presentation';
import {Search} from './Search';
import {SelectNodeTypeFilter} from './SelectNodeTypeFilter';
import {SelectionState, TreeContext, TreeNode, TreeNodeBreadcrumb} from './TreeNode';
import style from './style.module.css';

const SEARCH_DEBOUNCE_MS = 300;

interface Props {
    dataSource: TreeDataSource;
    selectedNodeIds: string[];
    // nodes selected since the tree was opened, they are highlighted differently
    newlySelectedNodeIds?: string[];
    allowDeselect?: boolean;
    canSelect?: boolean;
    // e.g. when the tree starts at the technical sites node
    hideRootNode?: boolean;
    initialSearchTerm?: string;
    initialNarrowNodeTypeFilter?: string;
    options?: {
        enableSearch?: boolean;
        enableNodeTypeFilter?: boolean;
    };
    className?: string;
    onSelect(treeNode: TreeNodeDTO, ancestors: TreeNodeBreadcrumb[]): void;
    onDeselect?(nodeId: string): void;
}

export const Tree: React.FC<Props> = (props) => {
    const [searchInput, setSearchInput] = React.useState(props.initialSearchTerm ?? '');
    const [searchTerm, setSearchTerm] = React.useState(props.initialSearchTerm ?? '');
    const [narrowNodeTypeFilter, setNarrowNodeTypeFilter] = React.useState(props.initialNarrowNodeTypeFilter ?? '');
    // the last loaded tree incl. the query it was loaded for, it stays visible while a new search is loading
    const [loaded, setLoaded] = React.useState<{root: TreeNodeDTO; searchTerm: string; narrowNodeTypeFilter: string} | null>(null);
    const [error, setError] = React.useState<unknown>(null);
    const [isLoading, setIsLoading] = React.useState(true);

    React.useEffect(() => {
        const timeout = window.setTimeout(() => setSearchTerm(searchInput.trim()), SEARCH_DEBOUNCE_MS);
        return () => window.clearTimeout(timeout);
    }, [searchInput]);

    React.useEffect(() => {
        let isCancelled = false;
        setIsLoading(true);
        props.dataSource.getTree({searchTerm, narrowNodeTypeFilter}).then(
            loadedRoot => {
                if (!isCancelled) {
                    setLoaded({root: loadedRoot, searchTerm, narrowNodeTypeFilter});
                    setError(null);
                    setIsLoading(false);
                }
            },
            loadingError => {
                if (!isCancelled) {
                    setError(loadingError);
                    setIsLoading(false);
                }
            }
        );
        return () => {
            isCancelled = true;
        };
    }, [props.dataSource, searchTerm, narrowNodeTypeFilter]);

    const selectedNodeIdsKey = props.selectedNodeIds.join();
    const containsSelectedNode = React.useCallback((treeNode: TreeNodeDTO): boolean =>
        props.selectedNodeIds.includes(treeNode.nodeAggregateIdentifier) || treeNode.children.some(containsSelectedNode),
    [selectedNodeIdsKey]);

    const isFiltered = Boolean(loaded?.searchTerm || loaded?.narrowNodeTypeFilter);

    const context: TreeContext = {
        dataSource: props.dataSource,
        searchTerm: loaded?.searchTerm ?? '',
        isFiltered,
        canSelect: props.canSelect ?? true,
        allowDeselect: Boolean(props.allowDeselect && props.onDeselect),
        getSelectionState: (nodeId): SelectionState => {
            if (!props.selectedNodeIds.includes(nodeId)) {
                return null;
            }
            return props.newlySelectedNodeIds?.includes(nodeId) ? 'newlySelected' : 'selected';
        },
        containsSelectedNode,
        onSelect: props.onSelect,
        onDeselect: nodeId => props.onDeselect?.(nodeId)
    };

    const loadingLabel = translate('Neos.Neos.Ui:Main:nodeTree.loading', 'Loading node tree…');
    const isReloading = isLoading && loaded !== null;

    let main;
    if (isLoading && !loaded) {
        main = <TreeSkeleton label={loadingLabel} />;
    } else if (error || !loaded) {
        main = <div className={style.message}>{translate('Neos.Neos.Ui:Main:nodeTree.couldNotLoad', 'The node tree could not be loaded.')}</div>;
    } else if (isFiltered && loaded.root.children.length === 0 && !loaded.root.isMatchedByFilter) {
        main = <div className={style.message}>{translate('Neos.Neos:Main:noMatchesFound', 'No matches found')}</div>;
    } else {
        const {root} = loaded;
        const topLevelNodes = props.hideRootNode ? root.children : [root];
        const topLevelAncestors = props.hideRootNode ? [{icon: root.icon, label: root.label}] : [];
        main = (
            <ul role="tree" className={style.tree} aria-multiselectable={props.allowDeselect ? true : undefined}>
                {topLevelNodes.map(topLevelNode => (
                    <TreeNode
                        // remount the tree on every search, so the expanded state is reset
                        key={`${loaded.searchTerm}|${loaded.narrowNodeTypeFilter}|${topLevelNode.nodeAggregateIdentifier}`}
                        treeNode={topLevelNode}
                        level={0}
                        ancestors={topLevelAncestors}
                        context={context}
                    />
                ))}
            </ul>
        );
    }

    const hasToolbar = props.options?.enableSearch || props.options?.enableNodeTypeFilter;

    return (
        <div className={cx(style.container, props.className)}>
            {hasToolbar ? (
                <div className={style.toolbar}>
                    {props.options?.enableSearch ? (
                        <div className={style.search}>
                            <Search initialValue={props.initialSearchTerm ?? ''} onChange={setSearchInput} />
                        </div>
                    ) : null}
                    {props.options?.enableNodeTypeFilter ? (
                        <div className={style.filter}>
                            <SelectNodeTypeFilter dataSource={props.dataSource} value={narrowNodeTypeFilter} onChange={setNarrowNodeTypeFilter} />
                        </div>
                    ) : null}
                </div>
            ) : null}
            <div className={style.scroll} aria-busy={isLoading}>
                {isReloading ? (
                    <div className={style.progress} role="status" aria-label={loadingLabel}><span /></div>
                ) : null}
                <div className={cx({[style.isReloading]: isReloading})}>{main}</div>
            </div>
        </div>
    );
};
