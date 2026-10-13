import * as React from 'react';

import {useLatestState} from '@neos-project/framework-observable-react';
import {State} from '@neos-project/framework-observable';
import {Editor} from '../../domain/Editor/Editor';
import {RelationPropertiesDialog} from './RelationPropertiesDialog';

export {RelationPropertiesDialog} from './RelationPropertiesDialog';

/**
 * The relation properties dialog bound to the inspector editor state
 */
export const ReferencesPropertiesDialog: React.FC<{
    editor$: State<Editor>;
    source: {icon: string; label: string};
}> = ({editor$, source}) => {
    const editor = useLatestState(editor$);
    const reference = editor.getReferenceInPropertyEditing();

    const dismiss = React.useCallback(() => editor$.update(editor => editor.withDismissedReferencePropertyEditing()), [editor$]);
    const apply = React.useCallback((properties: Record<string, unknown>) => editor$.update(editor =>
        Object.entries(properties)
            .reduce((currentEditor, [propertyName, value]) => currentEditor.withReferenceProperty(propertyName, value), editor)
            .withAppliedReferencePropertyEditing()
    ), [editor$]);

    return (
        <RelationPropertiesDialog
            source={source}
            target={reference?.presentation}
            propertySchema={editor.getPropertySchema()}
            initialProperties={reference?.properties}
            onApply={apply}
            onCancel={dismiss}
        />
    );
};
