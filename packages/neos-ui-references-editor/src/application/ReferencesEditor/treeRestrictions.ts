// todo make configurable via editor options
export const STARTING_POINT = '/<Neos.Neos:Sites>/';

/**
 * Which nodes the picker offers, derived from the reference constraints (or the legacy editorOptions.nodeTypes)
 */
export function getTreeRestrictions(constraints: any, options: any): {
    allowedNodeTypes: string[];
    baseNodeTypeFilter: string;
    maxItems?: number;
} {
    const fromConstraints = Object.entries(constraints?.nodeTypes ?? {})
        .filter(([nodeTypeName, isAllowed]) => nodeTypeName !== '*' && isAllowed === true)
        .map(([nodeTypeName]) => nodeTypeName);
    const allowedNodeTypes: string[] = fromConstraints.length > 0 ? fromConstraints : (options?.nodeTypes ?? []);
    return {
        allowedNodeTypes,
        // restrict the tree to documents and the referencable node types, so that e.g. content collections are not shown
        baseNodeTypeFilter: allowedNodeTypes.length > 0 ? ['Neos.Neos:Document', ...allowedNodeTypes].join(',') : '',
        maxItems: constraints?.maxItems
    };
}
