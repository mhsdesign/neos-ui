import {Editor} from './Editor';

describe('Editor', () => {
    test('loading state', () => {
        const editor = Editor.fromLoadingState(1);

        expect(editor.isLoading()).toBe(true);
        expect(editor.getReferences()).toStrictEqual({});
        expect(editor.getPropertySchema()).toStrictEqual({});
        expect(editor.getLoadingReferencesCount()).toBe(1);
        expect(editor.isReferencePropertyEditingOpen()).toBe(false);
        expect(editor.getChange('nodeid', 'myRef')).toBe(null);
    })

    test('load references', () => {
        const editor = Editor.fromLoadingState(1).withReferencesAndConfiguration(
            {
                'myTarget': {
                    targetNodeId: 'myTarget',
                    properties: null,
                    presentation: {
                        label: 'My Target',
                        breadcrumbs: [],
                        icon: 'question',
                        uri: 'node://myTarget'
                    }
                }
            },
            {},
            {}
        );

        expect(editor.isLoading()).toBe(false);
        expect(editor.getReferences()).toStrictEqual({
            'myTarget': {
                targetNodeId: 'myTarget',
                properties: null,
                presentation: {
                    label: 'My Target',
                    breadcrumbs: [],
                    icon: 'question',
                    uri: 'node://myTarget'
                }
            }
        });
        expect(editor.getPropertySchema()).toStrictEqual({});
        expect(editor.getLoadingReferencesCount()).toBe(1);
        expect(editor.isReferencePropertyEditingOpen()).toBe(false);
        expect(editor.getChange('nodeid', 'myRef')).toBe(null);
    })

    test('load references and queue change', () => {
        const editor = Editor.fromLoadingState(2).withReferencesAndConfiguration(
            {
                'myTarget': {
                    targetNodeId: 'myTarget',
                    properties: null,
                    presentation: {
                        label: 'My Target',
                        breadcrumbs: [],
                        icon: 'question',
                        uri: 'node://myTarget'
                    }
                },
                'mySecondTarget': {
                    targetNodeId: 'mySecondTarget',
                    properties: null,
                    presentation: {
                        label: 'My Target',
                        breadcrumbs: [],
                        icon: 'question',
                        uri: 'node://mySecondTarget'
                    }
                }
            },
            {},
            {}
        );
        expect(editor.isLoading()).toBe(false);
        expect(Object.keys(editor.getReferences())).toStrictEqual(['myTarget', 'mySecondTarget']);
        expect(editor.isReferencePropertyEditingOpen()).toBe(false);
        expect(editor.getChange('nodeid', 'myRef')).toBe(null);

        const editorNext = editor.withRemovedReference('myTarget');
        expect(editorNext).not.toBe(editor); // immutable

        expect(editorNext.isLoading()).toBe(false);
        expect(Object.keys(editorNext.getReferences())).toStrictEqual(['mySecondTarget']);
        expect(editorNext.isReferencePropertyEditingOpen()).toBe(false);
        expect(editorNext.getChange('nodeid', 'myRef')).toStrictEqual({
            'type': 'Neos.Neos.Ui:Reference',
            'subject': 'nodeid',
            'payload': {
                'referenceName': 'myRef',
                'serializedReferences': [{'properties': null, 'targetNodeId': 'mySecondTarget'}]
            }
        });
    })

    test('load references and que property change but dismiss', () => {
        let editor = Editor.fromLoadingState(2).withReferencesAndConfiguration(
            {
                'myTarget': {
                    targetNodeId: 'myTarget',
                    properties: null,
                    presentation: {
                        label: 'My Target',
                        breadcrumbs: [],
                        icon: 'question',
                        uri: 'node://myTarget'
                    }
                }
            },
            {},
            {
                myProperty: {
                    type: 'string'
                }
            }
        );
        expect(editor.isLoading()).toBe(false);
        expect(editor.isReferencePropertyEditingOpen()).toBe(false);
        expect(Object.keys(editor.getReferences())).toStrictEqual(['myTarget']);
        expect(editor.getPropertySchema()).toStrictEqual({
            myProperty: {
                type: 'string'
            }
        });

        editor = editor.withReferencePropertyEditing('myTarget');

        expect(editor.isLoading()).toBe(false);
        expect(editor.isReferencePropertyEditingOpen()).toBe(true);
        expect(editor.isReferencePropertyEditingDirty()).toBe(false);
        expect(Object.keys(editor.getReferences())).toStrictEqual(['myTarget']);
        expect(editor.getChange('nodeid', 'myRef')).toBe(null);

        expect(editor.getReferencePropertyValue('myProperty')).toBe(undefined);

        editor = editor.withReferenceProperty('myProperty', 'myPropertyValue');

        expect(editor.isReferencePropertyEditingOpen()).toBe(true);
        expect(editor.isReferencePropertyEditingDirty()).toBe(true);
        expect(editor.getReferencePropertyValue('myProperty')).toBe('myPropertyValue');

        editor = editor.withDismissedReferencePropertyEditing();
        expect(editor.isReferencePropertyEditingOpen()).toBe(false);
        expect(editor.isReferencePropertyEditingDirty()).toBe(false);
        expect(editor.getReferencePropertyValue('myProperty')).toBe(undefined);
        expect(editor.getReferences()).toStrictEqual({
            'myTarget': {
                targetNodeId: 'myTarget',
                properties: null,
                presentation: {
                    label: 'My Target',
                    breadcrumbs: [],
                    icon: 'question',
                    uri: 'node://myTarget'
                }
            }
        });
        expect(editor.getChange('nodeid', 'myRef')).toBe(null);
    })

    test('load references and queue property change and apply', () => {
        let editor = Editor.fromLoadingState(2).withReferencesAndConfiguration(
            {
                'myTarget': {
                    targetNodeId: 'myTarget',
                    properties: null,
                    presentation: {
                        label: 'My Target',
                        breadcrumbs: [],
                        icon: 'question',
                        uri: 'node://myTarget'
                    }
                }
            },
            {},
            {
                myProperty: {
                    type: 'string'
                }
            }
        );
        expect(editor.isLoading()).toBe(false);
        expect(editor.isReferencePropertyEditingOpen()).toBe(false);
        expect(Object.keys(editor.getReferences())).toStrictEqual(['myTarget']);
        expect(editor.getPropertySchema()).toStrictEqual({
            myProperty: {
                type: 'string'
            }
        });

        editor = editor.withReferencePropertyEditing('myTarget');

        expect(editor.isLoading()).toBe(false);
        expect(editor.isReferencePropertyEditingOpen()).toBe(true);
        expect(editor.isReferencePropertyEditingDirty()).toBe(false);
        expect(Object.keys(editor.getReferences())).toStrictEqual(['myTarget']);
        expect(editor.getChange('nodeid', 'myRef')).toBe(null);

        expect(editor.getReferencePropertyValue('myProperty')).toBe(undefined);

        editor = editor.withReferenceProperty('myProperty', 'myPropertyValue');

        expect(editor.isReferencePropertyEditingOpen()).toBe(true);
        expect(editor.isReferencePropertyEditingDirty()).toBe(true);
        expect(editor.getReferencePropertyValue('myProperty')).toBe('myPropertyValue');

        editor = editor.withAppliedReferencePropertyEditing();
        expect(editor.isReferencePropertyEditingOpen()).toBe(false);
        expect(editor.isReferencePropertyEditingDirty()).toBe(false);
        expect(editor.getReferencePropertyValue('myProperty')).toBe('myPropertyValue');
        expect(editor.getReferences()).toStrictEqual({
            'myTarget': {
                targetNodeId: 'myTarget',
                properties: {
                    'myProperty': 'myPropertyValue'
                },
                presentation: {
                    label: 'My Target',
                    breadcrumbs: [],
                    icon: 'question',
                    uri: 'node://myTarget'
                }
            }
        });
        expect(editor.getChange('nodeid', 'myRef')).toStrictEqual({
            'type': 'Neos.Neos.Ui:Reference',
            'subject': 'nodeid',
            'payload': {
                'referenceName': 'myRef',
                'serializedReferences': [{'properties': {'myProperty': 'myPropertyValue'}, 'targetNodeId': 'myTarget'}]
            }
        });
    })

    test('discard with pending changes will not show resolved presentation values', () => {
        let editor = Editor.fromLoadingState(1).withReferencesAndConfiguration(
            {
                'myTarget': {
                    targetNodeId: 'myTarget',
                    properties: null,
                    presentation: {
                        label: 'My Target',
                        breadcrumbs: [],
                        icon: 'question',
                        uri: 'node://myTarget'
                    }
                }
            },
            {},
            {}
        );

        editor = editor.withSelectedTargetNodeId('mySecondTarget');
        editor = editor.withDiscard();
        editor = editor.withAddedReferencePresentation({
            targetNodeId: 'mySecondTarget',
            properties: null,
            presentation: {
                label: 'mySecondTarget',
                breadcrumbs: [],
                icon: 'question',
                uri: 'node://mySecondTarget'
            }
        });

        expect(editor.getReferences()).toStrictEqual({
            'myTarget': {
                targetNodeId: 'myTarget',
                properties: null,
                presentation: {
                    label: 'My Target',
                    breadcrumbs: [],
                    icon: 'question',
                    uri: 'node://myTarget'
                }
            }
        });
    })

    test('discard without pending changes will not show resolved presentation values', () => {
        let editor = Editor.fromLoadingState(1).withReferencesAndConfiguration(
            {
                'myTarget': {
                    targetNodeId: 'myTarget',
                    properties: null,
                    presentation: {
                        label: 'My Target',
                        breadcrumbs: [],
                        icon: 'question',
                        uri: 'node://myTarget'
                    }
                }
            },
            {},
            {}
        );

        editor = editor.withSelectedTargetNodeId('mySecondTarget');
        editor = editor.withAddedReferencePresentation({
            targetNodeId: 'mySecondTarget',
            properties: null,
            presentation: {
                label: 'mySecondTarget',
                breadcrumbs: [],
                icon: 'question',
                uri: 'node://mySecondTarget'
            }
        });
        editor = editor.withDiscard();

        expect(editor.getReferences()).toStrictEqual({
            'myTarget': {
                targetNodeId: 'myTarget',
                properties: null,
                presentation: {
                    label: 'My Target',
                    breadcrumbs: [],
                    icon: 'question',
                    uri: 'node://myTarget'
                }
            }
        });
    })

    test('apply with pending changes will show resolved presentation values', () => {
        let editor = Editor.fromLoadingState(1).withReferencesAndConfiguration(
            {
                'myTarget': {
                    targetNodeId: 'myTarget',
                    properties: null,
                    presentation: {
                        label: 'My Target',
                        breadcrumbs: [],
                        icon: 'question',
                        uri: 'node://myTarget'
                    }
                }
            },
            {},
            {}
        );

        editor = editor.withSelectedTargetNodeId('mySecondTarget');
        editor = editor.withApply();
        editor = editor.withAddedReferencePresentation({
            targetNodeId: 'mySecondTarget',
            properties: null,
            presentation: {
                label: 'mySecondTarget',
                breadcrumbs: [],
                icon: 'question',
                uri: 'node://mySecondTarget'
            }
        });

        expect(editor.getReferences()).toStrictEqual({
            'myTarget': {
                targetNodeId: 'myTarget',
                properties: null,
                presentation: {
                    label: 'My Target',
                    breadcrumbs: [],
                    icon: 'question',
                    uri: 'node://myTarget'
                }
            },
            'mySecondTarget': {
                targetNodeId: 'mySecondTarget',
                properties: null,
                presentation: {
                    label: 'mySecondTarget',
                    breadcrumbs: [],
                    icon: 'question',
                    uri: 'node://mySecondTarget'
                }
            }
        });
    })

    test('apply without pending changes will show resolved presentation values', () => {
        let editor = Editor.fromLoadingState(1).withReferencesAndConfiguration(
            {
                'myTarget': {
                    targetNodeId: 'myTarget',
                    properties: null,
                    presentation: {
                        label: 'My Target',
                        breadcrumbs: [],
                        icon: 'question',
                        uri: 'node://myTarget'
                    }
                }
            },
            {},
            {}
        );

        editor = editor.withSelectedTargetNodeId('mySecondTarget');
        editor = editor.withAddedReferencePresentation({
            targetNodeId: 'mySecondTarget',
            properties: null,
            presentation: {
                label: 'mySecondTarget',
                breadcrumbs: [],
                icon: 'question',
                uri: 'node://mySecondTarget'
            }
        });
        editor = editor.withApply();

        expect(editor.getReferences()).toStrictEqual({
            'myTarget': {
                targetNodeId: 'myTarget',
                properties: null,
                presentation: {
                    label: 'My Target',
                    breadcrumbs: [],
                    icon: 'question',
                    uri: 'node://myTarget'
                }
            },
            'mySecondTarget': {
                targetNodeId: 'mySecondTarget',
                properties: null,
                presentation: {
                    label: 'mySecondTarget',
                    breadcrumbs: [],
                    icon: 'question',
                    uri: 'node://mySecondTarget'
                }
            }
        });
    })

    test('move reference and queue change', () => {
        const reference = (targetNodeId: string) => ({targetNodeId, properties: null, presentation: undefined});
        const editor = Editor.fromLoadingState(3).withReferencesAndConfiguration(
            {
                'a': reference('a'),
                'b': reference('b'),
                'c': reference('c')
            },
            {},
            {}
        ).withMovedReference(2, 0);

        expect(Object.keys(editor.getReferences())).toStrictEqual(['c', 'a', 'b']);
        expect(editor.getChange('nodeid', 'myRef')).toStrictEqual({
            type: 'Neos.Neos.Ui:Reference',
            subject: 'nodeid',
            payload: {
                referenceName: 'myRef',
                serializedReferences: [
                    {targetNodeId: 'c', properties: null},
                    {targetNodeId: 'a', properties: null},
                    {targetNodeId: 'b', properties: null}
                ]
            }
        });
    })

    test('replace references from picker and queue change', () => {
        const reference = (targetNodeId: string) => ({targetNodeId, properties: null, presentation: undefined});
        const editor = Editor.fromLoadingState(2).withReferencesAndConfiguration(
            {'a': reference('a'), 'b': reference('b')},
            {},
            {}
        ).withReferences({'b': reference('b'), 'c': reference('c')});

        expect(Object.keys(editor.getReferences())).toStrictEqual(['b', 'c']);
        expect(editor.getChange('nodeid', 'myRef')?.payload.serializedReferences).toStrictEqual([
            {targetNodeId: 'b', properties: null},
            {targetNodeId: 'c', properties: null}
        ]);
        expect(Object.keys(editor.withDiscard().getReferences())).toStrictEqual(['a', 'b']);
    })

    test('apply properties of several references and queue change', () => {
        const reference = (targetNodeId: string, properties: any) => ({targetNodeId, properties, presentation: undefined});
        const editor = Editor.fromLoadingState(3).withReferencesAndConfiguration(
            {'a': reference('a', null), 'b': reference('b', {note: 'old'}), 'c': reference('c', {note: 'keep'})},
            {},
            {note: {type: 'string'}}
        ).withReferencePropertyEditing('a').withAppliedPropertiesForReferences({
            'a': {note: 'new a'},
            'b': {note: 'new b'}
        });

        expect(editor.isReferencePropertyEditingOpen()).toBe(false);
        expect(editor.getChange('nodeid', 'myRef')?.payload.serializedReferences).toStrictEqual([
            {targetNodeId: 'a', properties: {note: 'new a'}},
            {targetNodeId: 'b', properties: {note: 'new b'}},
            {targetNodeId: 'c', properties: {note: 'keep'}}
        ]);
    })

    test('move reference out of bounds is ignored', () => {
        const editor = Editor.fromLoadingState(1).withReferencesAndConfiguration(
            {'a': {targetNodeId: 'a', properties: null, presentation: undefined}},
            {},
            {}
        );

        expect(editor.withMovedReference(0, 1)).toBe(editor);
        expect(editor.withMovedReference(0, 0)).toBe(editor);
        expect(editor.withMovedReference(3, 0)).toBe(editor);
    })
})
