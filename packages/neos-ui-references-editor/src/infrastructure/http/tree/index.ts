import {DimensionCombination} from '@neos-project/neos-ts-interfaces';
import {TreeDataSource, getNodeTypeFilterOptions} from '@neos-project/neos-ui-link-editor-custom-node-tree';
import {getTree} from './getTree';
import {getChildrenForTreeNode} from './getChildrenForTreeNode';

/**
 * Feeds the node tree (shared with the link editor) from the references editor endpoints,
 * which allow multiple selected nodes; the node type filter options are the same as for the link editor
 */
export function createReferencesTreeDataSource(query: {
    workspaceName: string;
    dimensionValues: DimensionCombination;
    startingPoint: string;
    loadingDepth: number;
    baseNodeTypeFilter: string;
    allowedNodeTypes: string[];
    selectedNodeIds: string[];
}): TreeDataSource {
    return {
        async getTree({searchTerm, narrowNodeTypeFilter}) {
            const result = await getTree({
                workspaceName: query.workspaceName,
                legacyDimensionValues: query.dimensionValues,
                startingPoint: query.startingPoint,
                loadingDepth: query.loadingDepth,
                baseNodeTypeFilter: query.baseNodeTypeFilter,
                allowedNodeTypes: query.allowedNodeTypes,
                selectedNodeIds: query.selectedNodeIds,
                narrowNodeTypeFilter,
                searchTerm
            });
            if ('error' in result) {
                throw result.error;
            }
            return result.success.root;
        },
        async getChildren(treeNodeId) {
            const result = await getChildrenForTreeNode({
                workspaceName: query.workspaceName,
                legacyDimensionValues: query.dimensionValues,
                treeNodeId,
                nodeTypeFilter: query.baseNodeTypeFilter,
                allowedNodeTypes: query.allowedNodeTypes
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
