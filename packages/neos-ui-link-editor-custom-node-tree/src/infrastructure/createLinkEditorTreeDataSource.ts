/*
 * This file is part of the Neos.Neos.Ui package.
 *
 * (c) Contributors of the Neos Project - www.neos.io
 *
 * This package is Open Source Software. For the full copyright and license
 * information, please view the LICENSE file which was distributed with this
 * source code.
 */
import {TreeDataSource} from '../domain';
import {getChildrenForTreeNode, getNodeTypeFilterOptions, getTree} from './http';

export function createLinkEditorTreeDataSource(query: {
    workspaceName: string;
    legacyDimensionValues: Record<string, string[]>;
    startingPoint: string;
    loadingDepth: number;
    baseNodeTypeFilter: string;
    linkableNodeTypes?: string[];
    selectedNodeId?: string;
}): TreeDataSource {
    return {
        async getTree({searchTerm, narrowNodeTypeFilter}) {
            const result = await getTree({...query, searchTerm, narrowNodeTypeFilter});
            if ('error' in result) {
                throw result.error;
            }
            return result.success.root;
        },
        async getChildren(treeNodeId) {
            const result = await getChildrenForTreeNode({
                workspaceName: query.workspaceName,
                legacyDimensionValues: query.legacyDimensionValues,
                treeNodeId,
                nodeTypeFilter: query.baseNodeTypeFilter,
                linkableNodeTypes: query.linkableNodeTypes
            });
            if ('error' in result) {
                throw result.error;
            }
            return result.success.children;
        },
        async getNodeTypeFilterOptions() {
            const result = await getNodeTypeFilterOptions({baseNodeTypeFilter: query.baseNodeTypeFilter});
            if ('error' in result) {
                throw result.error;
            }
            return result.success.options;
        }
    };
}
