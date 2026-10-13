import {IReference, IReferences} from '../References';
import {Change} from '@neos-project/neos-ui-backend-connector/src/Endpoints/Change';
import {IReferenceWithProperties} from '../References/References';

export class Editor {
    private constructor(
        private readonly data: {
            readonly isLocked: boolean;
            readonly isReferencePropertyEditingOpen: boolean;
            readonly selectedReferenceId: string;
            readonly initialReferencesCount: number;
            readonly initialValues: IReferences;
            readonly transientValues: IReferences;
            readonly transientReferencePropertyValues: IReferenceWithProperties;
            readonly constraints: any;
            readonly propertySchema: any;
        }
    ) {
    }

    public static fromLoadingState(initialReferencesCount: number): Editor {
        return new Editor({initialReferencesCount})
    }

    public withReferencesAndConfiguration(initialValues: IReferences, constraints: any, propertySchema: any): Editor {
        return new Editor({
            ...this.data,
            initialValues,
            constraints,
            propertySchema
        })
    }

    public withReferencePropertyEditing(referenceTargetId: string): Editor {
        return new Editor({
            ...this.data,
            isReferencePropertyEditingOpen: true,
            selectedReferenceId: referenceTargetId
        })
    }

    public withRemovedReference(referenceTargetId: string): Editor {
        const {[referenceTargetId]: _, ...otherReferences} = this.data.transientValues ?? this.data.initialValues;

        return new Editor({
            ...this.data,
            transientValues: otherReferences
        })
    }

    public withReferences(references: IReferences): Editor {
        return new Editor({
            ...this.data,
            transientValues: references
        })
    }

    public withMovedReference(fromIndex: number, toIndex: number): Editor {
        const entries = Object.entries(this.data.transientValues ?? this.data.initialValues ?? {});
        if (fromIndex === toIndex || !entries[fromIndex] || toIndex < 0 || toIndex >= entries.length) {
            return this;
        }
        const [moved] = entries.splice(fromIndex, 1);
        entries.splice(toIndex, 0, moved);

        // todo object key order is only reliable for non integer-like ids, see reference model rework
        return new Editor({
            ...this.data,
            transientValues: Object.fromEntries(entries)
        })
    }

    public withSelectedTargetNodeId(targetNodeId: string): Editor {
        const transientValues = this.data.transientValues ?? this.data.initialValues;
        if (transientValues[targetNodeId]) {
            return this;
        }
        return new Editor({
            ...this.data,
            transientValues: {
                ...transientValues,
                [targetNodeId]: {
                    targetNodeId,
                    properties: undefined,
                    presentation: undefined
                }
            }
        })
    }

    public withAddedReferencePresentation(targetNodeId: string, referencePresentation: IReference["presentation"]): Editor {
        // unapplied changes
        if (this.data.transientValues && Object.keys(this.data.transientValues).includes(targetNodeId)) {
            return new Editor({
                ...this.data,
                transientValues: {
                    ...this.data.transientValues,
                    [targetNodeId]: {
                        ...this.data.transientValues[targetNodeId],
                        presentation: referencePresentation
                    }
                }
            })
        }
        if (this.data.initialValues && Object.keys(this.data.initialValues).includes(targetNodeId)) {
            return new Editor({
                ...this.data,
                initialValues: {
                    ...this.data.initialValues,
                    [targetNodeId]: {
                        ...this.data.initialValues[targetNodeId],
                        presentation: referencePresentation
                    }
                }
            })
        }
        return this;
    }

    /**
     * Applies the properties of several references at once (the properties dialog can page through all references)
     */
    public withAppliedPropertiesForReferences(propertiesByTargetNodeId: Record<string, Record<string, unknown>>): Editor {
        const references = this.data.transientValues ?? this.data.initialValues ?? {};
        return new Editor({
            ...this.data,
            isReferencePropertyEditingOpen: false,
            transientReferencePropertyValues: undefined as any,
            transientValues: Object.fromEntries(Object.entries(references).map(([targetNodeId, reference]) => [
                targetNodeId,
                targetNodeId in propertiesByTargetNodeId
                    ? {...reference, properties: propertiesByTargetNodeId[targetNodeId]}
                    : reference
            ]))
        })
    }

