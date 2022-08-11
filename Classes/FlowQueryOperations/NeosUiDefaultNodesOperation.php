<?php

namespace Neos\Neos\Ui\FlowQueryOperations;

/*
 * This file is part of the Neos.Neos.Ui package.
 *
 * (c) Contributors of the Neos Project - www.neos.io
 *
 * This package is Open Source Software. For the full copyright and license
 * information, please view the LICENSE file which was distributed with this
 * source code.
 */

use Neos\ContentRepository\Projection\ContentGraph\ContentSubgraphIdentity;
use Neos\ContentRepository\SharedModel\NodeType\NodeTypeConstraintParser;
use Neos\ContentRepositoryRegistry\ContentRepositoryRegistry;
use Neos\Eel\FlowQuery\FlowQuery;
use Neos\Eel\FlowQuery\Operations\AbstractOperation;
use Neos\ContentRepository\NodeAccess\NodeAccessorManager;
use Neos\ContentRepository\SharedModel\NodeAddressFactory;
use Neos\ContentRepository\SharedModel\VisibilityConstraints;
use Neos\ContentRepository\Projection\ContentGraph\NodeInterface;
use Neos\Flow\Annotations as Flow;

class NeosUiDefaultNodesOperation extends AbstractOperation
{
    /**
     * {@inheritdoc}
     *
     * @var string
     */
    protected static $shortName = 'neosUiDefaultNodes';

    /**
     * {@inheritdoc}
     *
     * @var integer
     */
    protected static $priority = 110;

    /**
     * @Flow\Inject
     * @var NodeAccessorManager
     */
    protected $nodeAccessorManager;

    /**
     * @Flow\Inject
     * @var ContentRepositoryRegistry
     */
    protected $contentRepositoryRegistry;

    /**
     * {@inheritdoc}
     *
     * @param array<int,mixed> $context (or array-like object) onto which this operation should be applied
     * @return boolean TRUE if the operation can be applied onto the $context, FALSE otherwise
     */
    public function canEvaluate($context)
    {
        return isset($context[0]) && ($context[0] instanceof NodeInterface);
    }

