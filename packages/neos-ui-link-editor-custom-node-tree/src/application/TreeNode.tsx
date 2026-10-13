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

import {Icon} from '@neos-project/react-ui-components';
import {translate} from '@neos-project/neos-ui-i18n';

import {TreeDataSource, TreeNodeDTO} from '../domain';
import style from './style.module.css';

export type TreeNodeBreadcrumb = {icon: string; label: string};

export type SelectionState = 'selected' | 'newlySelected' | null;

export interface TreeContext {
    dataSource: TreeDataSource;
    searchTerm: string;
    isFiltered: boolean;
    canSelect: boolean;
    allowDeselect: boolean;
    getSelectionState(nodeId: string): SelectionState;
    containsSelectedNode(treeNode: TreeNodeDTO): boolean;
    onSelect(treeNode: TreeNodeDTO, ancestors: TreeNodeBreadcrumb[]): void;
    onDeselect(nodeId: string): void;
}

const INDENTATION_PX = 24;

const HighlightedLabel: React.FC<{label: string; searchTerm: string}> = ({label, searchTerm}) => {
    const start = searchTerm ? label.toLowerCase().indexOf(searchTerm.toLowerCase()) : -1;
    if (start === -1) {
        return <>{label}</>;
    }
    const end = start + searchTerm.length;
    return <>{label.slice(0, start)}<mark className={style.match}>{label.slice(start, end)}</mark>{label.slice(end)}</>;
};

const NodeIcon: React.FC<{treeNode: TreeNodeDTO}> = ({treeNode}) => (
    <span className={style.rowIcon}>
        <Icon icon={treeNode.icon} />
        {treeNode.hasScheduledDisabledState ? (
            <span className={cx(style.visibilityBadge, {[style.visibilityBadgeIsDisabled]: treeNode.isDisabled})}><Icon icon="clock" /></span>
        ) : treeNode.isDisabled ? (
            <span className={cx(style.visibilityBadge, style.visibilityBadgeIsDisabled)}><Icon icon="times" /></span>
        ) : null}
    </span>
);

export const TreeNode: React.FC<{
    treeNode: TreeNodeDTO;
    level: number;
    ancestors: TreeNodeBreadcrumb[];
    context: TreeContext;
}> = ({treeNode, level, ancestors, context}) => {
    const [loadedChildren, setLoadedChildren] = React.useState<TreeNodeDTO[] | null>(null);
    const [isLoadingChildren, setIsLoadingChildren] = React.useState(false);
    const [isExpanded, setIsExpanded] = React.useState(() =>
        context.isFiltered || (treeNode.children.length > 0 && (level < 1 || context.containsSelectedNode(treeNode)))
    );

    const children = loadedChildren ?? treeNode.children;
    const hasChildren = children.length > 0 || treeNode.hasUnloadedChildren;
    const selectionState = context.getSelectionState(treeNode.nodeAggregateIdentifier);
    const isSelectable = treeNode.isLinkable && selectionState === null && context.canSelect;
    const isDeselectable = selectionState !== null && context.allowDeselect;

    const toggle = async () => {
        if (!isExpanded && treeNode.hasUnloadedChildren && children.length === 0) {
            setIsLoadingChildren(true);
            try {
                setLoadedChildren(await context.dataSource.getChildren(treeNode.nodeAggregateIdentifier));
            } finally {
                setIsLoadingChildren(false);
            }
        }
        setIsExpanded(expanded => !expanded);
    };

    // the row (de)selects the node, expanding is done via the chevron if the node itself is selectable
    const handleRowClick = () => {
        if (isDeselectable) {
            context.onDeselect(treeNode.nodeAggregateIdentifier);
        } else if (isSelectable) {
            context.onSelect(treeNode, ancestors);
        } else if (hasChildren && selectionState === null) {
            toggle();
        }
    };

    const ownBreadcrumb = {icon: treeNode.icon, label: treeNode.label};

    return (
        <li role="treeitem" aria-expanded={hasChildren ? isExpanded : undefined} aria-selected={selectionState !== null}>
            <div
                className={cx(style.row, {
                    [style.rowIsSelected]: selectionState === 'selected',
                    [style.rowIsNewlySelected]: selectionState === 'newlySelected',
                    [style.rowIsNotSelectable]: !treeNode.isLinkable,
                    [style.rowIsClickable]: isSelectable || isDeselectable
                })}
                style={{paddingLeft: `calc(var(--spacing-Half) + ${level * INDENTATION_PX}px)`}}
                title={treeNode.nodeTypeLabel ? translate(treeNode.nodeTypeLabel as any, treeNode.nodeTypeLabel) : undefined}
                onClick={handleRowClick}
            >
                {hasChildren ? (
                    <button
                        type="button"
                        className={style.chevron}
                        aria-label={isExpanded ? translate('Neos.Neos:Main:collapse', 'Collapse') : translate('Neos.Neos:Main:expand', 'Expand')}
                        onClick={event => {
                            event.stopPropagation();
                            toggle();
                        }}
                    >
                        <Icon icon={isLoadingChildren ? 'spinner' : (isExpanded ? 'chevron-down' : 'chevron-right')} spin={isLoadingChildren} />
                    </button>
                ) : <span className={style.chevron} />}
                <NodeIcon treeNode={treeNode} />
                <span className={style.rowLabel}>
                    <HighlightedLabel label={treeNode.label} searchTerm={context.searchTerm} />
                </span>
                {selectionState === 'selected' ? (
                    <span className={style.state}><Icon icon="check" />{translate('Neos.Neos.Ui:Main:nodeTree.selected', 'Selected')}</span>
                ) : null}
                {selectionState === 'newlySelected' ? (
                    <span className={cx(style.state, style.stateIsNew)}><Icon icon="check" />{translate('Neos.Neos.Ui:Main:nodeTree.added', 'Added')}</span>
                ) : null}
            </div>
            {isExpanded && children.length > 0 ? (
                <ul role="group" className={style.group}>
                    {children.map(child => (
                        <TreeNode
                            key={child.nodeAggregateIdentifier}
                            treeNode={child}
                            level={level + 1}
                            ancestors={[...ancestors, ownBreadcrumb]}
                            context={context}
                        />
                    ))}
                </ul>
            ) : null}
        </li>
    );
};
