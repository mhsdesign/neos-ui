/*
 * This file is part of the Neos.Neos.Ui package.
 *
 * (c) Contributors of the Neos Project - www.neos.io
 *
 * This package is Open Source Software. For the full copyright and license
 * information, please view the LICENSE file which was distributed with this
 * source code.
 */
import {NodeTypeFilterOptionDTO} from './NodeTypeFilterOptionDTO';
import {TreeNodeDTO} from './TreeNodeDTO';

/**
 * The tree is shared by the link editor and the references editor, which each query their own endpoints
 */
export interface TreeDataSource {
    getTree(query: {searchTerm: string; narrowNodeTypeFilter: string}): Promise<TreeNodeDTO>;
    getChildren(treeNodeId: string): Promise<TreeNodeDTO[]>;
    getNodeTypeFilterOptions(): Promise<NodeTypeFilterOptionDTO[]>;
}
