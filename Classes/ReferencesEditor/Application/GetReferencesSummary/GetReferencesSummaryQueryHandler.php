<?php

/*
 * This file is part of the Neos.Neos.Ui package.
 *
 * (c) Contributors of the Neos Project - www.neos.io
 *
 * This package is Open Source Software. For the full copyright and license
 * information, please view the LICENSE file which was distributed with this
 * source code.
 */

declare(strict_types=1);

namespace Neos\Neos\Ui\ReferencesEditor\Application\GetReferencesSummary;

use GuzzleHttp\Psr7\Uri;
use Neos\ContentRepository\Core\Projection\ContentGraph\Filter\FindReferencesFilter;
use Neos\ContentRepository\Core\Projection\ContentGraph\Node;
use Neos\ContentRepositoryRegistry\ContentRepositoryRegistry;
use Neos\Flow\Annotations as Flow;
use Neos\Utility\Arrays;
use Neos\Neos\Domain\SubtreeTagging\NeosVisibilityConstraints;
use Neos\Neos\Ui\LinkEditor\Infrastructure\ESCR\NodeService;
use Neos\Neos\Ui\LinkEditor\Infrastructure\ESCR\NodeServiceFactory;

/**
 * @internal
 */
#[Flow\Scope("singleton")]
final class GetReferencesSummaryQueryHandler
{
    #[Flow\Inject]
    protected NodeServiceFactory $nodeServiceFactory;

    #[Flow\Inject]
    protected ContentRepositoryRegistry $contentRepositoryRegistry;

    /**
     * @var array<string,array<string,mixed>>
     */
    #[Flow\InjectConfiguration(path: "userInterface.inspector.dataTypes", package: "Neos.Neos")]
    protected array $dataTypesDefaultConfiguration;

    /**
     * @var array<string,array<string,mixed>>
     */
    #[Flow\InjectConfiguration(path: "userInterface.inspector.editors", package: "Neos.Neos")]
    protected array $editorDefaultConfiguration;

    public function handle(GetReferencesSummaryQuery $query): GetReferencesSummaryQueryResult
    {
        $nodeService = $this->nodeServiceFactory->create(
            contentRepositoryId: $query->contentRepositoryId,
            workspaceName: $query->workspaceName,
            dimensionSpacePoint: $query->dimensionSpacePoint,
        );

        $sourceNode = $nodeService->requireNodeById($query->nodeId);
        $sourceNodeType = $nodeService->requireNodeTypeByName($sourceNode->nodeTypeName);
        $sourceReferenceSchema = $sourceNodeType->getConfiguration("references." . $query->referenceName->value);

        $contentRepository = $this->contentRepositoryRegistry->get($query->contentRepositoryId);
        $subgraph = $contentRepository->getContentGraph($query->workspaceName)->getSubgraph($query->dimensionSpacePoint, NeosVisibilityConstraints::excludeRemoved());
        $referenceNodes = $subgraph->findReferences($query->nodeId, FindReferencesFilter::create(referenceName: $query->referenceName));

        $references = [];
        foreach ($referenceNodes as $reference) {
            $referencesNode = $reference->node;
            $referenceNodeType = $nodeService->requireNodeTypeByName($referencesNode->nodeTypeName);
            $references[] = new Reference(
                icon: $referenceNodeType->getConfiguration('ui.icon') ?? 'questionmark',
                label: $nodeService->getLabelForNode($referencesNode),
                uri: new Uri('node://' . $referencesNode->aggregateId->value),
                breadcrumbs: $this->createBreadcrumbsForNode($nodeService, $referencesNode),
                properties: $reference->properties?->serialized()->getPlainValues(),
            );
        }

        return new GetReferencesSummaryQueryResult(
            references: $references,
            propertySchema: isset($sourceReferenceSchema["properties"])
                ? $this->applyDefaultEditorConfiguration($sourceReferenceSchema["properties"])
                : null,
            constraints: $sourceReferenceSchema["constraints"] ?? null,
        );
    }

    /**
     * The properties of references are not processed by the DefaultPropertyEditorPostprocessor,
     * so the editor is resolved the same way here: editor defaults, then data type defaults, then the property configuration
     *
     * @todo move into the DefaultPropertyEditorPostprocessor of Neos.Neos
     * @param array<string,mixed> $propertiesConfiguration
     * @return array<string,mixed>
     */
    private function applyDefaultEditorConfiguration(array $propertiesConfiguration): array
    {
        foreach ($propertiesConfiguration as $propertyName => $propertyConfiguration) {
            if (!is_array($propertyConfiguration) || !isset($propertyConfiguration['type'])) {
                continue;
            }
            $inspectorConfiguration = $propertyConfiguration['ui']['inspector'] ?? [];
            if (!is_array($inspectorConfiguration)) {
                // explicitly hidden via "inspector: false"
                continue;
            }
            $defaultConfigurationFromDataType = $this->dataTypesDefaultConfiguration[$propertyConfiguration['type']] ?? [];
            $editor = $inspectorConfiguration['editor'] ?? $defaultConfigurationFromDataType['editor'] ?? null;
            if ($editor === null) {
                continue;
            }

            $mergedInspectorConfiguration = Arrays::arrayMergeRecursiveOverrule(
                Arrays::arrayMergeRecursiveOverrule($this->editorDefaultConfiguration[$editor] ?? [], $defaultConfigurationFromDataType),
                $inspectorConfiguration
            );
            $mergedInspectorConfiguration['editor'] = $editor;
            $propertiesConfiguration[$propertyName]['ui']['inspector'] = $mergedInspectorConfiguration;
        }
        return $propertiesConfiguration;
    }

    private function createBreadcrumbsForNode(NodeService $nodeService, Node $node): Breadcrumbs
    {
        $items = [];

        while ($node) {
            /** @var Node $node */
            $items[] = $this->createBreadcrumbForNode($nodeService, $node);
            $node = $nodeService->findParentNode($node);
        }

        $items = array_slice($items, 0, -1);
        $items = array_reverse($items);

        return new Breadcrumbs(...$items);
    }

    private function createBreadcrumbForNode(NodeService $nodeService, Node $node): Breadcrumb
    {
        $nodeType = $nodeService->requireNodeTypeByName($node->nodeTypeName);

        return new Breadcrumb(
            icon: $nodeType->getConfiguration('ui.icon') ?? 'questionmark',
            label: $nodeService->getLabelForNode($node),
        );
    }
}