    /**
     * {@inheritdoc}
     *
     * @param FlowQuery<int,mixed> $flowQuery the FlowQuery object
     * @param array<int,mixed> $arguments the arguments for this operation
     * @return void
     */
    public function evaluate(FlowQuery $flowQuery, array $arguments)
    {
        /** @var array<int,mixed> $context */
        $context = $flowQuery->getContext();
        /** @var NodeInterface $siteNode */
        /** @var NodeInterface $documentNode */
        list($siteNode, $documentNode) = $context;
        /** @var string[] $toggledNodes Node Addresses */
        list($baseNodeType, $loadingDepth, $toggledNodes, $clipboardNodesContextPaths) = $arguments;

        $contentRepository = $this->contentRepositoryRegistry->get($documentNode->getSubgraphIdentity()->contentRepositoryIdentifier);
        $nodeTypeConstraintParser = NodeTypeConstraintParser::create($contentRepository->getNodeTypeManager());

        $baseNodeTypeConstraints = $nodeTypeConstraintParser->parseFilterString($baseNodeType);

        $nodeAccessor = $this->nodeAccessorManager->accessorFor(
            $documentNode->getSubgraphIdentity()
        );

        // Collect all parents of documentNode up to siteNode
        $parents = [];
        $currentNode = $nodeAccessor->findParentNode($documentNode);
        if ($currentNode) {
            $currentNodePath = $nodeAccessor->findNodePath($currentNode);
            $siteNodePath = $nodeAccessor->findNodePath($siteNode);
            $parentNodeIsUnderneathSiteNode = str_starts_with((string)$currentNodePath, (string)$siteNodePath);
            while ($currentNode instanceof NodeInterface
                && !$currentNode->getNodeAggregateIdentifier()->equals($siteNode->getNodeAggregateIdentifier())
                && $parentNodeIsUnderneathSiteNode
            ) {
                $parents[] = $currentNode->getNodeAggregateIdentifier()->jsonSerialize();
                $currentNode = $nodeAccessor->findParentNode($currentNode);
            }
        }

        $nodes = [
            ((string)$siteNode->getNodeAggregateIdentifier()) => $siteNode
        ];

        $gatherNodesRecursively = function (
            &$nodes,
            NodeInterface $baseNode,
            $level = 0
        ) use (
            &$gatherNodesRecursively,
            $baseNodeTypeConstraints,
            $loadingDepth,
            $toggledNodes,
            $parents,
            $nodeAccessor
        ) {
            $contentRepository = $this->contentRepositoryRegistry->get($baseNode->getSubgraphIdentity()->contentRepositoryIdentifier);
            $baseNodeAddress = NodeAddressFactory::create($contentRepository)->createFromNode($baseNode);

            if ($level < $loadingDepth || // load all nodes within loadingDepth
                $loadingDepth === 0 || // unlimited loadingDepth
                // load toggled nodes
                in_array($baseNodeAddress->serializeForUri(), $toggledNodes) ||
                // load children of all parents of documentNode
                in_array((string)$baseNode->getNodeAggregateIdentifier(), $parents)
            ) {
                foreach ($nodeAccessor->findChildNodes($baseNode, $baseNodeTypeConstraints) as $childNode) {
                    $nodes[(string)$childNode->getNodeAggregateIdentifier()] = $childNode;
                    $gatherNodesRecursively($nodes, $childNode, $level + 1);
                }
            }
        };
        $gatherNodesRecursively($nodes, $siteNode);

        if (!isset($nodes[(string)$documentNode->getNodeAggregateIdentifier()])) {
            $nodes[(string)$documentNode->getNodeAggregateIdentifier()] = $documentNode;
        }

        $contentRepository = $this->contentRepositoryRegistry->get($documentNode->getSubgraphIdentity()->contentRepositoryIdentifier);
        foreach ($clipboardNodesContextPaths as $clipboardNodeContextPath) {
            // TODO: does not work across multiple CRs yet.
            $clipboardNodeAddress = NodeAddressFactory::create($contentRepository)->createFromUriString($clipboardNodeContextPath);
            $clipboardNode = $this->nodeAccessorManager->accessorFor(
                new ContentSubgraphIdentity(
                    $siteNode->getSubgraphIdentity()->contentRepositoryIdentifier,
                    $clipboardNodeAddress->contentStreamIdentifier,
                    $clipboardNodeAddress->dimensionSpacePoint,
                    VisibilityConstraints::withoutRestrictions()
                )
            )->findByIdentifier($clipboardNodeAddress->nodeAggregateIdentifier);
            if ($clipboardNode && !array_key_exists((string)$clipboardNode->getNodeAggregateIdentifier(), $nodes)) {
                $nodes[(string)$clipboardNode->getNodeAggregateIdentifier()] = $clipboardNode;
            }
        }

        /* TODO: we might use the Subtree as this may be more efficient
         - but the logic above mirrors the old behavior better.
        if ($loadingDepth === 0) {
            throw new \RuntimeException('TODO: Loading Depth 0 not supported');
        }
        $subtree = $nodeAccessor->findSubtrees([$siteNode], $loadingDepth, $nodeTypeConstraints);
        $subtree = $subtree->getChildren()[0];
        $this->flattenSubtreeToNodeList($nodeAccessor, $subtree, $nodes);*/

        $flowQuery->setContext($nodes);
    }

    /**
     * @param array<string,NodeInterface> &$nodes
     */
    /*
    private function flattenSubtreeToNodeList(
        NodeAccessorInterface $nodeAccessor,
        SubtreeInterface $subtree,
        array &$nodes
    ): void {
        $currentNode = $subtree->getNode();
        if (is_null($currentNode)) {
            return;
        }

        $nodes[(string)$currentNode->getNodeAggregateIdentifier()] = $currentNode;

        foreach ($subtree->getChildren() as $childSubtree) {
            $this->flattenSubtreeToNodeList($nodeAccessor, $childSubtree, $nodes);
        }
    }*/
}