    public getSelectedReferenceId(): string | undefined {
        return this.data.selectedReferenceId;
    }

    public withDismissedReferencePropertyEditing(): Editor {
        return new Editor({
            ...this.data,
            isReferencePropertyEditingOpen: false,
            transientReferencePropertyValues: undefined
        })
    }

    public withAppliedReferencePropertyEditing(): Editor {
        if (!this.data.transientReferencePropertyValues) {
            throw Error('Fatal invalid state');
        }
        return new Editor({
            ...this.data,
            isReferencePropertyEditingOpen: false,
            transientValues: Object.entries(this.data.transientValues ?? this.data.initialValues).reduce((carry, [targetNodeId, reference]) => {
                return {
                    ...carry,
                    [targetNodeId]: {
                        ...reference,
                        properties: this.data.transientReferencePropertyValues[targetNodeId].properties
                    }
                }
            }, {}),
            transientReferencePropertyValues: undefined
        })
    }

    public withReferenceProperty(propertyName: string, value: any): Editor {
        const transientReferencePropertyValues = this.data.transientReferencePropertyValues ?? this.data.transientValues ?? this.data.initialValues;

        return new Editor({
            ...this.data,
            transientReferencePropertyValues: {
                ...transientReferencePropertyValues,
                [this.data.selectedReferenceId]: {
                    ...transientReferencePropertyValues[this.data.selectedReferenceId],
                    properties: {
                        ...transientReferencePropertyValues[this.data.selectedReferenceId]?.properties,
                        [propertyName]: value
                    }
                }
            }
        })
    }

    public withApply(): Editor {
        return new Editor({
            initialValues: this.data.transientValues ?? this.data.initialValues,
            constraints: this.data.constraints,
            propertySchema: this.data.propertySchema
        })
    }

    public withDiscard(): Editor {
        return new Editor({
            initialValues: this.data.initialValues,
            constraints: this.data.constraints,
            propertySchema: this.data.propertySchema
        })
    }

    public isReferencePropertyEditingOpen(): boolean {
        return this.data.isReferencePropertyEditingOpen ?? false;
    }

    public isLoading(): boolean {
        return !this.data.initialValues
    }

    public isReferencePropertyEditingDirty(): boolean {
        return Boolean(this.data.transientReferencePropertyValues)
    }

    public getLoadingReferencesCount(): number {
        return this.data.initialReferencesCount;
    }

    public getReferences(): IReferences {
        return this.data.transientValues ?? this.data.initialValues ?? {};
    }

    public getReferenceInPropertyEditing(): IReference | undefined {
        return this.data.isReferencePropertyEditingOpen
            ? this.getReferences()[this.data.selectedReferenceId]
            : undefined;
    }

    public getConstraints(): any {
        return this.data.constraints ?? {};
    }

    public getPropertySchema(): any {
        return this.data.propertySchema ?? {};
    }

    public getReferencePropertyValue(propertyName: string): any {
        return (this.data.transientReferencePropertyValues ?? this.data.transientValues ?? this.data.initialValues)[this.data.selectedReferenceId]?.properties?.[propertyName]
    }

    public getSelectedNodeIds(): string[]
    {
        // todo memo value
        return Object.keys(this.data.transientValues ?? this.data.initialValues ?? {})
    }

    public getChange(nodeAddress: string, referenceName: string): Change | null {
        if (this.data.isReferencePropertyEditingOpen) {
            return null;
        }
        if (!this.data.transientValues) {
            return null;
        }
        return {
            type: 'Neos.Neos.Ui:Reference',
            subject: nodeAddress,
            payload: {
                referenceName,
                serializedReferences: Object.values(this.data.transientValues).map((({targetNodeId, properties}) => ({
                    targetNodeId,
                    properties
                })))
            }
        };
    }
}
