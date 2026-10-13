import * as React from 'react';

import {useLatestState} from '@neos-project/framework-observable-react';
import {State} from '@neos-project/framework-observable';
import {Editor} from '../../domain/Editor/Editor';
import {RelationPropertiesDialog, RelationPropertiesDialogProps} from './RelationPropertiesDialog';

export {RelationPropertiesDialog} from './RelationPropertiesDialog';

/**
 * The relation properties dialog bound to the inspector editor state
 */
export const ReferencesPropertiesDialog: React.FC<{
    editor$: State<Editor>;
    title: string;
    source: RelationPropertiesDialogProps['source'];
}> = ({editor$, title, source}) => {
    const editor = useLatestState(editor$);

    const dismiss = React.useCallback(() => editor$.update(editor => editor.withDismissedReferencePropertyEditing()), [editor$]);
    const apply = React.useCallback(
        (propertiesByTargetNodeId: Record<string, Record<string, unknown>>) => editor$.update(editor => editor.withAppliedPropertiesForReferences(propertiesByTargetNodeId)),
        [editor$]
    );

    return (
        <RelationPropertiesDialog
            title={title}
            source={source}
            references={Object.values(editor.getReferences())}
            initialTargetNodeId={editor.getSelectedReferenceId() ?? ''}
            propertySchema={editor.getPropertySchema()}
            onApply={apply}
            onCancel={dismiss}
        />
    );
};
